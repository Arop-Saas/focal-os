import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { useAppStore } from "@/lib/store";

// ─── Configure notification behavior ─────────────────────────────────────────

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// ─── Register for push notifications ─────────────────────────────────────────

export async function registerForPushNotifications(): Promise<string | null> {
  // Check existing permission
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Request permission if not granted
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("Push notification permission not granted");
    return null;
  }

  // Android needs a notification channel
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#1B4F9E",
    });
  }

  // Get push token
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    const token = tokenData.data;
    useAppStore.getState().setPushToken(token);
    return token;
  } catch (error) {
    console.error("Failed to get push token:", error);
    return null;
  }
}

// ─── Listen for incoming notifications ────────────────────────────────────────

export function addNotificationListener(
  callback: (notification: Notifications.Notification) => void
) {
  return Notifications.addNotificationReceivedListener(callback);
}

// Listen for notification taps (user tapped on a notification)
export function addNotificationResponseListener(
  callback: (response: Notifications.NotificationResponse) => void
) {
  return Notifications.addNotificationResponseReceivedListener(callback);
}
