import {
  addRestTime,
  completeSet,
  getActiveExercise,
  getExerciseProgress,
  getRestRemainingSeconds,
  selectExercise,
  skipRest,
  startWorkoutSession,
} from "./workoutSession";
import type { WorkoutPlan } from "./workoutSession";

const plan: WorkoutPlan = {
  id: "upper-push",
  name: "upper push",
  exercises: [
    {
      id: "incline-db-press",
      name: "incline dumbbell press",
      targetSets: 3,
      restSeconds: 90,
    },
    {
      id: "shoulder-press",
      name: "shoulder press",
      targetSets: 2,
      restSeconds: 75,
    },
  ],
};

describe("workout session", () => {
  it("starts on the first exercise with no completed sets", () => {
    const session = startWorkoutSession(plan, 1000);

    expect(session).toEqual({
      planId: "upper-push",
      startedAt: 1000,
      activeExerciseIndex: 0,
      completedAt: null,
      restEndsAt: null,
      sets: [],
    });
    expect(getActiveExercise(plan, session)?.name).toBe(
      "incline dumbbell press",
    );
  });

  it("logs a set and starts rest for the active exercise", () => {
    const session = completeSet(startWorkoutSession(plan, 1000), plan, 1200);

    expect(session.sets).toEqual([
      {
        exerciseId: "incline-db-press",
        completedAt: 1200,
        setNumber: 1,
        reps: undefined,
        weightLb: undefined,
      },
    ]);
    expect(session.restEndsAt).toBe(91200);
    expect(session.activeExerciseIndex).toBe(0);
  });

  it("stores actual reps and weight for a completed set", () => {
    const session = completeSet(startWorkoutSession(plan, 1000), plan, 1200, {
      reps: 8,
      weightLb: 55,
    });

    expect(session.sets[0]).toMatchObject({
      reps: 8,
      weightLb: 55,
    });
  });

  it("reports exercise progress for the overview", () => {
    const first = completeSet(startWorkoutSession(plan, 1000), plan, 1200);
    const second = completeSet(first, plan, 92000);
    const third = completeSet(second, plan, 183000);

    expect(getExerciseProgress(plan, third)).toEqual([
      {
        exerciseId: "incline-db-press",
        completedSets: 3,
        targetSets: 3,
        complete: true,
      },
      {
        exerciseId: "shoulder-press",
        completedSets: 0,
        targetSets: 2,
        complete: false,
      },
    ]);
  });

  it("selects an unfinished exercise for set logging", () => {
    const session = selectExercise(startWorkoutSession(plan, 1000), plan, 1);

    expect(session.activeExerciseIndex).toBe(1);
    expect(session.restEndsAt).toBeNull();
    expect(getActiveExercise(plan, session)?.id).toBe("shoulder-press");
  });

  it("does not select a completed exercise", () => {
    const first = completeSet(startWorkoutSession(plan, 1000), plan, 1200);
    const second = completeSet(first, plan, 92000);
    const third = completeSet(second, plan, 183000);

    expect(selectExercise(third, plan, 0)).toBe(third);
  });

  it("advances after the target sets are completed", () => {
    const one = completeSet(startWorkoutSession(plan, 1000), plan, 1200);
    const two = completeSet(one, plan, 92000);
    const three = completeSet(two, plan, 183000);

    expect(three.activeExerciseIndex).toBe(1);
    expect(three.restEndsAt).toBeNull();
    expect(getActiveExercise(plan, three)?.name).toBe("shoulder press");
  });

  it("marks the session done after the final target set", () => {
    const first = completeSet(startWorkoutSession(plan, 1000), plan, 1200);
    const second = completeSet(first, plan, 92000);
    const third = completeSet(second, plan, 183000);
    const fourth = completeSet(third, plan, 184000);
    const done = completeSet(fourth, plan, 260000);

    expect(done.completedAt).toBe(260000);
    expect(done.activeExerciseIndex).toBe(2);
    expect(done.restEndsAt).toBeNull();
    expect(getActiveExercise(plan, done)).toBeNull();
  });

  it("does not log more sets after completion", () => {
    const first = completeSet(startWorkoutSession(plan, 1000), plan, 1200);
    const second = completeSet(first, plan, 92000);
    const third = completeSet(second, plan, 183000);
    const fourth = completeSet(third, plan, 184000);
    const done = completeSet(fourth, plan, 260000);

    expect(completeSet(done, plan, 300000)).toBe(done);
  });

  it("calculates rest remaining with ceiling seconds", () => {
    const session = completeSet(startWorkoutSession(plan, 1000), plan, 1200);

    expect(getRestRemainingSeconds(session, 1200)).toBe(90);
    expect(getRestRemainingSeconds(session, 90550)).toBe(1);
    expect(getRestRemainingSeconds(session, 91200)).toBe(0);
    expect(getRestRemainingSeconds(session, 95000)).toBe(0);
  });

  it("returns zero rest remaining when no rest is active", () => {
    const session = startWorkoutSession(plan, 1000);

    expect(getRestRemainingSeconds(session, 1200)).toBe(0);
  });

  it("skips active rest", () => {
    const session = completeSet(startWorkoutSession(plan, 1000), plan, 1200);

    expect(skipRest(session).restEndsAt).toBeNull();
  });

  it("leaves completed sessions unchanged when skipping rest", () => {
    const first = completeSet(startWorkoutSession(plan, 1000), plan, 1200);
    const second = completeSet(first, plan, 92000);
    const third = completeSet(second, plan, 183000);
    const fourth = completeSet(third, plan, 184000);
    const done = completeSet(fourth, plan, 260000);

    expect(skipRest(done)).toBe(done);
  });

  it("adds rest time to an active rest window", () => {
    const session = completeSet(startWorkoutSession(plan, 1000), plan, 1200);

    expect(addRestTime(session, 30).restEndsAt).toBe(121200);
  });

  it("does not add rest time when rest is inactive", () => {
    const session = startWorkoutSession(plan, 1000);

    expect(addRestTime(session, 30)).toBe(session);
  });

  it("throws when a plan has no exercises", () => {
    expect(() =>
      startWorkoutSession(
        {
          ...plan,
          exercises: [],
        },
        1000,
      ),
    ).toThrow("workout plan needs at least one exercise");
  });
});
