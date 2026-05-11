import { createDefaultWorkoutPlan } from "../data/workoutPlan";
import { startWorkoutSession } from "./workoutSession";
import { applyWorkoutVoiceLog, parseWorkoutVoiceLog } from "./voiceLog";

describe("workout voice log", () => {
  it("parses sets, reps, and exercise from natural speech", () => {
    expect(
      parseWorkoutVoiceLog("three sets of forty on incline dumbbell press"),
    ).toEqual({
      exerciseName: "incline dumbbell press",
      sets: 3,
      reps: 40,
    });
  });

  it("parses numeric shorthand with weight", () => {
    expect(
      parseWorkoutVoiceLog("2 sets of 10 at 55 on shoulder press"),
    ).toEqual({
      exerciseName: "shoulder press",
      sets: 2,
      reps: 10,
      weightLb: 55,
    });
  });

  it("parses a single logged set", () => {
    expect(parseWorkoutVoiceLog("12 reps 50 lb incline db")).toEqual({
      exerciseName: "incline db",
      sets: 1,
      reps: 12,
      weightLb: 50,
    });
  });

  it("returns null when there is not enough workout intent", () => {
    expect(parseWorkoutVoiceLog("felt good today")).toBeNull();
  });

  it("applies parsed sets to the matching exercise", () => {
    const plan = createDefaultWorkoutPlan();
    const session = startWorkoutSession(plan, 1000);
    const applied = applyWorkoutVoiceLog(
      plan,
      session,
      "2 sets of 10 at 55 on incline db",
      2000,
    );

    expect(applied.success).toBe(true);
    expect(applied.session.sets).toEqual([
      {
        exerciseId: "incline-db-press",
        setNumber: 1,
        completedAt: 2000,
        reps: 10,
        weightLb: 55,
      },
      {
        exerciseId: "incline-db-press",
        setNumber: 2,
        completedAt: 2001,
        reps: 10,
        weightLb: 55,
      },
    ]);
  });

  it("does not mutate the session when no exercise matches", () => {
    const plan = createDefaultWorkoutPlan();
    const session = startWorkoutSession(plan, 1000);
    const applied = applyWorkoutVoiceLog(
      plan,
      session,
      "2 sets of 10 on curls",
      2000,
    );

    expect(applied).toEqual({
      success: false,
      session,
    });
  });
});
