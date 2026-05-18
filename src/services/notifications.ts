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
  scheduleNotificationAsync: (request: {
    identifier: string;
    content: {
      title: string;
      body: string;
      sound: boolean;
      data: { source: string };
    };
    trigger: {
      type: "timeInterval";
      seconds: number;
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
