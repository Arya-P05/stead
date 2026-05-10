export type WeatherCondition = 'sunny' | 'cloudy' | 'rain' | 'storm';

export type RecommendationType = 'walk' | 'workout' | 'calendar' | 'focus' | 'steady';

export type DayState = {
  steps: number;
  stepGoal: number;
  minutesWorked: number;
  minutesUntilNextEvent: number | null;
  weather: {
    condition: WeatherCondition;
    temperatureF: number;
    precipitationChance: number;
  };
  workout: {
    planned: boolean;
    completed: boolean;
    name: string;
  };
};

export type Recommendation = {
  action: string;
  reason: string;
  type: RecommendationType;
};

const CALENDAR_PREP_WINDOW_MINUTES = 15;
const LONG_WORK_BLOCK_MINUTES = 180;
const WALK_STEP_GAP = 1200;

export function chooseRecommendation(day: DayState): Recommendation {
  if (
    day.minutesUntilNextEvent !== null &&
    day.minutesUntilNextEvent <= CALENDAR_PREP_WINDOW_MINUTES
  ) {
    return {
      action: 'prep for next thing',
      reason: `starts in ${day.minutesUntilNextEvent} min`,
      type: 'calendar',
    };
  }

  if (shouldWalk(day)) {
    return {
      action: 'take a 10 min walk',
      reason: day.minutesUntilNextEvent === null ? 'sunny window' : 'sunny window before calls',
      type: 'walk',
    };
  }

  if (day.minutesWorked >= LONG_WORK_BLOCK_MINUTES) {
    return {
      action: 'take a 5 min reset',
      reason: 'long work block',
      type: 'focus',
    };
  }

  if (day.workout.planned && !day.workout.completed) {
    return {
      action: `start ${day.workout.name}`,
      reason: 'planned session still open',
      type: 'workout',
    };
  }

  return {
    action: 'keep going',
    reason: 'day is on track',
    type: 'steady',
  };
}

function shouldWalk(day: DayState) {
  return day.stepGoal - day.steps >= WALK_STEP_GAP && isWalkable(day.weather);
}

function isWalkable(weather: DayState['weather']) {
  return (
    weather.condition === 'sunny' &&
    weather.temperatureF >= 50 &&
    weather.temperatureF <= 90 &&
    weather.precipitationChance <= 0.2
  );
}
