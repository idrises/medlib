import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

interface ContentCardProps {
  title: string;
  subtitle?: string;
  meta?: string;
  badge?: string;
  badgeColor?: string;
  accentColor?: string;
  rightIcon?: React.ReactNode;
  onPress?: () => void;
  compact?: boolean;
}

export function ContentCard({ title, subtitle, meta, badge, badgeColor, accentColor, rightIcon, onPress, compact }: ContentCardProps) {
  const colors = useColors();

  const styles = StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      padding: compact ? 12 : 16,
      marginBottom: compact ? 8 : 12,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
      elevation: 2,
    },
    row: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
    },
    accent: {
      width: 4,
      borderRadius: 2,
      alignSelf: "stretch",
      backgroundColor: accentColor || colors.primary,
    },
    content: { flex: 1 },
    badgeRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
    badge: {
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 4,
    },
    badgeText: {
      fontSize: 10,
      fontFamily: "Inter_600SemiBold",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    title: {
      fontSize: compact ? 14 : 15,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
      lineHeight: 20,
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      marginBottom: 4,
    },
    meta: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
    },
    arrow: { marginLeft: "auto", paddingLeft: 8, alignSelf: "center" },
  });

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}
    >
      <View style={styles.row}>
        {accentColor !== undefined && <View style={styles.accent} />}
        <View style={styles.content}>
          {badge && (
            <View style={styles.badgeRow}>
              <View style={[styles.badge, { backgroundColor: (badgeColor || colors.primary) + "20" }]}>
                <Text style={[styles.badgeText, { color: badgeColor || colors.primary }]}>{badge}</Text>
              </View>
            </View>
          )}
          <Text style={styles.title} numberOfLines={compact ? 2 : 3}>{title}</Text>
          {subtitle && <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text>}
          {meta && <Text style={styles.meta}>{meta}</Text>}
        </View>
        {rightIcon ? (
          <View style={styles.arrow}>{rightIcon}</View>
        ) : onPress ? (
          <View style={styles.arrow}>
            <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

export function SectionHeader({ title, subtitle, action, onAction }: { title: string; subtitle?: string; action?: string; onAction?: () => void }) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12, marginTop: 4 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: colors.foreground }}>{title}</Text>
        {subtitle && <Text style={{ fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 2 }}>{subtitle}</Text>}
      </View>
      {action && onAction && (
        <Pressable onPress={onAction}>
          <Text style={{ fontSize: 13, color: colors.primary, fontFamily: "Inter_500Medium" }}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}
