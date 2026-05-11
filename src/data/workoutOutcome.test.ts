import { completeSet, startWorkoutSession } from "../domain/workoutSession";
import { createWorkoutOutcome } from "./workoutOutcome";
import type { WorkoutPlan } from "../domain/workoutSession";

const plan: WorkoutPlan = {
  id: "push-day",
  name: "push day",
  exercises: [
    {
      id: "incline-db-press",
      name: "incline dumbbell press",
      targetSets: 2,
      targetReps: 10,
      weightLb: 50,
      restSeconds: 90,
    },
    {
      id: "cable-fly",
      name: "cable fly",
      targetSets: 1,
      targetReps: 12,
      weightLb: 25,
      restSeconds: 60,
    },
  ],
};

describe("createWorkoutOutcome", () => {
  it("summarizes completed sets by exercise", () => {
    const first = completeSet(startWorkoutSession(plan, 1000), plan, 2000);
    const second = completeSet(first, plan, 93000);
    const done = completeSet(second, plan, 94000);

    expect(createWorkoutOutcome(plan, done)).toEqual({
      id: "push-day-1000",
      planId: "push-day",
      name: "push day",
      startedAt: 1000,
      completedAt: 94000,
      totalSets: 3,
      exercises: [
        {
          exerciseId: "incline-db-press",
          name: "incline dumbbell press",
          sets: 2,
          reps: 10,
          weightLb: 50,
        },
        {
          exerciseId: "cable-fly",
          name: "cable fly",
          sets: 1,
          reps: 12,
          weightLb: 25,
        },
      ],
    });
  });

  it("uses the latest timestamp when the session is unfinished", () => {
    const session = completeSet(startWorkoutSession(plan, 1000), plan, 2000);

    expect(createWorkoutOutcome(plan, session, 5000).completedAt).toBe(5000);
  });

  it("uses logged reps and weight when they differ from the plan", () => {
    const session = completeSet(startWorkoutSession(plan, 1000), plan, 2000, {
      reps: 8,
      weightLb: 55,
    });

    expect(createWorkoutOutcome(plan, session).exercises[0]).toMatchObject({
      reps: 8,
      weightLb: 55,
    });
  });
});
