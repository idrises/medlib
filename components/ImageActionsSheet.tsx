import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";

interface Props {
  visible: boolean;
  onClose: () => void;
  imageUrl: string;
  authToken?: string | null;
  fileName?: string;
}

function guessExt(url: string): string {
  if (url.startsWith("data:image/png")) return "png";
  if (url.startsWith("data:image/jpeg") || url.startsWith("data:image/jpg")) return "jpg";
  if (url.startsWith("data:image/webp")) return "webp";
  if (url.startsWith("data:image/gif")) return "gif";
  const m = url.match(/\.(png|jpe?g|webp|gif|bmp)(?:\?|$)/i);
  return m ? m[1].toLowerCase().replace("jpeg", "jpg") : "png";
}

async function materializeToCache(url: string, authToken?: string | null, fileName?: string): Promise<string> {
  const ext = guessExt(url);
  const safeName = (fileName ?? `medlib-image-${Date.now()}`).replace(/[^a-zA-Z0-9._-]/g, "_");
  const targetName = safeName.includes(".") ? safeName : `${safeName}.${ext}`;
  const targetPath = `${FileSystem.cacheDirectory}${targetName}`;
  if (url.startsWith("data:image/")) {
    const base64 = url.split(",")[1] ?? "";
    await FileSystem.writeAsStringAsync(targetPath, base64, { encoding: FileSystem.EncodingType.Base64 });
    return targetPath;
  }
  const headers: Record<string, string> = {};
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
  const dl = await FileSystem.downloadAsync(url, targetPath, { headers });
  return dl.uri;
}

export default function ImageActionsSheet({ visible, onClose, imageUrl, authToken, fileName }: Props) {
  const colors = useColors();
  const [busy, setBusy] = useState<string | null>(null);

  const runAction = async (key: string, fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(key);
    try {
      await fn();
    } catch (e: any) {
      Alert.alert("Hata", e?.message ?? "İşlem tamamlanamadı");
    } finally {
      setBusy(null);
      onClose();
    }
  };

  const handleShare = () =>
    runAction("share", async () => {
      const localUri = await materializeToCache(imageUrl, authToken, fileName);
      const ok = await Sharing.isAvailableAsync();
      if (!ok) throw new Error("Paylaşım bu cihazda kullanılamıyor");
      await Sharing.shareAsync(localUri, { dialogTitle: "Resmi paylaş", mimeType: "image/*", UTI: "public.image" });
    });

  const handleCopyImage = () =>
    runAction("copy", async () => {
      if (imageUrl.startsWith("data:image/")) {
        const base64 = imageUrl.split(",")[1] ?? "";
        await Clipboard.setImageAsync(base64);
      } else {
        const localUri = await materializeToCache(imageUrl, authToken, fileName);
        const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 });
        await Clipboard.setImageAsync(base64);
      }
      Alert.alert("Kopyalandı", "Resim panoya kopyalandı.");
    });

  const handleCopyLink = () =>
    runAction("link", async () => {
      if (imageUrl.startsWith("data:image/")) throw new Error("Bu resmin paylaşılabilir bir bağlantısı yok");
      await Clipboard.setStringAsync(imageUrl);
      Alert.alert("Kopyalandı", "Resim bağlantısı panoya kopyalandı.");
    });

  const items: { key: string; icon: any; label: string; onPress: () => void; hidden?: boolean }[] = [
    { key: "share", icon: "share-2", label: "Paylaş / Fotoğraflara Kaydet", onPress: handleShare },
    { key: "copy", icon: "copy", label: "Resmi Kopyala", onPress: handleCopyImage },
    { key: "link", icon: "link", label: "Bağlantıyı Kopyala", onPress: handleCopyLink, hidden: imageUrl.startsWith("data:image/") },
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
            {items.filter(i => !i.hidden).map((it) => (
              <Pressable
                key={it.key}
                accessibilityRole="button"
                accessibilityLabel={it.label}
                onPress={it.onPress}
                disabled={busy !== null}
                style={({ pressed }) => [
                  styles.row,
                  { backgroundColor: pressed ? colors.muted : "transparent", opacity: busy && busy !== it.key ? 0.5 : 1 },
                ]}
                hitSlop={10}
              >
                {busy === it.key ? (
                  <ActivityIndicator size="small" color={colors.foreground} />
                ) : (
                  <Feather name={it.icon} size={18} color={colors.foreground} />
                )}
                <Text style={[styles.label, { color: colors.foreground }]}>{it.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable
            onPress={onClose}
            disabled={busy !== null}
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
  backdrop: { flex: 1, backgroundColor: "#00000066", justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 8,
    paddingBottom: 24,
    paddingHorizontal: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    maxHeight: "60%",
  },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, marginBottom: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 10 },
  label: { fontSize: 15, fontFamily: "Inter_500Medium" },
  cancelRow: { marginTop: 8, paddingVertical: 14, alignItems: "center", borderTopWidth: StyleSheet.hairlineWidth },
  cancelText: { fontSize: 14, fontFamily: "Inter_500Medium" },
});
