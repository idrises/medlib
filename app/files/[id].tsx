import { Feather } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image as RNImage,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import PagePreviewModal from "@/components/PagePreviewModal";
import { useColors } from "@/hooks/useColors";
import { API_BASE_URL } from "@/services/api";
import {
  type FileSubStatus,
  UserFileDto,
  deleteUserFile,
  getFilePage,
  getUserFile,
  listFilePages,
} from "@/services/filesApi";

function formatBytes(n: number): string {
  if (!n || n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export default function FileDetailScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string }>();
  const fileId = String(params.id ?? "");

  const [file, setFile] = useState<UserFileDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pageCount, setPageCount] = useState<number>(0);
  const [previewPage, setPreviewPage] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const f = await getUserFile(fileId);
      setFile(f);
      // Fetch page list separately — failure here shouldn't break the
      // detail screen, just hide the gallery.
      try {
        const p = await listFilePages(fileId);
        setPageCount(p.pageCount);
      } catch {
        setPageCount(0);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Dosya bulunamadı.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [fileId]);

  useEffect(() => {
    load();
  }, [load]);

  const onOpen = async () => {
    if (!file || busy) return;
    setBusy(true);
    try {
      const token = await AsyncStorage.getItem("medlib_auth_token");
      if (!token) throw new Error("Oturum bulunamadı.");
      const safe = (file.name || "dosya").replace(/[\\/:"<>|?*\x00-\x1f]/g, "_");
      const target = `${FileSystem.cacheDirectory}${file.fileId}-${safe}`;
      const dl = await FileSystem.downloadAsync(
        `${API_BASE_URL}/files/${file.fileId}/download`,
        target,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (dl.status >= 400) throw new Error(`İndirme hatası (${dl.status})`);
      if (Platform.OS === "web") {
        if (typeof window !== "undefined") window.open(dl.uri, "_blank");
      } else {
        const can = await Sharing.isAvailableAsync();
        if (can) await Sharing.shareAsync(dl.uri);
        else Alert.alert("Açılamadı", "Bu cihazda paylaşım uygun değil.");
      }
    } catch (e) {
      Alert.alert("Hata", e instanceof Error ? e.message : "Dosya açılamadı.");
    } finally {
      setBusy(false);
    }
  };

  const onAskAi = () => {
    if (!file) return;
    router.push({
      pathname: "/ai-chat/[id]",
      params: {
        id: "new",
        prefill: `📎 "${file.name}" dosyam hakkında bana yardım et.`,
        fileId: file.fileId,
        fileName: file.name,
      },
    } as never);
  };

  const onDelete = () => {
    if (!file) return;
    Alert.alert(
      "Dosyayı sil",
      `"${file.name}" silinecek. Bu işlem geri alınamaz.`,
      [
        { text: "İptal", style: "cancel" },
        {
          text: "Sil",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteUserFile(file.fileId);
              router.back();
            } catch (e) {
              Alert.alert("Hata", e instanceof Error ? e.message : "Silinemedi.");
            }
          },
        },
      ],
    );
  };

  const topPad = Platform.OS === "web" ? 24 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Feather name="chevron-left" size={26} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
          Dosya
        </Text>
        <View style={{ width: 26 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error || !file ? (
        <View style={styles.center}>
          <Feather name="alert-circle" size={36} color="#dc2626" />
          <Text style={[styles.errorText, { color: colors.foreground }]}>
            {error ?? "Dosya bulunamadı."}
          </Text>
          <Pressable
            onPress={() => router.back()}
            style={[styles.primaryBtn, { backgroundColor: colors.primary, marginTop: 12 }]}
          >
            <Text style={styles.primaryBtnText}>Geri dön</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <View
            style={[
              styles.heroCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View
              style={[
                styles.heroIcon,
                { backgroundColor: colors.primary + "18" },
              ]}
            >
              <Feather name="file-text" size={26} color={colors.primary} />
            </View>
            <Text
              style={[styles.heroName, { color: colors.foreground }]}
              numberOfLines={3}
            >
              {file.name}
            </Text>
            <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>
              {(file.extension ?? "").toUpperCase() || "DOSYA"} ·{" "}
              {formatBytes(file.sizeBytes)}
            </Text>
          </View>

          <InfoRow label="Tip (MIME)" value={file.mimeType} colors={colors} />
          <InfoRow
            label="Durum"
            value={
              file.status === "ready"
                ? "Hazır"
                : file.status === "processing"
                  ? "İşleniyor"
                  : file.status === "failed"
                    ? "Hata"
                    : file.status
            }
            colors={colors}
          />
          {file.chunkCount !== null && file.chunkCount > 0 ? (
            <InfoRow
              label="İçerik parça sayısı"
              value={String(file.chunkCount)}
              colors={colors}
            />
          ) : null}

          {/* Task #153 — per-capability sub-status mini chips. Older
              servers don't return `subStatuses`; in that case we hide
              the row entirely so the screen looks identical to before. */}
          {file.subStatuses ? (
            <View style={styles.chipsRow}>
              <SubStatusChip label="Metin" v={file.subStatuses.text} colors={colors} />
              <SubStatusChip label="Sayfa" v={file.subStatuses.render} colors={colors} />
              <SubStatusChip label="OCR" v={file.subStatuses.ocr} colors={colors} />
              <SubStatusChip label="Tablo" v={file.subStatuses.table} colors={colors} />
              <SubStatusChip label="Şekil" v={file.subStatuses.figure} colors={colors} />
            </View>
          ) : null}
          <InfoRow
            label="Yüklenme"
            value={new Date(file.uploadedAt).toLocaleString("tr-TR")}
            colors={colors}
          />
          <InfoRow
            label="Son erişim"
            value={new Date(file.lastAccessedAt).toLocaleString("tr-TR")}
            colors={colors}
          />

          {pageCount > 0 ? (
            <View style={{ marginTop: 18 }}>
              <Text style={[styles.galleryTitle, { color: colors.foreground }]}>
                Sayfalar ({pageCount})
              </Text>
              <Text
                style={[styles.gallerySub, { color: colors.mutedForeground }]}
              >
                Önizlemek için bir sayfaya dokun.
              </Text>
              <FlatList
                data={Array.from({ length: pageCount }, (_, i) => i + 1)}
                keyExtractor={(n) => String(n)}
                numColumns={3}
                scrollEnabled={false}
                columnWrapperStyle={{ gap: 8 }}
                contentContainerStyle={{ gap: 8, marginTop: 10 }}
                initialNumToRender={6}
                maxToRenderPerBatch={6}
                windowSize={3}
                removeClippedSubviews
                renderItem={({ item: n }) => (
                  <PageThumb
                    fileId={file.fileId}
                    pageNum={n}
                    onPress={() => setPreviewPage(n)}
                    colors={colors}
                  />
                )}
              />
            </View>
          ) : null}

          <View style={{ gap: 10, marginTop: 16 }}>
            <Pressable
              onPress={onOpen}
              disabled={busy}
              style={({ pressed }) => [
                styles.primaryBtn,
                {
                  backgroundColor: colors.primary,
                  opacity: busy ? 0.6 : pressed ? 0.85 : 1,
                },
              ]}
            >
              {busy ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Feather name="external-link" size={15} color="#fff" />
                  <Text style={styles.primaryBtnText}>Dosyayı aç / paylaş</Text>
                </>
              )}
            </Pressable>
            <Pressable
              onPress={onAskAi}
              style={({ pressed }) => [
                styles.secondaryBtn,
                { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Feather name="cpu" size={15} color={colors.foreground} />
              <Text style={[styles.secondaryBtnText, { color: colors.foreground }]}>
                AI'a sor
              </Text>
            </Pressable>
            <Pressable
              onPress={onDelete}
              style={({ pressed }) => [
                styles.secondaryBtn,
                { borderColor: "#dc2626", opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Feather name="trash-2" size={15} color="#dc2626" />
              <Text style={[styles.secondaryBtnText, { color: "#dc2626" }]}>
                Dosyayı sil
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      )}
      {file && previewPage !== null ? (
        <PagePreviewModal
          visible={previewPage !== null}
          onClose={() => setPreviewPage(null)}
          fileId={file.fileId}
          fileName={file.name}
          pageNum={previewPage}
        />
      ) : null}
    </View>
  );
}

interface PageThumbProps {
  fileId: string;
  pageNum: number;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
}

function PageThumb({ fileId, pageNum, onPress, colors }: PageThumbProps) {
  const [uri, setUri] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getFilePage(fileId, pageNum)
      .then((r) => {
        if (!cancelled) setUri(r.imageDataUrl);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [fileId, pageNum]);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.thumb,
        {
          backgroundColor: colors.muted,
          borderColor: colors.border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      {uri ? (
        <RNImage source={{ uri }} style={styles.thumbImage} resizeMode="cover" />
      ) : failed ? (
        <Feather name="alert-circle" size={18} color={colors.mutedForeground} />
      ) : (
        <ActivityIndicator size="small" color={colors.mutedForeground} />
      )}
      <View style={[styles.thumbLabel, { backgroundColor: "rgba(0,0,0,0.55)" }]}>
        <Text style={styles.thumbLabelText}>{pageNum}</Text>
      </View>
    </Pressable>
  );
}

function InfoRow({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
      <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>
        {label}
      </Text>
      <Text
        style={[styles.infoValue, { color: colors.foreground }]}
        numberOfLines={3}
      >
        {value}
      </Text>
    </View>
  );
}

/**
 * Task #153 — render one sub-status as a small coloured chip. NULL
 * (legacy/unknown) is intentionally shown as a neutral "—" pill rather
 * than hidden so the user can see *which* axis we don't know about
 * yet (vs. an axis that's not_supported for this MIME type).
 */
function SubStatusChip({
  label,
  v,
  colors,
}: {
  label: string;
  v: FileSubStatus | null | undefined;
  colors: ReturnType<typeof useColors>;
}) {
  const palette = chipPalette(v ?? null, colors);
  return (
    <View
      style={[
        styles.chip,
        { backgroundColor: palette.bg, borderColor: palette.border },
      ]}
    >
      <Text style={[styles.chipLabel, { color: palette.fg }]}>{label}</Text>
      <Text style={[styles.chipValue, { color: palette.fg }]}>
        {chipShortValue(v ?? null)}
      </Text>
    </View>
  );
}

function chipShortValue(v: FileSubStatus | null): string {
  switch (v) {
    case "ok":
      return "✓";
    case "partial":
      return "~";
    case "failed":
      return "✕";
    case "pending":
      return "…";
    case "not_supported":
      return "n/a";
    case "not_needed":
      return "—";
    default:
      return "?";
  }
}

function chipPalette(
  v: FileSubStatus | null,
  colors: ReturnType<typeof useColors>,
): { bg: string; fg: string; border: string } {
  switch (v) {
    case "ok":
      return { bg: "#16a34a22", fg: "#15803d", border: "#16a34a55" };
    case "partial":
      return { bg: "#ca8a0422", fg: "#a16207", border: "#ca8a0455" };
    case "failed":
      return { bg: "#dc262622", fg: "#b91c1c", border: "#dc262655" };
    case "pending":
      return { bg: colors.muted, fg: colors.foreground, border: colors.border };
    case "not_supported":
    case "not_needed":
    default:
      return {
        bg: colors.muted,
        fg: colors.mutedForeground,
        border: colors.border,
      };
  }
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingVertical: 10,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  chipValue: { fontSize: 11, fontFamily: "Inter_500Medium" },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: { padding: 4 },
  title: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 10 },
  errorText: { fontSize: 14, fontFamily: "Inter_500Medium", textAlign: "center" },
  heroCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    marginBottom: 16,
    gap: 10,
  },
  heroIcon: {
    width: 60,
    height: 60,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  heroName: { fontSize: 16, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  heroSub: { fontSize: 12, fontFamily: "Inter_500Medium" },
  infoRow: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  infoLabel: { fontSize: 12, fontFamily: "Inter_500Medium", flex: 0 },
  infoValue: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    flex: 1,
    textAlign: "right",
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
  },
  primaryBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  secondaryBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  galleryTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  gallerySub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  thumb: {
    flex: 1,
    aspectRatio: 0.72,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbImage: { width: "100%", height: "100%" },
  thumbLabel: {
    position: "absolute",
    bottom: 4,
    right: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  thumbLabelText: {
    color: "#fff",
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
  },
});
