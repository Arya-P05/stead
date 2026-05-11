import type { StepSample } from "../data/appState";

export type HealthKitAdapter = {
  requestStepAuthorization: () => Promise<boolean>;
  readTodaySteps: () => Promise<number>;
};

export type StepSyncResult =
  | {
      status: "success";
      sample: StepSample;
    }
  | {
      status: "denied";
    };

export async function syncTodaySteps(
  adapter: HealthKitAdapter,
): Promise<StepSample | null> {
  const result = await syncTodayStepsWithStatus(adapter);

  return result.status === "success" ? result.sample : null;
}

export async function syncTodayStepsWithStatus(
  adapter: HealthKitAdapter,
): Promise<StepSyncResult> {
  const authorized = await adapter.requestStepAuthorization();

  if (!authorized) {
    return { status: "denied" };
  }

  return {
    status: "success",
    sample: {
      capturedAt: Date.now(),
      steps: await adapter.readTodaySteps(),
      source: "health",
    },
  };
}
