import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

export type SnackbarTone = "success" | "error" | "info";

interface SnackbarProps {
  message: string | null;
  tone?: SnackbarTone;
  durationMs?: number;
  onHide: () => void;
}

export function Snackbar({ message, tone = "success", durationMs = 1800, onHide }: SnackbarProps) {
  const colors = useColors();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onHideRef = useRef(onHide);
  useEffect(() => {
    onHideRef.current = onHide;
  }, [onHide]);

  useEffect(() => {
    if (!message) return;
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 160, useNativeDriver: true }),
    ]).start();
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 160, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 20, duration: 160, useNativeDriver: true }),
      ]).start(() => onHideRef.current());
    }, durationMs);
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [message, durationMs, opacity, translateY]);

  if (!message) return null;

  const bg =
    tone === "error" ? "#dc2626" : tone === "info" ? colors.foreground : "#16a34a";
  const icon = tone === "error" ? "alert-circle" : tone === "info" ? "info" : "check-circle";

  return (
    <View pointerEvents="none" style={styles.wrap}>
      <Animated.View
        style={[
          styles.bar,
          { backgroundColor: bg, opacity, transform: [{ translateY }] },
        ]}
      >
        <Feather name={icon as never} size={16} color="#fff" />
        <Text style={styles.text} numberOfLines={2}>
          {message}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 96,
    alignItems: "center",
    paddingHorizontal: 24,
    zIndex: 999,
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    maxWidth: 420,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  text: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    flexShrink: 1,
  },
});
