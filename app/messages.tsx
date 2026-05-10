import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Alert, FlatList, Platform, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Conversation, useApp } from "@/contexts/AppContext";
import { useSettings } from "@/contexts/SettingsContext";
import { timeAgo } from "@/utils/time";
import { useColors } from "@/hooks/useColors";

function isInQuietHours(start: string, end: string): boolean {
  const m = (s: string) => {
    const [h, mm] = s.split(":").map(n => parseInt(n, 10));
    return (isNaN(h) ? 0 : h) * 60 + (isNaN(mm) ? 0 : mm);
  };
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  const a = m(start), b = m(end);
  return a <= b ? cur >= a && cur < b : cur >= a || cur < b;
}

const AVATAR_COLORS = ["#0057B8", "#8B5CF6", "#059669", "#DC2626", "#D97706", "#0891B2"];

export default function MessagesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { conversations, currentUserId, deleteConversation, loadDmConversations, groups, loadGroups, joinGroup, leaveGroup } = useApp();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await Promise.all([loadDmConversations(), loadGroups()]); } finally { setRefreshing(false); }
  }, [loadDmConversations, loadGroups]);

  useFocusEffect(
    useCallback(() => {
      loadDmConversations();
      loadGroups();
    }, [loadDmConversations, loadGroups]),
  );

  const confirmLeave = (gid: string, name: string) => {
    Alert.alert(
      "Gruptan ayrıl",
      `"${name}" grubundan ayrılmak istediğinden emin misin? Bildirimleri durdurulur.`,
      [
        { text: "Vazgeç", style: "cancel" },
        { text: "Ayrıl", style: "destructive", onPress: () => leaveGroup(gid) },
      ],
    );
  };

  const confirmDelete = (conv: Conversation) => {
    const isGroup = conv.type === "public";
    if (isGroup) {
      const gid = conv.id.startsWith("group_") ? conv.id.slice(6) : null;
      const g = gid ? groups.find(x => x.id === gid) : null;
      if (g && g.isMember) {
        confirmLeave(g.id, g.name);
      } else {
        Alert.alert("Grup", "Bu grubu silemezsin. Bildirimleri durdurmak için katılmaktan çıkabilirsin.");
      }
      return;
    }
    const otherName = conv.participantNames.find((_, i) => conv.participants[i] !== currentUserId) || "kişi";
    Alert.alert(
      "Sohbeti sil",
      `"${otherName}" ile olan tüm mesajlar silinsin mi?`,
      [
        { text: "Vazgeç", style: "cancel" },
        { text: "Sil", style: "destructive", onPress: () => deleteConversation(conv.id) },
      ],
    );
  };
  const { settings } = useSettings();
  const [activeTab, setActiveTab] = useState<"private" | "public">("public");

  const muted = settings.msgMuteAll;
  const quietActive = settings.msgQuietHoursEnabled
    && isInQuietHours(settings.msgQuietHoursStart, settings.msgQuietHoursEnd);
  const hidePreview = !settings.msgPreview;

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom + 20;

  const filtered = [...conversations]
    .filter(c => c.type === activeTab)
    .sort((a, b) => b.timestamp - a.timestamp);

  const privateUnread = conversations.filter(c => c.type === "private").reduce((s, c) => s + c.unreadCount, 0);
  const publicUnread = conversations.filter(c => c.type === "public").reduce((s, c) => s + c.unreadCount, 0);

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingTop: topPad + 16,
      paddingHorizontal: 20,
      paddingBottom: 0,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTop: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 14,
    },
    title: { fontSize: 22, fontFamily: "Inter_700Bold", color: colors.foreground, flex: 1 },
    segmentRow: {
      flexDirection: "row",
      borderBottomWidth: 0,
    },
    segTab: {
      flex: 1,
      paddingBottom: 12,
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "center",
      gap: 6,
      borderBottomWidth: 2,
    },
    segTabText: {
      fontSize: 15,
      fontFamily: "Inter_600SemiBold",
    },
    convCard: {
      backgroundColor: colors.card,
      marginHorizontal: 16,
      marginVertical: 5,
      borderRadius: colors.radius,
      padding: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
    },
    avatar: {
      width: 48, height: 48, borderRadius: 24,
      alignItems: "center", justifyContent: "center",
    },
    groupAvatarWrap: {
      width: 48, height: 48, position: "relative",
    },
    avatarText: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#FFF" },
    name: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    lastMsg: { fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_400Regular", lineHeight: 18, marginTop: 2 },
    unreadBadge: {
      minWidth: 20, height: 20, borderRadius: 10,
      paddingHorizontal: 4,
      backgroundColor: colors.destructive,
      alignItems: "center", justifyContent: "center",
    },
    unreadText: { fontSize: 11, fontFamily: "Inter_700Bold", color: "#FFF" },
  });

  const renderGroupAvatar = (conv: Conversation, idx: number) => {
    const name = conv.groupName || "G";
    const color = AVATAR_COLORS[idx % AVATAR_COLORS.length];
    return (
      <View style={[styles.avatar, { backgroundColor: color }]}>
        <Feather name="users" size={20} color="#FFF" />
      </View>
    );
  };

  const renderPrivateAvatar = (conv: Conversation, idx: number) => {
    const otherName = conv.participantNames.find((_, i) => conv.participants[i] !== currentUserId) || "?";
    const color = AVATAR_COLORS[idx % AVATAR_COLORS.length];
    return (
      <View style={[styles.avatar, { backgroundColor: color }]}>
        <Text style={styles.avatarText}>{otherName[0]}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Pressable onPress={() => router.back()} style={{ marginRight: 12 }}>
            <Feather name="arrow-left" size={24} color={colors.foreground} />
          </Pressable>
          <Text style={styles.title}>Messages</Text>
          <Pressable
            onPress={() => router.push("/messaging-settings" as never)}
            hitSlop={10}
            style={{ marginLeft: "auto", marginRight: 8, padding: 8, borderRadius: 20, backgroundColor: colors.muted }}
            accessibilityLabel="Mesaj ayarları"
          >
            <Feather name="settings" size={18} color={colors.foreground} />
          </Pressable>
          <Pressable
            onPress={() => router.push("/new-message" as never)}
            hitSlop={10}
            style={{ marginRight: 4, padding: 6, borderRadius: 20, backgroundColor: colors.primary }}
          >
            <Feather name="edit" size={18} color={colors.primaryForeground} />
          </Pressable>
          {muted && (
            <Feather name="bell-off" size={18} color={colors.mutedForeground} style={{ marginLeft: 8 }} />
          )}
        </View>

        {!settings.messagingConfigured && (
          <Pressable
            onPress={() => router.push("/messaging-settings" as never)}
            style={({ pressed }) => [{
              marginBottom: 12, paddingVertical: 10, paddingHorizontal: 12,
              backgroundColor: colors.primary + "15", borderRadius: 8,
              borderWidth: 1, borderColor: colors.primary + "40",
              flexDirection: "row", alignItems: "center", gap: 10,
              opacity: pressed ? 0.7 : 1,
            }]}
          >
            <Feather name="alert-circle" size={16} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, color: colors.foreground, fontFamily: "Inter_600SemiBold" }}>
                Mesajlaşma ayarlarını yap
              </Text>
              <Text style={{ fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 2 }}>
                Mesaj göndermeden önce kim sana ulaşabilir, hangi bilgilerin görünür ayarla.
              </Text>
            </View>
            <Feather name="chevron-right" size={16} color={colors.primary} />
          </Pressable>
        )}

        {(quietActive || muted) && (
          <View style={{
            marginBottom: 12, paddingVertical: 8, paddingHorizontal: 12,
            backgroundColor: colors.muted, borderRadius: 8,
            flexDirection: "row", alignItems: "center", gap: 8,
          }}>
            <Feather name={quietActive ? "moon" : "bell-off"} size={14} color={colors.mutedForeground} />
            <Text style={{ flex: 1, fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_500Medium" }}>
              {quietActive
                ? `Sessiz saatler (${settings.msgQuietHoursStart}–${settings.msgQuietHoursEnd}) — bildirim gelmiyor`
                : "Tüm mesajlar susturuldu"}
            </Text>
            <Pressable onPress={() => router.push("/settings" as never)} hitSlop={8}>
              <Text style={{ fontSize: 12, color: colors.primary, fontFamily: "Inter_600SemiBold" }}>Ayarlar</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.segmentRow}>
          {(["private", "public"] as const).map(tab => {
            const isActive = activeTab === tab;
            const label = tab === "private" ? "Private" : "Groups";
            const unread = tab === "private" ? privateUnread : publicUnread;
            return (
              <Pressable
                key={tab}
                onPress={() => setActiveTab(tab)}
                style={[styles.segTab, { borderBottomColor: isActive ? colors.primary : "transparent" }]}
              >
                <Text style={[styles.segTabText, { color: isActive ? colors.primary : colors.mutedForeground }]}>
                  {label}
                </Text>
                {unread > 0 && (
                  <View style={[styles.unreadBadge, { backgroundColor: isActive ? colors.primary : colors.mutedForeground }]}>
                    <Text style={styles.unreadText}>{unread > 9 ? "9+" : unread}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={c => c.id}
        contentContainerStyle={{ paddingTop: 12, paddingBottom: bottomPad }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        renderItem={({ item, index }) => {
          const isGroup = item.type === "public";
          const groupId = isGroup && item.id.startsWith("group_") ? item.id.slice(6) : null;
          const grpInfo = groupId ? groups.find(g => g.id === groupId) : null;
          const isMember = !isGroup ? true : (grpInfo ? grpInfo.isMember : true);
          const displayName = isGroup
            ? (grpInfo?.name || item.groupName!)
            : (item.participantNames.find((_, i) => item.participants[i] !== currentUserId) || "Unknown");
          const lastMsg = item.lastMessage;
          const isUnread = item.unreadCount > 0;

          return (
            <Pressable
              style={({ pressed }) => [styles.convCard, pressed && { opacity: 0.75 }]}
              onPress={() => {
                if (isGroup && !isMember) return;
                router.push(`/conversation/${item.id}` as never);
              }}
              onLongPress={() => confirmDelete(item)}
              delayLongPress={400}
            >
              {isGroup ? renderGroupAvatar(item, index) : renderPrivateAvatar(item, index)}
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={[styles.name, isUnread && { color: colors.foreground }]} numberOfLines={1}>
                    {displayName}
                  </Text>
                  {isMember && (
                    <Text style={{ fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_400Regular" }}>
                      {lastMsg ? timeAgo(lastMsg.timestamp) : (item.timestamp ? timeAgo(item.timestamp) : "")}
                    </Text>
                  )}
                </View>
                {isGroup && (
                  <Text style={{ fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginBottom: 1 }}>
                    {(grpInfo?.memberCount ?? item.participants.length)} members
                  </Text>
                )}
                {isGroup && item.description && (!lastMsg || !isMember) && (
                  <Text style={styles.lastMsg} numberOfLines={1}>
                    {item.description}
                  </Text>
                )}
                {isMember && lastMsg && (
                  <Text
                    style={[styles.lastMsg, isUnread && { color: colors.foreground, fontFamily: "Inter_500Medium" }]}
                    numberOfLines={1}
                  >
                    {hidePreview
                      ? "Yeni mesaj"
                      : `${isGroup && lastMsg.senderId && lastMsg.senderId !== currentUserId && lastMsg.senderName ? `${lastMsg.senderName.split(" ")[1] || lastMsg.senderName}: ` : ""}${lastMsg.sharedContent ? `Shared: ${lastMsg.sharedContent.title}` : lastMsg.text}`}
                  </Text>
                )}
              </View>
              {isGroup && !isMember ? (
                <Pressable
                  onPress={() => groupId && joinGroup(groupId)}
                  style={({ pressed }) => [{
                    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16,
                    backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1,
                  }]}
                >
                  <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.primaryForeground }}>Join</Text>
                </Pressable>
              ) : isUnread && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadText}>{item.unreadCount > 9 ? "9+" : item.unreadCount}</Text>
                </View>
              )}
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingTop: 80 }}>
            <Feather
              name={activeTab === "private" ? "message-circle" : "users"}
              size={48}
              color={colors.mutedForeground}
            />
            <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 12, fontSize: 16 }}>
              {activeTab === "private" ? "No private messages" : "No groups yet"}
            </Text>
            <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 6, textAlign: "center", paddingHorizontal: 40 }}>
              {activeTab === "private"
                ? "Share content with colleagues to start a conversation"
                : "Create a group to discuss topics with multiple colleagues"}
            </Text>
          </View>
        }
      />
    </View>
  );
}
