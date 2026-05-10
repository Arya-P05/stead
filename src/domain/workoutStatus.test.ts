import { completeSet, startWorkoutSession } from './workoutSession';
import { getWorkoutStatus } from './workoutStatus';
import type { WorkoutPlan } from './workoutSession';

const plan: WorkoutPlan = {
  id: 'upper-push',
  name: 'upper push',
  exercises: [
    {
      id: 'incline-db-press',
      name: 'incline dumbbell press',
      targetSets: 3,
      restSeconds: 90,
    },
    {
      id: 'shoulder-press',
      name: 'shoulder press',
      targetSets: 2,
      restSeconds: 75,
    },
  ],
};

describe('getWorkoutStatus', () => {
  it('shows the first exercise before any set is logged', () => {
    expect(getWorkoutStatus(plan, startWorkoutSession(plan, 1000), 1000)).toEqual({
      title: 'upper push',
      meta: 'next up · incline dumbbell press',
      action: 'log set',
      restSeconds: 0,
      isComplete: false,
    });
  });

  it('shows rest copy while rest is active', () => {
    const session = completeSet(startWorkoutSession(plan, 1000), plan, 2000);

    expect(getWorkoutStatus(plan, session, 32000)).toEqual({
      title: 'upper push',
      meta: 'rest · 60s',
      action: 'log set',
      restSeconds: 60,
      isComplete: false,
    });
  });

  it('shows the next exercise after an exercise is complete', () => {
    const one = completeSet(startWorkoutSession(plan, 1000), plan, 2000);
    const two = completeSet(one, plan, 93000);
    const three = completeSet(two, plan, 184000);

    expect(getWorkoutStatus(plan, three, 184000)).toEqual({
      title: 'upper push',
      meta: 'next up · shoulder press',
      action: 'log set',
      restSeconds: 0,
      isComplete: false,
    });
  });

  it('shows complete copy when the session is done', () => {
    const one = completeSet(startWorkoutSession(plan, 1000), plan, 2000);
    const two = completeSet(one, plan, 93000);
    const three = completeSet(two, plan, 184000);
    const four = completeSet(three, plan, 185000);
    const done = completeSet(four, plan, 261000);

    expect(getWorkoutStatus(plan, done, 261000)).toEqual({
      title: 'upper push',
      meta: 'done · 5 sets',
      action: 'done',
      restSeconds: 0,
      isComplete: true,
    });
  });
});
