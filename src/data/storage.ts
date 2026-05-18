import AsyncStorage from "@react-native-async-storage/async-storage";
import { CURRENT_APP_STATE_VERSION, createInitialAppState } from "./appState";
import type { AppState } from "./appState";
import { normalizeWorkoutPlan } from "./workoutPlan";

export type StorageAdapter = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

export const APP_STATE_KEY = "stead.app-state";
export const appStorage: StorageAdapter = AsyncStorage;

type StoredAppState = Partial<Omit<AppState, "version">> & {
  version?: number;
};

export async function loadAppState(
  storage: StorageAdapter = appStorage,
): Promise<AppState> {
  const stored = await storage.getItem(APP_STATE_KEY);

  if (stored === null) {
    return createInitialAppState();
  }

  try {
    return migrateAppState(JSON.parse(stored));
  } catch {
    return createInitialAppState();
  }
}

export function migrateAppState(stored: unknown): AppState {
  if (!isStoredAppState(stored)) {
    return createInitialAppState();
  }

  if (
    stored.version === 1 ||
    stored.version === 2 ||
    stored.version === CURRENT_APP_STATE_VERSION
  ) {
    return {
      ...createInitialAppState(),
      ...stored,
      version: CURRENT_APP_STATE_VERSION,
      workoutPlan: normalizeWorkoutPlan(stored.workoutPlan),
    };
  }

  return createInitialAppState();
}

export async function saveAppState(
  state: AppState,
  storage: StorageAdapter = appStorage,
): Promise<void> {
  await storage.setItem(APP_STATE_KEY, JSON.stringify(state));
}

function isStoredAppState(value: unknown): value is StoredAppState {
  return typeof value === "object" && value !== null;
}
