import {
  canSaveAddPlanDraft,
  createWorkoutPlanFromAddPlanDraft,
} from "./addPlanDraft";

describe("add plan draft", () => {
  it("converts a hand-built draft into a lightweight workout plan", () => {
    const plan = createWorkoutPlanFromAddPlanDraft(
      {
        createdVia: "write",
        kind: "strength",
        name: " Push Day ",
        lifts: [
          { name: " Incline DB Press ", sets: 4, reps: 8 },
          { name: "lat raise" },
        ],
      },
      1000,
    );

    expect(plan).toEqual({
      id: "workout-plan-1000",
      name: "push day",
      exercises: [
        {
          id: "incline-db-press-1000-1",
          name: "incline db press",
          targetSets: 4,
          targetReps: 8,
          restSeconds: 60,
        },
        {
          id: "lat-raise-1000-2",
          name: "lat raise",
          targetSets: 3,
          targetReps: 10,
          restSeconds: 60,
        },
      ],
    });
  });

  it("uses calm defaults and skips empty lifts", () => {
    const plan = createWorkoutPlanFromAddPlanDraft(
      {
        createdVia: "snap",
        name: "",
        lifts: [{ name: "" }, { name: "bench", sets: 0, reps: Number.NaN }],
      },
      2000,
    );

    expect(plan.name).toBe("push day");
    expect(plan.exercises).toEqual([
      {
        id: "bench-2000-1",
        name: "bench",
        targetSets: 1,
        targetReps: 10,
        restSeconds: 60,
      },
    ]);
  });

  it("knows whether a draft can be saved", () => {
    expect(
      canSaveAddPlanDraft({
        createdVia: "write",
        name: "push",
        lifts: [{ name: " " }],
      }),
    ).toBe(false);
    expect(
      canSaveAddPlanDraft({
        createdVia: "write",
        name: "push",
        lifts: [{ name: "bench" }],
      }),
    ).toBe(true);
  });
});
