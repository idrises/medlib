import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import ActivityView, { ActivityData } from "@/components/ActivityView";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

const BASE =
  process.env["EXPO_PUBLIC_API_URL"] ??
  (process.env["EXPO_PUBLIC_DOMAIN"]
    ? `https://${process.env["EXPO_PUBLIC_DOMAIN"]}/api`
    : "https://medical-library-hub.replit.app/api");

type MyDevice = { type: string; label: string; model: string | null; registered: boolean };

export default function DevicesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, token } = useAuth();

  const [myDevices, setMyDevices] = useState<MyDevice[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [activity, setActivity] = useState<ActivityData | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    setDevicesLoading(true);
    fetch(`${BASE}/auth/my-devices`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setMyDevices(d.devices ?? []))
      .catch(() => {})
      .finally(() => setDevicesLoading(false));
    setActivityLoading(true);
    fetch(`${BASE}/me/activity`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setActivity(d))
      .catch(() => {})
      .finally(() => setActivityLoading(false));
  }, [token]);

  const topPad = Platform.OS === "web" ? 40 : insets.top;
  const bottomPad = Platform.OS === "web" ? 40 : insets.bottom + 30;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Feather name="chevron-left" size={26} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground }]}>Cihazlarım & Kullanım</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomPad }}>
        {devicesLoading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <>
            <Text style={{ color: colors.mutedForeground, fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
              Kayıtlı Cihazlarım
            </Text>
            {myDevices.filter(d => d.registered).length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: 20 }}>
                <Feather name="smartphone" size={36} color={colors.mutedForeground} />
                <Text style={{ color: colors.mutedForeground, marginTop: 10, fontFamily: "Inter_400Regular", fontSize: 13, textAlign: "center" }}>
                  Henüz kayıtlı cihaz yok.{"\n"}Bir sonraki girişinizde cihazınız otomatik kaydedilir.
                </Text>
              </View>
            ) : (
              myDevices.filter(d => d.registered).map(d => (
                <View key={d.type} style={{
                  flexDirection: "row", alignItems: "center", gap: 14,
                  backgroundColor: colors.card, borderRadius: 12, borderWidth: 1,
                  borderColor: colors.border, padding: 14, marginBottom: 10,
                }}>
                  <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: colors.primary + "15", alignItems: "center", justifyContent: "center" }}>
                    <Feather
                      name={d.type === "ipad" ? "tablet" : d.type === "mac" ? "monitor" : "smartphone"}
                      size={18} color={colors.primary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>{d.label}</Text>
                    <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 }}>
                      {d.model ?? "Model bilinmiyor"}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#16A34A15", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#16A34A" }} />
                    <Text style={{ color: "#16A34A", fontSize: 10, fontFamily: "Inter_600SemiBold" }}>Aktif</Text>
                  </View>
                </View>
              ))
            )}
            {myDevices.filter(d => !d.registered).length > 0 && (
              <>
                <Text style={{ color: colors.mutedForeground, fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 8, marginBottom: 10 }}>
                  Kayıtsız Cihazlar
                </Text>
                {myDevices.filter(d => !d.registered).map(d => (
                  <View key={d.type} style={{
                    flexDirection: "row", alignItems: "center", gap: 14,
                    backgroundColor: colors.card, borderRadius: 12, borderWidth: 1,
                    borderColor: colors.border, padding: 14, marginBottom: 10, opacity: 0.5,
                  }}>
                    <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center" }}>
                      <Feather name={d.type === "ipad" ? "tablet" : d.type === "mac" ? "monitor" : "smartphone"} size={18} color={colors.mutedForeground} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>{d.label}</Text>
                      <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 }}>Kayıtlı değil</Text>
                    </View>
                  </View>
                ))}
              </>
            )}
          </>
        )}

        <View style={{ height: 18 }} />

        {activityLoading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : !activity ? (
          <View style={{ alignItems: "center", paddingVertical: 20 }}>
            <Feather name="bar-chart-2" size={36} color={colors.mutedForeground} />
            <Text style={{ color: colors.mutedForeground, marginTop: 10, fontFamily: "Inter_400Regular", fontSize: 13 }}>
              Henüz kullanım verisi yok.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 14 }}>
            {(() => {
              const expDate = user?.expireDate ? new Date(user.expireDate) : null;
              const isExpired = expDate ? expDate < new Date() : true;
              const daysLeft = expDate ? Math.ceil((expDate.getTime() - Date.now()) / 86400000) : null;
              const statusColor = isExpired ? "#DC2626" : daysLeft != null && daysLeft <= 30 ? "#D97706" : "#16A34A";
              const statusText = isExpired ? "Süresi Dolmuş" : `${daysLeft} gün kaldı`;
              return (
                <View style={{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 14 }}>
                  <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Üyelik Bilgileri</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: statusColor + "18", alignItems: "center", justifyContent: "center" }}>
                      <Feather name={isExpired ? "x-circle" : "check-circle"} size={18} color={statusColor} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: statusColor }}>{statusText}</Text>
                      {expDate ? (
                        <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 2 }}>
                          Bitiş: {expDate.toLocaleDateString("tr-TR")}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  {user?.subject ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
                      <Feather name="tag" size={14} color={colors.mutedForeground} />
                      <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: colors.foreground, flex: 1 }} numberOfLines={2}>{user.subject}</Text>
                    </View>
                  ) : null}
                  {user?.id ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}>
                      <Feather name="hash" size={14} color={colors.mutedForeground} />
                      <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>Kullanıcı ID: {user.id}</Text>
                    </View>
                  ) : null}
                </View>
              );
            })()}
            <ActivityView activity={activity} />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 14, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { padding: 4 },
  title: { fontSize: 17, fontFamily: "Inter_700Bold" },
});
