import type { WorkoutPlan } from "../domain/workoutSession";

export type AddPlanLift = {
  id?: string;
  name: string;
  reps?: number;
  sets?: number;
};

export type AddPlanDraft = {
  createdVia: "describe" | "snap" | "write";
  kind?: "strength" | "muscle" | "general health" | "endurance";
  lifts: AddPlanLift[];
  name: string;
};

const DEFAULT_REPS = 10;
const DEFAULT_REST_SECONDS = 60;
const DEFAULT_SETS = 3;

export function createWorkoutPlanFromAddPlanDraft(
  draft: AddPlanDraft,
  now: number,
): WorkoutPlan {
  const normalizedName = normalizeLabel(draft.name) || "push day";
  const lifts = draft.lifts
    .map((lift) => ({
      ...lift,
      name: normalizeLabel(lift.name),
    }))
    .filter((lift) => lift.name.length > 0);

  return {
    id: `workout-plan-${now}`,
    name: normalizedName,
    exercises: lifts.map((lift, index) => ({
      id: lift.id ?? `${slugify(lift.name)}-${now}-${index + 1}`,
      name: lift.name,
      targetSets: normalizePositiveInt(lift.sets, DEFAULT_SETS),
      targetReps: normalizePositiveInt(lift.reps, DEFAULT_REPS),
      restSeconds: DEFAULT_REST_SECONDS,
    })),
  };
}

export function canSaveAddPlanDraft(draft: AddPlanDraft) {
  return draft.lifts.some((lift) => normalizeLabel(lift.name).length > 0);
}

function normalizeLabel(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizePositiveInt(value: number | undefined, fallback: number) {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(1, Math.round(value));
}

function slugify(value: string) {
  return (
    normalizeLabel(value)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "lift"
  );
}
