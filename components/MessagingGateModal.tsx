import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

export function MessagingGateModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const colors = useColors();
  const router = useRouter();

  const styles = StyleSheet.create({
    backdrop: {
      flex: 1, backgroundColor: "rgba(0,0,0,0.5)",
      alignItems: "center", justifyContent: "center", padding: 24,
    },
    card: {
      width: "100%", maxWidth: 380, backgroundColor: colors.card,
      borderRadius: 16, padding: 22, alignItems: "center",
    },
    iconWrap: {
      width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primary + "20",
      alignItems: "center", justifyContent: "center", marginBottom: 14,
    },
    title: {
      fontSize: 18, fontFamily: "Inter_700Bold", color: colors.foreground,
      textAlign: "center", marginBottom: 8,
    },
    body: {
      fontSize: 14, color: colors.mutedForeground, fontFamily: "Inter_400Regular",
      textAlign: "center", lineHeight: 20, marginBottom: 20,
    },
    primary: {
      backgroundColor: colors.primary, paddingVertical: 12, paddingHorizontal: 22,
      borderRadius: 10, alignSelf: "stretch", alignItems: "center", marginBottom: 8,
    },
    primaryText: { color: colors.primaryForeground, fontSize: 15, fontFamily: "Inter_600SemiBold" },
    secondary: { paddingVertical: 10, alignItems: "center" },
    secondaryText: { color: colors.mutedForeground, fontSize: 14, fontFamily: "Inter_500Medium" },
  });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Feather name="message-circle" size={28} color={colors.primary} />
          </View>
          <Text style={styles.title}>Mesajlaşma Ayarları Gerekli</Text>
          <Text style={styles.body}>
            Mesajlaşmaya başlamadan önce kimlerin sana ulaşabileceğini ve
            hangi bilgilerinin görüneceğini ayarlamalısın.
          </Text>
          <Pressable
            style={styles.primary}
            onPress={() => {
              onClose();
              router.push("/messaging-settings");
            }}
          >
            <Text style={styles.primaryText}>Ayarlara Git</Text>
          </Pressable>
          <Pressable style={styles.secondary} onPress={onClose}>
            <Text style={styles.secondaryText}>Şimdi değil</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
