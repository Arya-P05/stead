import type { StepSample } from "../data/appState";

export type HealthKitAdapter = {
  requestStepAuthorization: () => Promise<boolean>;
  readTodaySteps: () => Promise<number>;
};

export async function syncTodaySteps(
  adapter: HealthKitAdapter,
): Promise<StepSample | null> {
  const authorized = await adapter.requestStepAuthorization();

  if (!authorized) {
    return null;
  }

  return {
    capturedAt: Date.now(),
    steps: await adapter.readTodaySteps(),
    source: "health",
  };
}
