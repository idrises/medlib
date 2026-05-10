import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ContentType, useApp } from "@/contexts/AppContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useColors } from "@/hooks/useColors";
import { MessagingGateModal } from "@/components/MessagingGateModal";

interface ContentActionBarProps {
  contentType: ContentType;
  contentId: string;
  title: string;
  subtitle?: string;
  /** PDF URL to attach directly to shared messages */
  pdfUrl?: string;
  /** Renders as compact icon-only row for placing in header nav */
  compact?: boolean;
  /** Icon color for compact mode — use "rgba(255,255,255,0.85)" on colored headers */
  iconColor?: string;
}

export function ContentActionBar({
  contentType, contentId, title, subtitle, pdfUrl, compact, iconColor,
}: ContentActionBarProps) {
  const colors = useColors();
  const router = useRouter();
  const { toggleLike, isLiked, toggleBookmark, isBookmarked, conversations, sendMessage, sendDm, sendGroupMessage } = useApp();
  const { settings } = useSettings();
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [gateVisible, setGateVisible] = useState(false);
  const [shareMessage, setShareMessage] = useState("");
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  const openShare = () => {
    if (!settings.messagingConfigured) {
      setGateVisible(true);
      return;
    }
    setShareModalVisible(true);
  };

  const liked = isLiked(contentType, contentId);
  const bookmarked = isBookmarked(contentType, contentId);

  const handleLike = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleLike({ contentType, contentId, title, subtitle });
  };

  const handleBookmark = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleBookmark({ contentType, contentId, title, subtitle });
  };

  const handleVoice = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: "/ai-realtime",
      params: { contextType: contentType, contextId: contentId },
    });
  };

  const handlePresentation = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: "/ai-presentation" as any,
      params: { topic: title, contextTitle: title },
    });
  };


  const modal = (
    <Modal visible={shareModalVisible} animationType="slide" presentationStyle="pageSheet">
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: Platform.OS === "web" ? 67 : 0 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Text style={{ fontSize: 18, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>Share with</Text>
          <Pressable onPress={() => setShareModalVisible(false)}>
            <Feather name="x" size={24} color={colors.mutedForeground} />
          </Pressable>
        </View>

        <View style={{ margin: 16, padding: 12, backgroundColor: colors.secondary, borderRadius: colors.radius }}>
          <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.primary, marginBottom: 2 }}>{title}</Text>
          {subtitle && <Text style={{ fontSize: 12, color: colors.mutedForeground }}>{subtitle}</Text>}
          {pdfUrl && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 }}>
              <Feather name="file-text" size={12} color="#0057B8" />
              <Text style={{ fontSize: 11, color: "#0057B8", fontFamily: "Inter_500Medium" }}>PDF attached</Text>
            </View>
          )}
        </View>

        <ScrollView style={{ flex: 1 }}>
          {["public", "private"].map(section => {
            const sectionConvs = conversations.filter(c => c.type === section);
            if (sectionConvs.length === 0) return null;
            return (
              <React.Fragment key={section}>
                <View style={{ paddingHorizontal: 16, paddingVertical: 8, backgroundColor: colors.muted }}>
                  <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    {section === "public" ? "Groups" : "Private"}
                  </Text>
                </View>
                {sectionConvs.map(conv => {
                  const isGroup = conv.type === "public";
                  const displayName = isGroup
                    ? (conv.groupName || "Group")
                    : (conv.participantNames.find((_, i) => conv.participants[i] !== "user_me") || "Unknown");
                  const isSelected = selectedConvId === conv.id;
                  return (
                    <Pressable
                      key={conv.id}
                      onPress={() => setSelectedConvId(conv.id)}
                      style={{
                        flexDirection: "row", alignItems: "center", padding: 16,
                        borderBottomWidth: 1, borderBottomColor: colors.border,
                        backgroundColor: isSelected ? colors.secondary : colors.background,
                      }}
                    >
                      <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: isGroup ? "#05966920" : colors.primary + "20", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                        {isGroup
                          ? <Feather name="users" size={18} color="#059669" />
                          : <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: colors.primary }}>{displayName[0]}</Text>
                        }
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontFamily: "Inter_500Medium", color: colors.foreground }}>{displayName}</Text>
                        {isGroup && (
                          <Text style={{ fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular" }}>
                            {conv.participants.length} members
                          </Text>
                        )}
                      </View>
                      {isSelected && (
                        <Feather name="check-circle" size={20} color={colors.primary} />
                      )}
                    </Pressable>
                  );
                })}
              </React.Fragment>
            );
          })}
        </ScrollView>

        <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: colors.border, paddingBottom: insets.bottom + 16 }}>
          <TextInput
            value={shareMessage}
            onChangeText={setShareMessage}
            placeholder="Add a message... (optional)"
            placeholderTextColor={colors.mutedForeground}
            style={{
              borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius,
              padding: 12, marginBottom: 12, color: colors.foreground,
              backgroundColor: colors.card, fontSize: 15, fontFamily: "Inter_400Regular",
            }}
            multiline
          />
          <Pressable
            onPress={async () => {
              if (!selectedConvId) return;
              try {
                const shared = { contentType, contentId, title, subtitle, pdfUrl };
                let result: { ok: boolean; error?: string } = { ok: true };
                if (selectedConvId.startsWith("group_")) {
                  result = await sendGroupMessage(selectedConvId, shareMessage, shared);
                } else if (selectedConvId.startsWith("dm_")) {
                  result = await sendDm(selectedConvId, shareMessage, shared);
                } else {
                  sendMessage(selectedConvId, shareMessage, shared);
                }
                if (!result.ok) {
                  try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch {}
                  const msg = result.error?.includes("katılmadın") || result.error?.includes("403")
                    ? "Önce gruba katılmalısın."
                    : (result.error || "Mesaj gönderilemedi.");
                  if (Platform.OS === "web") { alert(msg); } else { Alert.alert("Gönderilemedi", msg); }
                  return;
                }
                setShareModalVisible(false);
                setShareMessage("");
                setSelectedConvId(null);
                try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
              } catch (e: any) {
                const msg = e?.message || String(e) || "Bilinmeyen hata";
                if (Platform.OS === "web") { alert("Hata: " + msg); } else { Alert.alert("Paylaşım hatası", msg); }
              }
            }}
            disabled={!selectedConvId}
            style={{
              backgroundColor: selectedConvId ? colors.primary : colors.muted,
              padding: 14, borderRadius: colors.radius, alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 16, fontFamily: "Inter_600SemiBold", color: selectedConvId ? colors.primaryForeground : colors.mutedForeground }}>
              Send
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );

  const gate = <MessagingGateModal visible={gateVisible} onClose={() => setGateVisible(false)} />;

  if (compact) {
    const iconCol = iconColor || colors.mutedForeground;

    return (
      <>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
          <Pressable
            onPress={handleVoice}
            hitSlop={4}
            style={({ pressed }) => ({ padding: 8, opacity: pressed ? 0.6 : 1 })}
            accessibilityLabel="Bu içerik hakkında sesli sohbet et"
          >
            <Ionicons name="mic-circle-outline" size={26} color={iconCol} />
          </Pressable>
          <Pressable
            onPress={handlePresentation}
            hitSlop={4}
            style={({ pressed }) => ({ padding: 8, opacity: pressed ? 0.6 : 1 })}
            accessibilityLabel="Bu konudan sunum hazırla"
          >
            <Feather name="layout" size={20} color={iconCol} />
          </Pressable>
          <Pressable
            onPress={handleLike}
            hitSlop={4}
            style={({ pressed }) => ({ padding: 8, opacity: pressed ? 0.6 : 1 })}
          >
            <Ionicons name={liked ? "heart" : "heart-outline"} size={22} color={iconCol} />
          </Pressable>
          <Pressable
            onPress={handleBookmark}
            hitSlop={4}
            style={({ pressed }) => ({ padding: 8, opacity: pressed ? 0.6 : 1 })}
          >
            <Ionicons name={bookmarked ? "bookmark" : "bookmark-outline"} size={22} color={iconCol} />
          </Pressable>
          <Pressable
            onPress={() => openShare()}
            hitSlop={4}
            style={({ pressed }) => ({ padding: 8, opacity: pressed ? 0.6 : 1 })}
          >
            <Ionicons name="paper-plane-outline" size={20} color={iconCol} />
          </Pressable>
        </View>
        {modal}{gate}
      </>
    );
  }

  const styles = StyleSheet.create({
    bar: {
      flexDirection: "row",
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.card,
    },
    btn: {
      flex: 1, flexDirection: "row", alignItems: "center",
      justifyContent: "center", paddingVertical: 14, gap: 6,
    },
    divider: { width: 1, backgroundColor: colors.border, marginVertical: 10 },
    btnText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  });

  return (
    <>
      <View style={styles.bar}>
        <Pressable style={({ pressed }) => [styles.btn, pressed && { opacity: 0.5 }]} onPress={handleLike}>
          <Ionicons name={liked ? "heart" : "heart-outline"} size={20} color={liked ? "#E11D48" : colors.mutedForeground} />
          <Text style={[styles.btnText, { color: liked ? "#E11D48" : colors.mutedForeground }]}>
            {liked ? "Liked" : "Like"}
          </Text>
        </Pressable>
        <View style={styles.divider} />
        <Pressable style={({ pressed }) => [styles.btn, pressed && { opacity: 0.5 }]} onPress={handleBookmark}>
          <Ionicons name={bookmarked ? "bookmark" : "bookmark-outline"} size={20} color={bookmarked ? colors.primary : colors.mutedForeground} />
          <Text style={[styles.btnText, { color: bookmarked ? colors.primary : colors.mutedForeground }]}>
            {bookmarked ? "Saved" : "Save"}
          </Text>
        </Pressable>
        <View style={styles.divider} />
        <Pressable style={({ pressed }) => [styles.btn, pressed && { opacity: 0.5 }]} onPress={handlePresentation}>
          <Feather name="layout" size={18} color={colors.mutedForeground} />
          <Text style={[styles.btnText, { color: colors.mutedForeground }]}>Sunum</Text>
        </Pressable>
        <View style={styles.divider} />
        <Pressable style={({ pressed }) => [styles.btn, pressed && { opacity: 0.5 }]} onPress={() => openShare()}>
          <Ionicons name="paper-plane-outline" size={20} color={colors.mutedForeground} />
          <Text style={[styles.btnText, { color: colors.mutedForeground }]}>Share</Text>
        </Pressable>
      </View>
      {modal}{gate}
    </>
  );
}
