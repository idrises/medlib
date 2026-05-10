import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";

interface Props {
  baseUrl: string;
  token?: string;
}

interface FtJob {
  id: string;
  status: string;
  model: string;
  fineTunedModel: string | null;
  createdAt: number;
  finishedAt: number | null;
  trainedTokens: number | null;
  error: any;
}

export const AdminFineTuneView: React.FC<Props> = ({ baseUrl, token }) => {
  const colors = useColors();

  const [activeModel, setActiveModel] = useState<string>("");
  const [defaultModel, setDefaultModel] = useState<string>("");
  const [modelInput, setModelInput] = useState<string>("");
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewBytes, setPreviewBytes] = useState<number | null>(null);
  const [previewSample, setPreviewSample] = useState<string[]>([]);
  const [jobs, setJobs] = useState<FtJob[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [suffix, setSuffix] = useState<string>("");

  const headers = useCallback((): Record<string, string> => {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
  }, [token]);

  const fetchActiveModel = useCallback(async () => {
    try {
      const r = await fetch(`${baseUrl}/openai/admin/model`, { headers: headers() });
      if (!r.ok) return;
      const j = (await r.json()) as { model: string; defaultModel: string };
      setActiveModel(j.model);
      setDefaultModel(j.defaultModel);
      if (!modelInput) setModelInput(j.model);
    } catch {}
  }, [baseUrl, headers, modelInput]);

  const fetchJobs = useCallback(async () => {
    setLoading("jobs");
    try {
      const r = await fetch(`${baseUrl}/openai/admin/finetune/jobs`, { headers: headers() });
      if (r.ok) {
        const j = (await r.json()) as { jobs: FtJob[] };
        setJobs(j.jobs ?? []);
      }
    } catch {}
    setLoading(null);
  }, [baseUrl, headers]);

  useEffect(() => {
    fetchActiveModel();
    fetchJobs();
  }, [fetchActiveModel, fetchJobs]);

  const onPreview = useCallback(async () => {
    setLoading("preview");
    try {
      const r = await fetch(`${baseUrl}/openai/admin/finetune/preview`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ limit: 1000 }),
      });
      const j = await r.json();
      if (!r.ok) {
        Alert.alert("Hata", j?.error || "Önizleme alınamadı");
      } else {
        setPreviewCount(j.count);
        setPreviewBytes(j.bytes);
        setPreviewSample(j.sample ?? []);
      }
    } catch (e: any) {
      Alert.alert("Hata", String(e?.message ?? e));
    }
    setLoading(null);
  }, [baseUrl, headers]);

  const onStart = useCallback(() => {
    Alert.alert(
      "Eğitimi başlat",
      `${previewCount ?? "?"} örnekle yeni bir fine-tune işi başlatılacak. OpenAI ücretlendirmesi geçerlidir. Devam edilsin mi?`,
      [
        { text: "İptal", style: "cancel" },
        {
          text: "Başlat",
          onPress: async () => {
            setLoading("start");
            try {
              const r = await fetch(`${baseUrl}/openai/admin/finetune/start`, {
                method: "POST",
                headers: headers(),
                body: JSON.stringify({ limit: 1000, suffix: suffix.trim() || undefined }),
              });
              const j = await r.json();
              if (!r.ok) {
                Alert.alert("Hata", j?.error || "Eğitim başlatılamadı");
              } else {
                Alert.alert("Eğitim başladı", `Job ID: ${j.jobId}\nÖrnek: ${j.count}\nModel: ${j.baseModel}`);
                fetchJobs();
              }
            } catch (e: any) {
              Alert.alert("Hata", String(e?.message ?? e));
            }
            setLoading(null);
          },
        },
      ],
    );
  }, [baseUrl, headers, previewCount, suffix, fetchJobs]);

  const onSetActiveModel = useCallback(async () => {
    const v = modelInput.trim();
    if (!v) return;
    setLoading("model");
    try {
      const r = await fetch(`${baseUrl}/openai/admin/model`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ model: v }),
      });
      const j = await r.json();
      if (!r.ok) Alert.alert("Hata", j?.error || "Model kaydedilemedi");
      else {
        setActiveModel(j.model);
        Alert.alert("Tamam", `Aktif model: ${j.model}`);
      }
    } catch (e: any) {
      Alert.alert("Hata", String(e?.message ?? e));
    }
    setLoading(null);
  }, [baseUrl, headers, modelInput]);

  const onActivateJob = useCallback((j: FtJob) => {
    if (!j.fineTunedModel) return;
    setModelInput(j.fineTunedModel);
    Alert.alert("Modeli aktive et", `${j.fineTunedModel} aktif chat modeli olarak ayarlansın mı?`, [
      { text: "İptal", style: "cancel" },
      {
        text: "Aktive et",
        onPress: async () => {
          setLoading("model");
          try {
            const r = await fetch(`${baseUrl}/openai/admin/model`, {
              method: "POST",
              headers: headers(),
              body: JSON.stringify({ model: j.fineTunedModel }),
            });
            const data = await r.json();
            if (!r.ok) Alert.alert("Hata", data?.error || "Model kaydedilemedi");
            else { setActiveModel(data.model); Alert.alert("Tamam", `Aktif: ${data.model}`); }
          } catch (e: any) { Alert.alert("Hata", String(e?.message ?? e)); }
          setLoading(null);
        },
      },
    ]);
  }, [baseUrl, headers]);

  const styles = StyleSheet.create({
    container: { flex: 1, padding: 14, gap: 14 },
    section: { backgroundColor: colors.card, borderRadius: 12, padding: 14, gap: 10, borderWidth: 1, borderColor: colors.border },
    sectionTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: colors.foreground },
    label: { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
    value: { fontSize: 13, color: colors.foreground, fontFamily: "Inter_500Medium" },
    btn: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, alignItems: "center", flexDirection: "row", gap: 6, justifyContent: "center" },
    btnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 13 },
    btnSec: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 12, alignItems: "center", flexDirection: "row", gap: 6, justifyContent: "center" },
    btnSecText: { color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 12 },
    input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: colors.foreground, fontFamily: "Inter_400Regular", fontSize: 13, backgroundColor: colors.background },
    sampleRow: { backgroundColor: colors.background, borderRadius: 6, padding: 8 },
    sampleText: { fontSize: 10, color: colors.mutedForeground, fontFamily: "Menlo" },
    jobCard: { backgroundColor: colors.background, borderRadius: 8, padding: 10, gap: 4, borderWidth: 1, borderColor: colors.border },
    jobRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    jobId: { fontFamily: "Menlo", fontSize: 11, color: colors.foreground },
    statusPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, fontSize: 10, fontFamily: "Inter_600SemiBold", overflow: "hidden" },
  });

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Aktif Chat Modeli</Text>
        <View>
          <Text style={styles.label}>Şu an</Text>
          <Text style={styles.value}>{activeModel || "(yükleniyor)"}</Text>
          <Text style={[styles.label, { marginTop: 2 }]}>Varsayılan: {defaultModel}</Text>
        </View>
        <TextInput
          value={modelInput}
          onChangeText={setModelInput}
          placeholder="ör. ft:gpt-4o-mini-2024-07-18:medlib:..."
          placeholderTextColor={colors.mutedForeground}
          style={styles.input}
          autoCapitalize="none"
        />
        <Pressable style={styles.btn} onPress={onSetActiveModel} disabled={loading === "model"}>
          {loading === "model" ? <ActivityIndicator color="#fff" size="small" /> : <Feather name="check" size={14} color="#fff" />}
          <Text style={styles.btnText}>Aktif Modeli Kaydet</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Eğitim Veri Seti</Text>
        <Text style={styles.label}>👍 oylanmış asistan cevaplarından JSONL üretilir.</Text>
        <Pressable style={styles.btnSec} onPress={onPreview} disabled={loading === "preview"}>
          {loading === "preview" ? <ActivityIndicator color={colors.primary} size="small" /> : <Feather name="eye" size={14} color={colors.foreground} />}
          <Text style={styles.btnSecText}>Önizle</Text>
        </Pressable>
        {previewCount != null ? (
          <View>
            <Text style={styles.value}>{previewCount} örnek · {((previewBytes ?? 0) / 1024).toFixed(1)} KB</Text>
            {previewSample.slice(0, 2).map((s, i) => (
              <View key={i} style={[styles.sampleRow, { marginTop: 6 }]}>
                <Text style={styles.sampleText} numberOfLines={4}>{s}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <Text style={[styles.label, { marginTop: 6 }]}>Suffix (opsiyonel, max 40 karakter)</Text>
        <TextInput
          value={suffix}
          onChangeText={setSuffix}
          placeholder="medlib-2026-05"
          placeholderTextColor={colors.mutedForeground}
          style={styles.input}
          autoCapitalize="none"
          maxLength={40}
        />
        <Pressable
          style={[styles.btn, { backgroundColor: (previewCount ?? 0) >= 10 ? colors.primary : colors.muted }]}
          onPress={onStart}
          disabled={(previewCount ?? 0) < 10 || loading === "start"}
        >
          {loading === "start" ? <ActivityIndicator color="#fff" size="small" /> : <Feather name="play" size={14} color="#fff" />}
          <Text style={styles.btnText}>Eğitimi Başlat</Text>
        </Pressable>
        {(previewCount ?? 0) < 10 && previewCount != null ? (
          <Text style={[styles.label, { color: "#ef4444" }]}>En az 10 örnek gerekli</Text>
        ) : null}
      </View>

      <View style={styles.section}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={styles.sectionTitle}>İşler</Text>
          <Pressable onPress={fetchJobs} hitSlop={8}>
            <Feather name="refresh-cw" size={14} color={colors.mutedForeground} />
          </Pressable>
        </View>
        {loading === "jobs" && jobs.length === 0 ? <ActivityIndicator color={colors.primary} /> : null}
        {jobs.length === 0 && loading !== "jobs" ? (
          <Text style={styles.label}>Henüz iş yok.</Text>
        ) : null}
        {jobs.map((j) => {
          const statusColor =
            j.status === "succeeded" ? "#16A34A" :
            j.status === "failed" || j.status === "cancelled" ? "#DC2626" :
            j.status === "running" || j.status === "validating_files" ? "#D97706" : colors.muted;
          return (
            <View key={j.id} style={styles.jobCard}>
              <View style={styles.jobRow}>
                <Text style={styles.jobId}>{j.id}</Text>
                <Text style={[styles.statusPill, { backgroundColor: statusColor + "22", color: statusColor }]}>{j.status}</Text>
              </View>
              <Text style={styles.label}>Base: {j.model}</Text>
              {j.fineTunedModel ? <Text style={styles.label}>Çıktı: {j.fineTunedModel}</Text> : null}
              {j.trainedTokens ? <Text style={styles.label}>Token: {j.trainedTokens}</Text> : null}
              {j.error ? <Text style={[styles.label, { color: "#ef4444" }]}>Hata: {JSON.stringify(j.error)}</Text> : null}
              {j.fineTunedModel ? (
                <Pressable style={[styles.btnSec, { marginTop: 4 }]} onPress={() => onActivateJob(j)}>
                  <Feather name="zap" size={12} color={colors.primary} />
                  <Text style={[styles.btnSecText, { color: colors.primary }]}>Bu modeli aktive et</Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
};
