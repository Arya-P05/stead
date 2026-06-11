import * as Notifications from "expo-notifications";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

type PermissionResponse = {
  status: string;
  granted?: boolean;
};

export type NotificationAdapter = {
  getPermissionsAsync: () => Promise<PermissionResponse>;
  requestPermissionsAsync: () => Promise<PermissionResponse>;
  cancelScheduledNotificationAsync?: (identifier: string) => Promise<void>;
  scheduleNotificationAsync: (request: {
    identifier: string;
    content: {
      title: string;
      subtitle?: string;
      body: string;
      sound: boolean;
      data: { source: string; screen?: string };
    };
    trigger:
      | {
          type: "timeInterval";
          seconds: number;
        }
      | {
          type: "calendar";
          hour: number;
          minute: number;
          repeats: boolean;
        };
  }) => Promise<string>;
};

export type RecommendationNudge = {
  identifier: string;
  title: string;
  body: string;
  secondsFromNow: number;
};

export async function scheduleRecommendationNudge(
  nudge: RecommendationNudge,
  adapter: NotificationAdapter = Notifications as unknown as NotificationAdapter,
) {
  const permissions = await adapter.getPermissionsAsync();
  if (permissions.status === "denied") {
    return null;
  }

  const finalPermissions =
    permissions.status === "granted"
      ? permissions
      : await adapter.requestPermissionsAsync();

  if (finalPermissions.status !== "granted" && !finalPermissions.granted) {
    return null;
  }

  return adapter.scheduleNotificationAsync({
    identifier: nudge.identifier,
    content: {
      title: nudge.title,
      body: nudge.body,
      sound: false,
      data: { source: "stead" },
    },
    trigger: {
      type: "timeInterval",
      seconds: nudge.secondsFromNow,
    },
  });
}

export type MorningWeighInReminder = {
  wakeTime: string;
  hasLoggedToday: boolean;
  now?: Date;
};

export async function scheduleMorningWeighInReminder(
  reminder: MorningWeighInReminder,
  adapter: NotificationAdapter = Notifications as unknown as NotificationAdapter,
) {
  const identifier = "stead-morning-weigh-in";

  const permissions = await adapter.getPermissionsAsync();
  if (permissions.status === "denied") {
    return null;
  }

  const finalPermissions =
    permissions.status === "granted"
      ? permissions
      : await adapter.requestPermissionsAsync();

  if (finalPermissions.status !== "granted" && !finalPermissions.granted) {
    return null;
  }

  const [hourText, minuteText] = reminder.wakeTime.split(":");
  const hour = Number.parseInt(hourText ?? "6", 10);
  const minute = Number.parseInt(minuteText ?? "30", 10);
  const triggerDate = getNextMorningWeighInDate({
    hasLoggedToday: reminder.hasLoggedToday,
    hour: Number.isFinite(hour) ? hour : 6,
    minute: Number.isFinite(minute) ? minute : 30,
    now: reminder.now ?? new Date(),
  });
  const seconds = Math.max(
    1,
    Math.round(
      (triggerDate.getTime() - (reminder.now ?? new Date()).getTime()) / 1000,
    ),
  );

  await adapter.cancelScheduledNotificationAsync?.(identifier);

  return adapter.scheduleNotificationAsync({
    identifier,
    content: {
      title: "stead",
      subtitle: "good morning",
      body: "step on the scale — log today's weight before the day starts.",
      sound: false,
      data: { source: "stead", screen: "morning-weigh-in" },
    },
    trigger: {
      type: "timeInterval",
      seconds,
    },
  });
}

function getNextMorningWeighInDate({
  hasLoggedToday,
  hour,
  minute,
  now,
}: {
  hasLoggedToday: boolean;
  hour: number;
  minute: number;
  now: Date;
}) {
  const target = new Date(now);
  target.setHours(hour, minute, 0, 0);

  if (hasLoggedToday || target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }

  return target;
}

export function addMorningWeighInResponseListener(onOpen: () => void) {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    if (
      response.notification.request.content.data?.screen === "morning-weigh-in"
    ) {
      onOpen();
    }
  });
}
