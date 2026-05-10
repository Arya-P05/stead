import type { WorkoutExercise, WorkoutPlan } from '../domain/workoutSession';

export function createDefaultWorkoutPlan(): WorkoutPlan {
  return {
    id: 'push-day',
    name: 'push day',
    exercises: [
      {
        id: 'incline-db-press',
        name: 'incline dumbbell press',
        targetSets: 4,
        targetReps: 10,
        weightLb: 50,
        restSeconds: 90,
      },
      {
        id: 'shoulder-press',
        name: 'shoulder press',
        targetSets: 3,
        targetReps: 10,
        weightLb: 40,
        restSeconds: 90,
      },
      {
        id: 'cable-fly',
        name: 'cable fly',
        targetSets: 3,
        targetReps: 12,
        weightLb: 25,
        restSeconds: 60,
      },
      {
        id: 'tricep-pushdown',
        name: 'tricep pushdown',
        targetSets: 3,
        targetReps: 15,
        weightLb: 35,
        restSeconds: 60,
      },
      {
        id: 'lat-raise',
        name: 'lat raise',
        targetSets: 3,
        targetReps: 12,
        weightLb: 15,
        restSeconds: 45,
      },
    ],
  };
}

export function updateExercise(
  plan: WorkoutPlan,
  exerciseId: string,
  patch: Partial<WorkoutExercise>,
): WorkoutPlan {
  return {
    ...plan,
    exercises: plan.exercises.map((exercise) =>
      exercise.id === exerciseId
        ? {
            ...exercise,
            ...patch,
            targetSets: clampInt(patch.targetSets ?? exercise.targetSets, 1),
            targetReps: clampInt(patch.targetReps ?? exercise.targetReps ?? 1, 1),
            restSeconds: clampInt(patch.restSeconds ?? exercise.restSeconds, 15),
            weightLb: clampInt(patch.weightLb ?? exercise.weightLb ?? 0, 0),
          }
        : exercise,
    ),
  };
}

function clampInt(value: number, min: number) {
  return Math.max(min, Math.round(value));
}
