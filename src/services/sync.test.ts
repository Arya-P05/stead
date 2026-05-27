jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

import {
  dailyItemToRow,
  dailyOutcomeToRow,
  dailyPlanToRow,
  emptyRemoteSnapshot,
  mergeRemoteSnapshot,
  stepSampleToRow,
  workoutExerciseToRow,
  workoutOutcomeToRow,
  workoutPlanToRow,
} from "./sync";
import {
  addDailyItem,
  addDailyOutcome,
  addStepSample,
  addWorkoutOutcome,
  createInitialAppState,
} from "../data/appState";

describe("sync mapping", () => {
  it("maps local workout data to Supabase rows", () => {
    const state = createInitialAppState();
    const plan = {
      ...state.workoutPlans[0],
      createdAt: 1000,
      updatedAt: 2000,
      archivedAt: null,
    };
    const exercise = plan.exercises[0];

    expect(workoutPlanToRow("user-1", plan)).toEqual({
      user_id: "user-1",
      local_id: plan.id,
      name: plan.name,
      archived_at: null,
      created_at: "1970-01-01T00:00:01.000Z",
      updated_at: "1970-01-01T00:00:02.000Z",
    });
    expect(workoutExerciseToRow("user-1", plan.id, exercise, 0)).toEqual({
      user_id: "user-1",
      plan_local_id: plan.id,
      local_id: exercise.id,
      name: exercise.name,
      position: 0,
      target_sets: exercise.targetSets,
      target_reps: exercise.targetReps,
      weight_lb: exercise.weightLb,
      rest_seconds: exercise.restSeconds,
    });
  });

  it("maps local day, outcome, and step data to Supabase rows", () => {
    const dailyItem = {
      id: "item-1",
      date: "2026-05-27",
      title: "push day",
      kind: "workout" as const,
      workoutPlanId: "plan-1",
      position: 1,
      completedAt: 3000,
      createdAt: 1000,
      updatedAt: 4000,
    };

    expect(
      dailyPlanToRow("user-1", {
        date: "2026-05-27",
        itemIds: ["item-1"],
        createdAt: 1000,
        updatedAt: 2000,
      }),
    ).toEqual({
      user_id: "user-1",
      date: "2026-05-27",
      created_at: "1970-01-01T00:00:01.000Z",
      updated_at: "1970-01-01T00:00:02.000Z",
    });
    expect(dailyItemToRow("user-1", dailyItem)).toEqual({
      user_id: "user-1",
      local_id: "item-1",
      date: "2026-05-27",
      title: "push day",
      kind: "workout",
      workout_plan_local_id: "plan-1",
      position: 1,
      completed_at: "1970-01-01T00:00:03.000Z",
      created_at: "1970-01-01T00:00:01.000Z",
      updated_at: "1970-01-01T00:00:04.000Z",
    });
    expect(
      dailyOutcomeToRow("user-1", {
        date: "2026-05-27",
        completedItems: 2,
        plannedItems: 3,
        steps: 8123,
        focusMinutes: 154,
        note: "solid",
      }),
    ).toEqual({
      user_id: "user-1",
      date: "2026-05-27",
      completed_items: 2,
      planned_items: 3,
      steps: 8123,
      focus_minutes: 154,
      note: "solid",
    });
    expect(
      stepSampleToRow("user-1", {
        capturedAt: 5000,
        steps: 8123,
        source: "health",
      }),
    ).toEqual({
      user_id: "user-1",
      captured_at: "1970-01-01T00:00:05.000Z",
      steps: 8123,
      source: "health",
    });
  });

  it("maps workout outcomes without losing set details", () => {
    expect(
      workoutOutcomeToRow("user-1", {
        id: "outcome-1",
        planId: "plan-1",
        name: "push day",
        startedAt: 1000,
        completedAt: 2000,
        totalSets: 4,
        exercises: [
          {
            exerciseId: "bench",
            name: "bench",
            sets: 4,
            reps: 8,
            weightLb: 135,
          },
        ],
      }),
    ).toEqual({
      user_id: "user-1",
      local_id: "outcome-1",
      plan_local_id: "plan-1",
      name: "push day",
      started_at: "1970-01-01T00:00:01.000Z",
      completed_at: "1970-01-01T00:00:02.000Z",
      total_sets: 4,
      exercises: [
        {
          exerciseId: "bench",
          name: "bench",
          sets: 4,
          reps: 8,
          weightLb: 135,
        },
      ],
      created_at: "1970-01-01T00:00:01.000Z",
      updated_at: "1970-01-01T00:00:02.000Z",
    });
  });

  it("merges newer remote rows into local state", () => {
    const local = addDailyItem(createInitialAppState(), {
      id: "item-1",
      date: "2026-05-27",
      title: "walk",
      kind: "task",
      createdAt: 1000,
      updatedAt: 1000,
    });
    const merged = mergeRemoteSnapshot(local, {
      ...emptyRemoteSnapshot,
      dailyPlans: [
        {
          id: "remote-plan-row",
          user_id: "user-1",
          date: "2026-05-27",
          created_at: "1970-01-01T00:00:01.000Z",
          updated_at: "1970-01-01T00:00:03.000Z",
        },
      ],
      dailyItems: [
        {
          id: "remote-item-row",
          user_id: "user-1",
          local_id: "item-1",
          date: "2026-05-27",
          title: "walk outside",
          kind: "task",
          workout_plan_local_id: null,
          position: 0,
          completed_at: null,
          created_at: "1970-01-01T00:00:01.000Z",
          updated_at: "1970-01-01T00:00:03.000Z",
        },
      ],
    });

    expect(merged.dailyItems[0]).toMatchObject({
      id: "item-1",
      title: "walk outside",
      updatedAt: 3000,
    });
  });

  it("unions remote outcomes and HealthKit samples", () => {
    const local = addStepSample(
      addDailyOutcome(createInitialAppState(), {
        date: "2026-05-26",
        completedItems: 1,
        plannedItems: 2,
        steps: 5000,
        focusMinutes: 90,
      }),
      { capturedAt: 1000, steps: 5000, source: "health" },
    );
    const merged = mergeRemoteSnapshot(local, {
      ...emptyRemoteSnapshot,
      workoutOutcomes: [
        {
          id: "row-1",
          user_id: "user-1",
          local_id: "outcome-1",
          plan_local_id: "plan-1",
          name: "push day",
          started_at: "1970-01-01T00:00:01.000Z",
          completed_at: "1970-01-01T00:00:02.000Z",
          total_sets: 2,
          exercises: [],
          created_at: "1970-01-01T00:00:01.000Z",
          updated_at: "1970-01-01T00:00:02.000Z",
        },
      ],
      dailyOutcomes: [
        {
          id: "daily-row",
          user_id: "user-1",
          date: "2026-05-27",
          completed_items: 2,
          planned_items: 3,
          steps: 9123,
          focus_minutes: 154,
          note: null,
          created_at: "1970-01-01T00:00:01.000Z",
          updated_at: "1970-01-01T00:00:02.000Z",
        },
      ],
      stepSamples: [
        {
          id: "step-row",
          user_id: "user-1",
          captured_at: "1970-01-01T00:00:02.000Z",
          steps: 9123,
          source: "health",
          created_at: "1970-01-01T00:00:02.000Z",
        },
      ],
    });

    expect(merged.workoutOutcomes).toHaveLength(1);
    expect(merged.dailyOutcomes.map((outcome) => outcome.date)).toEqual([
      "2026-05-27",
      "2026-05-26",
    ]);
    expect(merged.stepSamples.map((sample) => sample.steps)).toEqual([
      9123, 5000,
    ]);
  });
});
