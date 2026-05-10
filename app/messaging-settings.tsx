import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import MessagingSettingsContent from "@/components/MessagingSettingsContent";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useColors } from "@/hooks/useColors";

export default function MessagingSettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { settings, setSetting, pushMessagingToServer } = useSettings();
  const { user, token } = useAuth();

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const saveAndContinue = async () => {
    setSetting("messagingConfigured", true);
    if (token) {
      await new Promise(res => setTimeout(res, 50));
      await pushMessagingToServer(token);
    }
    router.back();
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingTop: topPad + 12, paddingHorizontal: 16, paddingBottom: 12,
      backgroundColor: colors.card,
      borderBottomWidth: 1, borderBottomColor: colors.border,
      flexDirection: "row", alignItems: "center", gap: 12,
    },
    title: { fontSize: 20, fontFamily: "Inter_700Bold", color: colors.foreground, flex: 1 },
    intro: {
      backgroundColor: colors.primary + "15", marginHorizontal: 16, marginTop: 16,
      padding: 14, borderRadius: colors.radius, flexDirection: "row", gap: 10, alignItems: "flex-start",
    },
    introText: { flex: 1, fontSize: 13, color: colors.foreground, fontFamily: "Inter_400Regular", lineHeight: 18 },
    saveBtn: {
      margin: 16, marginTop: 24, padding: 14, borderRadius: colors.radius,
      backgroundColor: colors.primary, alignItems: "center",
    },
    saveText: { color: colors.primaryForeground, fontSize: 16, fontFamily: "Inter_600SemiBold" },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Feather name="arrow-left" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={styles.title}>Mesajlaşma Ayarları</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        {!settings.messagingConfigured && (
          <View style={styles.intro}>
            <Feather name="info" size={18} color={colors.primary} />
            <Text style={styles.introText}>
              Mesajlaşmaya başlamadan önce gizlilik tercihlerini ayarla.
              Buradan kimlerin sana ulaşabileceğini ve hangi bilgilerinin görüneceğini seçebilirsin.
            </Text>
          </View>
        )}

        <MessagingSettingsContent colors={colors} isAdmin={user?.isAdmin} />

        <Pressable style={styles.saveBtn} onPress={saveAndContinue}>
          <Text style={styles.saveText}>
            {settings.messagingConfigured ? "Kaydet" : "Kaydet ve Mesajlaşmaya Başla"}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
