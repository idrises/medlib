import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, AppState, AppStateStatus, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/contexts/AuthContext";
import { BACKGROUND_RELOCK_DELAY_MS, useSettings } from "@/contexts/SettingsContext";
import { useColors } from "@/hooks/useColors";

let LocalAuthentication: typeof import("expo-local-authentication") | null = null;
try { LocalAuthentication = require("expo-local-authentication"); } catch {}

let ScreenCapture: typeof import("expo-screen-capture") | null = null;
try { ScreenCapture = require("expo-screen-capture"); } catch {}

type LockState = "idle" | "prompting" | "unlocked" | "failed";

export function BiometricLockGate({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  const { user, isLoading: authLoading } = useAuth();
  const { settings, ready: settingsReady } = useSettings();

  const nativeAvailable = !!LocalAuthentication && !!ScreenCapture;
  const safeSettings = settings ?? {};
  const enabled = !!user && !!safeSettings.biometricUnlock && nativeAvailable;

  const [state, setState] = useState<LockState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);
  const promptInFlightRef = useRef(false);
  const lastBackgroundedAtRef = useRef<number | null>(null);

  const runPrompt = useCallback(async () => {
    if (promptInFlightRef.current) return;
    if (Platform.OS === "web") {
      setState("unlocked");
      return;
    }
    promptInFlightRef.current = true;
    setState("prompting");
    setErrorMessage(null);
    try {
      if (!LocalAuthentication) { setState("unlocked"); return; }
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !isEnrolled) {
        setState("unlocked");
        return;
      }
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "MedLib'i açmak için doğrulayın",
        cancelLabel: "İptal",
        disableDeviceFallback: false,
        fallbackLabel: "Cihaz şifresini kullan",
      });
      if (result.success) {
        setState("unlocked");
      } else {
        setState("failed");
        setErrorMessage(
          result.error === "user_cancel" || result.error === "system_cancel"
            ? "Doğrulama iptal edildi."
            : "Doğrulama başarısız."
        );
      }
    } catch {
      setState("failed");
      setErrorMessage("Doğrulama sırasında bir hata oluştu.");
    } finally {
      promptInFlightRef.current = false;
    }
  }, []);

  // Cold-start gate: when auth + settings are ready and the user has the
  // toggle on, lock until biometrics succeed.
  useEffect(() => {
    if (authLoading || !settingsReady) return;
    if (!enabled) {
      setState("unlocked");
      return;
    }
    if (state === "idle") {
      runPrompt();
    }
  }, [authLoading, settingsReady, enabled, state, runPrompt]);

  // Re-lock after backgrounding for more than the user-configured delay.
  // Also tracks the current AppState so we can hide private content from the
  // OS app-switcher snapshot while the app is inactive/backgrounded.
  const relockMs = BACKGROUND_RELOCK_DELAY_MS[safeSettings.backgroundRelockDelay ?? "1m"];
  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      setAppState(next);
      if (next === "background" || next === "inactive") {
        lastBackgroundedAtRef.current = Date.now();
      } else if (next === "active") {
        const since = lastBackgroundedAtRef.current;
        lastBackgroundedAtRef.current = null;
        if (since != null && Date.now() - since >= relockMs) {
          setState("idle");
        }
      }
    });
    return () => sub.remove();
  }, [enabled, relockMs]);

  // If the user turns the toggle off while locked, release immediately.
  useEffect(() => {
    if (!enabled && state !== "unlocked") {
      setState("unlocked");
    }
  }, [enabled, state]);

  // Prevent screenshots / screen recording while the biometric lock is on
  // (Android: FLAG_SECURE; iOS: blacks out captured frames + recording overlay).
  // Gated on the same setting as the snapshot shield so opt-out users see no change.
  useEffect(() => {
    if (Platform.OS === "web" || !ScreenCapture) return;
    if (!enabled) return;
    const key = "biometric-lock";
    ScreenCapture.preventScreenCaptureAsync(key).catch(() => {});
    return () => {
      ScreenCapture.allowScreenCaptureAsync(key).catch(() => {});
    };
  }, [enabled]);

  // iOS-only: the OS can't fully suppress the screenshot button press, so
  // listen for the event and warn the user that their captured frame is
  // blank by design. Android's FLAG_SECURE blocks the event entirely.
  useEffect(() => {
    if (Platform.OS !== "ios" || !ScreenCapture) return;
    if (!enabled) return;
    const sub = ScreenCapture.addScreenshotListener(() => {
      Alert.alert(
        "Ekran görüntüsü engellendi",
        "Gizlilik kilidi açıkken hassas içerik için ekran görüntüsü ve ekran kaydı devre dışıdır.",
      );
    });
    return () => sub.remove();
  }, [enabled]);

  if (authLoading || !settingsReady) return null;

  // While biometric lock is enabled, hide the underlying UI from the OS
  // snapshot whenever the app is not in the active state. We keep the
  // children mounted underneath so we don't tear down the navigation stack
  // every time the app is briefly backgrounded.
  const obscureForSnapshot = enabled && appState !== "active";

  if (!enabled || (state === "unlocked" && !obscureForSnapshot)) {
    return <>{children}</>;
  }

  if (state === "unlocked") {
    return (
      <View style={styles.fill}>
        {children}
        <View
          style={[StyleSheet.absoluteFill, styles.snapshotShield, { backgroundColor: colors.background }]}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <View style={[styles.iconWrap, { backgroundColor: colors.secondary }]}>
            <Feather name="lock" size={48} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>MedLib</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.iconWrap, { backgroundColor: colors.secondary }]}>
        <Feather name="lock" size={48} color={colors.primary} />
      </View>
      <Text style={[styles.title, { color: colors.foreground }]}>MedLib kilitli</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        Devam etmek için Face ID / Touch ID ile doğrulayın.
      </Text>
      {state === "prompting" ? (
        <ActivityIndicator style={styles.spinner} color={colors.primary} />
      ) : null}
      {state === "failed" && errorMessage ? (
        <Text style={[styles.error, { color: colors.destructive }]}>{errorMessage}</Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        onPress={runPrompt}
        disabled={state === "prompting"}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: colors.primary, opacity: pressed || state === "prompting" ? 0.7 : 1 },
        ]}
      >
        <Feather name="unlock" size={18} color={colors.primaryForeground} />
        <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>
          {state === "failed" ? "Tekrar dene" : "Doğrula"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  snapshotShield: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  spinner: {
    marginBottom: 16,
  },
  error: {
    fontSize: 14,
    marginBottom: 16,
    textAlign: "center",
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
    minWidth: 180,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
