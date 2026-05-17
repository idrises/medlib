import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef } from "react";
import { ActivityIndicator, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import { listAiConversations } from "@/services/aiApi";

const LAST_CONV_KEY = "medlib.lastAiConversationId";

// ChatGPT-style entry: opening the AI area lands directly in a chat
// (last active conversation if available, otherwise a new empty one).
// The full conversation list is reached via the in-chat left drawer.
export default function AiChatEntryScreen() {
  const router = useRouter();
  const colors = useColors();
  const params = useLocalSearchParams<{ openNewThread?: string }>();
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) return;
    handledRef.current = true;

    (async () => {
      const newThreadSuffix = params.openNewThread === "1" ? "?openNewThread=1" : "";

      // If the user explicitly came here to create a new folder, skip the
      // last-conversation shortcut so the drawer/new-thread modal can open.
      if (params.openNewThread === "1") {
        router.replace(`/ai-chat/new${newThreadSuffix}` as never);
        return;
      }

      let lastId: number | null = null;
      try {
        const raw = await AsyncStorage.getItem(LAST_CONV_KEY);
        const parsed = raw ? parseInt(raw, 10) : NaN;
        if (Number.isFinite(parsed) && parsed > 0) lastId = parsed;
      } catch {}

      if (lastId) {
        // Validate the stored conversation still exists. If validation
        // fails for any reason (network error, stale ID, server error)
        // we drop the stored ID and start a clean new chat — opening a
        // dead conversation would trap the user in a broken loop.
        let stillExists = false;
        try {
          const list = await listAiConversations();
          stillExists = Array.isArray(list) && list.some((c) => c.id === lastId);
        } catch {
          stillExists = false;
        }
        if (stillExists) {
          router.replace(`/ai-chat/${lastId}` as never);
          return;
        }
        try {
          await AsyncStorage.removeItem(LAST_CONV_KEY);
        } catch {}
      }

      router.replace("/ai-chat/new" as never);
    })();
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
