import {
  addExercise,
  createDefaultWorkoutPlan,
  moveExercise,
  normalizeWorkoutPlan,
  removeExercise,
  updateExercise,
} from "./workoutPlan";

describe("workout plan", () => {
  it("creates the default push day plan", () => {
    const plan = createDefaultWorkoutPlan();

    expect(plan.name).toBe("push day");
    expect(plan.exercises).toHaveLength(5);
    expect(plan.exercises[0]).toMatchObject({
      id: "incline-db-press",
      targetSets: 4,
      targetReps: 10,
      weightLb: 50,
    });
  });

  it("updates one exercise without touching the others", () => {
    const plan = createDefaultWorkoutPlan();
    const updated = updateExercise(plan, "incline-db-press", {
      targetReps: 12,
      weightLb: 55,
    });

    expect(updated.exercises[0]).toMatchObject({
      targetReps: 12,
      weightLb: 55,
    });
    expect(updated.exercises[1]).toEqual(plan.exercises[1]);
  });

  it("keeps exercise values usable", () => {
    const plan = createDefaultWorkoutPlan();
    const updated = updateExercise(plan, "incline-db-press", {
      targetSets: 0,
      targetReps: 0,
      restSeconds: -30,
      weightLb: -10,
    });

    expect(updated.exercises[0]).toMatchObject({
      targetSets: 1,
      targetReps: 1,
      restSeconds: 15,
      weightLb: 0,
    });
  });

  it("repairs incomplete stored plans", () => {
    const normalized = normalizeWorkoutPlan({
      id: "push-day",
      name: "",
      exercises: [
        {
          id: "incline-db-press",
          name: "",
          targetSets: 0,
          restSeconds: 0,
        },
      ],
    });

    expect(normalized).toEqual(createDefaultWorkoutPlan());
  });

  it("adds, removes, and moves exercises", () => {
    const plan = createDefaultWorkoutPlan();
    const added = addExercise(plan, {
      id: "dip",
      name: "dip",
      targetSets: 0,
      targetReps: 8,
      weightLb: 0,
      restSeconds: 0,
    });
    const moved = moveExercise(added, "dip", -1);
    const removed = removeExercise(moved, "dip");

    expect(added.exercises.at(-1)).toMatchObject({
      id: "dip",
      targetSets: 1,
      restSeconds: 15,
    });
    expect(moved.exercises.at(-2)?.id).toBe("dip");
    expect(removed.exercises.map((exercise) => exercise.id)).toEqual(
      plan.exercises.map((exercise) => exercise.id),
    );
  });

  it("keeps at least one exercise when removing", () => {
    const plan = {
      ...createDefaultWorkoutPlan(),
      exercises: [createDefaultWorkoutPlan().exercises[0]],
    };

    expect(removeExercise(plan, plan.exercises[0].id)).toBe(plan);
  });
});
