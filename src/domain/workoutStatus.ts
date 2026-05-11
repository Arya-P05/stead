import { getActiveExercise, getRestRemainingSeconds } from "./workoutSession";
import type { WorkoutPlan, WorkoutSession } from "./workoutSession";

export type WorkoutStatus = {
  title: string;
  meta: string;
  action: string;
  restSeconds: number;
  isComplete: boolean;
};

export function getWorkoutStatus(
  plan: WorkoutPlan,
  session: WorkoutSession,
  now: number,
): WorkoutStatus {
  const restSeconds = getRestRemainingSeconds(session, now);

  if (session.completedAt !== null) {
    return {
      title: plan.name,
      meta: `done · ${session.sets.length} sets`,
      action: "done",
      restSeconds: 0,
      isComplete: true,
    };
  }

  if (restSeconds > 0) {
    return {
      title: plan.name,
      meta: `rest · ${restSeconds}s`,
      action: "log set",
      restSeconds,
      isComplete: false,
    };
  }

  return {
    title: plan.name,
    meta: `next up · ${getActiveExercise(plan, session)?.name ?? "done"}`,
    action: "log set",
    restSeconds: 0,
    isComplete: false,
  };
}
