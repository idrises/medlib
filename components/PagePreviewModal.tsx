import { Feather } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useColors } from "@/hooks/useColors";
import { API_BASE_URL } from "@/services/api";

interface Props {
  visible: boolean;
  onClose: () => void;
  fileId: string;
  fileName: string;
  pageNum: number | null;
}

export default function PagePreviewModal({
  visible,
  onClose,
  fileId,
  fileName,
  pageNum,
}: Props) {
  const colors = useColors();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const openFile = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const token = await AsyncStorage.getItem("medlib_auth_token");
      if (!token) throw new Error("Oturum bulunamadı.");
      const safe = (fileName || "dosya").replace(/[\\/:"<>|?*\x00-\x1f]/g, "_");
      const target = `${FileSystem.cacheDirectory}${fileId}-${safe}`;
      const dl = await FileSystem.downloadAsync(
        `${API_BASE_URL}/files/${fileId}/download`,
        target,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (dl.status >= 400) {
        throw new Error(`İndirme hatası (${dl.status})`);
      }
      if (Platform.OS === "web") {
        // Web: open the cached file URI in a new tab.
        if (typeof window !== "undefined") {
          window.open(dl.uri, "_blank");
        }
      } else {
        const can = await Sharing.isAvailableAsync();
        if (can) {
          await Sharing.shareAsync(dl.uri);
        } else {
          Alert.alert("Açılamadı", "Bu cihazda paylaşım uygun değil.");
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Dosya açılamadı.";
      Alert.alert("Hata", msg);
    } finally {
      setBusy(false);
    }
  };

  const goToFiles = () => {
    onClose();
    router.push(`/files/${fileId}` as never);
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: colors.background }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.header}>
            <View style={[styles.iconWrap, { backgroundColor: colors.primary + "18" }]}>
              <Feather name="file-text" size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={[styles.title, { color: colors.foreground }]}
                numberOfLines={2}
              >
                {fileName}
              </Text>
              {pageNum !== null && pageNum > 0 ? (
                <Text style={[styles.sub, { color: colors.mutedForeground }]}>
                  Sayfa {pageNum}
                </Text>
              ) : (
                <Text style={[styles.sub, { color: colors.mutedForeground }]}>
                  Yüklediğiniz dosya
                </Text>
              )}
            </View>
            <Pressable onPress={onClose} hitSlop={10}>
              <Feather name="x" size={22} color={colors.mutedForeground} />
            </Pressable>
          </View>

          <View
            style={[
              styles.placeholder,
              { backgroundColor: colors.muted, borderColor: colors.border },
            ]}
          >
            <Feather name="image" size={36} color={colors.mutedForeground} />
            <Text style={[styles.placeholderText, { color: colors.mutedForeground }]}>
              {pageNum
                ? `Sayfa ${pageNum} önizlemesi tam dosya açılınca görünür.`
                : "Önizleme yok — tam dosyayı aç."}
            </Text>
          </View>

          <View style={styles.actions}>
            <Pressable
              onPress={openFile}
              disabled={busy}
              style={({ pressed }) => [
                styles.primaryBtn,
                { backgroundColor: colors.primary, opacity: busy ? 0.6 : pressed ? 0.85 : 1 },
              ]}
            >
              {busy ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Feather name="external-link" size={15} color="#fff" />
                  <Text style={styles.primaryBtnText}>Tam dosyayı aç</Text>
                </>
              )}
            </Pressable>
            <Pressable
              onPress={goToFiles}
              style={({ pressed }) => [
                styles.secondaryBtn,
                { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Feather name="folder" size={15} color={colors.foreground} />
              <Text style={[styles.secondaryBtnText, { color: colors.foreground }]}>
                Dosya bilgileri
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
    gap: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  sub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  placeholder: {
    height: 220,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 24,
  },
  placeholderText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  actions: { gap: 10 },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
  },
  primaryBtnText: {
    color: "#fff",
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  secondaryBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
});
