import { completeSet, selectExercise } from "./workoutSession";
import type { WorkoutPlan, WorkoutSession } from "./workoutSession";

export type WorkoutVoiceLog = {
  exerciseName: string;
  sets: number;
  reps: number;
  weightLb?: number;
};

const numberWords: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

export function parseWorkoutVoiceLog(
  transcript: string,
): WorkoutVoiceLog | null {
  const normalized = transcript
    .toLowerCase()
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (normalized.length === 0) {
    return null;
  }

  const setCount = readCountBefore(normalized, /\bsets?\b/) ?? 1;
  const reps =
    readCountBefore(normalized, /\breps?\b/) ??
    readCountAfter(normalized, /\bsets?\s+of\b/) ??
    readCountAfter(normalized, /\bset\s+of\b/);
  const weightLb =
    readCountBefore(normalized, /\blb\b|\blbs\b|\bpounds?\b/) ??
    readCountAfter(normalized, /\bat\b/);
  const exerciseName = readExerciseName(normalized);

  if (!exerciseName || reps === null) {
    return null;
  }

  return {
    exerciseName,
    sets: setCount,
    reps,
    ...(weightLb === null ? {} : { weightLb }),
  };
}

export function applyWorkoutVoiceLog(
  plan: WorkoutPlan,
  session: WorkoutSession,
  transcript: string,
  now: number,
): { success: boolean; session: WorkoutSession } {
  const parsed = parseWorkoutVoiceLog(transcript);

  if (!parsed) {
    return { success: false, session };
  }

  const exerciseIndex = plan.exercises.findIndex((exercise) =>
    namesMatch(exercise.name, parsed.exerciseName),
  );

  if (exerciseIndex === -1) {
    return { success: false, session };
  }

  let nextSession = selectExercise(session, plan, exerciseIndex);

  for (let setIndex = 0; setIndex < parsed.sets; setIndex += 1) {
    nextSession = completeSet(nextSession, plan, now + setIndex, {
      reps: parsed.reps,
      weightLb: parsed.weightLb,
    });
  }

  return { success: true, session: nextSession };
}

function readExerciseName(transcript: string) {
  const match = transcript.match(/\bon\s+(.+)$/);
  const fallbackMatch = transcript.match(
    /\b(?:lb|lbs|pounds?|at\s+\d+)\s+(.+)$/,
  );
  const rawName = match?.[1] ?? fallbackMatch?.[1];

  return rawName
    ?.replace(/\b\d+\b/g, "")
    .replace(/\b(?:sets?|reps?|lb|lbs|pounds?|at|of)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function readCountBefore(transcript: string, marker: RegExp) {
  const markerMatch = transcript.match(marker);

  if (!markerMatch || markerMatch.index === undefined) {
    return null;
  }

  const before = transcript
    .slice(0, markerMatch.index)
    .trim()
    .split(" ")
    .at(-1);

  return before ? parseCount(before) : null;
}

function readCountAfter(transcript: string, marker: RegExp) {
  const markerMatch = transcript.match(marker);

  if (!markerMatch || markerMatch.index === undefined) {
    return null;
  }

  const after = transcript
    .slice(markerMatch.index + markerMatch[0].length)
    .trim()
    .split(" ")
    .at(0);

  return after ? parseCount(after) : null;
}

function parseCount(value: string) {
  const numeric = Number.parseInt(value, 10);

  if (Number.isFinite(numeric)) {
    return numeric;
  }

  return numberWords[value] ?? null;
}

function namesMatch(planName: string, transcriptName: string) {
  const normalizedPlan = normalizeName(planName);
  const normalizedTranscript = normalizeName(transcriptName);

  return (
    normalizedPlan.includes(normalizedTranscript) ||
    normalizedTranscript.includes(normalizedPlan) ||
    normalizedPlan.replace("dumbbell", "db").includes(normalizedTranscript)
  );
}

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .replace(/\bdumbbell\b/g, "db")
    .replace(/\s+/g, " ")
    .trim();
}
