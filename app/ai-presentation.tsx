import { Feather } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { buildPresentationStream, type PresProgress } from "@/services/presentationApi";

export default function AiPresentationScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ topic?: string; contextTitle?: string }>();
  const initialTopic = (params.topic as string) || (params.contextTitle as string) || "";

  const [topic, setTopic] = useState<string>(initialTopic);
  const [slideCount, setSlideCount] = useState<number>(8);
  const [withImages, setWithImages] = useState<boolean>(false);
  const [audience, setAudience] = useState<string>("");

  const [busy, setBusy] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [imgDone, setImgDone] = useState(0);
  const [imgTotal, setImgTotal] = useState(0);

  const stageLabel = (ev: PresProgress) => {
    if (ev.type !== "progress") return "";
    if (ev.stage === "outline") return "İçerik üretiliyor…";
    if (ev.stage === "images") return `Görseller hazırlanıyor (${ev.done}/${ev.total})…`;
    if (ev.stage === "pptx") return "PowerPoint dosyası oluşturuluyor…";
    if (ev.stage === "done") return "Tamamlandı";
    return "";
  };

  const handleBuild = async () => {
    const t = topic.trim();
    if (t.length < 3) { Alert.alert("Konu çok kısa", "Lütfen daha açıklayıcı bir konu yaz."); return; }
    setBusy(true);
    setStatusText("Başlatılıyor…");
    setImgDone(0); setImgTotal(0);
    try {
      const result = await buildPresentationStream(
        { topic: t, slideCount, withImages, audience: audience.trim() || undefined },
        (ev) => {
          if (ev.type === "progress" && ev.stage === "images") {
            setImgDone(ev.done); setImgTotal(ev.total);
          }
          setStatusText(stageLabel(ev));
        }
      );
      router.replace({ pathname: "/presentation/[id]" as any, params: { id: String(result.id) } });
    } catch (e: any) {
      Alert.alert("Sunum üretilemedi", e?.message ?? "Bilinmeyen hata");
      setBusy(false);
      setStatusText("");
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.primary }]}>
        <Pressable onPress={() => !busy && router.back()} style={styles.iconBtn} disabled={busy}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerKind}>YENİ SUNUM</Text>
          <Text style={styles.headerTitle}>AI ile slayt hazırla</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Text style={[styles.label, { color: colors.foreground }]}>Konu</Text>
        <TextInput
          value={topic}
          onChangeText={setTopic}
          placeholder="Örn: Rinoplastide burun ucu projeksiyonu"
          placeholderTextColor={colors.mutedForeground}
          editable={!busy}
          multiline
          style={[styles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border, minHeight: 70 }]}
        />

        <Text style={[styles.label, { color: colors.foreground, marginTop: 16 }]}>Slayt sayısı: {slideCount}</Text>
        <View style={styles.slideRow}>
          {[5, 8, 10, 12, 15, 20].map(n => (
            <Pressable
              key={n}
              onPress={() => !busy && setSlideCount(n)}
              style={({ pressed }) => [
                styles.slidePill,
                {
                  backgroundColor: slideCount === n ? colors.primary : colors.secondary,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Text style={{ color: slideCount === n ? colors.primaryForeground : colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>{n}</Text>
            </Pressable>
          ))}
        </View>

        <View style={[styles.toggleRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.toggleTitle, { color: colors.foreground }]}>Slaytlara görsel ekle</Text>
            <Text style={[styles.toggleSub, { color: colors.mutedForeground }]}>
              DALL-E ile anatomik/cerrahi illüstrasyon. Yavaşlatır (~10sn × görsel sayısı).
            </Text>
          </View>
          <Switch value={withImages} onValueChange={setWithImages} disabled={busy} />
        </View>

        <Text style={[styles.label, { color: colors.foreground, marginTop: 16 }]}>Hedef kitle (opsiyonel)</Text>
        <TextInput
          value={audience}
          onChangeText={setAudience}
          placeholder="Örn: plastik cerrahi asistanları"
          placeholderTextColor={colors.mutedForeground}
          editable={!busy}
          style={[styles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border }]}
        />

        <Pressable
          onPress={handleBuild}
          disabled={busy}
          style={({ pressed }) => [styles.cta, { backgroundColor: colors.primary, opacity: busy || pressed ? 0.8 : 1 }]}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Feather name="layout" size={18} color="#fff" />}
          <Text style={styles.ctaText}>{busy ? "Hazırlanıyor…" : "Sunumu oluştur"}</Text>
        </Pressable>

        {busy ? (
          <View style={{ marginTop: 18, padding: 14, borderRadius: 12, backgroundColor: colors.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border }}>
            <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>{statusText || "Bekleniyor…"}</Text>
            {imgTotal > 0 ? (
              <View style={{ marginTop: 10, height: 8, borderRadius: 4, backgroundColor: colors.secondary, overflow: "hidden" }}>
                <View style={{ height: "100%", width: `${Math.round((imgDone / imgTotal) * 100)}%`, backgroundColor: colors.primary }} />
              </View>
            ) : null}
            <Text style={{ marginTop: 8, color: colors.mutedForeground, fontSize: 12 }}>
              Bu işlem 30 saniye - 2 dakika sürebilir. Ekranı kapatma.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingBottom: 14 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerKind: { color: "rgba(255,255,255,0.7)", fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },
  headerTitle: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  label: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 6 },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: "Inter_400Regular" },
  slideRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  slidePill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  toggleRow: { marginTop: 16, flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth },
  toggleTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  toggleSub: { fontSize: 11, marginTop: 2 },
  cta: { marginTop: 22, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 12 },
  ctaText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
