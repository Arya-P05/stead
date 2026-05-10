import { parseWorkoutVoiceLog } from './voiceLog';

describe('workout voice log', () => {
  it('parses sets, reps, and exercise from natural speech', () => {
    expect(parseWorkoutVoiceLog('three sets of forty on incline dumbbell press')).toEqual({
      exerciseName: 'incline dumbbell press',
      sets: 3,
      reps: 40,
    });
  });

  it('parses numeric shorthand with weight', () => {
    expect(parseWorkoutVoiceLog('2 sets of 10 at 55 on shoulder press')).toEqual({
      exerciseName: 'shoulder press',
      sets: 2,
      reps: 10,
      weightLb: 55,
    });
  });

  it('parses a single logged set', () => {
    expect(parseWorkoutVoiceLog('12 reps 50 lb incline db')).toEqual({
      exerciseName: 'incline db',
      sets: 1,
      reps: 12,
      weightLb: 50,
    });
  });

  it('returns null when there is not enough workout intent', () => {
    expect(parseWorkoutVoiceLog('felt good today')).toBeNull();
  });
});
