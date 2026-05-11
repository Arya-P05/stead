import { scheduleRecommendationNudge } from "./notifications";

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
      scheduleRecommendationNudge(adapter, {
        identifier: "stead-next-action",
        title: "you've been at it three hours.",
        body: "walk · ten min · sun is out",
        secondsFromNow: 60,
      }),
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
      scheduleRecommendationNudge(adapter, {
        identifier: "stead-next-action",
        title: "walk",
        body: "ten min",
        secondsFromNow: 60,
      }),
    ).resolves.toBeNull();
    expect(adapter.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});
