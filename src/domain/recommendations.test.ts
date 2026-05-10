import { chooseRecommendation } from './recommendations';
import type { DayState } from './recommendations';

const baseDay: DayState = {
  steps: 6200,
  stepGoal: 10000,
  minutesWorked: 140,
  minutesUntilNextEvent: 90,
  weather: {
    condition: 'sunny',
    temperatureF: 72,
    precipitationChance: 0.05,
  },
  workout: {
    planned: true,
    completed: false,
    name: 'upper push',
  },
};

describe('chooseRecommendation', () => {
  it('suggests a walk when steps are behind and weather is good', () => {
    expect(chooseRecommendation(baseDay)).toEqual({
      action: 'take a 10 min walk',
      reason: 'sunny window before calls',
      type: 'walk',
    });
  });

  it('does not suggest a walk when the step goal is done', () => {
    expect(
      chooseRecommendation({
        ...baseDay,
        steps: 10000,
      }),
    ).toEqual({
      action: 'start upper push',
      reason: 'planned session still open',
      type: 'workout',
    });
  });

  it('protects calendar prep when an event is close', () => {
    expect(
      chooseRecommendation({
        ...baseDay,
        minutesUntilNextEvent: 12,
      }),
    ).toEqual({
      action: 'prep for next thing',
      reason: 'starts in 12 min',
      type: 'calendar',
    });
  });

  it('suggests a reset when work has run long and weather is not walkable', () => {
    expect(
      chooseRecommendation({
        ...baseDay,
        minutesWorked: 190,
        weather: {
          condition: 'rain',
          temperatureF: 48,
          precipitationChance: 0.9,
        },
      }),
    ).toEqual({
      action: 'take a 5 min reset',
      reason: 'long work block',
      type: 'focus',
    });
  });

  it('falls back to the planned workout when walking is not useful', () => {
    expect(
      chooseRecommendation({
        ...baseDay,
        steps: 9400,
        weather: {
          condition: 'storm',
          temperatureF: 41,
          precipitationChance: 0.95,
        },
      }),
    ).toEqual({
      action: 'start upper push',
      reason: 'planned session still open',
      type: 'workout',
    });
  });

  it('stays quiet when the core day is handled', () => {
    expect(
      chooseRecommendation({
        ...baseDay,
        steps: 11000,
        minutesWorked: 45,
        workout: {
          planned: true,
          completed: true,
          name: 'upper push',
        },
      }),
    ).toEqual({
      action: 'keep going',
      reason: 'day is on track',
      type: 'steady',
    });
  });

  it('handles a missing next event without showing broken metadata', () => {
    expect(
      chooseRecommendation({
        ...baseDay,
        minutesUntilNextEvent: null,
      }),
    ).toEqual({
      action: 'take a 10 min walk',
      reason: 'sunny window',
      type: 'walk',
    });
  });
});
