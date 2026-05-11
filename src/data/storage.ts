import AsyncStorage from "@react-native-async-storage/async-storage";
import { createInitialAppState } from "./appState";
import type { AppState } from "./appState";
import { normalizeWorkoutPlan } from "./workoutPlan";

export type StorageAdapter = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

export const APP_STATE_KEY = "stead.app-state";
export const appStorage: StorageAdapter = AsyncStorage;

export async function loadAppState(
  storage: StorageAdapter = appStorage,
): Promise<AppState> {
  const stored = await storage.getItem(APP_STATE_KEY);

  if (stored === null) {
    return createInitialAppState();
  }

  try {
    const parsed = JSON.parse(stored);

    if (parsed?.version !== 1) {
      return createInitialAppState();
    }

    return {
      ...createInitialAppState(),
      ...parsed,
      workoutPlan: normalizeWorkoutPlan(parsed.workoutPlan),
    };
  } catch {
    return createInitialAppState();
  }
}

export async function saveAppState(
  storage: StorageAdapter = appStorage,
  state: AppState,
): Promise<void> {
  await storage.setItem(APP_STATE_KEY, JSON.stringify(state));
}
