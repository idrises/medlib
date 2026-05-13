import { Feather } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image as RNImage,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useColors } from "@/hooks/useColors";
import { API_BASE_URL } from "@/services/api";
import { FilePagePreview, getFilePage, listFilePages } from "@/services/filesApi";

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
  pageNum: initialPage,
}: Props) {
  const colors = useColors();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState<number | null>(initialPage);
  const [data, setData] = useState<FilePagePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Upper bound for the pager. null = unknown (don't disable Next yet);
  // 0 = file has no pages; >0 = last page index.
  const [pageCount, setPageCount] = useState<number | null>(null);

  // Reset when opened with a new (file, page) pair.
  useEffect(() => {
    if (visible) {
      setPage(initialPage);
      setData(null);
      setError(null);
      setPageCount(null);
    }
  }, [visible, initialPage, fileId]);

  // Fetch the file's total page count once per open so the pager can
  // disable the Next button at the last page rather than stepping
  // into repeated 404s.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    listFilePages(fileId)
      .then((p) => {
        if (!cancelled) setPageCount(p.pageCount);
      })
      .catch(() => {
        if (!cancelled) setPageCount(null);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, fileId]);

  // Fetch the page preview whenever the active page changes while open.
  useEffect(() => {
    if (!visible || !page || page < 1) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getFilePage(fileId, page)
      .then((r) => {
        if (!cancelled) setData(r);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setData(null);
          setError(e instanceof Error ? e.message : "Sayfa yüklenemedi.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, fileId, page]);

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

  const goToFiles = () => {
    onClose();
    router.push(`/files/${fileId}` as never);
  };

  const goPrev = () => {
    if (page && page > 1) setPage(page - 1);
  };
  const goNext = () => {
    if (!page) return;
    if (pageCount !== null && page >= pageCount) return;
    setPage(page + 1);
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
            <View
              style={[styles.iconWrap, { backgroundColor: colors.primary + "18" }]}
            >
              <Feather name="file-text" size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={[styles.title, { color: colors.foreground }]}
                numberOfLines={2}
              >
                {fileName}
              </Text>
              {page !== null && page > 0 ? (
                <Text style={[styles.sub, { color: colors.mutedForeground }]}>
                  Sayfa {page}
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
              styles.previewWrap,
              { backgroundColor: colors.muted, borderColor: colors.border },
            ]}
          >
            {loading ? (
              <ActivityIndicator color={colors.primary} />
            ) : data?.imageDataUrl ? (
              <RNImage
                source={{ uri: data.imageDataUrl }}
                style={styles.previewImage}
                resizeMode="contain"
              />
            ) : error ? (
              <View style={styles.previewMsg}>
                <Feather name="alert-circle" size={28} color="#dc2626" />
                <Text
                  style={[styles.previewMsgText, { color: colors.mutedForeground }]}
                >
                  {error}
                </Text>
              </View>
            ) : (
              <View style={styles.previewMsg}>
                <Feather name="image" size={28} color={colors.mutedForeground} />
                <Text
                  style={[styles.previewMsgText, { color: colors.mutedForeground }]}
                >
                  {page
                    ? `Sayfa ${page} önizlemesi yüklenecek.`
                    : "Bu dosya için sayfa önizlemesi yok."}
                </Text>
              </View>
            )}
          </View>

          {data?.pageText ? (
            <ScrollView style={styles.textWrap} nestedScrollEnabled>
              <Text style={[styles.pageText, { color: colors.foreground }]}>
                {data.pageText}
              </Text>
            </ScrollView>
          ) : null}

          {page !== null && page > 0 ? (
            <View style={styles.pager}>
              <Pressable
                onPress={goPrev}
                disabled={page <= 1 || loading}
                hitSlop={10}
                style={({ pressed }) => [
                  styles.pagerBtn,
                  {
                    borderColor: colors.border,
                    opacity: page <= 1 || loading ? 0.4 : pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Feather name="chevron-left" size={18} color={colors.foreground} />
              </Pressable>
              <Text style={[styles.pagerText, { color: colors.mutedForeground }]}>
                {pageCount !== null && pageCount > 0
                  ? `Sayfa ${page} / ${pageCount}`
                  : `Sayfa ${page}`}
              </Text>
              <Pressable
                onPress={goNext}
                disabled={
                  loading || (pageCount !== null && page >= pageCount)
                }
                hitSlop={10}
                style={({ pressed }) => {
                  const atEnd = pageCount !== null && page >= pageCount;
                  return [
                    styles.pagerBtn,
                    {
                      borderColor: colors.border,
                      opacity: loading || atEnd ? 0.4 : pressed ? 0.7 : 1,
                    },
                  ];
                }}
              >
                <Feather
                  name="chevron-right"
                  size={18}
                  color={colors.foreground}
                />
              </Pressable>
            </View>
          ) : null}

          <View style={styles.actions}>
            <Pressable
              onPress={openFile}
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
              <Text
                style={[styles.secondaryBtnText, { color: colors.foreground }]}
              >
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
    gap: 14,
    maxHeight: "92%",
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
  previewWrap: {
    height: 320,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  previewImage: { width: "100%", height: "100%" },
  previewMsg: {
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 24,
  },
  previewMsgText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  textWrap: { maxHeight: 120 },
  pageText: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  pager: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  pagerBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pagerText: { fontSize: 12, fontFamily: "Inter_500Medium" },
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
