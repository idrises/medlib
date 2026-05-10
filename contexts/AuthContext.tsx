import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Application from "expo-application";
import * as Device from "expo-device";
import * as SecureStore from "expo-secure-store";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import { registerForPushNotifications } from "@/services/notifications";

const TOKEN_KEY = "medlib_auth_token";
const USER_KEY = "medlib_auth_user";
const WEB_DEVICE_KEY = "medlib_web_device_id";
const SECURE_DEVICE_KEY = "medlib_device_id_v1";

async function getOrCreateStableId(fallback: string): Promise<string> {
  try {
    const existing = await SecureStore.getItemAsync(SECURE_DEVICE_KEY);
    if (existing && existing.length > 0) return existing;
    const seed = fallback && fallback.length > 0
      ? fallback
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
    await SecureStore.setItemAsync(SECURE_DEVICE_KEY, seed, {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
    });
    return seed;
  } catch {
    return fallback;
  }
}

export interface AuthUser {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  subject: string;
  expireDate: string | null;
  activate: string | null;
  isAdmin?: boolean;
  role?: "super_admin" | "admin" | "user";
  aiAccess?: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, cdkey: string) => Promise<{
    ok: boolean; error?: string; code?: string;
    deviceType?: string; deviceId?: string;
    requireTotp?: boolean; tempToken?: string; userId?: number;
  }>;
  submitTotp: (userId: number, tempToken: string, code: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  token: null,
  isLoading: true,
  login: async () => ({ ok: false }),
  submitTotp: async () => ({ ok: false }),
  logout: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

const BASE =
  process.env["EXPO_PUBLIC_API_URL"] ??
  (process.env["EXPO_PUBLIC_DOMAIN"]
    ? `https://${process.env["EXPO_PUBLIC_DOMAIN"]}/api`
    : "https://medical-library-hub.replit.app/api");

async function getDeviceInfo(): Promise<{ deviceId: string; deviceType: string; deviceModel: string }> {
  if (Platform.OS === "web") {
    let id = await AsyncStorage.getItem(WEB_DEVICE_KEY);
    if (!id) {
      id = "web-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      await AsyncStorage.setItem(WEB_DEVICE_KEY, id);
    }
    return { deviceId: id, deviceType: "web", deviceModel: "Web Tarayıcı" };
  }

  if (Platform.OS === "ios") {
    const iosId = (await Application.getIosIdForVendorAsync()) ?? "";
    const stableId = await getOrCreateStableId(iosId);
    const dt = await Device.getDeviceTypeAsync();
    const deviceType =
      dt === Device.DeviceType.TABLET ? "ipad" :
      dt === Device.DeviceType.DESKTOP ? "mac" :
      "iphone";
    const deviceModel = Device.modelName ?? Device.deviceName ?? deviceType;
    return { deviceId: stableId, deviceType, deviceModel };
  }

  if (Platform.OS === "android") {
    const androidId = Application.getAndroidId() ?? "";
    const stableId = await getOrCreateStableId(androidId);
    const deviceModel = Device.modelName ?? Device.deviceName ?? "Android";
    return { deviceId: stableId, deviceType: "android", deviceModel };
  }

  return { deviceId: "", deviceType: "unknown", deviceModel: "Bilinmeyen" };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const tokenRef = useRef<string | null>(null);

  // Keep tokenRef in sync so AppState handler can access current token
  useEffect(() => { tokenRef.current = token; }, [token]);

  useEffect(() => {
    (async () => {
      try {
        const [storedToken, storedUser] = await Promise.all([
          AsyncStorage.getItem(TOKEN_KEY),
          AsyncStorage.getItem(USER_KEY),
        ]);
        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
        }
      } catch {
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // Check session validity when app comes to foreground AND every 30s while active
  useEffect(() => {
    const appStateRef = { current: AppState.currentState };
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const doCheck = async () => {
      const t = tokenRef.current;
      if (!t) return;
      try {
        const res = await fetch(`${BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${t}` },
          cache: "no-store",
        });
        if (res.status === 401) {
          await Promise.all([
            AsyncStorage.removeItem(TOKEN_KEY),
            AsyncStorage.removeItem(USER_KEY),
          ]);
          setToken(null);
          setUser(null);
        } else if (res.ok) {
          registerForPushNotifications(t);
        }
      } catch {}
    };

    const startPolling = () => {
      if (intervalId) return;
      intervalId = setInterval(doCheck, 30_000);
    };

    const stopPolling = () => {
      if (intervalId) { clearInterval(intervalId); intervalId = null; }
    };

    // Start polling immediately if app is already active
    if (appStateRef.current === "active") startPolling();

    const sub = AppState.addEventListener("change", state => {
      if (state === "active") { doCheck(); startPolling(); }
      else stopPolling();
    });

    return () => { sub.remove(); stopPolling(); };
  }, []);

  const login = useCallback(async (email: string, cdkey: string) => {
    try {
      const { deviceId, deviceType, deviceModel } = await getDeviceInfo();

      const res = await fetch(`${BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          cdkey: cdkey.trim(),
          deviceId,
          deviceType,
          deviceModel,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { ok: false, error: data.error ?? "Giriş başarısız.", code: data.code, deviceType, deviceId };
      }
      // Admin TOTP step required
      if (data.requireTotp) {
        return { ok: false, requireTotp: true, tempToken: data.tempToken, userId: data.userId };
      }
      await Promise.all([
        AsyncStorage.setItem(TOKEN_KEY, data.token),
        AsyncStorage.setItem(USER_KEY, JSON.stringify(data.user)),
      ]);
      setToken(data.token);
      setUser(data.user);
      registerForPushNotifications(data.token);
      return { ok: true };
    } catch {
      return { ok: false, error: "Sunucuya bağlanılamadı." };
    }
  }, []);

  const submitTotp = useCallback(async (userId: number, tempToken: string, code: string) => {
    try {
      const res = await fetch(`${BASE}/totp/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, tempToken, code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { ok: false, error: data.error ?? "Doğrulama başarısız." };
      }
      await Promise.all([
        AsyncStorage.setItem(TOKEN_KEY, data.token),
        AsyncStorage.setItem(USER_KEY, JSON.stringify(data.user)),
      ]);
      setToken(data.token);
      setUser(data.user);
      registerForPushNotifications(data.token);
      return { ok: true };
    } catch {
      return { ok: false, error: "Sunucuya bağlanılamadı." };
    }
  }, []);

  const logout = useCallback(async () => {
    await Promise.all([
      AsyncStorage.removeItem(TOKEN_KEY),
      AsyncStorage.removeItem(USER_KEY),
    ]);
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, submitTotp, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
