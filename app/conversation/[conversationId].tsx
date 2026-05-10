import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MessagingGateModal } from "@/components/MessagingGateModal";
import { PDFViewerModal } from "@/components/PDFViewerModal";
import { useApp } from "@/contexts/AppContext";
import { useSettings } from "@/contexts/SettingsContext";
import { timeAgo } from "@/utils/time";
import { useColors } from "@/hooks/useColors";

const MSG_FONT_SCALE: Record<string, number> = { small: 0.9, medium: 1, large: 1.15 };

export default function ConversationScreen() {
  const { conversationId, name: pendingName } = useLocalSearchParams<{ conversationId: string; name?: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [text, setText] = useState("");
  const flatListRef = useRef<FlatList>(null);
  const { conversations, messages, sendMessage, currentUserId, markConversationRead, deleteMessage, sendDm, loadDmMessages, markDmRead, startDmAndSend, groups, loadGroupMessages, markGroupRead, sendGroupMessage } = useApp();
  const isDm = !!conversationId && conversationId.startsWith("dm_") && !conversationId.startsWith("dm_new_");
  const isPendingDm = !!conversationId && conversationId.startsWith("dm_new_");
  const isGroupConv = !!conversationId && conversationId.startsWith("group_");
  const pendingRecipientId = isPendingDm ? parseInt(conversationId.replace("dm_new_", "")) : 0;

  const confirmDeleteMessage = (messageId: string) => {
    if (!conversationId) return;
    Alert.alert(
      "Mesajı sil",
      "Bu mesajı silmek istediğinden emin misin?",
      [
        { text: "Vazgeç", style: "cancel" },
        { text: "Sil", style: "destructive", onPress: () => deleteMessage(conversationId, messageId) },
      ],
    );
  };
  const { settings } = useSettings();
  const fontScale = MSG_FONT_SCALE[settings.msgFontSize] ?? 1;
  const [activePdfUrl, setActivePdfUrl] = useState<string | null>(null);
  const [activePdfTitle, setActivePdfTitle] = useState<string | undefined>(undefined);
  const [gateVisible, setGateVisible] = useState(false);

  const conversation = conversations.find(c => c.id === conversationId);
  const groupSummary = isGroupConv ? groups.find(g => `group_${g.id}` === conversationId) : undefined;
  const convMessages = messages[conversationId!] || [];
  const isGroup = isGroupConv || conversation?.type === "public";
  const otherName = isPendingDm
    ? (typeof pendingName === "string" ? pendingName : "Yeni Sohbet")
    : isGroupConv
      ? (groupSummary?.name || conversation?.groupName || "Group")
      : conversation?.type === "public"
        ? (conversation?.groupName || "Group")
        : (conversation?.participantNames.find((_, i) => conversation?.participants[i] !== currentUserId) || "Unknown");

  React.useEffect(() => {
    if (!conversationId || isPendingDm) return;
    if (isDm) {
      loadDmMessages(conversationId);
      markDmRead(conversationId);
    } else if (isGroupConv) {
      loadGroupMessages(conversationId);
      markGroupRead(conversationId);
    } else {
      markConversationRead(conversationId);
    }
  }, [conversationId, isDm, isGroupConv, isPendingDm]);

  // Live polling: while the conversation screen is focused, refresh messages
  // every 4s so new messages from other users appear without leaving the screen.
  useFocusEffect(
    useCallback(() => {
      if (!conversationId || isPendingDm) return;
      const tick = () => {
        if (isDm) {
          loadDmMessages(conversationId);
          markDmRead(conversationId);
        } else if (isGroupConv) {
          loadGroupMessages(conversationId);
          markGroupRead(conversationId);
        }
      };
      const iv = setInterval(tick, 4000);
      return () => clearInterval(iv);
    }, [conversationId, isDm, isGroupConv, isPendingDm, loadDmMessages, loadGroupMessages, markDmRead, markGroupRead])
  );

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const colors2 = colors;

  const handleContentPress = (contentType: string, contentId: string) => {
    const routes: Record<string, string> = {
      article: `/articles/${contentId}`,
      journal: `/journals/${contentId}`,
      book: `/books/${contentId}`,
      chapter: `/chapters/${contentId}`,
      videoset: `/videosets/${contentId}`,
      videoset_video: `/videos/${contentId}`,
      video: `/videos/${contentId}`,
    };
    const route = routes[contentType];
    if (route) router.push(route as never);
  };

  const handleSend = async () => {
    if (!text.trim() || !conversationId) return;
    if (!isGroup && !settings.messagingConfigured) {
      setGateVisible(true);
      return;
    }
    const body = text.trim();
    setText("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isPendingDm) {
      const r = await startDmAndSend(pendingRecipientId, body);
      if (!r.ok || !r.conversationId) {
        Alert.alert("Mesaj gönderilemedi", r.error || "Bir hata oluştu.");
        setText(body);
      } else {
        router.replace(`/conversation/${r.conversationId}` as never);
      }
    } else if (isDm) {
      const r = await sendDm(conversationId, body);
      if (!r.ok) {
        Alert.alert("Mesaj gönderilemedi", r.error || "Bir hata oluştu.");
        setText(body);
      }
    } else if (isGroupConv) {
      const r = await sendGroupMessage(conversationId, body);
      if (!r.ok) {
        Alert.alert("Mesaj gönderilemedi", r.error || "Bir hata oluştu.");
        setText(body);
      }
    } else {
      sendMessage(conversationId, body);
    }
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors2.background },
    header: {
      paddingTop: topPad + 8,
      paddingHorizontal: 16,
      paddingBottom: 14,
      backgroundColor: colors2.card,
      borderBottomWidth: 1,
      borderBottomColor: colors2.border,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    avatar: {
      width: 38, height: 38, borderRadius: 19,
      backgroundColor: colors2.primary,
      alignItems: "center", justifyContent: "center",
    },
    avatarText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#FFF" },
    name: { fontSize: 17, fontFamily: "Inter_600SemiBold", color: colors2.foreground },
    msgBubble: {
      maxWidth: "75%",
      padding: 12,
      borderRadius: 16,
      marginVertical: 3,
    },
    msgText: { fontSize: 15 * fontScale, lineHeight: 22 * fontScale },
    msgTime: { fontSize: 10, marginTop: 4 },
    sharedContent: {
      borderRadius: 10,
      padding: 10,
      marginBottom: 6,
      borderWidth: 1,
    },
    sharedType: { fontSize: 10, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 },
    sharedTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", lineHeight: 18 },
    sharedSubtitle: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
    inputRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      paddingHorizontal: 12,
      paddingVertical: 10,
      paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 10,
      borderTopWidth: 1,
      borderTopColor: colors2.border,
      backgroundColor: colors2.card,
      gap: 8,
    },
    input: {
      flex: 1,
      backgroundColor: colors2.muted,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 10,
      fontSize: 15 * fontScale,
      maxHeight: 100,
    },
    sendBtn: {
      width: 42, height: 42, borderRadius: 21,
      backgroundColor: colors2.primary,
      alignItems: "center", justifyContent: "center",
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={colors2.foreground} />
        </Pressable>
        <View style={[styles.avatar, { backgroundColor: isGroup ? "#059669" : colors2.primary }]}>
          {isGroup
            ? <Feather name="users" size={19} color="#FFF" />
            : <Text style={styles.avatarText}>{otherName[0]}</Text>
          }
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={styles.name} numberOfLines={1}>{otherName}</Text>
            {settings.msgMuteAll && (
              <Feather name="bell-off" size={13} color={colors2.mutedForeground} />
            )}
          </View>
          {isGroup && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={{ fontSize: 12, color: colors2.mutedForeground, fontFamily: "Inter_400Regular" }}>
                {isGroupConv
                  ? `${groupSummary?.memberCount ?? 0} members`
                  : (conversation ? `${conversation.participants.length} members` : "")}
              </Text>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#16A34A" }} />
              <Text style={{ fontSize: 11, color: "#16A34A", fontFamily: "Inter_600SemiBold" }}>Canlı</Text>
            </View>
          )}
        </View>
      </View>

      <KeyboardAvoidingView
        behavior="padding"
        style={{ flex: 1 }}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={convMessages}
          keyExtractor={m => m.id}
          contentContainerStyle={{ padding: 16 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => {
            const isMe = item.senderId === currentUserId;
            return (
              <View style={{ alignItems: isMe ? "flex-end" : "flex-start", marginVertical: 2 }}>
                {!isMe && (
                  <Text style={{ fontSize: 11, color: colors2.mutedForeground, fontFamily: "Inter_500Medium", marginBottom: 3, marginLeft: 4 }}>
                    {item.senderName}
                  </Text>
                )}
                <Pressable
                  onLongPress={() => confirmDeleteMessage(item.id)}
                  delayLongPress={400}
                  style={[styles.msgBubble, { backgroundColor: isMe ? colors2.primary : colors2.card }]}
                >
                  {item.sharedContent && (
                    <>
                      <Pressable
                        onPress={() => handleContentPress(item.sharedContent!.contentType, item.sharedContent!.contentId)}
                        style={({ pressed }) => [styles.sharedContent, {
                          backgroundColor: isMe ? "rgba(255,255,255,0.15)" : colors2.secondary,
                          borderColor: isMe ? "rgba(255,255,255,0.3)" : colors2.border,
                          opacity: pressed ? 0.7 : 1,
                        }]}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                          <Text style={[styles.sharedType, { color: isMe ? "rgba(255,255,255,0.7)" : colors2.primary }]}>
                            {item.sharedContent.contentType.replace("_", " ")}
                          </Text>
                          <Feather name="chevron-right" size={12} color={isMe ? "rgba(255,255,255,0.5)" : colors2.mutedForeground} />
                        </View>
                        <Text style={[styles.sharedTitle, { color: isMe ? "#FFF" : colors2.foreground }]} numberOfLines={2}>
                          {item.sharedContent.title}
                        </Text>
                        {item.sharedContent.subtitle && (
                          <Text style={[styles.sharedSubtitle, { color: isMe ? "rgba(255,255,255,0.7)" : colors2.mutedForeground }]} numberOfLines={1}>
                            {item.sharedContent.subtitle}
                          </Text>
                        )}
                      </Pressable>
                      {item.sharedContent.pdfUrl && (
                        <Pressable
                          onPress={() => {
                            setActivePdfUrl(item.sharedContent!.pdfUrl!);
                            setActivePdfTitle(item.sharedContent!.title);
                          }}
                          style={({ pressed }) => [{
                            flexDirection: "row" as const,
                            alignItems: "center" as const,
                            gap: 6,
                            marginTop: 4,
                            marginBottom: 4,
                            padding: 8,
                            borderRadius: 8,
                            backgroundColor: isMe ? "rgba(255,255,255,0.15)" : colors2.secondary,
                            borderWidth: 1,
                            borderColor: isMe ? "rgba(255,255,255,0.25)" : colors2.border,
                            opacity: pressed ? 0.7 : 1,
                          }]}
                        >
                          <Feather name="file-text" size={14} color={isMe ? "#FFF" : "#0057B8"} />
                          <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: isMe ? "#FFF" : "#0057B8", flex: 1 }}>
                            Full Text PDF
                          </Text>
                          <Feather name="chevron-right" size={12} color={isMe ? "rgba(255,255,255,0.6)" : colors2.mutedForeground} />
                        </Pressable>
                      )}
                    </>
                  )}
                  {item.text && (
                    <Text style={[styles.msgText, { color: isMe ? "#FFF" : colors2.foreground, fontFamily: "Inter_400Regular" }]}>
                      {item.text}
                    </Text>
                  )}
                  <Text style={[styles.msgTime, { color: isMe ? "rgba(255,255,255,0.6)" : colors2.mutedForeground, textAlign: "right", fontFamily: "Inter_400Regular" }]}>
                    {timeAgo(item.timestamp)}
                  </Text>
                </Pressable>
              </View>
            );
          }}
        />

        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, { color: colors2.foreground, fontFamily: "Inter_400Regular" }]}
            value={text}
            onChangeText={setText}
            placeholder="Message..."
            placeholderTextColor={colors2.mutedForeground}
            multiline={!settings.msgEnterToSend}
            returnKeyType={settings.msgEnterToSend ? "send" : "default"}
            blurOnSubmit={settings.msgEnterToSend}
            onSubmitEditing={settings.msgEnterToSend ? handleSend : undefined}
          />
          <Pressable
            style={[styles.sendBtn, { opacity: text.trim() ? 1 : 0.5 }]}
            onPress={handleSend}
            disabled={!text.trim()}
          >
            <Feather name="send" size={18} color="#FFF" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <PDFViewerModal
        visible={!!activePdfUrl}
        url={activePdfUrl || ""}
        title={activePdfTitle}
        onClose={() => { setActivePdfUrl(null); setActivePdfTitle(undefined); }}
      />
      <MessagingGateModal visible={gateVisible} onClose={() => setGateVisible(false)} />
    </View>
  );
}
