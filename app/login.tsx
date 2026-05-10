import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

const BASE =
  process.env["EXPO_PUBLIC_API_URL"] ??
  (process.env["EXPO_PUBLIC_DOMAIN"]
    ? `https://${process.env["EXPO_PUBLIC_DOMAIN"]}/api`
    : "https://medical-library-hub.replit.app/api");

const DEVICE_LABELS: Record<string, string> = {
  iphone: "iPhone", ipad: "iPad", mac: "Mac",
};

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { login, submitTotp } = useAuth();

  const [email, setEmail] = useState("");
  const [cdkeyInput, setCdkeyInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  // For reset request flow
  // Device mismatch flow
  const [mismatchDeviceType, setMismatchDeviceType] = useState<string | null>(null);
  const [mismatchDeviceId, setMismatchDeviceId] = useState<string | null>(null);
  const [requestState, setRequestState] = useState<"idle" | "loading" | "sent" | "pending">("idle");

  // TOTP step
  const [totpStep, setTotpStep] = useState(false);
  const [totpUserId, setTotpUserId] = useState<number | null>(null);
  const [totpTempToken, setTotpTempToken] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [totpLoading, setTotpLoading] = useState(false);
  const [totpError, setTotpError] = useState<string | null>(null);

  // Format cdkey: auto-insert dash after every 5 chars (max 3 groups = 17 chars)
  // Display value: XXXXX-XXXXX-XXXXX
  // Raw value sent to API: same (API normalizes anyway)
  const cdkey = cdkeyInput;

  function handleKeyChange(raw: string) {
    // Strip everything except alphanumeric, uppercase
    const stripped = raw.replace(/[^A-Z0-9a-z]/g, "").toUpperCase().slice(0, 15);
    // Re-insert dashes after every 5 chars
    const formatted = stripped.match(/.{1,5}/g)?.join("-") ?? stripped;
    setCdkeyInput(formatted);
    setError(null);
    setErrorCode(null);
    setRequestState("idle");
  }

  async function handleLogin() {
    if (!email.trim() || cdkey.length === 0) {
      setError("Email ve lisans anahtarı zorunludur.");
      setErrorCode(null);
      return;
    }
    setError(null);
    setErrorCode(null);
    setRequestState("idle");
    setLoading(true);
    const result = await login(email, cdkey);
    setLoading(false);
    if (result.ok) {
      router.replace("/(tabs)/" as never);
    } else if (result.requireTotp) {
      setTotpUserId(result.userId ?? null);
      setTotpTempToken(result.tempToken ?? null);
      setTotpStep(true);
    } else {
      setError(result.error ?? "Giriş başarısız.");
      setErrorCode(result.code ?? null);
      if (result.code === "DEVICE_MISMATCH") {
        setMismatchDeviceType(result.deviceType ?? null);
        setMismatchDeviceId(result.deviceId ?? null);
      }
    }
  }

  async function handleTotpSubmit() {
    if (!totpCode.trim() || !totpUserId || !totpTempToken) return;
    setTotpLoading(true);
    setTotpError(null);
    const result = await submitTotp(totpUserId, totpTempToken, totpCode);
    setTotpLoading(false);
    if (result.ok) {
      router.replace("/(tabs)/" as never);
    } else {
      setTotpError(result.error ?? "Geçersiz kod.");
      setTotpCode("");
    }
  }

  async function handleRequestReset() {
    if (!mismatchDeviceType || !mismatchDeviceId) return;
    setRequestState("loading");
    try {
      const res = await fetch(`${BASE}/auth/request-device-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          cdkey: cdkey.trim(),
          deviceType: mismatchDeviceType,
          newDeviceId: mismatchDeviceId,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setRequestState(data.alreadyPending ? "pending" : "sent");
      } else {
        setRequestState("idle");
        setError(data.error ?? "Talep gönderilemedi.");
      }
    } catch {
      setRequestState("idle");
      setError("Sunucuya bağlanılamadı.");
    }
  }

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const deviceLabel = mismatchDeviceType ? (DEVICE_LABELS[mismatchDeviceType] ?? mismatchDeviceType) : "Cihaz";

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: topPad + 40, paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
        <View style={styles.logoArea}>
          <Image
            source={require("../assets/images/icon.png")}
            style={styles.logoImage}
            resizeMode="cover"
          />
        </View>

        {/* TOTP Card */}
        {totpStep ? (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={{ alignItems: "center", marginBottom: 18 }}>
              <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary + "18", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                <Feather name="shield" size={26} color={colors.primary} />
              </View>
              <Text style={[styles.cardTitle, { color: colors.foreground, textAlign: "center" }]}>İki Adımlı Doğrulama</Text>
              <Text style={[styles.cardSub, { color: colors.mutedForeground, textAlign: "center", marginBottom: 0 }]}>
                Google Authenticator uygulamasındaki 6 haneli kodu giriniz
              </Text>
            </View>

            {totpError ? (
              <View style={[styles.errorBox, { backgroundColor: "#DC262610", borderColor: "#DC262635", marginBottom: 14 }]}>
                <Feather name="alert-circle" size={15} color="#DC2626" style={{ marginTop: 1 }} />
                <Text style={styles.errorText}>{totpError}</Text>
              </View>
            ) : null}

            <View style={styles.fieldWrap}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Doğrulama Kodu</Text>
              <View style={[styles.inputRow, { borderColor: colors.border, backgroundColor: colors.muted }]}>
                <Feather name="hash" size={18} color={colors.mutedForeground} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: colors.foreground, letterSpacing: 6, fontSize: 22, fontFamily: "Inter_700Bold" }]}
                  placeholder="000000"
                  placeholderTextColor={colors.mutedForeground}
                  value={totpCode}
                  onChangeText={v => { setTotpCode(v.replace(/\D/g, "").slice(0, 6)); setTotpError(null); }}
                  keyboardType="number-pad"
                  maxLength={6}
                  returnKeyType="done"
                  onSubmitEditing={handleTotpSubmit}
                  autoFocus
                />
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [styles.loginBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
              onPress={handleTotpSubmit}
              disabled={totpLoading || totpCode.length < 6}
            >
              {totpLoading ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <>
                  <Feather name="check-circle" size={18} color="#FFF" />
                  <Text style={styles.loginBtnText}>Doğrula</Text>
                </>
              )}
            </Pressable>

            <Pressable onPress={() => { setTotpStep(false); setTotpCode(""); setTotpError(null); }} style={{ marginTop: 14, alignItems: "center" }}>
              <Text style={{ color: colors.mutedForeground, fontSize: 13, fontFamily: "Inter_400Regular" }}>← Geri dön</Text>
            </Pressable>
          </View>
        ) : (

        /* Normal login Card */
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Giriş Yap</Text>
          <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>
            Email adresinizi ve lisans anahtarınızı giriniz
          </Text>

          {/* Email */}
          <View style={styles.fieldWrap}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Email</Text>
            <View style={[styles.inputRow, { borderColor: colors.border, backgroundColor: colors.muted }]}>
              <Feather name="mail" size={18} color={colors.mutedForeground} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                placeholder="ornek@email.com"
                placeholderTextColor={colors.mutedForeground}
                value={email}
                onChangeText={v => { setEmail(v); setError(null); setErrorCode(null); setRequestState("idle"); }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
              />
            </View>
          </View>

          {/* License Key */}
          <View style={styles.fieldWrap}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Lisans Anahtarı</Text>
            <View style={[styles.inputRow, {
              borderColor: cdkeyInput.length > 0 ? colors.primary : colors.border,
              backgroundColor: colors.muted,
            }]}>
              <Feather name="key" size={18} color={colors.mutedForeground} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: colors.foreground, letterSpacing: 2, fontFamily: "Inter_700Bold", fontSize: 16 }]}
                placeholder="XXXXX-XXXXX-XXXXX"
                placeholderTextColor={colors.mutedForeground}
                value={cdkeyInput}
                onChangeText={handleKeyChange}
                autoCapitalize="characters"
                autoCorrect={false}
                keyboardType="default"
                maxLength={17}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
                selectionColor={colors.primary}
              />
            </View>
          </View>

          {/* Error */}
          {error ? (
            <View style={[styles.errorBox, { backgroundColor: "#DC262610", borderColor: "#DC262635" }]}>
              <Feather name="alert-circle" size={15} color="#DC2626" style={{ marginTop: 1 }} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Device mismatch panel */}
          {errorCode === "DEVICE_MISMATCH" ? (
            <View style={[styles.devicePanel, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <View style={styles.devicePanelHeader}>
                <Feather name="smartphone" size={16} color="#D97706" />
                <Text style={[styles.devicePanelTitle, { color: colors.foreground }]}>
                  {deviceLabel} değişikliği
                </Text>
              </View>

              {requestState === "sent" ? (
                <View style={styles.successRow}>
                  <Feather name="check-circle" size={18} color="#16A34A" />
                  <Text style={styles.successText}>
                    Talebiniz yöneticiye iletildi. Onaylandıktan sonra giriş yapabilirsiniz.
                  </Text>
                </View>
              ) : requestState === "pending" ? (
                <View style={styles.successRow}>
                  <Feather name="clock" size={18} color="#D97706" />
                  <Text style={[styles.successText, { color: "#D97706" }]}>
                    Cihaz değişikliği talebiniz zaten beklemede. Yönetici onayını bekleyin.
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={[styles.devicePanelBody, { color: colors.mutedForeground }]}>
                    Bu hesap başka bir {deviceLabel}'a kayıtlı. Yeni cihazınızı kaydetmek için yöneticiden onay isteyebilirsiniz.
                  </Text>
                  <Pressable
                    style={[styles.requestBtn, { backgroundColor: "#D97706" }]}
                    onPress={handleRequestReset}
                    disabled={requestState === "loading"}
                  >
                    {requestState === "loading" ? (
                      <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                      <>
                        <Feather name="send" size={15} color="#FFF" />
                        <Text style={styles.requestBtnText}>Cihaz Değişikliği Talep Et</Text>
                      </>
                    )}
                  </Pressable>
                </>
              )}
            </View>
          ) : null}

          {/* Login Button */}
          <Pressable
            style={({ pressed }) => [
              styles.loginBtn,
              { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
            ]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <>
                <Feather name="log-in" size={18} color="#FFF" />
                <Text style={styles.loginBtnText}>Giriş Yap</Text>
              </>
            )}
          </Pressable>
        </View>
        )}

        <Text style={[styles.footer, { color: colors.mutedForeground }]}>
          Lisans anahtarınız üyelik başvurusu sırasında size iletilmiştir.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingHorizontal: 24, alignItems: "center" },
  logoArea: { alignItems: "center", marginBottom: 32 },
  logoImage: { width: 160, height: 160, borderRadius: 32 },
  card: {
    width: "100%", maxWidth: 420, borderRadius: 16, borderWidth: 1, padding: 24,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },
  cardTitle: { fontSize: 22, fontFamily: "Inter_700Bold", marginBottom: 4 },
  cardSub: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 24, lineHeight: 18 },
  fieldWrap: { marginBottom: 16 },
  label: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
  inputRow: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, height: 48 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  errorBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: 8, borderWidth: 1, marginBottom: 12 },
  errorText: { flex: 1, color: "#DC2626", fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  devicePanel: { borderRadius: 10, borderWidth: 1, padding: 14, marginBottom: 16, gap: 10 },
  devicePanelHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  devicePanelTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  devicePanelBody: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  requestBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingVertical: 11, borderRadius: 9,
  },
  requestBtnText: { color: "#FFF", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  successRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  successText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18, color: "#16A34A" },
  loginBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    height: 50, borderRadius: 12, marginTop: 4,
  },
  loginBtnText: { color: "#FFF", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  footer: { marginTop: 24, fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 18, maxWidth: 300 },
});
