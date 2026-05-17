import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef } from "react";
import { ActivityIndicator, View } from "react-native";

import { useColors } from "@/hooks/useColors";

// Entry behavior: always open a fresh empty chat. The previous "auto-open
// last conversation" shortcut was removed by user request — opening the AI
// area should feel like starting a new ChatGPT thread. Previous chats stay
// accessible from the in-chat left drawer ("AI Sohbetler" listesi).
export default function AiChatEntryScreen() {
  const router = useRouter();
  const colors = useColors();
  const params = useLocalSearchParams<{ openNewThread?: string }>();
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) return;
    handledRef.current = true;
    const suffix = params.openNewThread === "1" ? "?openNewThread=1" : "";
    router.replace(`/ai-chat/new${suffix}` as never);
  }, [router, params.openNewThread]);

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.background,
      }}
    >
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}
