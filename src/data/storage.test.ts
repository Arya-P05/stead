jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

import { createInitialAppState } from "./appState";
import { loadAppState, migrateAppState, saveAppState } from "./storage";
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

describe("storage", () => {
  it("loads initial state when nothing is saved", async () => {
    await expect(loadAppState(createMemoryStorage())).resolves.toEqual(
      createInitialAppState(),
    );
  });

  it("loads initial state when saved json is corrupt", async () => {
    const storage = createMemoryStorage({
      "stead.app-state": "{nope",
    });

    await expect(loadAppState(storage)).resolves.toEqual(
      createInitialAppState(),
    );
  });

  it("loads initial state when saved version is unsupported", async () => {
    const storage = createMemoryStorage({
      "stead.app-state": JSON.stringify({ version: 99 }),
    });

    await expect(loadAppState(storage)).resolves.toEqual(
      createInitialAppState(),
    );
  });

  it("migrates older v1 saves with the current defaults", async () => {
    const storage = createMemoryStorage({
      "stead.app-state": JSON.stringify({
        version: 1,
        dailyOutcomes: [],
        workoutOutcomes: [],
        activeWorkoutSession: null,
        exerciseWeights: {},
        stepSamples: [],
      }),
    });

    await expect(loadAppState(storage)).resolves.toEqual(
      createInitialAppState(),
    );
  });

  it("keeps valid saved fields when migrating from v1", () => {
    expect(
      migrateAppState({
        version: 1,
        dailyOutcomes: [
          {
            date: "2026-05-18",
            completedItems: 1,
            plannedItems: 3,
            steps: 6000,
            focusMinutes: 90,
          },
        ],
      }).dailyOutcomes,
    ).toEqual([
      {
        date: "2026-05-18",
        completedItems: 1,
        plannedItems: 3,
        steps: 6000,
        focusMinutes: 90,
      },
    ]);
  });

  it("repairs a broken saved workout plan", async () => {
    const storage = createMemoryStorage({
      "stead.app-state": JSON.stringify({
        ...createInitialAppState(),
        workoutPlan: {
          id: "push-day",
          name: "",
          exercises: [
            { id: "incline-db-press", name: "", targetSets: 0, restSeconds: 0 },
          ],
        },
      }),
    });

    await expect(loadAppState(storage)).resolves.toEqual(
      createInitialAppState(),
    );
  });

  it("saves and reloads app state", async () => {
    const storage = createMemoryStorage();
    const state = {
      ...createInitialAppState(),
      stepSamples: [
        { capturedAt: 1000, steps: 6400, source: "health" as const },
      ],
    };

    await saveAppState(state, storage);

    await expect(loadAppState(storage)).resolves.toEqual(state);
  });
});
