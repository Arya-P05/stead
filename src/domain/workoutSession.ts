export type WorkoutExercise = {
  id: string;
  name: string;
  targetSets: number;
  restSeconds: number;
  targetReps?: number;
  weightLb?: number;
};

export type WorkoutPlan = {
  id: string;
  name: string;
  exercises: WorkoutExercise[];
};

export type CompletedSet = {
  exerciseId: string;
  setNumber: number;
  completedAt: number;
};

export type WorkoutSession = {
  planId: string;
  startedAt: number;
  activeExerciseIndex: number;
  completedAt: number | null;
  restEndsAt: number | null;
  sets: CompletedSet[];
};

export type ExerciseProgress = {
  exerciseId: string;
  completedSets: number;
  targetSets: number;
  complete: boolean;
};

export function startWorkoutSession(plan: WorkoutPlan, now: number): WorkoutSession {
  if (plan.exercises.length === 0) {
    throw new Error('workout plan needs at least one exercise');
  }

  return {
    planId: plan.id,
    startedAt: now,
    activeExerciseIndex: 0,
    completedAt: null,
    restEndsAt: null,
    sets: [],
  };
}

export function getActiveExercise(plan: WorkoutPlan, session: WorkoutSession) {
  return plan.exercises[session.activeExerciseIndex] ?? null;
}

export function getExerciseProgress(
  plan: WorkoutPlan,
  session: WorkoutSession,
): ExerciseProgress[] {
  return plan.exercises.map((exercise) => {
    const completedSets = session.sets.filter((set) => set.exerciseId === exercise.id).length;

    return {
      exerciseId: exercise.id,
      completedSets,
      targetSets: exercise.targetSets,
      complete: completedSets >= exercise.targetSets,
    };
  });
}

export function selectExercise(
  session: WorkoutSession,
  plan: WorkoutPlan,
  exerciseIndex: number,
): WorkoutSession {
  if (session.completedAt !== null) {
    return session;
  }

  const progress = getExerciseProgress(plan, session)[exerciseIndex];

  if (!progress || progress.complete) {
    return session;
  }

  return {
    ...session,
    activeExerciseIndex: exerciseIndex,
    restEndsAt: null,
  };
}

export function completeSet(
  session: WorkoutSession,
  plan: WorkoutPlan,
  now: number,
): WorkoutSession {
  if (session.completedAt !== null) {
    return session;
  }

  const activeExercise = getActiveExercise(plan, session);

  if (activeExercise === null) {
    return {
      ...session,
      completedAt: now,
      restEndsAt: null,
    };
  }

  const completedSetsForExercise = session.sets.filter(
    (set) => set.exerciseId === activeExercise.id,
  ).length;
  const nextSet: CompletedSet = {
    exerciseId: activeExercise.id,
    completedAt: now,
    setNumber: completedSetsForExercise + 1,
  };
  const sets = [...session.sets, nextSet];
  const completedExercise = nextSet.setNumber >= activeExercise.targetSets;
  const nextExerciseIndex = completedExercise
    ? session.activeExerciseIndex + 1
    : session.activeExerciseIndex;
  const completedWorkout = nextExerciseIndex >= plan.exercises.length;

  return {
    ...session,
    activeExerciseIndex: nextExerciseIndex,
    completedAt: completedWorkout ? now : null,
    restEndsAt: completedExercise || completedWorkout ? null : now + activeExercise.restSeconds * 1000,
    sets,
  };
}

export function getRestRemainingSeconds(session: WorkoutSession, now: number) {
  if (session.restEndsAt === null) {
    return 0;
  }

  return Math.max(0, Math.ceil((session.restEndsAt - now) / 1000));
}

export function skipRest(session: WorkoutSession): WorkoutSession {
  if (session.completedAt !== null || session.restEndsAt === null) {
    return session;
  }

  return {
    ...session,
    restEndsAt: null,
  };
}

export function addRestTime(session: WorkoutSession, seconds: number): WorkoutSession {
  if (session.completedAt !== null || session.restEndsAt === null) {
    return session;
  }

  return {
    ...session,
    restEndsAt: session.restEndsAt + seconds * 1000,
  };
}
