import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useColors } from "@/hooks/useColors";
import { dmApi, messagingApi, UserSearchResult } from "@/services/api";

export default function NewMessageScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useAuth();
  const { settings } = useSettings();
  const { loadDmConversations } = useApp();

  const [q, setQ] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (!token || q.trim().length < 2) { setResults([]); return; }
    setLoading(true);
    debounce.current = setTimeout(async () => {
      try {
        const list = await messagingApi.searchUsers(token, q.trim());
        setResults(list);
      } catch (e) {
        console.warn("search failed", e);
      } finally {
        setLoading(false);
      }
    }, 280);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [q, token]);

  const onPickUser = async (u: UserSearchResult) => {
    if (!token) return;
    if (u.whoCanMessage === "nobody") {
      Alert.alert("Mesajlaşma kapalı", "Bu kullanıcı mesaj almıyor.");
      return;
    }
    const res = await messagingApi.canSend(token, u.id);
    if (!res.ok) {
      Alert.alert("Mesaj gönderilemedi", res.message || "Bu kullanıcıya mesaj gönderemezsin.");
      return;
    }
    // Find or create the conversation server-side without sending a message.
    // We do this by sending an empty body? No — server requires body or content.
    // Instead we just navigate to a placeholder route; conversation will be created on first send.
    // Easier: we can call the send endpoint with a no-op... Skip. Use a route param.
    router.push({ pathname: "/conversation/[conversationId]", params: { conversationId: `dm_new_${u.id}`, name: u.displayName } } as never);
    // Refresh in background in case prior conversation exists
    loadDmConversations();
  };

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingTop: topPad + 12, paddingHorizontal: 16, paddingBottom: 12,
      backgroundColor: colors.card,
      borderBottomWidth: 1, borderBottomColor: colors.border,
      flexDirection: "row", alignItems: "center", gap: 12,
    },
    title: { fontSize: 18, fontFamily: "Inter_700Bold", color: colors.foreground, flex: 1 },
    searchBox: {
      margin: 16, borderRadius: 10, backgroundColor: colors.card,
      borderWidth: 1, borderColor: colors.border,
      flexDirection: "row", alignItems: "center", paddingHorizontal: 12,
    },
    input: {
      flex: 1, paddingVertical: 12, paddingHorizontal: 8,
      fontSize: 15, color: colors.foreground, fontFamily: "Inter_400Regular",
    },
    item: {
      flexDirection: "row", alignItems: "center", gap: 12,
      paddingHorizontal: 16, paddingVertical: 12,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    avatar: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: colors.primary, alignItems: "center", justifyContent: "center",
    },
    avatarText: { color: colors.primaryForeground, fontFamily: "Inter_700Bold", fontSize: 16 },
    name: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    sub: { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 2 },
    empty: { padding: 32, alignItems: "center" },
    emptyText: { color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign: "center" },
  }), [colors, topPad]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Feather name="arrow-left" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={styles.title}>Yeni Mesaj</Text>
      </View>

      <View style={styles.searchBox}>
        <Feather name="search" size={18} color={colors.mutedForeground} />
        <TextInput
          style={styles.input}
          placeholder="İsim, branş veya kurum ara…"
          placeholderTextColor={colors.mutedForeground}
          value={q}
          onChangeText={setQ}
          autoFocus
        />
        {loading && <ActivityIndicator size="small" color={colors.primary} />}
      </View>

      {!settings.messagingConfigured && (
        <View style={{ marginHorizontal: 16, padding: 12, backgroundColor: colors.primary + "15", borderRadius: 10, marginBottom: 8 }}>
          <Text style={{ fontSize: 13, color: colors.foreground, fontFamily: "Inter_400Regular" }}>
            Mesajlaşma ayarlarını henüz tamamlamadın. Önce Ayarlar &gt; Mesajlaşma'dan tercihlerini belirle.
          </Text>
        </View>
      )}

      <FlatList
        data={results}
        keyExtractor={u => String(u.id)}
        renderItem={({ item }) => (
          <Pressable style={({ pressed }) => [styles.item, pressed && { opacity: 0.7 }]} onPress={() => onPickUser(item)}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.displayName[0]?.toUpperCase() || "?"}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>{item.displayName}</Text>
              {(item.specialty || item.institution) && (
                <Text style={styles.sub} numberOfLines={1}>
                  {[item.specialty, item.institution].filter(Boolean).join(" • ")}
                </Text>
              )}
            </View>
            {item.whoCanMessage === "nobody" ? (
              <Feather name="slash" size={16} color={colors.mutedForeground} />
            ) : (
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            )}
          </Pressable>
        )}
        ListEmptyComponent={
          q.trim().length < 2 ? (
            <View style={styles.empty}>
              <Feather name="users" size={36} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { marginTop: 12 }]}>
                Mesaj göndermek istediğin kişiyi aramak için yazmaya başla.
              </Text>
            </View>
          ) : !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Sonuç bulunamadı.</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}
