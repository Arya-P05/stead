import AsyncStorage from "@react-native-async-storage/async-storage";
import type { StorageAdapter } from "./storage";

export const ONBOARDING_STATE_KEY = "stead.onboarding-state";

export type OnboardingState = {
  version: 1;
  completedAt: number | null;
  accountConnectedAt: number | null;
  healthConnectedAt: number | null;
  notificationsEnabledAt: number | null;
  workoutPlanSetAt: number | null;
};

const initialOnboardingState: OnboardingState = {
  version: 1,
  completedAt: null,
  accountConnectedAt: null,
  healthConnectedAt: null,
  notificationsEnabledAt: null,
  workoutPlanSetAt: null,
};

export const onboardingStorage: StorageAdapter = AsyncStorage;

export async function loadOnboardingState(
  storage: StorageAdapter = onboardingStorage,
): Promise<OnboardingState> {
  const stored = await storage.getItem(ONBOARDING_STATE_KEY);

  if (stored === null) {
    return initialOnboardingState;
  }

  try {
    return migrateOnboardingState(JSON.parse(stored));
  } catch {
    return initialOnboardingState;
  }
}

export async function saveOnboardingState(
  state: OnboardingState,
  storage: StorageAdapter = onboardingStorage,
) {
  await storage.setItem(ONBOARDING_STATE_KEY, JSON.stringify(state));
}

export function migrateOnboardingState(stored: unknown): OnboardingState {
  if (!isStoredOnboardingState(stored)) {
    return initialOnboardingState;
  }

  return {
    version: 1,
    completedAt: numberOrNull(stored.completedAt),
    accountConnectedAt: numberOrNull(stored.accountConnectedAt),
    healthConnectedAt: numberOrNull(stored.healthConnectedAt),
    notificationsEnabledAt: numberOrNull(stored.notificationsEnabledAt),
    workoutPlanSetAt: numberOrNull(stored.workoutPlanSetAt),
  };
}

export function markOnboardingAccountConnected(
  state: OnboardingState,
  connectedAt = Date.now(),
): OnboardingState {
  return {
    ...state,
    accountConnectedAt: connectedAt,
  };
}

export function markOnboardingHealthConnected(
  state: OnboardingState,
  connectedAt = Date.now(),
): OnboardingState {
  return {
    ...state,
    healthConnectedAt: connectedAt,
  };
}

export function markOnboardingNotificationsEnabled(
  state: OnboardingState,
  enabledAt = Date.now(),
): OnboardingState {
  return {
    ...state,
    notificationsEnabledAt: enabledAt,
  };
}

export function markOnboardingWorkoutPlanSet(
  state: OnboardingState,
  setAt = Date.now(),
): OnboardingState {
  return {
    ...state,
    workoutPlanSetAt: setAt,
  };
}

export function completeOnboarding(
  state: OnboardingState,
  completedAt = Date.now(),
): OnboardingState {
  return {
    ...state,
    completedAt,
  };
}

export function resetOnboardingState(): OnboardingState {
  return initialOnboardingState;
}

function isStoredOnboardingState(
  value: unknown,
): value is Partial<OnboardingState> {
  return typeof value === "object" && value !== null;
}

function numberOrNull(value: unknown) {
  return typeof value === "number" ? value : null;
}
