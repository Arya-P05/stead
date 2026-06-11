import {
  scheduleMorningWeighInReminder,
  scheduleRecommendationNudge,
} from "./notifications";

function createAdapter(
  status: "granted" | "denied" | "undetermined" = "granted",
) {
  return {
    cancelScheduledNotificationAsync: jest.fn(async () => undefined),
    getPermissionsAsync: jest.fn(async () => ({
      status,
      granted: status === "granted",
    })),
    requestPermissionsAsync: jest.fn(async () => ({
      status: "granted",
      granted: true,
    })),
    scheduleNotificationAsync: jest.fn(async () => "notification-id"),
  };
}

describe("scheduleRecommendationNudge", () => {
  it("requests permission and schedules a quiet local nudge", async () => {
    const adapter = createAdapter("undetermined");

    await expect(
      scheduleRecommendationNudge(
        {
          identifier: "stead-next-action",
          title: "you've been at it three hours.",
          body: "walk · ten min · sun is out",
          secondsFromNow: 60,
        },
        adapter,
      ),
    ).resolves.toBe("notification-id");
    expect(adapter.requestPermissionsAsync).toHaveBeenCalled();
    expect(adapter.scheduleNotificationAsync).toHaveBeenCalledWith({
      identifier: "stead-next-action",
      content: {
        title: "you've been at it three hours.",
        body: "walk · ten min · sun is out",
        sound: false,
        data: { source: "stead" },
      },
      trigger: {
        type: "timeInterval",
        seconds: 60,
      },
    });
  });

  it("does not schedule when permission is denied", async () => {
    const adapter = createAdapter("denied");

    await expect(
      scheduleRecommendationNudge(
        {
          identifier: "stead-next-action",
          title: "walk",
          body: "ten min",
          secondsFromNow: 60,
        },
        adapter,
      ),
    ).resolves.toBeNull();
    expect(adapter.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});

describe("scheduleMorningWeighInReminder", () => {
  it("schedules the morning weigh-in payload at the user's wake time", async () => {
    const adapter = createAdapter("granted");

    await expect(
      scheduleMorningWeighInReminder(
        {
          wakeTime: "06:30",
          hasLoggedToday: false,
          now: new Date("2026-06-08T06:00:00.000-04:00"),
        },
        adapter,
      ),
    ).resolves.toBe("notification-id");
    expect(adapter.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      "stead-morning-weigh-in",
    );
    expect(adapter.scheduleNotificationAsync).toHaveBeenCalledWith({
      identifier: "stead-morning-weigh-in",
      content: {
        title: "stead",
        subtitle: "good morning",
        body: "step on the scale — log today's weight before the day starts.",
        sound: false,
        data: { source: "stead", screen: "morning-weigh-in" },
      },
      trigger: {
        type: "timeInterval",
        seconds: 1800,
      },
    });
  });

  it("schedules tomorrow when today's weight is already logged", async () => {
    const adapter = createAdapter("granted");

    await expect(
      scheduleMorningWeighInReminder(
        {
          wakeTime: "06:30",
          hasLoggedToday: true,
          now: new Date("2026-06-08T06:00:00.000-04:00"),
        },
        adapter,
      ),
    ).resolves.toBe("notification-id");
    expect(adapter.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      "stead-morning-weigh-in",
    );
    expect(adapter.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: {
          type: "timeInterval",
          seconds: 88200,
        },
      }),
    );
  });
});
