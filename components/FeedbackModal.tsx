import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";

interface FeedbackModalProps {
  visible: boolean;
  initialRating: number | null;
  onClose: () => void;
  onSubmit: (rating: 1 | -1, comment: string) => Promise<void>;
}

export function FeedbackModal({
  visible,
  initialRating,
  onClose,
  onSubmit,
}: FeedbackModalProps) {
  const colors = useColors();
  const [rating, setRating] = useState<1 | -1>(initialRating === 1 ? 1 : -1);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setRating(initialRating === 1 ? 1 : -1);
      setComment("");
      setError(null);
      setSubmitting(false);
    }
  }, [visible, initialRating]);

  const handleSubmit = async () => {
    const trimmed = comment.trim();
    if (!trimmed) {
      setError("Lütfen birkaç kelime yaz.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(rating, trimmed.slice(0, 500));
      onClose();
    } catch {
      setError("Gönderilemedi. Tekrar dene.");
      setSubmitting(false);
    }
  };

  const positive = rating === 1;
  const accent = positive ? colors.primary : "#ef4444";

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.backdrop}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={submitting ? undefined : onClose} />
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.background, borderColor: colors.border },
          ]}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.foreground }]}>
              Geri bildirim gönder
            </Text>
            <Pressable onPress={submitting ? undefined : onClose} hitSlop={10}>
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </Pressable>
          </View>

          <Text style={[styles.label, { color: colors.mutedForeground }]}>
            Bu yanıt hakkında ne düşünüyorsun?
          </Text>
          <View style={styles.ratingRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Olumlu"
              accessibilityState={{ selected: positive }}
              onPress={() => setRating(1)}
              style={({ pressed }) => [
                styles.ratingBtn,
                {
                  borderColor: positive ? colors.primary : colors.border,
                  backgroundColor: positive ? colors.primary + "22" : "transparent",
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Feather
                name="thumbs-up"
                size={16}
                color={positive ? colors.primary : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.ratingText,
                  { color: positive ? colors.primary : colors.mutedForeground },
                ]}
              >
                Yararlı
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Olumsuz"
              accessibilityState={{ selected: !positive }}
              onPress={() => setRating(-1)}
              style={({ pressed }) => [
                styles.ratingBtn,
                {
                  borderColor: !positive ? "#ef4444" : colors.border,
                  backgroundColor: !positive ? "#ef444422" : "transparent",
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Feather
                name="thumbs-down"
                size={16}
                color={!positive ? "#ef4444" : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.ratingText,
                  { color: !positive ? "#ef4444" : colors.mutedForeground },
                ]}
              >
                Sorunlu
              </Text>
            </Pressable>
          </View>

          <Text style={[styles.label, { color: colors.mutedForeground, marginTop: 14 }]}>
            Yorumun
          </Text>
          <TextInput
            value={comment}
            onChangeText={(t) => {
              setComment(t);
              if (error) setError(null);
            }}
            placeholder="Ne iyi gitti veya neyi düzeltmeliyiz?"
            placeholderTextColor={colors.mutedForeground}
            multiline
            maxLength={500}
            editable={!submitting}
            style={[
              styles.input,
              {
                color: colors.foreground,
                borderColor: error ? "#ef4444" : colors.border,
                backgroundColor: colors.card,
              },
            ]}
          />
          <Text style={[styles.counter, { color: colors.mutedForeground }]}>
            {comment.length}/500
          </Text>
          {error ? (
            <Text style={[styles.errorText, { color: "#ef4444" }]}>{error}</Text>
          ) : null}

          <View style={styles.actions}>
            <Pressable
              onPress={submitting ? undefined : onClose}
              style={({ pressed }) => [
                styles.btn,
                styles.btnGhost,
                { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={[styles.btnText, { color: colors.foreground }]}>İptal</Text>
            </Pressable>
            <Pressable
              onPress={handleSubmit}
              disabled={submitting}
              style={({ pressed }) => [
                styles.btn,
                {
                  backgroundColor: accent,
                  opacity: submitting ? 0.6 : pressed ? 0.85 : 1,
                },
              ]}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={[styles.btnText, { color: "#fff" }]}>Gönder</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "#00000099",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  sheet: {
    borderRadius: 14,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  title: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  label: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 8 },
  ratingRow: { flexDirection: "row", gap: 10 },
  ratingBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  ratingText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  input: {
    minHeight: 90,
    maxHeight: 200,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlignVertical: "top",
  },
  counter: { fontSize: 11, fontFamily: "Inter_400Regular", alignSelf: "flex-end", marginTop: 4 },
  errorText: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 6 },
  actions: { flexDirection: "row", gap: 10, marginTop: 16, justifyContent: "flex-end" },
  btn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: 96,
    alignItems: "center",
    justifyContent: "center",
  },
  btnGhost: { borderWidth: StyleSheet.hairlineWidth },
  btnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
});
