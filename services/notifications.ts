import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";

function getBundleId(): string | null {
  try {
    const cfg: any = Constants.expoConfig ?? (Constants as any).manifest ?? (Constants as any).manifest2;
    if (Platform.OS === "ios") {
      return cfg?.ios?.bundleIdentifier ?? cfg?.extra?.eas?.iosBundleIdentifier ?? "com.codex.MakaleSwiftUI.iOS";
    }
    if (Platform.OS === "android") {
      return cfg?.android?.package ?? "com.codex.makaleswiftui";
    }
  } catch {}
  return Platform.OS === "ios" ? "com.codex.MakaleSwiftUI.iOS" : Platform.OS === "android" ? "com.codex.makaleswiftui" : null;
}

const BASE =
  process.env["EXPO_PUBLIC_API_URL"] ??
  (process.env["EXPO_PUBLIC_DOMAIN"]
    ? `https://${process.env["EXPO_PUBLIC_DOMAIN"]}/api`
    : "https://medical-library-hub.replit.app/api");

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotifications(token: string): Promise<void> {
  if (Platform.OS === "web") return;
  if (!Device.isDevice) return;

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") return;

    const expoPushToken = await Notifications.getExpoPushTokenAsync();
    if (!expoPushToken.data) return;

    const bundleId = getBundleId();

    await fetch(`${BASE}/notifications/push-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ token: expoPushToken.data, bundleId, platform: Platform.OS }),
    });
  } catch {
  }
}
