import React from "react";
import { Pressable, Text, View } from "react-native";
import Svg, { Circle, G, Text as SvgText } from "react-native-svg";
import { Feather } from "@expo/vector-icons";

import { useColors } from "@/hooks/useColors";

export type DeviceStats = {
  total: number;
  active: number;
  expiringSoon: number;
  expired: number;
  devices: { iphone: number; ipad: number; mac: number };
  totalUsers?: number;
  activeUsers?: number;
};

export type StatusFilter = "active" | "expiringSoon" | "expired";
export type DeviceFilter = "iphone" | "ipad" | "mac";

function DonutChart({
  stats,
  colors,
  activeFilter,
  onSelect,
}: {
  stats: DeviceStats;
  colors: any;
  activeFilter: StatusFilter | null;
  onSelect: (k: StatusFilter) => void;
}) {
  const total = stats.active + stats.expiringSoon + stats.expired || 1;
  const size = 120;
  const r = 44;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const segments: { key: StatusFilter; value: number; color: string; label: string }[] = [
    { key: "active", value: stats.active, color: "#16A34A", label: "Aktif" },
    { key: "expiringSoon", value: stats.expiringSoon, color: "#D97706", label: "≤30 gün" },
    { key: "expired", value: stats.expired, color: "#DC2626", label: "Süresi doldu" },
  ];
  let offset = 0;
  return (
    <View style={{ alignItems: "center" }}>
      <Svg width={size} height={size}>
        <G rotation="-90" origin={`${cx},${cy}`}>
          {segments.map((seg, i) => {
            const dash = (seg.value / total) * circ;
            const gap = circ - dash;
            const el = (
              <Circle
                key={i}
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke={seg.color}
                strokeWidth={14}
                strokeDasharray={`${dash} ${gap}`}
                strokeDashoffset={-offset}
              />
            );
            offset += dash;
            return el;
          })}
        </G>
        <SvgText x={cx} y={cy - 6} textAnchor="middle" fontSize={20} fontWeight="bold" fill={colors.foreground}>{total}</SvgText>
        <SvgText x={cx} y={cy + 12} textAnchor="middle" fontSize={10} fill={colors.mutedForeground}>kullanıcı</SvgText>
      </Svg>
      <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", justifyContent: "center", marginTop: 8 }}>
        {segments.map(s => {
          const active = activeFilter === s.key;
          return (
            <Pressable
              key={s.key}
              onPress={() => onSelect(s.key)}
              hitSlop={4}
              style={{
                flexDirection: "row", alignItems: "center", gap: 4,
                paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999,
                backgroundColor: active ? s.color + "22" : "transparent",
                borderWidth: 1, borderColor: active ? s.color : "transparent",
              }}
            >
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: s.color }} />
              <Text style={{ fontSize: 10, color: active ? s.color : colors.mutedForeground, fontFamily: active ? "Inter_600SemiBold" : "Inter_400Regular" }}>
                {s.label} ({s.value})
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function DeviceBarChart({
  stats,
  colors,
  activeDeviceFilter,
  onDeviceSelect,
}: {
  stats: DeviceStats;
  colors: any;
  activeDeviceFilter?: DeviceFilter | null;
  onDeviceSelect?: (k: DeviceFilter) => void;
}) {
  const bars: { key: DeviceFilter; label: string; value: number; color: string }[] = [
    { key: "iphone", label: "iPhone", value: stats.devices.iphone, color: "#0057B8" },
    { key: "ipad",   label: "iPad",   value: stats.devices.ipad,   color: "#008080" },
    { key: "mac",    label: "Mac",    value: stats.devices.mac,    color: "#6D28D9" },
  ];
  const maxVal = Math.max(...bars.map(b => b.value), 1);
  const interactive = !!onDeviceSelect;
  return (
    <View style={{ flex: 1, paddingLeft: 8 }}>
      <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Cihaz Dağılımı</Text>
      {bars.map(b => {
        const active = activeDeviceFilter === b.key;
        const Wrapper: any = interactive ? Pressable : View;
        const wrapperProps = interactive
          ? {
              onPress: () => onDeviceSelect!(b.key),
              hitSlop: 4,
              style: {
                marginBottom: 6,
                paddingVertical: 3,
                paddingHorizontal: 6,
                borderRadius: 6,
                backgroundColor: active ? b.color + "18" : "transparent",
              },
            }
          : { style: { marginBottom: 10 } };
        return (
          <Wrapper key={b.label} {...wrapperProps}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3, alignItems: "center" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Text style={{ fontSize: 12, fontFamily: active ? "Inter_700Bold" : "Inter_500Medium", color: active ? b.color : colors.foreground }}>{b.label}</Text>
                {active ? <Feather name="filter" size={10} color={b.color} /> : null}
              </View>
              <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: b.color }}>{b.value}</Text>
            </View>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.border }}>
              <View style={{ height: 8, borderRadius: 4, backgroundColor: b.color, width: `${(b.value / maxVal) * 100}%` as any }} />
            </View>
          </Wrapper>
        );
      })}
    </View>
  );
}

export default function DeviceStatsHeader({
  stats,
  activeFilter,
  onSelect,
  activeDeviceFilter = null,
  onDeviceSelect,
}: {
  stats: DeviceStats | null;
  activeFilter: StatusFilter | null;
  onSelect: (k: StatusFilter) => void;
  activeDeviceFilter?: DeviceFilter | null;
  onDeviceSelect?: (k: DeviceFilter) => void;
}) {
  const colors = useColors();
  if (!stats) return null;
  return (
    <View style={{
      flexDirection: "row",
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 14,
      padding: 14,
      marginHorizontal: 16,
      marginTop: 12,
      marginBottom: 4,
      gap: 8,
    }}>
      <DonutChart stats={stats} colors={colors} activeFilter={activeFilter} onSelect={onSelect} />
      <DeviceBarChart
        stats={stats}
        colors={colors}
        activeDeviceFilter={activeDeviceFilter}
        {...(onDeviceSelect ? { onDeviceSelect } : {})}
      />
    </View>
  );
}
