jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

import {
  completeOnboarding,
  loadOnboardingState,
  markOnboardingAccountConnected,
  markOnboardingHealthConnected,
  markOnboardingNotificationsEnabled,
  markOnboardingWorkoutPlanSet,
  migrateOnboardingState,
  saveOnboardingState,
} from "./onboarding";
import type { StorageAdapter } from "./storage";

function createMemoryStorage(initial?: Record<string, string>): StorageAdapter {
  const data = new Map(Object.entries(initial ?? {}));

  return {
    getItem: jest.fn(async (key: string) => data.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      data.set(key, value);
    }),
  };
}

describe("onboarding state", () => {
  it("starts incomplete when nothing is saved", async () => {
    await expect(loadOnboardingState(createMemoryStorage())).resolves.toEqual({
      version: 1,
      completedAt: null,
      accountConnectedAt: null,
      healthConnectedAt: null,
      notificationsEnabledAt: null,
      workoutPlanSetAt: null,
    });
  });

  it("repairs invalid saved values", () => {
    expect(
      migrateOnboardingState({
        version: 1,
        completedAt: "soon",
        accountConnectedAt: 1000,
        healthConnectedAt: undefined,
        notificationsEnabledAt: 3000,
        workoutPlanSetAt: "done",
      }),
    ).toEqual({
      version: 1,
      completedAt: null,
      accountConnectedAt: 1000,
      healthConnectedAt: null,
      notificationsEnabledAt: 3000,
      workoutPlanSetAt: null,
    });
  });

  it("marks each setup milestone", () => {
    const state = {
      version: 1 as const,
      completedAt: null,
      accountConnectedAt: null,
      healthConnectedAt: null,
      notificationsEnabledAt: null,
      workoutPlanSetAt: null,
    };

    expect(
      completeOnboarding(
        markOnboardingWorkoutPlanSet(
          markOnboardingNotificationsEnabled(
            markOnboardingHealthConnected(
              markOnboardingAccountConnected(state, 1000),
              2000,
            ),
            3000,
          ),
          4000,
        ),
        5000,
      ),
    ).toEqual({
      version: 1,
      completedAt: 5000,
      accountConnectedAt: 1000,
      healthConnectedAt: 2000,
      notificationsEnabledAt: 3000,
      workoutPlanSetAt: 4000,
    });
  });

  it("saves and reloads onboarding state", async () => {
    const storage = createMemoryStorage();
    const state = completeOnboarding(
      {
        version: 1,
        completedAt: null,
        accountConnectedAt: 1000,
        healthConnectedAt: 2000,
        notificationsEnabledAt: 3000,
        workoutPlanSetAt: 4000,
      },
      5000,
    );

    await saveOnboardingState(state, storage);

    await expect(loadOnboardingState(storage)).resolves.toEqual(state);
  });
});
