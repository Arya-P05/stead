import {
  addDailyOutcome,
  addStepSample,
  addWorkoutOutcome,
  createInitialAppState,
  type AppState,
  type DailyItem,
  type DailyOutcome,
  type DailyPlan,
  type ManagedWorkoutPlan,
  type StepSample,
  type WorkoutOutcome,
} from "../data/appState";
import type { WorkoutExercise } from "../domain/workoutSession";
import { supabase } from "./supabaseClient";
import type {
  DailyItemRow,
  DailyOutcomeRow,
  DailyPlanRow,
  SteadDatabase,
  StepSampleRow,
  WorkoutExerciseRow,
  WorkoutOutcomeRow,
  WorkoutPlanRow,
} from "./syncTypes";

type SyncQueryResult<T = unknown> = {
  data: T | null;
  error: Error | null;
};

type SyncClient = {
  auth: {
    getUser: () => Promise<{
      data: { user: { id: string } | null };
      error: Error | null;
    }>;
  };
  from: (table: string) => {
    upsert: (
      rows: object[],
      options: { onConflict: string },
    ) => PromiseLike<SyncQueryResult>;
    select: (columns: string) => {
      eq: (
        column: string,
        value: string,
      ) => PromiseLike<SyncQueryResult<unknown[]>>;
    };
  };
};

export type SyncStatus = "idle" | "syncing" | "synced" | "signedOut" | "error";

export type SyncResult =
  | {
      status: "synced";
      state: AppState;
      syncedAt: number;
    }
  | {
      status: "signedOut";
    }
  | {
      status: "error";
      message: string;
    };

type RemoteSnapshot = {
  workoutPlans: WorkoutPlanRow[];
  workoutExercises: WorkoutExerciseRow[];
  workoutOutcomes: WorkoutOutcomeRow[];
  dailyPlans: DailyPlanRow[];
  dailyItems: DailyItemRow[];
  dailyOutcomes: DailyOutcomeRow[];
  stepSamples: StepSampleRow[];
};

export async function syncAppState(
  state: AppState,
  client: SyncClient | null = supabase as SyncClient | null,
): Promise<SyncResult> {
  if (!client) {
    return { status: "signedOut" };
  }

  try {
    const {
      data: { user },
      error,
    } = await client.auth.getUser();

    if (error) {
      throw error;
    }

    if (!user) {
      return { status: "signedOut" };
    }

    await pushAppState(client, user.id, state);
    const remote = await pullRemoteSnapshot(client, user.id);

    return {
      status: "synced",
      state: mergeRemoteSnapshot(state, remote),
      syncedAt: Date.now(),
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "sync failed",
    };
  }
}

export async function pushAppState(
  client: SyncClient,
  userId: string,
  state: AppState,
) {
  await upsertRows(client, "profiles", [{ id: userId }], "id");
  await upsertRows(
    client,
    "workout_plans",
    state.workoutPlans.map((plan) => workoutPlanToRow(userId, plan)),
    "user_id,local_id",
  );
  await upsertRows(
    client,
    "workout_exercises",
    state.workoutPlans.flatMap((plan) =>
      plan.exercises.map((exercise, position) =>
        workoutExerciseToRow(userId, plan.id, exercise, position),
      ),
    ),
    "user_id,plan_local_id,local_id",
  );
  await upsertRows(
    client,
    "workout_outcomes",
    state.workoutOutcomes.map((outcome) =>
      workoutOutcomeToRow(userId, outcome),
    ),
    "user_id,local_id",
  );
  await upsertRows(
    client,
    "daily_plans",
    state.dailyPlans.map((plan) => dailyPlanToRow(userId, plan)),
    "user_id,date",
  );
  await upsertRows(
    client,
    "daily_items",
    state.dailyItems.map((item) => dailyItemToRow(userId, item)),
    "user_id,local_id",
  );
  await upsertRows(
    client,
    "daily_outcomes",
    state.dailyOutcomes.map((outcome) => dailyOutcomeToRow(userId, outcome)),
    "user_id,date",
  );
  await upsertRows(
    client,
    "step_samples",
    state.stepSamples.map((sample) => stepSampleToRow(userId, sample)),
    "user_id,captured_at",
  );
}

export async function pullRemoteSnapshot(
  client: SyncClient,
  userId: string,
): Promise<RemoteSnapshot> {
  const [
    workoutPlans,
    workoutExercises,
    workoutOutcomes,
    dailyPlans,
    dailyItems,
    dailyOutcomes,
    stepSamples,
  ] = await Promise.all([
    selectRows(client, "workout_plans", userId),
    selectRows(client, "workout_exercises", userId),
    selectRows(client, "workout_outcomes", userId),
    selectRows(client, "daily_plans", userId),
    selectRows(client, "daily_items", userId),
    selectRows(client, "daily_outcomes", userId),
    selectRows(client, "step_samples", userId),
  ]);

  return {
    workoutPlans,
    workoutExercises,
    workoutOutcomes,
    dailyPlans,
    dailyItems,
    dailyOutcomes,
    stepSamples,
  };
}

export function mergeRemoteSnapshot(
  localState: AppState,
  remote: RemoteSnapshot,
): AppState {
  const plans = rowsToWorkoutPlans(
    remote.workoutPlans,
    remote.workoutExercises,
  );
  const dailyPlans = remote.dailyPlans.map(rowToDailyPlan);
  const remoteItems = remote.dailyItems.map(rowToDailyItem);
  const remoteOutcomes = remote.workoutOutcomes.map(rowToWorkoutOutcome);
  const remoteDailyOutcomes = remote.dailyOutcomes.map(rowToDailyOutcome);
  const remoteStepSamples = remote.stepSamples.map(rowToStepSample);
  const activePlan =
    plans.find((plan) => plan.id === localState.activeWorkoutPlanId) ??
    plans.find((plan) => plan.archivedAt === null);

  let merged: AppState = {
    ...localState,
    workoutPlans: mergeBy(
      localState.workoutPlans,
      plans,
      (plan) => plan.id,
      (plan) => plan.updatedAt,
    ),
    dailyPlans: mergeBy(
      localState.dailyPlans,
      dailyPlans,
      (plan) => plan.date,
      (plan) => plan.updatedAt,
    ),
    dailyItems: mergeBy(
      localState.dailyItems,
      remoteItems,
      (item) => item.id,
      (item) => item.updatedAt,
    ),
  };

  merged = remoteOutcomes.reduce(addWorkoutOutcome, merged);
  merged = remoteDailyOutcomes.reduce(addDailyOutcome, merged);
  merged = remoteStepSamples.reduce(addStepSample, merged);

  return {
    ...merged,
    activeWorkoutPlanId: activePlan?.id ?? merged.activeWorkoutPlanId,
    workoutPlan: activePlan ?? merged.workoutPlan,
  };
}

export function workoutPlanToRow(
  userId: string,
  plan: ManagedWorkoutPlan,
): Partial<WorkoutPlanRow> {
  return {
    user_id: userId,
    local_id: plan.id,
    name: plan.name,
    archived_at: toIsoOrNull(plan.archivedAt),
    created_at: toIso(plan.createdAt),
    updated_at: toIso(plan.updatedAt),
  };
}

export function workoutExerciseToRow(
  userId: string,
  planId: string,
  exercise: WorkoutExercise,
  position: number,
): Partial<WorkoutExerciseRow> {
  return {
    user_id: userId,
    plan_local_id: planId,
    local_id: exercise.id,
    name: exercise.name,
    position,
    target_sets: exercise.targetSets,
    target_reps: exercise.targetReps ?? null,
    weight_lb: exercise.weightLb ?? null,
    rest_seconds: exercise.restSeconds,
  };
}

export function workoutOutcomeToRow(
  userId: string,
  outcome: WorkoutOutcome,
): Partial<WorkoutOutcomeRow> {
  return {
    user_id: userId,
    local_id: outcome.id,
    plan_local_id: outcome.planId,
    name: outcome.name,
    started_at: toIso(outcome.startedAt),
    completed_at: toIso(outcome.completedAt),
    total_sets: outcome.totalSets,
    exercises: outcome.exercises,
    created_at: toIso(outcome.startedAt),
    updated_at: toIso(outcome.completedAt),
  };
}

export function dailyPlanToRow(
  userId: string,
  plan: DailyPlan,
): Partial<DailyPlanRow> {
  return {
    user_id: userId,
    date: plan.date,
    created_at: toIso(plan.createdAt),
    updated_at: toIso(plan.updatedAt),
  };
}

export function dailyItemToRow(
  userId: string,
  item: DailyItem,
): Partial<DailyItemRow> {
  return {
    user_id: userId,
    local_id: item.id,
    date: item.date,
    title: item.title,
    kind: item.kind,
    workout_plan_local_id: item.workoutPlanId ?? null,
    position: item.position,
    completed_at: toIsoOrNull(item.completedAt),
    created_at: toIso(item.createdAt),
    updated_at: toIso(item.updatedAt),
  };
}

export function dailyOutcomeToRow(
  userId: string,
  outcome: DailyOutcome,
): Partial<DailyOutcomeRow> {
  return {
    user_id: userId,
    date: outcome.date,
    completed_items: outcome.completedItems,
    planned_items: outcome.plannedItems,
    steps: outcome.steps,
    focus_minutes: outcome.focusMinutes,
    note: outcome.note ?? null,
  };
}

export function stepSampleToRow(
  userId: string,
  sample: StepSample,
): Partial<StepSampleRow> {
  return {
    user_id: userId,
    captured_at: toIso(sample.capturedAt),
    steps: sample.steps,
    source: sample.source,
  };
}

function rowsToWorkoutPlans(
  planRows: WorkoutPlanRow[],
  exerciseRows: WorkoutExerciseRow[],
): ManagedWorkoutPlan[] {
  return planRows.map((row) => ({
    id: row.local_id,
    name: row.name,
    exercises: exerciseRows
      .filter((exercise) => exercise.plan_local_id === row.local_id)
      .sort((a, b) => a.position - b.position)
      .map(rowToWorkoutExercise),
    createdAt: fromIso(row.created_at),
    updatedAt: fromIso(row.updated_at),
    archivedAt: fromIsoOrNull(row.archived_at),
  }));
}

function rowToWorkoutExercise(row: WorkoutExerciseRow): WorkoutExercise {
  return {
    id: row.local_id,
    name: row.name,
    targetSets: row.target_sets,
    targetReps: row.target_reps ?? undefined,
    weightLb: row.weight_lb ?? undefined,
    restSeconds: row.rest_seconds,
  };
}

function rowToDailyPlan(row: DailyPlanRow): DailyPlan {
  return {
    date: row.date,
    itemIds: [],
    createdAt: fromIso(row.created_at),
    updatedAt: fromIso(row.updated_at),
  };
}

function rowToDailyItem(row: DailyItemRow): DailyItem {
  return {
    id: row.local_id,
    date: row.date,
    title: row.title,
    kind: row.kind,
    workoutPlanId: row.workout_plan_local_id ?? undefined,
    position: row.position,
    completedAt: fromIsoOrNull(row.completed_at),
    createdAt: fromIso(row.created_at),
    updatedAt: fromIso(row.updated_at),
  };
}

function rowToWorkoutOutcome(row: WorkoutOutcomeRow): WorkoutOutcome {
  return {
    id: row.local_id,
    planId: row.plan_local_id,
    name: row.name,
    startedAt: fromIso(row.started_at),
    completedAt: fromIso(row.completed_at),
    totalSets: row.total_sets,
    exercises: row.exercises,
  };
}

function rowToDailyOutcome(row: DailyOutcomeRow): DailyOutcome {
  return {
    date: row.date,
    completedItems: row.completed_items,
    plannedItems: row.planned_items,
    steps: row.steps,
    focusMinutes: row.focus_minutes,
    note: row.note ?? undefined,
  };
}

function rowToStepSample(row: StepSampleRow): StepSample {
  return {
    capturedAt: fromIso(row.captured_at),
    steps: row.steps,
    source: row.source,
  };
}

function mergeBy<T>(
  localItems: T[],
  remoteItems: T[],
  keyFor: (item: T) => string,
  versionFor: (item: T) => number,
) {
  const items = new Map<string, T>();

  for (const item of localItems) {
    items.set(keyFor(item), item);
  }

  for (const item of remoteItems) {
    const key = keyFor(item);
    const current = items.get(key);

    if (!current || versionFor(item) >= versionFor(current)) {
      items.set(key, item);
    }
  }

  return Array.from(items.values());
}

async function upsertRows(
  client: SyncClient,
  table: keyof SteadDatabase["public"]["Tables"],
  rows: object[],
  onConflict: string,
) {
  if (rows.length === 0) {
    return;
  }

  const { error } = await client.from(table).upsert(rows, { onConflict });

  if (error) {
    throw error;
  }
}

async function selectRows<T extends keyof SteadDatabase["public"]["Tables"]>(
  client: SyncClient,
  table: T,
  userId: string,
): Promise<SteadDatabase["public"]["Tables"][T]["Row"][]> {
  const { data, error } = await client
    .from(table)
    .select("*")
    .eq("user_id", userId);

  if (error) {
    throw error;
  }

  return (data ?? []) as SteadDatabase["public"]["Tables"][T]["Row"][];
}

function toIso(timestamp: number) {
  return new Date(timestamp).toISOString();
}

function toIsoOrNull(timestamp: number | null) {
  return timestamp === null ? null : toIso(timestamp);
}

function fromIso(timestamp: string) {
  return new Date(timestamp).getTime();
}

function fromIsoOrNull(timestamp: string | null) {
  return timestamp === null ? null : fromIso(timestamp);
}

export const emptyRemoteSnapshot: RemoteSnapshot = {
  workoutPlans: [],
  workoutExercises: [],
  workoutOutcomes: [],
  dailyPlans: [],
  dailyItems: [],
  dailyOutcomes: [],
  stepSamples: [],
};

export function createSyncableInitialState() {
  return createInitialAppState();
}
