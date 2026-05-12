import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import React, { useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  ToastAndroid,
  View,
  Platform,
} from "react-native";
import { useColors } from "@/hooks/useColors";
import { speak, stop, useActiveSpeechId } from "@/services/speechBus";
import { MoreActionsSheet } from "@/components/MoreActionsSheet";

interface MessageActionBarProps {
  messageId: string;
  content: string;
  rating: number | null;
  onRate: (newRating: 1 | -1) => void;
  disabled?: boolean;
}

function showToast(msg: string) {
  if (Platform.OS === "android") {
    ToastAndroid.show(msg, ToastAndroid.SHORT);
  } else {
    Alert.alert(msg);
  }
}

export default function MessageActionBar({
  messageId,
  content,
  rating,
  onRate,
  disabled,
}: MessageActionBarProps) {
  const colors = useColors();
  const activeSpeechId = useActiveSpeechId();
  const speaking = activeSpeechId === messageId;
  const [moreOpen, setMoreOpen] = useState(false);
  const [rawOpen, setRawOpen] = useState(false);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(content);
    showToast("Kopyalandı");
  };

  const handleSpeak = () => {
    if (speaking) {
      stop();
    } else {
      speak(messageId, content);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({ message: content });
    } catch {
      // user cancelled
    }
  };

  const iconColor = colors.mutedForeground;
  const activeColor = colors.primary;

  return (
    <>
      <View style={styles.container}>
        <Pressable accessibilityRole="button" accessibilityLabel="Mesajı kopyala" onPress={handleCopy} style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]} hitSlop={12} disabled={disabled}>
          <Feather name="copy" size={16} color={iconColor} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={speaking ? "Seslendirmeyi durdur" : "Mesajı seslendir"} onPress={handleSpeak} style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]} hitSlop={12} disabled={disabled}>
          <Feather name={speaking ? "pause-circle" : "volume-2"} size={16} color={speaking ? activeColor : iconColor} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Beğen"
          accessibilityState={{ selected: rating === 1 }}
          onPress={() => onRate(1)}
          style={({ pressed }) => [
            styles.iconBtn,
            rating === 1 && { backgroundColor: activeColor + "22" },
            pressed && styles.pressed,
          ]}
          hitSlop={12}
          disabled={disabled}
        >
          <Feather name="thumbs-up" size={16} color={rating === 1 ? activeColor : iconColor} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Beğenme"
          accessibilityState={{ selected: rating === -1 }}
          onPress={() => onRate(-1)}
          style={({ pressed }) => [
            styles.iconBtn,
            rating === -1 && { backgroundColor: "#ef444422" },
            pressed && styles.pressed,
          ]}
          hitSlop={12}
          disabled={disabled}
        >
          <Feather name="thumbs-down" size={16} color={rating === -1 ? "#ef4444" : iconColor} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Paylaş" onPress={handleShare} style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]} hitSlop={12} disabled={disabled}>
          <Feather name="share" size={16} color={iconColor} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Daha fazla" onPress={() => setMoreOpen(true)} style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]} hitSlop={12} disabled={disabled}>
          <Feather name="more-horizontal" size={16} color={iconColor} />
        </Pressable>
      </View>

      <MoreActionsSheet
        visible={moreOpen}
        onClose={() => setMoreOpen(false)}
        onCopy={handleCopy}
        onShare={handleShare}
        onShowRaw={() => {
          setMoreOpen(false);
          setTimeout(() => setRawOpen(true), 250);
        }}
        onReport={() => Alert.alert("Mesajı bildir", "Bu özellik yakında eklenecek. Şimdilik 👎 ile geri bildirim verebilirsin.")}
      />

      <Modal visible={rawOpen} transparent animationType="fade" onRequestClose={() => setRawOpen(false)}>
        <Pressable style={styles.rawBackdrop} onPress={() => setRawOpen(false)}>
          <Pressable
            style={[styles.rawSheet, { backgroundColor: colors.background, borderColor: colors.border }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.rawHeader}>
              <Text style={[styles.rawTitle, { color: colors.foreground }]}>Ham metin</Text>
              <Pressable onPress={() => setRawOpen(false)} hitSlop={10}>
                <Feather name="x" size={20} color={colors.mutedForeground} />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 420 }}>
              <Text selectable style={[styles.rawBody, { color: colors.foreground }]}>{content}</Text>
            </ScrollView>
            <Pressable
              onPress={async () => { await Clipboard.setStringAsync(content); showToast("Kopyalandı"); }}
              style={({ pressed }) => [styles.rawCopyBtn, { backgroundColor: pressed ? colors.primary + "cc" : colors.primary }]}
            >
              <Feather name="copy" size={14} color="#fff" />
              <Text style={styles.rawCopyText}>Tümünü kopyala</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
    marginLeft: 0,
  },
  iconBtn: {
    paddingVertical: 6,
    paddingHorizontal: 9,
    borderRadius: 14,
  },
  pressed: {
    opacity: 0.5,
  },
  rawBackdrop: {
    flex: 1,
    backgroundColor: "#00000099",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  rawSheet: {
    borderRadius: 14,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rawHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  rawTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  rawBody: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 19,
  },
  rawCopyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  rawCopyText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
});
