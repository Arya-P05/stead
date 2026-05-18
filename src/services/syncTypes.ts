import type {
  DailyOutcome,
  StepSample,
  WorkoutOutcome,
} from "../data/appState";
import type { WorkoutExercise, WorkoutPlan } from "../domain/workoutSession";

type Row<T> = T & {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
};

export type WorkoutPlanRow = Row<{
  local_id: string;
  name: string;
  archived_at: string | null;
}>;

export type WorkoutExerciseRow = Row<{
  plan_local_id: string;
  local_id: string;
  name: string;
  position: number;
  target_sets: number;
  target_reps: number | null;
  weight_lb: number | null;
  rest_seconds: number;
}>;

export type WorkoutOutcomeRow = Row<{
  local_id: string;
  plan_local_id: string;
  name: string;
  started_at: string;
  completed_at: string;
  total_sets: number;
  exercises: WorkoutOutcome["exercises"];
}>;

export type DailyPlanRow = Row<{
  date: string;
}>;

export type DailyItemRow = Row<{
  local_id: string;
  date: string;
  title: string;
  kind: "task" | "workout";
  workout_plan_local_id: string | null;
  position: number;
  completed_at: string | null;
}>;

export type StepSampleRow = {
  id: string;
  user_id: string;
  captured_at: string;
  steps: number;
  source: StepSample["source"];
  created_at: string;
};

export type NotificationPreferencesRow = {
  user_id: string;
  enabled: boolean;
  updated_at: string;
};

export type SteadDatabase = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          apple_user_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          apple_user_id?: string | null;
        };
        Update: {
          apple_user_id?: string | null;
          updated_at?: string;
        };
      };
      workout_plans: Table<WorkoutPlanRow>;
      workout_exercises: Table<WorkoutExerciseRow>;
      workout_outcomes: Table<WorkoutOutcomeRow>;
      daily_plans: Table<DailyPlanRow>;
      daily_items: Table<DailyItemRow>;
      step_samples: Table<StepSampleRow>;
      notification_preferences: Table<NotificationPreferencesRow>;
    };
  };
};

export type SyncSnapshot = {
  workoutPlans: WorkoutPlan[];
  workoutExercises: Record<string, WorkoutExercise[]>;
  workoutOutcomes: WorkoutOutcome[];
  dailyOutcomes: DailyOutcome[];
  stepSamples: StepSample[];
};

type Table<T> = {
  Row: T;
  Insert: Partial<T>;
  Update: Partial<T>;
};
