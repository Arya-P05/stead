import type { WorkoutExercise, WorkoutPlan } from "../domain/workoutSession";

export type WorkoutPresetId = "push" | "pull" | "legs" | "upper";

type WorkoutPreset = {
  id: WorkoutPresetId;
  name: string;
  exercises: Array<Omit<WorkoutExercise, "id"> & { id: string }>;
};

const presets: WorkoutPreset[] = [
  {
    id: "push",
    name: "push day",
    exercises: [
      exercise("bench", "bench", 4, 8, 60, 120),
      exercise("incline-db-press", "incline db", 4, 10, 50, 90),
      exercise("cable-fly", "cable fly", 3, 12, 25, 75),
      exercise("tricep-pushdown", "tricep pushdown", 3, 15, 50, 60),
      exercise("lat-raise", "lat raise", 3, 12, 15, 60),
    ],
  },
  {
    id: "pull",
    name: "pull day",
    exercises: [
      exercise("pull-up", "pull up", 4, 8, 0, 120),
      exercise("barbell-row", "barbell row", 4, 8, 95, 120),
      exercise("lat-pulldown", "lat pulldown", 3, 10, 100, 90),
      exercise("rear-delt-fly", "rear delt fly", 3, 15, 20, 60),
      exercise("db-curl", "db curl", 3, 12, 25, 60),
    ],
  },
  {
    id: "legs",
    name: "legs",
    exercises: [
      exercise("squat", "squat", 4, 6, 135, 150),
      exercise("rdl", "rdl", 4, 8, 115, 120),
      exercise("leg-press", "leg press", 3, 12, 180, 90),
      exercise("leg-curl", "leg curl", 3, 12, 70, 75),
      exercise("calf-raise", "calf raise", 4, 15, 90, 60),
    ],
  },
  {
    id: "upper",
    name: "upper",
    exercises: [
      exercise("incline-db-press", "incline db", 3, 10, 50, 90),
      exercise("chest-supported-row", "chest row", 3, 10, 70, 90),
      exercise("shoulder-press", "shoulder press", 3, 8, 40, 90),
      exercise("lat-pulldown", "lat pulldown", 3, 10, 100, 75),
      exercise("arms", "arms", 3, 12, 30, 60),
    ],
  },
];

export function getWorkoutPresets() {
  return presets.map(({ id, name, exercises }) => ({
    id,
    name,
    exerciseCount: exercises.length,
    setCount: exercises.reduce((sum, item) => sum + item.targetSets, 0),
  }));
}

export function createWorkoutPlanFromPreset(
  presetId: WorkoutPresetId,
  createdAt = Date.now(),
): WorkoutPlan {
  const preset = presets.find((item) => item.id === presetId) ?? presets[0];

  return {
    id: `workout-plan-${preset.id}-${createdAt}`,
    name: preset.name,
    exercises: preset.exercises.map((item) => ({
      ...item,
      id: `${preset.id}-${item.id}-${createdAt}`,
    })),
  };
}

function exercise(
  id: string,
  name: string,
  targetSets: number,
  targetReps: number,
  weightLb: number,
  restSeconds: number,
): WorkoutPreset["exercises"][number] {
  return {
    id,
    name,
    targetSets,
    targetReps,
    weightLb,
    restSeconds,
  };
}
