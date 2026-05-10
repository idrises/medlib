import { Feather } from "@expo/vector-icons";
import React from "react";
import { View, Text } from "react-native";

import ActivityView, { ActivityData } from "@/components/ActivityView";
import { useColors } from "@/hooks/useColors";

export type UsageViewUser = {
  id?: number | string;
  email?: string;
  subject?: string | null;
  expireDate?: string | null;
  devices?: { iphone?: string; ipad?: string; mac?: string };
};

export default function UsageView({
  user,
  activity,
  showDevices = true,
}: {
  user: UsageViewUser | null | undefined;
  activity: ActivityData | null;
  showDevices?: boolean;
}) {
  const colors = useColors();

  const expDate = user?.expireDate ? new Date(user.expireDate) : null;
  const isExpired = expDate ? expDate < new Date() : true;
  const daysLeft = expDate
    ? Math.ceil((expDate.getTime() - Date.now()) / 86400000)
    : null;
  const statusColor = isExpired
    ? "#DC2626"
    : daysLeft != null && daysLeft <= 30
      ? "#D97706"
      : "#16A34A";
  const statusText = isExpired ? "Süresi Dolmuş" : `${daysLeft} gün kaldı`;

  const deviceItems = user?.devices
    ? [
        { type: "iphone", label: "iPhone", icon: "smartphone" as const, status: user.devices.iphone },
        { type: "ipad", label: "iPad", icon: "tablet" as const, status: user.devices.ipad },
        { type: "mac", label: "Mac", icon: "monitor" as const, status: user.devices.mac },
      ]
    : [];

  return (
    <View style={{ gap: 14 }}>
      <View style={{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 14 }}>
        <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
          Üyelik Bilgileri
        </Text>
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
        {user?.email ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
            <Feather name="mail" size={14} color={colors.mutedForeground} />
            <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: colors.foreground, flex: 1 }} numberOfLines={1}>{user.email}</Text>
          </View>
        ) : null}
        {user?.subject ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}>
            <Feather name="tag" size={14} color={colors.mutedForeground} />
            <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: colors.foreground, flex: 1 }} numberOfLines={2}>{user.subject}</Text>
          </View>
        ) : null}
        {user?.id != null ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}>
            <Feather name="hash" size={14} color={colors.mutedForeground} />
            <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>Kullanıcı ID: {user.id}</Text>
          </View>
        ) : null}
      </View>

      {showDevices && deviceItems.filter(d => d.status === "kayıtlı").length > 0 ? (
        <View style={{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 14 }}>
          <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
            Cihazlar
          </Text>
          {deviceItems.filter(d => d.status === "kayıtlı").map(d => {
            const registered = true;
            return (
              <View
                key={d.type}
                style={{
                  flexDirection: "row", alignItems: "center", gap: 12,
                  paddingVertical: 8,
                  opacity: registered ? 1 : 0.55,
                }}
              >
                <View style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: registered ? colors.primary + "15" : colors.muted, alignItems: "center", justifyContent: "center" }}>
                  <Feather name={d.icon} size={16} color={registered ? colors.primary : colors.mutedForeground} />
                </View>
                <Text style={{ flex: 1, color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 14 }}>{d.label}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: registered ? "#16A34A15" : colors.muted, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: registered ? "#16A34A" : colors.mutedForeground }} />
                  <Text style={{ color: registered ? "#16A34A" : colors.mutedForeground, fontSize: 10, fontFamily: "Inter_600SemiBold" }}>
                    {registered ? "Kayıtlı" : "Boş"}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      ) : null}

      {activity ? (
        <ActivityView activity={activity} />
      ) : (
        <View style={{ alignItems: "center", paddingVertical: 30 }}>
          <Feather name="bar-chart-2" size={36} color={colors.mutedForeground} />
          <Text style={{ color: colors.mutedForeground, marginTop: 10, fontFamily: "Inter_400Regular", fontSize: 13 }}>
            Henüz kullanım verisi yok.
          </Text>
        </View>
      )}
    </View>
  );
}
