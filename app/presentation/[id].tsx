import { Feather } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, AppState, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { getPresentation, presentationFileUrl, type Presentation } from "@/services/presentationApi";

export default function PresentationDetailScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const numericId = Number(id);
  const [pres, setPres] = useState<Presentation | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const cancelledRef = useRef(false);
  useEffect(() => {
    cancelledRef.current = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const fetchOnce = async () => {
      try {
        const p = await getPresentation(numericId);
        if (cancelledRef.current) return;
        setPres(p);
        setErr(null);
        // processing ise tekrar poll et
        if (p.status === "processing") {
          timer = setTimeout(fetchOnce, 4000);
        }
      } catch (e: any) {
        if (cancelledRef.current) return;
        setErr(e?.message ?? "Yüklenemedi");
      } finally {
        if (!cancelledRef.current) setLoading(false);
      }
    };

    fetchOnce();
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") {
        if (timer) { clearTimeout(timer); timer = null; }
        fetchOnce();
      }
    });

    return () => {
      cancelledRef.current = true;
      if (timer) clearTimeout(timer);
      sub.remove();
    };
  }, [numericId]);

  const handleDownload = async () => {
    if (!pres) return;
    setDownloading(true);
    try {
      const token = await AsyncStorage.getItem("medlib_auth_token");
      const url = presentationFileUrl(numericId, token);
      if (Platform.OS === "web") {
        Linking.openURL(url);
      } else {
        const safe = (pres.title || "sunum").replace(/[^\p{L}\p{N}_\- ]/gu, "").trim().slice(0, 80) || "sunum";
        const dest = `${FileSystem.cacheDirectory}${safe}.pptx`;
        const dl = await FileSystem.downloadAsync(url, dest);
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(dl.uri, {
            mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            dialogTitle: pres.title,
            UTI: "org.openxmlformats.presentationml.presentation",
          });
        } else {
          Alert.alert("İndirildi", `Dosya: ${dl.uri}`);
        }
      }
    } catch (e: any) {
      Alert.alert("İndirme hatası", e?.message ?? "Bilinmeyen hata");
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (err || !pres) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={{ color: colors.foreground }}>{err ?? "Sunum bulunamadı"}</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 12 }}>
          <Text style={{ color: colors.primary }}>Geri</Text>
        </Pressable>
      </View>
    );
  }

  const slides = pres.outline?.slides ?? [];
  const isProcessing = pres.status === "processing";
  const isFailed = pres.status === "failed";

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.primary }]}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.headerKind}>
            {isProcessing ? "SUNUM · HAZIRLANIYOR…" : isFailed ? "SUNUM · HATA" : `SUNUM · ${pres.slideCount} slayt`}
          </Text>
          <Text style={styles.headerTitle} numberOfLines={2}>{pres.title}</Text>
        </View>
        {!isProcessing && !isFailed ? (
          <Pressable onPress={handleDownload} style={styles.iconBtn} disabled={downloading}>
            {downloading
              ? <ActivityIndicator color="#fff" />
              : <Feather name="download" size={22} color="#fff" />}
          </Pressable>
        ) : isProcessing ? (
          <View style={styles.iconBtn}><ActivityIndicator color="#fff" /></View>
        ) : null}
      </View>

      {isProcessing ? (
        <View style={[styles.center, { flex: 1, backgroundColor: colors.background, padding: 24 }]}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={{ color: colors.foreground, marginTop: 16, fontSize: 15, fontFamily: "Inter_600SemiBold", textAlign: "center" }}>
            Sunum hazırlanıyor…
          </Text>
          <Text style={{ color: colors.mutedForeground, marginTop: 8, fontSize: 13, textAlign: "center", lineHeight: 18 }}>
            30 sn - 2 dk sürebilir. Uygulamayı arka plana alabilirsin{"\n"}— ön plana döndüğünde otomatik tazelenir.
          </Text>
        </View>
      ) : isFailed ? (
        <View style={[styles.center, { flex: 1, backgroundColor: colors.background, padding: 24 }]}>
          <Feather name="alert-triangle" size={36} color="#ef4444" />
          <Text style={{ color: colors.foreground, marginTop: 12, fontSize: 15, fontFamily: "Inter_600SemiBold", textAlign: "center" }}>
            Sunum üretilemedi
          </Text>
          <Text style={{ color: colors.mutedForeground, marginTop: 8, fontSize: 13, textAlign: "center" }}>
            {pres.error ?? "Bilinmeyen hata"}
          </Text>
          <Pressable onPress={() => router.back()} style={{ marginTop: 18, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 8, backgroundColor: colors.primary }}>
            <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold" }}>Geri</Text>
          </Pressable>
        </View>
      ) : null}

      {!isProcessing && !isFailed ? (

      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 30 }}>
        {pres.outline?.subtitle ? (
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{pres.outline.subtitle}</Text>
        ) : null}

        {slides.map((s, i) => (
          <View key={i} style={[styles.slide, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.slideHeader}>
              <Text style={[styles.slideNum, { color: colors.mutedForeground }]}>SLAYT {i + 1}</Text>
              <Text style={[styles.slideTitle, { color: colors.foreground }]}>{s.title}</Text>
            </View>
            {s.bullets.map((b, j) => (
              <View key={j} style={styles.bulletRow}>
                <Text style={[styles.bulletDot, { color: colors.primary }]}>•</Text>
                <Text style={[styles.bulletText, { color: colors.foreground }]}>{b}</Text>
              </View>
            ))}
            {s.imagePrompt && s.imagePrompt.length > 5 ? (
              <View style={[styles.imageNote, { backgroundColor: colors.secondary }]}>
                <Feather name="image" size={11} color={colors.mutedForeground} />
                <Text style={[styles.imageNoteText, { color: colors.mutedForeground }]} numberOfLines={2}>
                  {pres.withImages ? "Görsel PPTX'e gömüldü" : "Görsel önerisi"}: {s.imagePrompt}
                </Text>
              </View>
            ) : null}
            {s.chart && s.chart.data && s.chart.data.length > 0 ? (
              <View style={[styles.chartNote, { backgroundColor: colors.secondary }]}>
                <Feather name="bar-chart-2" size={11} color={colors.mutedForeground} />
                <Text style={[styles.imageNoteText, { color: colors.mutedForeground }]} numberOfLines={1}>
                  Grafik: {s.chart.title || s.chart.type} ({s.chart.data.length} veri)
                </Text>
              </View>
            ) : null}
            {s.speakerNotes ? (
              <View style={[styles.notesBox, { borderColor: colors.border }]}>
                <Text style={[styles.notesLabel, { color: colors.mutedForeground }]}>KONUŞMACI NOTU</Text>
                <Text style={[styles.notesText, { color: colors.mutedForeground }]}>{s.speakerNotes}</Text>
              </View>
            ) : null}
          </View>
        ))}

        <Pressable
          onPress={handleDownload}
          disabled={downloading}
          style={({ pressed }) => [styles.bigDownload, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
        >
          {downloading
            ? <ActivityIndicator color="#fff" />
            : <Feather name="download" size={18} color="#fff" />}
          <Text style={styles.bigDownloadText}>PPTX olarak indir</Text>
        </Pressable>
      </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingBottom: 14 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerKind: { color: "rgba(255,255,255,0.7)", fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },
  headerTitle: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold", lineHeight: 20 },
  subtitle: { fontSize: 14, fontStyle: "italic", marginBottom: 10, paddingHorizontal: 4 },
  slide: { marginBottom: 14, padding: 14, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth },
  slideHeader: { marginBottom: 10 },
  slideNum: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 0.6, marginBottom: 3 },
  slideTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold", lineHeight: 22 },
  bulletRow: { flexDirection: "row", gap: 8, marginBottom: 6, paddingRight: 4 },
  bulletDot: { fontSize: 16, lineHeight: 20, width: 12 },
  bulletText: { flex: 1, fontSize: 14, lineHeight: 20, fontFamily: "Inter_400Regular" },
  imageNote: { flexDirection: "row", alignItems: "center", gap: 6, padding: 8, borderRadius: 8, marginTop: 8 },
  chartNote: { flexDirection: "row", alignItems: "center", gap: 6, padding: 8, borderRadius: 8, marginTop: 6 },
  imageNoteText: { fontSize: 11, fontFamily: "Inter_400Regular", flex: 1 },
  notesBox: { marginTop: 10, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth },
  notesLabel: { fontSize: 9, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5, marginBottom: 3 },
  notesText: { fontSize: 12, lineHeight: 17, fontStyle: "italic" },
  bigDownload: { marginTop: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 12 },
  bigDownloadText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
