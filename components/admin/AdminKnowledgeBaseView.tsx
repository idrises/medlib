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

interface Status {
  totals: { files: number; chunks: number; bytes: number };
  lastUpdatedAt: string | null;
  running: { ID: number; Scope: string; FilesDone: number; FilesPlanned: number; ChunksCreated: number; StartedAt: string }[];
}

interface BrowseEntry {
  name: string;
  path: string;
  pdfCount: number;
  videoCount: number;
  subDirCount: number;
}

interface PlanResult {
  totalPdfs: number;
  totalBytes: number;
  estimatedChunks: number;
  estimatedCostUsd: number;
}

interface KbJobError {
  path: string;
  err: string;
  at: string;
}

interface KbJob {
  ID: number;
  JobType: string;
  Scope: string;
  Status: string;
  FilesPlanned: number | null;
  FilesDone: number;
  FilesFailed: number;
  FilesUnreadable?: number | null;
  FilesEmpty?: number | null;
  FilesTooBig?: number | null;
  FilesAlreadyIndexed?: number | null;
  LastErrors?: string | null;
  BytesDone: number;
  ChunksCreated: number;
  Error: string | null;
  StartedAt: string;
  FinishedAt: string | null;
}

interface KbFile {
  SourcePath: string;
  SourceTitle: string;
  ParentTitle: string;
  SourceType: string;
  ChunkCount: number;
  SizeBytes: number;
  UpdatedAt: string;
}

const fmtBytes = (b: number) => b > 1024 * 1024 ? `${(b/1024/1024).toFixed(1)} MB` : `${(b/1024).toFixed(0)} KB`;
const fmtUsd = (v: number) => `$${v < 0.01 ? v.toFixed(4) : v.toFixed(2)}`;

export const AdminKnowledgeBaseView: React.FC<Props> = ({ baseUrl, token }) => {
  const colors = useColors();

  const [status, setStatus] = useState<Status | null>(null);
  const [pathInput, setPathInput] = useState<string>("/");
  const [browse, setBrowse] = useState<{ path: string; entries: BrowseEntry[]; pdfHere: number; videoHere: number } | null>(null);
  const [plan, setPlan] = useState<{ path: string; result: PlanResult } | null>(null);
  const [jobs, setJobs] = useState<KbJob[]>([]);
  const [files, setFiles] = useState<KbFile[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [maxFiles, setMaxFiles] = useState<string>("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleSelected = useCallback((p: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p); else next.add(p);
      return next;
    });
  }, []);

  const headers = useCallback((): Record<string, string> => {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
  }, [token]);

  const fetchStatus = useCallback(async () => {
    try {
      const r = await fetch(`${baseUrl}/openai/admin/kb/status`, { headers: headers() });
      if (r.ok) setStatus(await r.json());
    } catch {}
  }, [baseUrl, headers]);

  const fetchJobs = useCallback(async () => {
    try {
      const r = await fetch(`${baseUrl}/openai/admin/kb/jobs`, { headers: headers() });
      if (r.ok) { const j = await r.json(); setJobs(j.jobs ?? []); }
    } catch {}
  }, [baseUrl, headers]);

  const fetchFiles = useCallback(async () => {
    try {
      const r = await fetch(`${baseUrl}/openai/admin/kb/files?limit=30`, { headers: headers() });
      if (r.ok) { const j = await r.json(); setFiles(j.files ?? []); }
    } catch {}
  }, [baseUrl, headers]);

  useEffect(() => {
    fetchStatus();
    fetchJobs();
    fetchFiles();
  }, [fetchStatus, fetchJobs, fetchFiles]);

  // Auto-poll while a job is running
  useEffect(() => {
    if (!status?.running?.length && !jobs.some(j => j.Status === "running")) return;
    const t = setInterval(() => { fetchStatus(); fetchJobs(); }, 3000);
    return () => clearInterval(t);
  }, [status, jobs, fetchStatus, fetchJobs]);

  const onBrowse = useCallback(async (p?: string) => {
    const target = (p ?? pathInput).trim() || "/";
    setLoading("browse");
    setPlan(null);
    try {
      const r = await fetch(`${baseUrl}/openai/admin/kb/browse`, {
        method: "POST", headers: headers(), body: JSON.stringify({ path: target }),
      });
      const j = await r.json();
      if (!r.ok) Alert.alert("Hata", j?.error || "Klasör listelenemedi");
      else { setBrowse(j); setPathInput(target); }
    } catch (e: any) { Alert.alert("Hata", String(e?.message ?? e)); }
    setLoading(null);
  }, [baseUrl, headers, pathInput]);

  const onPlan = useCallback(async (p?: string) => {
    const target = p ?? pathInput;
    setLoading("plan");
    try {
      const r = await fetch(`${baseUrl}/openai/admin/kb/plan`, {
        method: "POST", headers: headers(), body: JSON.stringify({ path: target }),
      });
      const j = await r.json();
      if (!r.ok) Alert.alert("Hata", j?.error || "Plan alınamadı");
      else setPlan({ path: target, result: j });
    } catch (e: any) { Alert.alert("Hata", String(e?.message ?? e)); }
    setLoading(null);
  }, [baseUrl, headers, pathInput]);

  const onStart = useCallback(() => {
    if (!plan) return;
    const limit = maxFiles.trim() ? Math.max(1, Number(maxFiles.trim()) | 0) : null;
    const realFiles = limit ? Math.min(limit, plan.result.totalPdfs) : plan.result.totalPdfs;
    const realCost = plan.result.totalPdfs > 0 ? plan.result.estimatedCostUsd * (realFiles / plan.result.totalPdfs) : 0;
    Alert.alert(
      "Taramayı başlat",
      `Klasör: ${plan.path}\nDosya: ${realFiles}${limit ? ` (sınırlı)` : ""}\nTahmini maliyet: ${fmtUsd(realCost)}\nOpenAI ücretlendirmesi geçerlidir. Devam edilsin mi?`,
      [
        { text: "İptal", style: "cancel" },
        {
          text: "Başlat",
          onPress: async () => {
            setLoading("start");
            try {
              const body: any = { path: plan.path, confirm: true, concurrency: 4 };
              if (limit) body.maxFiles = limit;
              const r = await fetch(`${baseUrl}/openai/admin/kb/ingest/start`, {
                method: "POST", headers: headers(), body: JSON.stringify(body),
              });
              const j = await r.json();
              if (!r.ok) Alert.alert("Hata", j?.error || "Başlatılamadı");
              else { Alert.alert("Tarama başladı", `Job: ${j.jobId}`); fetchStatus(); fetchJobs(); }
            } catch (e: any) { Alert.alert("Hata", String(e?.message ?? e)); }
            setLoading(null);
          },
        },
      ],
    );
  }, [plan, maxFiles, baseUrl, headers, fetchStatus, fetchJobs]);

  const onStartBatch = useCallback(() => {
    const paths = Array.from(selected);
    if (!paths.length) return;
    const limit = maxFiles.trim() ? Math.max(1, Number(maxFiles.trim()) | 0) : null;
    Alert.alert(
      `Seçili ${paths.length} klasörü işle`,
      `${paths.length} ayrı job kuyruğa eklenecek${limit ? ` (her biri için max ${limit} dosya)` : ""}.\nOpenAI ücretlendirmesi geçerlidir. Devam edilsin mi?`,
      [
        { text: "İptal", style: "cancel" },
        {
          text: "Başlat",
          onPress: async () => {
            setLoading("batch");
            let started = 0; let failed = 0;
            for (const p of paths) {
              try {
                const body: any = { path: p, confirm: true, concurrency: 4 };
                if (limit) body.maxFiles = limit;
                const r = await fetch(`${baseUrl}/openai/admin/kb/ingest/start`, {
                  method: "POST", headers: headers(), body: JSON.stringify(body),
                });
                if (r.ok) started++; else failed++;
              } catch { failed++; }
            }
            setLoading(null);
            setSelected(new Set());
            Alert.alert("Toplu tarama", `${started} job başlatıldı${failed ? ` · ${failed} başarısız` : ""}`);
            fetchStatus(); fetchJobs();
          },
        },
      ],
    );
  }, [selected, maxFiles, baseUrl, headers, fetchStatus, fetchJobs]);

  const onCancel = useCallback((j: KbJob) => {
    Alert.alert("İşi iptal et", `Job ${j.ID} iptal edilsin mi?`, [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "İptal et", style: "destructive",
        onPress: async () => {
          try {
            await fetch(`${baseUrl}/openai/admin/kb/jobs/${j.ID}/cancel`, { method: "POST", headers: headers() });
            fetchJobs();
          } catch {}
        },
      },
    ]);
  }, [baseUrl, headers, fetchJobs]);

  const onResume = useCallback((j: KbJob) => {
    Alert.alert(
      "Devam Et",
      `${j.Scope}\nKaldığı yerden devam edilecek. Daha önce indekslenmiş dosyalar otomatik atlanır (yeniden ücret çıkmaz).\nDevam edilsin mi?`,
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Devam Et",
          onPress: async () => {
            try {
              const r = await fetch(`${baseUrl}/openai/admin/kb/jobs/${j.ID}/resume`, { method: "POST", headers: headers() });
              const out = await r.json();
              if (!r.ok) Alert.alert("Hata", out?.error || "Devam ettirilemedi");
              else { Alert.alert("Devam ediyor", `Yeni job: ${out.jobId}`); fetchStatus(); fetchJobs(); }
            } catch (e: any) { Alert.alert("Hata", String(e?.message ?? e)); }
          },
        },
      ],
    );
  }, [baseUrl, headers, fetchStatus, fetchJobs]);

  const styles = StyleSheet.create({
    container: { padding: 14, gap: 14, paddingBottom: 80 },
    section: { backgroundColor: colors.card, borderRadius: 12, padding: 14, gap: 10, borderWidth: 1, borderColor: colors.border },
    sectionTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: colors.foreground },
    label: { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
    value: { fontSize: 13, color: colors.foreground, fontFamily: "Inter_500Medium" },
    big: { fontSize: 18, color: colors.foreground, fontFamily: "Inter_600SemiBold" },
    btn: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, alignItems: "center", flexDirection: "row", gap: 6, justifyContent: "center" },
    btnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 13 },
    btnSec: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10, alignItems: "center", flexDirection: "row", gap: 6, justifyContent: "center" },
    btnSecText: { color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 12 },
    input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: colors.foreground, fontFamily: "Menlo", fontSize: 12, backgroundColor: colors.background },
    row: { flexDirection: "row", gap: 8, alignItems: "center" },
    statRow: { flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 8 },
    stat: { flex: 1, minWidth: 90 },
    entry: { flexDirection: "row", alignItems: "center", paddingVertical: 8, paddingHorizontal: 10, backgroundColor: colors.background, borderRadius: 8, borderWidth: 1, borderColor: colors.border, gap: 8 },
    entryName: { flex: 1, color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 13 },
    entryMeta: { color: colors.mutedForeground, fontSize: 11, fontFamily: "Inter_400Regular" },
    barOuter: { height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: "hidden" },
    barInner: { height: 6, backgroundColor: colors.primary },
    jobCard: { backgroundColor: colors.background, borderRadius: 8, padding: 10, gap: 4, borderWidth: 1, borderColor: colors.border },
    jobRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    jobId: { fontFamily: "Menlo", fontSize: 11, color: colors.foreground },
    statusPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, fontSize: 10, fontFamily: "Inter_600SemiBold", overflow: "hidden" },
    fileRow: { backgroundColor: colors.background, borderRadius: 6, padding: 8, gap: 2, borderWidth: 1, borderColor: colors.border },
  });

  const statusColor = (s: string) =>
    s === "completed" ? "#16A34A" :
    s === "failed" ? "#DC2626" :
    s === "cancelled" ? "#6B7280" :
    s === "interrupted" ? "#0EA5E9" :
    s === "running" ? "#D97706" : colors.muted;

  const canResume = (s: string) => s === "interrupted" || s === "cancelled" || s === "failed";

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.container}>
      {/* Status */}
      <View style={styles.section}>
        <View style={[styles.row, { justifyContent: "space-between" }]}>
          <Text style={styles.sectionTitle}>Bilgi Havuzu Durumu</Text>
          <Pressable onPress={() => { fetchStatus(); fetchJobs(); fetchFiles(); }} hitSlop={8}>
            <Feather name="refresh-cw" size={14} color={colors.mutedForeground} />
          </Pressable>
        </View>
        <View style={styles.statRow}>
          <View style={styles.stat}><Text style={styles.label}>Dosya</Text><Text style={styles.big}>{status?.totals.files ?? 0}</Text></View>
          <View style={styles.stat}><Text style={styles.label}>Chunk</Text><Text style={styles.big}>{status?.totals.chunks ?? 0}</Text></View>
          <View style={styles.stat}><Text style={styles.label}>Boyut</Text><Text style={styles.big}>{fmtBytes(status?.totals.bytes ?? 0)}</Text></View>
        </View>
        {status?.lastUpdatedAt ? (
          <Text style={styles.label}>Son güncelleme: {new Date(status.lastUpdatedAt).toLocaleString("tr-TR")}</Text>
        ) : null}
        {status?.running?.map((r) => {
          const pct = r.FilesPlanned ? Math.round((r.FilesDone / r.FilesPlanned) * 100) : 0;
          return (
            <View key={r.ID} style={{ gap: 4, marginTop: 6 }}>
              <Text style={styles.label}>🟢 Aktif: {r.Scope} — {r.FilesDone}/{r.FilesPlanned ?? "?"} ({pct}%) · {r.ChunksCreated} chunk</Text>
              <View style={styles.barOuter}><View style={[styles.barInner, { width: `${pct}%` }]} /></View>
            </View>
          );
        })}
      </View>

      {/* Browse */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>FTP Klasörü Tara</Text>
        <Text style={styles.label}>Bir klasör yolu girin (örn. /DDAATTAA, /books). "/" kök dizindir.</Text>
        <TextInput
          value={pathInput} onChangeText={setPathInput}
          placeholder="/DDAATTAA" placeholderTextColor={colors.mutedForeground}
          style={styles.input} autoCapitalize="none"
        />
        <View style={styles.row}>
          <Pressable style={[styles.btnSec, { flex: 1 }]} onPress={() => onBrowse()} disabled={loading === "browse"}>
            {loading === "browse" ? <ActivityIndicator color={colors.primary} size="small" /> : <Feather name="folder" size={14} color={colors.foreground} />}
            <Text style={styles.btnSecText}>Listele</Text>
          </Pressable>
          <Pressable style={[styles.btnSec, { flex: 1 }]} onPress={() => onPlan()} disabled={loading === "plan"}>
            {loading === "plan" ? <ActivityIndicator color={colors.primary} size="small" /> : <Feather name="bar-chart-2" size={14} color={colors.foreground} />}
            <Text style={styles.btnSecText}>Maliyet Hesapla</Text>
          </Pressable>
        </View>

        {browse ? (
          <View style={{ gap: 6 }}>
            <Text style={styles.label}>📂 {browse.path} — burada: {browse.pdfHere} PDF, {browse.videoHere} video</Text>
            {browse.entries.map((e) => {
              const isSel = selected.has(e.path);
              return (
                <View key={e.path} style={styles.entry}>
                  <Pressable onPress={() => toggleSelected(e.path)} hitSlop={8} style={{ padding: 2 }}>
                    <Feather
                      name={isSel ? "check-square" : "square"}
                      size={18}
                      color={isSel ? colors.primary : colors.mutedForeground}
                    />
                  </Pressable>
                  <Pressable onPress={() => onBrowse(e.path)} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Feather name="folder" size={14} color={colors.mutedForeground} />
                    <Text style={styles.entryName} numberOfLines={1}>{e.name}</Text>
                    <Text style={styles.entryMeta}>{e.pdfCount} PDF · {e.videoCount} vid · {e.subDirCount} alt</Text>
                  </Pressable>
                </View>
              );
            })}
            <Text style={styles.label}>Toplam {browse.entries.length} klasör</Text>
            {selected.size > 0 ? (
              <View style={{ gap: 6, marginTop: 8, padding: 10, backgroundColor: colors.background, borderRadius: 8, borderWidth: 1, borderColor: colors.primary }}>
                <View style={[styles.row, { justifyContent: "space-between" }]}>
                  <Text style={styles.value}>✓ {selected.size} klasör seçili</Text>
                  <Pressable onPress={() => setSelected(new Set())} hitSlop={8}>
                    <Text style={[styles.label, { color: colors.primary }]}>Temizle</Text>
                  </Pressable>
                </View>
                <Pressable
                  style={[styles.btn, { opacity: loading === "batch" ? 0.6 : 1 }]}
                  onPress={onStartBatch}
                  disabled={loading === "batch"}
                >
                  {loading === "batch" ? <ActivityIndicator color="#fff" size="small" /> : <Feather name="play" size={14} color="#fff" />}
                  <Text style={styles.btnText}>Seçili {selected.size} klasörü işle</Text>
                </Pressable>
                {maxFiles.trim() ? (
                  <Text style={styles.label}>Her klasör için max {maxFiles} dosya işlenecek</Text>
                ) : (
                  <Text style={styles.label}>Üstte "Maks dosya" girersen her klasöre limit uygulanır</Text>
                )}
              </View>
            ) : null}
          </View>
        ) : null}

        {plan ? (
          <View style={{ gap: 8, marginTop: 6, padding: 10, backgroundColor: colors.background, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}>
            <Text style={styles.value}>📊 Plan: {plan.path}</Text>
            <Text style={styles.label}>{plan.result.totalPdfs} PDF · {fmtBytes(plan.result.totalBytes)} · ~{plan.result.estimatedChunks.toLocaleString("tr-TR")} chunk</Text>
            <Text style={[styles.value, { color: colors.primary }]}>Tahmini maliyet: {fmtUsd(plan.result.estimatedCostUsd)}</Text>
            <Text style={styles.label}>Maks. dosya (boş = hepsi):</Text>
            <TextInput
              value={maxFiles} onChangeText={setMaxFiles}
              placeholder="örn. 100" placeholderTextColor={colors.mutedForeground}
              style={styles.input} keyboardType="numeric"
            />
            <Pressable style={styles.btn} onPress={onStart} disabled={loading === "start"}>
              {loading === "start" ? <ActivityIndicator color="#fff" size="small" /> : <Feather name="play" size={14} color="#fff" />}
              <Text style={styles.btnText}>Taramayı Başlat (Onay İster)</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      {/* Jobs */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>İşler</Text>
        {jobs.length === 0 ? <Text style={styles.label}>Henüz iş yok.</Text> : null}
        {jobs.map((j) => {
          const pct = j.FilesPlanned ? Math.round((j.FilesDone / j.FilesPlanned) * 100) : 0;
          return (
            <View key={j.ID} style={styles.jobCard}>
              <View style={styles.jobRow}>
                <Text style={styles.jobId}>#{j.ID} · {j.Scope}</Text>
                <Text style={[styles.statusPill, { backgroundColor: statusColor(j.Status) + "22", color: statusColor(j.Status) }]}>{j.Status}</Text>
              </View>
              <Text style={styles.label}>
                {j.FilesDone}/{j.FilesPlanned ?? "?"} dosya · {j.ChunksCreated} chunk · {fmtBytes(j.BytesDone)} · hata {j.FilesFailed}
              </Text>
              {(() => {
                const fu = j.FilesUnreadable ?? 0;
                const fe = j.FilesEmpty ?? 0;
                const ftb = j.FilesTooBig ?? 0;
                const fai = j.FilesAlreadyIndexed ?? 0;
                // Legacy rows (pre-Phase 4.1) have all bucket cols at 0 — can't break down.
                const isLegacy = fu === 0 && fe === 0 && ftb === 0 && fai === 0 && j.FilesFailed > 0;
                if (isLegacy) {
                  return (
                    <Text style={[styles.label, { fontSize: 11, fontStyle: "italic" }]}>
                      ⚠️ eski iş — hata kırılımı yok ({j.FilesFailed} toplam fail, taranmış+boş+gerçek karışık)
                    </Text>
                  );
                }
                const realFail = Math.max(0, j.FilesFailed - fu - fe);
                if (fu + fe + ftb + fai + realFail === 0) return null;
                return (
                  <Text style={[styles.label, { fontSize: 11 }]}>
                    📊 atlanan {fai} · taranmış {fu} · boş {fe} · büyük {ftb} · gerçek hata {realFail}
                  </Text>
                );
              })()}
              {(() => {
                if (!j.LastErrors) return null;
                let parsed: KbJobError[] = [];
                try { parsed = JSON.parse(j.LastErrors) as KbJobError[]; } catch { return null; }
                if (!parsed.length) return null;
                return (
                  <View style={{ marginTop: 4, padding: 6, backgroundColor: "#fef2f2", borderRadius: 4, gap: 2 }}>
                    <Text style={[styles.label, { color: "#991b1b", fontSize: 10 }]}>
                      Son {parsed.length} gerçek hata:
                    </Text>
                    {parsed.slice(-5).reverse().map((e, i) => (
                      <Text key={i} style={[styles.label, { color: "#7f1d1d", fontSize: 10, fontFamily: "Menlo" }]} numberOfLines={2}>
                        • {e.path.split("/").slice(-2).join("/")}: {e.err.slice(0, 100)}
                      </Text>
                    ))}
                  </View>
                );
              })()}
              {j.Status === "running" ? (
                <>
                  <View style={styles.barOuter}><View style={[styles.barInner, { width: `${pct}%` }]} /></View>
                  <Pressable style={[styles.btnSec, { marginTop: 4 }]} onPress={() => onCancel(j)}>
                    <Feather name="x" size={12} color="#DC2626" />
                    <Text style={[styles.btnSecText, { color: "#DC2626" }]}>İptal Et</Text>
                  </Pressable>
                </>
              ) : canResume(j.Status) ? (
                <Pressable style={[styles.btnSec, { marginTop: 4, borderColor: colors.primary }]} onPress={() => onResume(j)}>
                  <Feather name="play" size={12} color={colors.primary} />
                  <Text style={[styles.btnSecText, { color: colors.primary }]}>Devam Et (kaldığı yerden)</Text>
                </Pressable>
              ) : null}
              {j.Error ? <Text style={[styles.label, { color: "#ef4444" }]}>{j.Error}</Text> : null}
              <Text style={styles.label}>Başlangıç: {new Date(j.StartedAt).toLocaleString("tr-TR")}</Text>
            </View>
          );
        })}
      </View>

      {/* Recent files */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Son Eklenen Dosyalar</Text>
        {files.length === 0 ? <Text style={styles.label}>Henüz dosya yok.</Text> : null}
        {files.map((f) => (
          <View key={f.SourcePath} style={styles.fileRow}>
            <Text style={styles.value} numberOfLines={1}>{f.SourceTitle}</Text>
            <Text style={styles.label} numberOfLines={1}>{f.ParentTitle}</Text>
            <Text style={styles.label}>{f.ChunkCount} chunk · {fmtBytes(f.SizeBytes)} · {new Date(f.UpdatedAt).toLocaleDateString("tr-TR")}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
};
