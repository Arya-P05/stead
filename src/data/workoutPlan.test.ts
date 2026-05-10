import { createDefaultWorkoutPlan, updateExercise } from './workoutPlan';

describe('workout plan', () => {
  it('creates the default push day plan', () => {
    const plan = createDefaultWorkoutPlan();

    expect(plan.name).toBe('push day');
    expect(plan.exercises).toHaveLength(5);
    expect(plan.exercises[0]).toMatchObject({
      id: 'incline-db-press',
      targetSets: 4,
      targetReps: 10,
      weightLb: 50,
    });
  });

  it('updates one exercise without touching the others', () => {
    const plan = createDefaultWorkoutPlan();
    const updated = updateExercise(plan, 'incline-db-press', {
      targetReps: 12,
      weightLb: 55,
    });

    expect(updated.exercises[0]).toMatchObject({
      targetReps: 12,
      weightLb: 55,
    });
    expect(updated.exercises[1]).toEqual(plan.exercises[1]);
  });

  it('keeps exercise values usable', () => {
    const plan = createDefaultWorkoutPlan();
    const updated = updateExercise(plan, 'incline-db-press', {
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
});
