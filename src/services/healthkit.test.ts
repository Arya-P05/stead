import { syncTodaySteps } from './healthkit';

describe('syncTodaySteps', () => {
  it('requests HealthKit access and returns today steps', async () => {
    const adapter = {
      requestStepAuthorization: jest.fn(async () => true),
      readTodaySteps: jest.fn(async () => 7124),
    };

    await expect(syncTodaySteps(adapter)).resolves.toEqual({
      capturedAt: expect.any(Number),
      steps: 7124,
      source: 'health',
    });
    expect(adapter.requestStepAuthorization).toHaveBeenCalled();
    expect(adapter.readTodaySteps).toHaveBeenCalled();
  });

  it('returns null when authorization fails', async () => {
    const adapter = {
      requestStepAuthorization: jest.fn(async () => false),
      readTodaySteps: jest.fn(async () => 7124),
    };

    await expect(syncTodaySteps(adapter)).resolves.toBeNull();
    expect(adapter.readTodaySteps).not.toHaveBeenCalled();
  });
});
