import type { WorkoutPlan, WorkoutSession } from '../domain/workoutSession';
import type { WorkoutOutcome } from './appState';

export function createWorkoutOutcome(
  plan: WorkoutPlan,
  session: WorkoutSession,
  now = Date.now(),
): WorkoutOutcome {
  return {
    id: `${plan.id}-${session.startedAt}`,
    planId: plan.id,
    name: plan.name,
    startedAt: session.startedAt,
    completedAt: session.completedAt ?? now,
    totalSets: session.sets.length,
    exercises: plan.exercises
      .map((exercise) => ({
        exerciseId: exercise.id,
        name: exercise.name,
        sets: session.sets.filter((set) => set.exerciseId === exercise.id).length,
        reps: exercise.targetReps,
        weightLb: exercise.weightLb,
      }))
      .filter((exercise) => exercise.sets > 0),
  };
}
