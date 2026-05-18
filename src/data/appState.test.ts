import {
  addDailyOutcome,
  addDailyItem,
  addStepSample,
  addWorkoutOutcome,
  addWorkoutPlan,
  archiveWorkoutPlan,
  clearActiveWorkoutSession,
  completeDailyItem,
  createInitialAppState,
  deleteDailyItem,
  duplicateWorkoutPlan,
  getActiveWorkoutPlan,
  getDailyItemsForDate,
  hasCompletedWorkout,
  hasCompletedWorkoutOnDate,
  reorderDailyItem,
  saveActiveWorkoutSession,
  saveWorkoutPlan,
  setActiveWorkoutPlan,
  updateDailyItem,
  upsertExerciseWeight,
} from "./appState";
import { createDefaultWorkoutPlan } from "./workoutPlan";

describe("app state", () => {
  it("starts with empty histories", () => {
    const workoutPlan = createDefaultWorkoutPlan();

    expect(createInitialAppState()).toEqual({
      version: 4,
      dailyOutcomes: [],
      dailyItems: [],
      dailyPlans: [],
      workoutOutcomes: [],
      activeWorkoutSession: null,
      exerciseWeights: {},
      stepSamples: [],
      activeWorkoutPlanId: workoutPlan.id,
      workoutPlan,
      workoutPlans: [
        {
          ...workoutPlan,
          createdAt: 0,
          updatedAt: 0,
          archivedAt: null,
        },
      ],
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

  it("adds daily items and keeps a date plan in order", () => {
    const first = addDailyItem(createInitialAppState(), {
      id: "walk",
      date: "2026-05-18",
      title: "walk",
      kind: "task",
      createdAt: 1000,
      updatedAt: 1000,
    });
    const second = addDailyItem(first, {
      id: "push",
      date: "2026-05-18",
      title: "push day",
      kind: "workout",
      workoutPlanId: "push-day",
      createdAt: 2000,
      updatedAt: 2000,
    });

    expect(
      getDailyItemsForDate(second, "2026-05-18").map((item) => item.id),
    ).toEqual(["walk", "push"]);
    expect(second.dailyPlans).toEqual([
      {
        date: "2026-05-18",
        itemIds: ["walk", "push"],
        createdAt: expect.any(Number),
        updatedAt: expect.any(Number),
      },
    ]);
  });

  it("updates, completes, reorders, and deletes daily items", () => {
    const state = addDailyItem(
      addDailyItem(createInitialAppState(), {
        id: "walk",
        date: "2026-05-18",
        title: "walk",
        kind: "task",
      }),
      {
        id: "read",
        date: "2026-05-18",
        title: "read",
        kind: "task",
      },
    );
    const updated = updateDailyItem(state, "read", { title: "read 30" }, 1000);
    const completed = completeDailyItem(updated, "read", 2000);
    const reordered = reorderDailyItem(completed, "read", -1);
    const deleted = deleteDailyItem(reordered, "walk");

    expect(getDailyItemsForDate(completed, "2026-05-18")[1]).toMatchObject({
      id: "read",
      title: "read 30",
      completedAt: 2000,
    });
    expect(
      getDailyItemsForDate(reordered, "2026-05-18").map((item) => item.id),
    ).toEqual(["read", "walk"]);
    expect(
      getDailyItemsForDate(deleted, "2026-05-18").map((item) => item.id),
    ).toEqual(["read"]);
    expect(deleted.dailyPlans[0].itemIds).toEqual(["read"]);
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

  it("adds and selects multiple workout plans", () => {
    const pullPlan = {
      ...createDefaultWorkoutPlan(),
      id: "pull-day",
      name: "pull day",
    };
    const state = addWorkoutPlan(createInitialAppState(), pullPlan, 1000);
    const selected = setActiveWorkoutPlan(state, "push-day");

    expect(getActiveWorkoutPlan(state).name).toBe("pull day");
    expect(getActiveWorkoutPlan(selected).name).toBe("push day");
  });

  it("duplicates and archives workout plans", () => {
    const state = createInitialAppState();
    const duplicated = duplicateWorkoutPlan(state, "push-day", 1000);
    const copy = duplicated.workoutPlans.find((plan) =>
      plan.name.endsWith("copy"),
    );
    const archived = archiveWorkoutPlan(duplicated, copy!.id, 2000);

    expect(copy).toBeDefined();
    expect(copy?.exercises[0].id).not.toBe("incline-db-press");
    expect(
      archived.workoutPlans.find((plan) => plan.id === copy?.id),
    ).toMatchObject({ archivedAt: 2000 });
    expect(getActiveWorkoutPlan(archived).id).toBe("push-day");
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
