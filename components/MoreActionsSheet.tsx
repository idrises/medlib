import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";

interface MoreActionsSheetProps {
  visible: boolean;
  onClose: () => void;
  onCopy: () => void;
  onShare: () => void;
  onShowRaw: () => void;
  onToggleSave: () => void;
  onSendFeedback: () => void;
  isSaved: boolean;
  canSave: boolean;
}

export function MoreActionsSheet({
  visible,
  onClose,
  onCopy,
  onShare,
  onShowRaw,
  onToggleSave,
  onSendFeedback,
  isSaved,
  canSave,
}: MoreActionsSheetProps) {
  const colors = useColors();
  const items: Array<{
    icon: React.ComponentProps<typeof Feather>["name"];
    label: string;
    onPress: () => void;
    disabled?: boolean;
    accent?: string;
  }> = [
    { icon: "copy", label: "Kopyala", onPress: onCopy },
    { icon: "share-2", label: "Paylaş", onPress: onShare },
    {
      icon: isSaved ? "bookmark" : "bookmark",
      label: isSaved ? "Kayıttan çıkar" : "Mesajı kaydet",
      onPress: onToggleSave,
      disabled: !canSave,
      accent: isSaved ? colors.primary : undefined,
    },
    { icon: "file-text", label: "Ham metni göster", onPress: onShowRaw },
    { icon: "message-square", label: "Geri bildirim gönder", onPress: onSendFeedback },
  ];
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <ScrollView>
            {items.map((it, i) => (
              <Pressable
                key={i}
                accessibilityRole="button"
                accessibilityLabel={it.label}
                accessibilityState={{ disabled: it.disabled }}
                disabled={it.disabled}
                onPress={() => {
                  onClose();
                  setTimeout(() => it.onPress(), 0);
                }}
                style={({ pressed }) => [
                  styles.row,
                  {
                    backgroundColor: pressed && !it.disabled ? colors.muted : "transparent",
                    opacity: it.disabled ? 0.4 : 1,
                  },
                ]}
                hitSlop={10}
              >
                <Feather
                  name={it.icon}
                  size={18}
                  color={it.accent ?? colors.foreground}
                />
                <Text
                  style={[
                    styles.label,
                    { color: it.accent ?? colors.foreground },
                  ]}
                >
                  {it.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.cancelRow,
              { backgroundColor: pressed ? colors.muted : "transparent", borderColor: colors.border },
            ]}
          >
            <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>İptal</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "#00000066",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 8,
    paddingBottom: 24,
    paddingHorizontal: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    maxHeight: "60%",
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 10,
  },
  label: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  cancelRow: {
    marginTop: 8,
    paddingVertical: 14,
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  cancelText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
});
