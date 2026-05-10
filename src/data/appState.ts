export type DailyOutcome = {
  date: string;
  completedItems: number;
  plannedItems: number;
  steps: number;
  focusMinutes: number;
  note?: string;
};

export type WorkoutExerciseOutcome = {
  exerciseId: string;
  name: string;
  sets: number;
  reps?: number;
  weightLb?: number;
};

export type WorkoutOutcome = {
  id: string;
  planId: string;
  name: string;
  startedAt: number;
  completedAt: number;
  totalSets: number;
  exercises: WorkoutExerciseOutcome[];
};

export type ExerciseWeight = {
  exerciseId: string;
  weightLb: number;
  updatedAt: number;
};

export type StepSample = {
  capturedAt: number;
  steps: number;
  source: 'health';
};

export type AppState = {
  version: 1;
  dailyOutcomes: DailyOutcome[];
  workoutOutcomes: WorkoutOutcome[];
  exerciseWeights: Record<string, ExerciseWeight>;
  stepSamples: StepSample[];
};

export function createInitialAppState(): AppState {
  return {
    version: 1,
    dailyOutcomes: [],
    workoutOutcomes: [],
    exerciseWeights: {},
    stepSamples: [],
  };
}

export function addDailyOutcome(state: AppState, outcome: DailyOutcome): AppState {
  return {
    ...state,
    dailyOutcomes: [
      outcome,
      ...state.dailyOutcomes.filter((stored) => stored.date !== outcome.date),
    ].sort((a, b) => b.date.localeCompare(a.date)),
  };
}

export function addWorkoutOutcome(state: AppState, outcome: WorkoutOutcome): AppState {
  return {
    ...state,
    workoutOutcomes: [
      outcome,
      ...state.workoutOutcomes.filter((stored) => stored.id !== outcome.id),
    ].sort((a, b) => b.startedAt - a.startedAt),
  };
}

export function upsertExerciseWeight(state: AppState, weight: ExerciseWeight): AppState {
  const current = state.exerciseWeights[weight.exerciseId];

  if (current && current.updatedAt > weight.updatedAt) {
    return state;
  }

  return {
    ...state,
    exerciseWeights: {
      ...state.exerciseWeights,
      [weight.exerciseId]: weight,
    },
  };
}

export function addStepSample(state: AppState, sample: StepSample): AppState {
  return {
    ...state,
    stepSamples: [
      sample,
      ...state.stepSamples.filter((stored) => stored.capturedAt !== sample.capturedAt),
    ].sort((a, b) => b.capturedAt - a.capturedAt),
  };
}
