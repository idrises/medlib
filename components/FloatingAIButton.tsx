import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useRef, useCallback } from "react";
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
} from "react-native";

import { useColors } from "@/hooks/useColors";

export function FloatingAIButton() {
  const colors = useColors();
  const router = useRouter();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 0.9,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      tension: 40,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const handlePress = useCallback(() => {
    router.push("/ai-chat" as never);
  }, [router]);

  const isWeb = Platform.OS === "web";

  return (
    <Animated.View
      style={[
        styles.container,
        {
          bottom: isWeb ? 100 : 100,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <Pressable
        style={[
          styles.button,
          {
            backgroundColor: colors.primary,
            shadowColor: colors.primary,
          },
        ]}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        testID="floating-ai-btn"
      >
        <Feather name="cpu" size={24} color="#fff" />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    right: 20,
    zIndex: 999,
  },
  button: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
});
