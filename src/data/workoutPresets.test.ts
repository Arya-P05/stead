import {
  createWorkoutPlanFromPreset,
  getWorkoutPresets,
} from "./workoutPresets";

describe("workout presets", () => {
  it("lists useful starter plans with set counts", () => {
    expect(getWorkoutPresets()).toEqual([
      { id: "push", name: "push day", exerciseCount: 5, setCount: 17 },
      { id: "pull", name: "pull day", exerciseCount: 5, setCount: 17 },
      { id: "legs", name: "legs", exerciseCount: 5, setCount: 18 },
      { id: "upper", name: "upper", exerciseCount: 5, setCount: 15 },
    ]);
  });

  it("creates stable plan copies with unique exercise ids", () => {
    const plan = createWorkoutPlanFromPreset("pull", 1000);

    expect(plan).toMatchObject({
      id: "workout-plan-pull-1000",
      name: "pull day",
    });
    expect(plan.exercises).toHaveLength(5);
    expect(new Set(plan.exercises.map((exercise) => exercise.id)).size).toBe(5);
    expect(plan.exercises[0]).toMatchObject({
      id: "pull-pull-up-1000",
      name: "pull up",
      targetSets: 4,
      targetReps: 8,
    });
  });
});
