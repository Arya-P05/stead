import type { WorkoutSession } from "../domain/workoutSession";
import type { WorkoutPlan } from "../domain/workoutSession";
import { createDefaultWorkoutPlan } from "./workoutPlan";

export const CURRENT_APP_STATE_VERSION = 3;

export type DailyOutcome = {
  date: string;
  completedItems: number;
  plannedItems: number;
  steps: number;
  focusMinutes: number;
  note?: string;
};

export type DailyItemKind = "task" | "workout";

export type DailyItem = {
  id: string;
  date: string;
  title: string;
  kind: DailyItemKind;
  workoutPlanId?: string;
  position: number;
  completedAt: number | null;
  createdAt: number;
  updatedAt: number;
};

export type DailyPlan = {
  date: string;
  itemIds: string[];
  createdAt: number;
  updatedAt: number;
};

export type WorkoutExerciseOutcome = {
  exerciseId: string;
  name: string;
  sets: number;
  reps?: number;
  weightLb?: number;
};

export type WorkoutOutcome = {
  id: string;
  planId: string;
  name: string;
  startedAt: number;
  completedAt: number;
  totalSets: number;
  exercises: WorkoutExerciseOutcome[];
};

export type ExerciseWeight = {
  exerciseId: string;
  weightLb: number;
  updatedAt: number;
};

export type StepSample = {
  capturedAt: number;
  steps: number;
  source: "health";
};

export type AppState = {
  version: typeof CURRENT_APP_STATE_VERSION;
  dailyOutcomes: DailyOutcome[];
  workoutOutcomes: WorkoutOutcome[];
  activeWorkoutSession: WorkoutSession | null;
  exerciseWeights: Record<string, ExerciseWeight>;
  stepSamples: StepSample[];
  workoutPlan: WorkoutPlan;
  dailyPlans: DailyPlan[];
  dailyItems: DailyItem[];
};

export function createInitialAppState(): AppState {
  return {
    version: CURRENT_APP_STATE_VERSION,
    dailyOutcomes: [],
    workoutOutcomes: [],
    activeWorkoutSession: null,
    exerciseWeights: {},
    stepSamples: [],
    workoutPlan: createDefaultWorkoutPlan(),
    dailyPlans: [],
    dailyItems: [],
  };
}

export function addDailyOutcome(
  state: AppState,
  outcome: DailyOutcome,
): AppState {
  return {
    ...state,
    dailyOutcomes: [
      outcome,
      ...state.dailyOutcomes.filter((stored) => stored.date !== outcome.date),
    ].sort((a, b) => b.date.localeCompare(a.date)),
  };
}

export function addWorkoutOutcome(
  state: AppState,
  outcome: WorkoutOutcome,
): AppState {
  return {
    ...state,
    workoutOutcomes: [
      outcome,
      ...state.workoutOutcomes.filter((stored) => stored.id !== outcome.id),
    ].sort((a, b) => b.startedAt - a.startedAt),
  };
}

export function hasCompletedWorkout(state: AppState, planId: string) {
  return state.workoutOutcomes.some((outcome) => outcome.planId === planId);
}

export function hasCompletedWorkoutOnDate(
  state: AppState,
  planId: string,
  date: string,
) {
  return state.workoutOutcomes.some(
    (outcome) =>
      outcome.planId === planId &&
      formatDateKey(new Date(outcome.completedAt)) === date,
  );
}

export function saveActiveWorkoutSession(
  state: AppState,
  session: WorkoutSession,
): AppState {
  return {
    ...state,
    activeWorkoutSession: session,
  };
}

export function clearActiveWorkoutSession(state: AppState): AppState {
  return {
    ...state,
    activeWorkoutSession: null,
  };
}

export function saveWorkoutPlan(
  state: AppState,
  workoutPlan: WorkoutPlan,
): AppState {
  return {
    ...state,
    workoutPlan,
  };
}

export function upsertExerciseWeight(
  state: AppState,
  weight: ExerciseWeight,
): AppState {
  const current = state.exerciseWeights[weight.exerciseId];

  if (current && current.updatedAt > weight.updatedAt) {
    return state;
  }

  return {
    ...state,
    exerciseWeights: {
      ...state.exerciseWeights,
      [weight.exerciseId]: weight,
    },
  };
}

export function addStepSample(state: AppState, sample: StepSample): AppState {
  return {
    ...state,
    stepSamples: [
      sample,
      ...state.stepSamples.filter(
        (stored) => stored.capturedAt !== sample.capturedAt,
      ),
    ].sort((a, b) => b.capturedAt - a.capturedAt),
  };
}

export function getDailyItemsForDate(state: AppState, date: string) {
  return state.dailyItems
    .filter((item) => item.date === date)
    .sort((a, b) => a.position - b.position);
}

export function addDailyItem(
  state: AppState,
  item: Omit<
    DailyItem,
    "id" | "position" | "completedAt" | "createdAt" | "updatedAt"
  > & {
    id?: string;
    position?: number;
    completedAt?: number | null;
    createdAt?: number;
    updatedAt?: number;
  },
): AppState {
  const now = item.updatedAt ?? item.createdAt ?? Date.now();
  const existingItems = getDailyItemsForDate(state, item.date);
  const nextItem: DailyItem = {
    id: item.id ?? createLocalId("day-item"),
    date: item.date,
    title: item.title.trim(),
    kind: item.kind,
    workoutPlanId: item.workoutPlanId,
    position: item.position ?? existingItems.length,
    completedAt: item.completedAt ?? null,
    createdAt: item.createdAt ?? now,
    updatedAt: now,
  };

  return upsertDailyPlan(
    {
      ...state,
      dailyItems: [
        nextItem,
        ...state.dailyItems.filter((stored) => stored.id !== nextItem.id),
      ].sort((a, b) => b.date.localeCompare(a.date) || a.position - b.position),
    },
    nextItem.date,
  );
}

export function updateDailyItem(
  state: AppState,
  itemId: string,
  patch: Partial<Pick<DailyItem, "title" | "kind" | "workoutPlanId">>,
  updatedAt = Date.now(),
): AppState {
  return {
    ...state,
    dailyItems: state.dailyItems.map((item) =>
      item.id === itemId
        ? {
            ...item,
            ...patch,
            title: patch.title?.trim() ?? item.title,
            updatedAt,
          }
        : item,
    ),
  };
}

export function completeDailyItem(
  state: AppState,
  itemId: string,
  completedAt = Date.now(),
): AppState {
  return {
    ...state,
    dailyItems: state.dailyItems.map((item) =>
      item.id === itemId
        ? {
            ...item,
            completedAt,
            updatedAt: completedAt,
          }
        : item,
    ),
  };
}

export function deleteDailyItem(state: AppState, itemId: string): AppState {
  const item = state.dailyItems.find((dailyItem) => dailyItem.id === itemId);
  const nextItems = state.dailyItems.filter(
    (dailyItem) => dailyItem.id !== itemId,
  );

  if (!item) {
    return state;
  }

  return upsertDailyPlan(
    {
      ...state,
      dailyItems: resequenceDailyItems(nextItems, item.date),
    },
    item.date,
  );
}

export function reorderDailyItem(
  state: AppState,
  itemId: string,
  direction: -1 | 1,
): AppState {
  const item = state.dailyItems.find((dailyItem) => dailyItem.id === itemId);

  if (!item) {
    return state;
  }

  const items = getDailyItemsForDate(state, item.date);
  const index = items.findIndex((dailyItem) => dailyItem.id === itemId);
  const nextIndex = index + direction;

  if (index < 0 || nextIndex < 0 || nextIndex >= items.length) {
    return state;
  }

  const reordered = [...items];
  const [moved] = reordered.splice(index, 1);
  reordered.splice(nextIndex, 0, moved);

  return upsertDailyPlan(
    {
      ...state,
      dailyItems: [
        ...state.dailyItems.filter((dailyItem) => dailyItem.date !== item.date),
        ...reordered.map((dailyItem, position) => ({
          ...dailyItem,
          position,
          updatedAt: Date.now(),
        })),
      ],
    },
    item.date,
  );
}

function upsertDailyPlan(state: AppState, date: string): AppState {
  const items = getDailyItemsForDate(state, date);
  const existing = state.dailyPlans.find((plan) => plan.date === date);
  const now = Date.now();
  const plan: DailyPlan = {
    date,
    itemIds: items.map((item) => item.id),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  return {
    ...state,
    dailyPlans: [
      plan,
      ...state.dailyPlans.filter((dailyPlan) => dailyPlan.date !== date),
    ].sort((a, b) => b.date.localeCompare(a.date)),
  };
}

function resequenceDailyItems(items: DailyItem[], date: string) {
  let position = 0;

  return items.map((item) =>
    item.date === date
      ? {
          ...item,
          position: position++,
          updatedAt: Date.now(),
        }
      : item,
  );
}

function createLocalId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
