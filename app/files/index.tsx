import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  AppStateStatus,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import {
  FileFailureReason,
  FileStateKind,
  UserFileDto,
  deleteUserFile,
  listUserFiles,
  retryUserFile,
} from "@/services/filesApi";

function fileIcon(ext: string | null, mime: string): {
  name: React.ComponentProps<typeof Feather>["name"];
  color: string;
} {
  const e = (ext || "").toLowerCase();
  if (e === "pdf") return { name: "file-text", color: "#dc2626" };
  if (["png", "jpg", "jpeg", "webp", "gif", "heic"].includes(e))
    return { name: "image", color: "#0ea5e9" };
  if (["xlsx", "csv"].includes(e)) return { name: "grid", color: "#16a34a" };
  if (e === "pptx") return { name: "monitor", color: "#ea580c" };
  if (e === "docx") return { name: "file-text", color: "#2563eb" };
  if (e === "zip") return { name: "package", color: "#64748b" };
  if (mime.startsWith("audio/")) return { name: "music", color: "#9333ea" };
  return { name: "file", color: "#6b7280" };
}

function formatBytes(n: number): string {
  if (!n || n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

/**
 * Task #145 — derive the discriminated state from the server DTO. New
 * server builds set `stateKind` directly; while OTA is rolling out we
 * fall back to the legacy `status` string so the chip never goes blank.
 */
function deriveStateKind(f: UserFileDto): FileStateKind | null {
  if (f.stateKind) return f.stateKind;
  switch (f.status) {
    case "uploaded":
      return "Uploaded";
    case "processing":
      return "Extracting";
    case "extracted":
      return "Extracted";
    case "embedding":
      return "Embedding";
    case "ready":
      return "Ready";
    case "failed":
    case "embed_failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
    default:
      return null;
  }
}

interface ChipStyle {
  label: string;
  fg: string;
  bg: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  spinning?: boolean;
}

function chipStyleFor(state: FileStateKind | null, reason: string | null): ChipStyle | null {
  switch (state) {
    case "Uploaded":
      return { label: "Sıraya alındı", fg: "#475569", bg: "#e2e8f0", icon: "clock" };
    case "Extracting":
      return {
        label: "Metin çıkarılıyor…",
        fg: "#2563eb",
        bg: "#dbeafe",
        icon: "loader",
        spinning: true,
      };
    case "Extracted":
      return { label: "Vektörleme bekliyor", fg: "#1d4ed8", bg: "#dbeafe", icon: "cpu" };
    case "Embedding":
      return {
        label: "Vektörleniyor…",
        fg: "#7c3aed",
        bg: "#ede9fe",
        icon: "loader",
        spinning: true,
      };
    case "Ready":
      // Ready durumda chip göstermiyoruz — meta satırı yeterli.
      return null;
    case "Failed":
      return { label: failureLabel(reason), fg: "#b91c1c", bg: "#fee2e2", icon: "alert-triangle" };
    case "Cancelled":
      return { label: "İptal edildi", fg: "#475569", bg: "#e2e8f0", icon: "slash" };
    default:
      return null;
  }
}

function failureLabel(reason: string | null): string {
  const r = (reason as FileFailureReason | null) ?? "unknown";
  switch (r) {
    case "extract_error":
      return "Çıkarma hatası";
    case "embed_rate_limit":
      return "Yoğunluk hatası — tekrar dene";
    case "embed_quota":
      return "Kota doldu";
    case "embed_unknown":
      return "Vektörleme başarısız";
    case "storage_missing":
      return "Dosya bulunamadı";
    case "stale":
      return "İşlem askıda kaldı";
    case "timeout":
      return "Zaman aşımı";
    case "unknown":
    default:
      return "Hata oluştu";
  }
}

/** Sürekli dönen küçük loader (chip içi). */
function SpinningIcon({
  name,
  color,
  size = 11,
}: {
  name: React.ComponentProps<typeof Feather>["name"];
  color: string;
  size?: number;
}) {
  return <Feather name={name} size={size} color={color} />;
}

function StateChip({ state, reason }: { state: FileStateKind | null; reason: string | null }) {
  const style = chipStyleFor(state, reason);
  if (!style) return null;
  return (
    <View style={[styles.chip, { backgroundColor: style.bg }]}>
      {style.spinning ? (
        <ActivityIndicator size="small" color={style.fg} style={{ transform: [{ scale: 0.6 }] }} />
      ) : (
        <SpinningIcon name={style.icon} color={style.fg} />
      )}
      <Text style={[styles.chipText, { color: style.fg }]} numberOfLines={1}>
        {style.label}
      </Text>
    </View>
  );
}

export default function FilesScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [files, setFiles] = useState<UserFileDto[]>([]);
  const [quota, setQuota] = useState<{ used: number; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const loadingRef = useRef(false);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const r = await listUserFiles();
      setFiles(r.files);
      setQuota(r.quota);
      setError(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Dosyalar yüklenemedi.";
      setError(msg);
    } finally {
      loadingRef.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Foreground refresh: when the user comes back to the app and there's
  // any non-terminal file, fetch once. We do not run a continuous
  // background poll — that would burn battery; per spec, foreground
  // event is enough.
  const hasInFlight = useCallback(
    (list: UserFileDto[]) =>
      list.some((f) => {
        const s = deriveStateKind(f);
        return s === "Uploaded" || s === "Extracting" || s === "Extracted" || s === "Embedding";
      }),
    [],
  );

  useEffect(() => {
    const sub = AppState.addEventListener("change", (s: AppStateStatus) => {
      if (s === "active" && hasInFlight(files)) {
        load();
      }
    });
    return () => sub.remove();
  }, [files, load, hasInFlight]);

  // Light-touch poll while focused if any file is still progressing.
  // Stops as soon as the queue clears so we're not hitting the API
  // forever after the user uploads one big PDF.
  useEffect(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (hasInFlight(files)) {
      pollTimerRef.current = setTimeout(() => load(), 6000);
    }
    return () => {
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [files, load, hasInFlight]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const onDelete = useCallback(
    (file: UserFileDto) => {
      Alert.alert(
        "Dosyayı sil",
        `"${file.name}" silinecek. Bu işlem geri alınamaz.`,
        [
          { text: "İptal", style: "cancel" },
          {
            text: "Sil",
            style: "destructive",
            onPress: async () => {
              setDeletingId(file.fileId);
              try {
                await deleteUserFile(file.fileId);
                setFiles((prev) => prev.filter((f) => f.fileId !== file.fileId));
              } catch (e) {
                const msg = e instanceof Error ? e.message : "Silinemedi.";
                Alert.alert("Hata", msg);
              } finally {
                setDeletingId(null);
              }
            },
          },
        ],
      );
    },
    [],
  );

  const onRetry = useCallback(
    async (file: UserFileDto) => {
      if (retryingId) return;
      setRetryingId(file.fileId);
      try {
        const updated = await retryUserFile(file.fileId);
        setFiles((prev) => prev.map((f) => (f.fileId === file.fileId ? { ...f, ...updated } : f)));
        // Hemen polling başlasın diye listeyi yenile.
        load();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Tekrar denenemedi.";
        Alert.alert("Tekrar deneme başarısız", msg);
      } finally {
        setRetryingId(null);
      }
    },
    [retryingId, load],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return files;
    return files.filter((f) => f.name.toLowerCase().includes(q));
  }, [files, search]);

  const topPad = Platform.OS === "web" ? 24 : insets.top;
  const usedPct = quota && quota.total > 0
    ? Math.min(100, Math.round((quota.used / quota.total) * 100))
    : 0;

  const renderItem = ({ item }: { item: UserFileDto }) => {
    const ic = fileIcon(item.extension, item.mimeType);
    const state = deriveStateKind(item);
    const reason = (item.lastFailureReason as string | null) ?? null;
    // Server `canRetry` flag'i geldiyse ona uy; yoksa Failed→true varsay
    // (OTA gecikmesi sırasında eski sunucu için graceful fallback).
    const canRetry = item.canRetry ?? state === "Failed";
    const retryCount = item.retryCount ?? 0;
    return (
      <Pressable
        onPress={() => router.push(`/files/${item.fileId}` as never)}
        style={({ pressed }) => [
          styles.row,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <View style={[styles.rowIcon, { backgroundColor: ic.color + "1A" }]}>
          <Feather name={ic.name} size={18} color={ic.color} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.rowName, { color: colors.foreground }]} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={styles.rowMeta}>
            {item.extension ? (
              <>
                <Text style={[styles.rowMetaText, { color: colors.mutedForeground }]}>
                  {item.extension.toUpperCase()}
                </Text>
                <Text style={[styles.rowMetaText, { color: colors.mutedForeground }]}>·</Text>
              </>
            ) : null}
            <Text style={[styles.rowMetaText, { color: colors.mutedForeground }]}>
              {formatBytes(item.sizeBytes)}
            </Text>
            {item.pageCount && item.pageCount > 0 ? (
              <>
                <Text style={[styles.rowMetaText, { color: colors.mutedForeground }]}>·</Text>
                <Text style={[styles.rowMetaText, { color: colors.mutedForeground }]}>
                  {item.pageCount} sayfa
                </Text>
              </>
            ) : null}
            <Text style={[styles.rowMetaText, { color: colors.mutedForeground }]}>·</Text>
            <Text style={[styles.rowMetaText, { color: colors.mutedForeground }]}>
              {formatDate(item.uploadedAt)}
            </Text>
          </View>
          <View style={styles.chipRow}>
            <StateChip state={state} reason={reason} />
            {state === "Failed" && canRetry ? (
              <Pressable
                onPress={(e) => {
                  e.stopPropagation?.();
                  onRetry(item);
                }}
                disabled={retryingId === item.fileId}
                hitSlop={6}
                style={({ pressed }) => [
                  styles.retryInline,
                  {
                    borderColor: colors.border,
                    backgroundColor: pressed ? colors.muted : "transparent",
                  },
                ]}
              >
                {retryingId === item.fileId ? (
                  <ActivityIndicator size="small" color={colors.foreground} />
                ) : (
                  <>
                    <Feather name="refresh-cw" size={11} color={colors.foreground} />
                    <Text style={[styles.retryInlineText, { color: colors.foreground }]}>
                      Tekrar Dene{retryCount > 0 ? ` (${retryCount})` : ""}
                    </Text>
                  </>
                )}
              </Pressable>
            ) : null}
          </View>
          {state === "Failed" && item.errorMessage ? (
            <Text
              style={[styles.errorText, { color: colors.mutedForeground }]}
              numberOfLines={2}
            >
              {item.errorMessage}
            </Text>
          ) : null}
        </View>
        <Pressable
          onPress={(e) => {
            e.stopPropagation?.();
            onDelete(item);
          }}
          hitSlop={10}
          disabled={deletingId === item.fileId}
          style={{ padding: 6 }}
        >
          {deletingId === item.fileId ? (
            <ActivityIndicator size="small" color={colors.mutedForeground} />
          ) : (
            <Feather name="trash-2" size={16} color={colors.mutedForeground} />
          )}
        </Pressable>
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Feather name="chevron-left" size={26} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground }]}>Dosyalarım</Text>
        <Pressable onPress={onRefresh} hitSlop={12} style={styles.backBtn}>
          <Feather name="refresh-cw" size={20} color={colors.foreground} />
        </Pressable>
      </View>

      {quota ? (
        <View style={styles.quotaWrap}>
          <View style={styles.quotaTop}>
            <Text style={[styles.quotaLabel, { color: colors.mutedForeground }]}>
              {formatBytes(quota.used)} / {formatBytes(quota.total)} kullanıldı
            </Text>
            <Text style={[styles.quotaLabel, { color: colors.mutedForeground }]}>
              {usedPct}%
            </Text>
          </View>
          <View style={[styles.quotaTrack, { backgroundColor: colors.muted }]}>
            <View
              style={[
                styles.quotaFill,
                {
                  width: `${usedPct}%`,
                  backgroundColor: usedPct > 90 ? "#dc2626" : colors.primary,
                },
              ]}
            />
          </View>
        </View>
      ) : null}

      <View
        style={[
          styles.searchWrap,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Feather name="search" size={15} color={colors.mutedForeground} />
        <TextInput
          style={[styles.searchInput, { color: colors.foreground }]}
          placeholder="Dosya adı ara…"
          placeholderTextColor={colors.mutedForeground}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {search.length > 0 ? (
          <Pressable onPress={() => setSearch("")} hitSlop={6}>
            <Feather name="x" size={14} color={colors.mutedForeground} />
          </Pressable>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.emptyWrap}>
          <Feather name="alert-circle" size={36} color="#dc2626" />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            Yüklenemedi
          </Text>
          <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
            {error}
          </Text>
          <Pressable
            onPress={onRefresh}
            style={({ pressed }) => [
              styles.retryBtn,
              { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Text style={styles.retryBtnText}>Tekrar dene</Text>
          </Pressable>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyWrap}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}>
            <Feather name="folder" size={32} color={colors.mutedForeground} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            {search ? "Sonuç yok" : "Henüz dosya yok"}
          </Text>
          <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
            {search
              ? "Arama kriterlerine uyan dosya bulunamadı."
              : "AI sohbetinde + tuşundan PDF, görsel, Excel, Word ve daha fazlasını yükle."}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(it) => it.fileId}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 8 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: { padding: 4 },
  title: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  quotaWrap: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 12 },
  quotaTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  quotaLabel: { fontSize: 11, fontFamily: "Inter_500Medium" },
  quotaTrack: {
    height: 5,
    borderRadius: 3,
    overflow: "hidden",
  },
  quotaFill: { height: "100%", borderRadius: 3 },
  searchWrap: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    paddingVertical: 0,
  },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 36,
    gap: 12,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  emptyDesc: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 19 },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  retryBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 13 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  rowName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  rowMeta: { flexDirection: "row", gap: 6, marginTop: 2, flexWrap: "wrap" },
  rowMetaText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  chipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
    flexWrap: "wrap",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    maxWidth: "100%",
  },
  chipText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  retryInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  retryInlineText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  errorText: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 4 },
});
