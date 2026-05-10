import {
  queryStatisticsForQuantity,
  requestAuthorization,
} from '@kingstinct/react-native-healthkit';
import type { HealthKitAdapter } from './healthkit';

export const healthKitAdapter: HealthKitAdapter = {
  async requestStepAuthorization() {
    return requestAuthorization({
      toRead: ['HKQuantityTypeIdentifierStepCount'],
    });
  },
  async readTodaySteps() {
    const now = new Date();
    const start = new Date(now);

    start.setHours(0, 0, 0, 0);

    const response = await queryStatisticsForQuantity(
      'HKQuantityTypeIdentifierStepCount',
      ['cumulativeSum'],
      {
        filter: {
          date: {
            startDate: start,
            endDate: now,
          },
        },
        unit: 'count',
      },
    );

    return Math.round(response.sumQuantity?.quantity ?? 0);
  },
};
