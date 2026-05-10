jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import { createInitialAppState } from './appState';
import { loadAppState, saveAppState } from './storage';
import type { StorageAdapter } from './storage';

function createMemoryStorage(initial?: Record<string, string>): StorageAdapter {
  const data = new Map(Object.entries(initial ?? {}));

  return {
    getItem: jest.fn(async (key: string) => data.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      data.set(key, value);
    }),
  };
}

describe('storage', () => {
  it('loads initial state when nothing is saved', async () => {
    await expect(loadAppState(createMemoryStorage())).resolves.toEqual(createInitialAppState());
  });

  it('loads initial state when saved json is corrupt', async () => {
    const storage = createMemoryStorage({
      'stead.app-state': '{nope',
    });

    await expect(loadAppState(storage)).resolves.toEqual(createInitialAppState());
  });

  it('loads initial state when saved version is unsupported', async () => {
    const storage = createMemoryStorage({
      'stead.app-state': JSON.stringify({ version: 99 }),
    });

    await expect(loadAppState(storage)).resolves.toEqual(createInitialAppState());
  });

  it('hydrates older v1 saves with the current defaults', async () => {
    const storage = createMemoryStorage({
      'stead.app-state': JSON.stringify({
        version: 1,
        dailyOutcomes: [],
        workoutOutcomes: [],
        activeWorkoutSession: null,
        exerciseWeights: {},
        stepSamples: [],
      }),
    });

    await expect(loadAppState(storage)).resolves.toEqual(createInitialAppState());
  });

  it('repairs a broken saved workout plan', async () => {
    const storage = createMemoryStorage({
      'stead.app-state': JSON.stringify({
        ...createInitialAppState(),
        workoutPlan: {
          id: 'push-day',
          name: '',
          exercises: [{ id: 'incline-db-press', name: '', targetSets: 0, restSeconds: 0 }],
        },
      }),
    });

    await expect(loadAppState(storage)).resolves.toEqual(createInitialAppState());
  });

  it('saves and reloads app state', async () => {
    const storage = createMemoryStorage();
    const state = {
      ...createInitialAppState(),
      stepSamples: [{ capturedAt: 1000, steps: 6400, source: 'health' as const }],
    };

    await saveAppState(storage, state);

    await expect(loadAppState(storage)).resolves.toEqual(state);
  });
});
