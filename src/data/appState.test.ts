import {
  addDailyOutcome,
  addStepSample,
  addWorkoutOutcome,
  clearActiveWorkoutSession,
  createInitialAppState,
  hasCompletedWorkout,
  hasCompletedWorkoutOnDate,
  saveActiveWorkoutSession,
  saveWorkoutPlan,
  upsertExerciseWeight,
} from "./appState";
import { createDefaultWorkoutPlan } from "./workoutPlan";

describe("app state", () => {
  it("starts with empty histories", () => {
    expect(createInitialAppState()).toEqual({
      version: 1,
      dailyOutcomes: [],
      workoutOutcomes: [],
      activeWorkoutSession: null,
      exerciseWeights: {},
      stepSamples: [],
      workoutPlan: createDefaultWorkoutPlan(),
    });
  });

  it("stores one outcome per day and replaces newer saves", () => {
    const state = addDailyOutcome(createInitialAppState(), {
      date: "2026-05-09",
      completedItems: 5,
      plannedItems: 7,
      steps: 6420,
      focusMinutes: 154,
      note: "solid day",
    });
    const updated = addDailyOutcome(state, {
      date: "2026-05-09",
      completedItems: 6,
      plannedItems: 7,
      steps: 10012,
      focusMinutes: 180,
      note: "walk done",
    });

    expect(updated.dailyOutcomes).toEqual([
      {
        date: "2026-05-09",
        completedItems: 6,
        plannedItems: 7,
        steps: 10012,
        focusMinutes: 180,
        note: "walk done",
      },
    ]);
  });

  it("stores workout outcomes newest first", () => {
    const first = addWorkoutOutcome(createInitialAppState(), {
      id: "a",
      planId: "push-day",
      name: "push day",
      startedAt: 1000,
      completedAt: 2000,
      totalSets: 17,
      exercises: [],
    });
    const second = addWorkoutOutcome(first, {
      id: "b",
      planId: "pull-day",
      name: "pull day",
      startedAt: 3000,
      completedAt: 4000,
      totalSets: 12,
      exercises: [],
    });

    expect(second.workoutOutcomes.map((outcome) => outcome.id)).toEqual([
      "b",
      "a",
    ]);
  });

  it("knows when a workout has been completed", () => {
    const state = addWorkoutOutcome(createInitialAppState(), {
      id: "a",
      planId: "push-day",
      name: "push day",
      startedAt: 1000,
      completedAt: 2000,
      totalSets: 17,
      exercises: [],
    });

    expect(hasCompletedWorkout(state, "push-day")).toBe(true);
    expect(hasCompletedWorkout(state, "pull-day")).toBe(false);
  });

  it("knows when a workout has been completed on a specific day", () => {
    const state = addWorkoutOutcome(createInitialAppState(), {
      id: "a",
      planId: "push-day",
      name: "push day",
      startedAt: new Date("2026-05-10T20:00:00").getTime(),
      completedAt: new Date("2026-05-10T21:00:00").getTime(),
      totalSets: 17,
      exercises: [],
    });

    expect(hasCompletedWorkoutOnDate(state, "push-day", "2026-05-10")).toBe(
      true,
    );
    expect(hasCompletedWorkoutOnDate(state, "push-day", "2026-05-11")).toBe(
      false,
    );
  });

  it("saves and clears an active workout session", () => {
    const session = {
      planId: "push-day",
      startedAt: 1000,
      activeExerciseIndex: 0,
      completedAt: null,
      restEndsAt: null,
      sets: [],
    };
    const saved = saveActiveWorkoutSession(createInitialAppState(), session);

    expect(saved.activeWorkoutSession).toBe(session);
    expect(clearActiveWorkoutSession(saved).activeWorkoutSession).toBeNull();
  });

  it("saves the editable workout plan", () => {
    const plan = {
      ...createDefaultWorkoutPlan(),
      name: "upper day",
    };

    expect(saveWorkoutPlan(createInitialAppState(), plan).workoutPlan).toEqual(
      plan,
    );
  });

  it("keeps the latest known weight per exercise", () => {
    const state = upsertExerciseWeight(createInitialAppState(), {
      exerciseId: "incline-db-press",
      weightLb: 50,
      updatedAt: 1000,
    });
    const stale = upsertExerciseWeight(state, {
      exerciseId: "incline-db-press",
      weightLb: 45,
      updatedAt: 900,
    });
    const fresh = upsertExerciseWeight(stale, {
      exerciseId: "incline-db-press",
      weightLb: 55,
      updatedAt: 1200,
    });

    expect(fresh.exerciseWeights["incline-db-press"]).toEqual({
      exerciseId: "incline-db-press",
      weightLb: 55,
      updatedAt: 1200,
    });
  });

  it("stores step samples newest first and replaces duplicate timestamps", () => {
    const first = addStepSample(createInitialAppState(), {
      capturedAt: 1000,
      steps: 5000,
      source: "health",
    });
    const second = addStepSample(first, {
      capturedAt: 2000,
      steps: 6400,
      source: "health",
    });
    const updated = addStepSample(second, {
      capturedAt: 1000,
      steps: 5200,
      source: "health",
    });

    expect(updated.stepSamples).toEqual([
      { capturedAt: 2000, steps: 6400, source: "health" },
      { capturedAt: 1000, steps: 5200, source: "health" },
    ]);
  });
});
