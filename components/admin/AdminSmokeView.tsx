import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import { type AuthConfig, buildAuthHeaders, resolveAuth } from "./adminAuthUtils";

export type { AuthConfig };

interface Props {
  baseUrl: string;
  token?: string;
  auth?: AuthConfig;
  refreshMs?: number;
  onRefreshMsChange?: (ms: number) => void;
}

type SmokeStatus = "ok" | "failed" | "harness-error";
type SmokeReason = "post-deploy" | "scheduled";

interface SmokeRun {
  lastRunAt: string;
  lastReason: SmokeReason;
  lastStatus: SmokeStatus;
  apiBase: string;
  setIds: number[];
  failureCount: number;
  harnessError?: string;
}

interface RefreshOption {
  label: string;
  ms: number;
}

const REFRESH_OPTIONS: RefreshOption[] = [
  { label: "15s", ms: 15_000 },
  { label: "30s", ms: 30_000 },
  { label: "60s", ms: 60_000 },
  { label: "120s", ms: 120_000 },
  { label: "Kapalı", ms: 0 },
];

const STATUS_COLOR: Record<SmokeStatus, string> = {
  ok: "#16A34A",
  failed: "#DC2626",
  "harness-error": "#D97706",
};

const STATUS_LABEL: Record<SmokeStatus, string> = {
  ok: "Başarılı",
  failed: "Başarısız",
  "harness-error": "Çalıştırılamadı",
};

const REASON_LABEL: Record<SmokeReason, string> = {
  "post-deploy": "Dağıtım sonrası",
  scheduled: "Zamanlanmış",
};

function formatRunAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function Sparkline({ runs }: { runs: SmokeRun[] }) {
  const colors = useColors();
  const chronological = runs.slice().reverse();
  if (chronological.length === 0) return null;

  return (
    <View style={sparkStyles.container}>
      <Text style={[sparkStyles.label, { color: colors.mutedForeground }]}>
        Trend (eski → yeni)
      </Text>
      <View style={sparkStyles.dotRow}>
        {chronological.map((run, i) => (
          <View
            key={`${run.lastRunAt}-${i}`}
            style={[
              sparkStyles.dot,
              { backgroundColor: STATUS_COLOR[run.lastStatus] },
            ]}
          />
        ))}
      </View>
      <View style={sparkStyles.legendRow}>
        <View style={sparkStyles.legendItem}>
          <View style={[sparkStyles.legendDot, { backgroundColor: STATUS_COLOR.ok }]} />
          <Text style={[sparkStyles.legendText, { color: colors.mutedForeground }]}>OK</Text>
        </View>
        <View style={sparkStyles.legendItem}>
          <View style={[sparkStyles.legendDot, { backgroundColor: STATUS_COLOR.failed }]} />
          <Text style={[sparkStyles.legendText, { color: colors.mutedForeground }]}>Fail</Text>
        </View>
        <View style={sparkStyles.legendItem}>
          <View style={[sparkStyles.legendDot, { backgroundColor: STATUS_COLOR["harness-error"] }]} />
          <Text style={[sparkStyles.legendText, { color: colors.mutedForeground }]}>Error</Text>
        </View>
      </View>
    </View>
  );
}

function SummaryCard({ runs }: { runs: SmokeRun[] }) {
  const colors = useColors();
  if (runs.length === 0) return null;

  const okCount = runs.filter((r) => r.lastStatus === "ok").length;
  const failCount = runs.filter((r) => r.lastStatus === "failed").length;
  const errorCount = runs.filter((r) => r.lastStatus === "harness-error").length;
  const latest = runs[0];

  return (
    <View
      style={[
        summaryStyles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={summaryStyles.statsRow}>
        <View style={summaryStyles.statItem}>
          <Text style={[summaryStyles.statValue, { color: STATUS_COLOR.ok }]}>
            {okCount}
          </Text>
          <Text style={[summaryStyles.statLabel, { color: colors.mutedForeground }]}>
            Başarılı
          </Text>
        </View>
        <View style={[summaryStyles.divider, { backgroundColor: colors.border }]} />
        <View style={summaryStyles.statItem}>
          <Text style={[summaryStyles.statValue, { color: STATUS_COLOR.failed }]}>
            {failCount}
          </Text>
          <Text style={[summaryStyles.statLabel, { color: colors.mutedForeground }]}>
            Başarısız
          </Text>
        </View>
        <View style={[summaryStyles.divider, { backgroundColor: colors.border }]} />
        <View style={summaryStyles.statItem}>
          <Text
            style={[
              summaryStyles.statValue,
              { color: STATUS_COLOR["harness-error"] },
            ]}
          >
            {errorCount}
          </Text>
          <Text style={[summaryStyles.statLabel, { color: colors.mutedForeground }]}>
            Hata
          </Text>
        </View>
      </View>
      {latest ? (
        <View style={summaryStyles.latestRow}>
          <Feather name="clock" size={11} color={colors.mutedForeground} />
          <Text style={[summaryStyles.latestText, { color: colors.mutedForeground }]}>
            Son: {formatRunAt(latest.lastRunAt)}
          </Text>
          <View
            style={[
              summaryStyles.latestBadge,
              { backgroundColor: STATUS_COLOR[latest.lastStatus] + "18" },
            ]}
          >
            <View
              style={[
                sparkStyles.legendDot,
                { backgroundColor: STATUS_COLOR[latest.lastStatus] },
              ]}
            />
            <Text
              style={[
                summaryStyles.latestBadgeText,
                { color: STATUS_COLOR[latest.lastStatus] },
              ]}
            >
              {STATUS_LABEL[latest.lastStatus]}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

interface DedupeState {
  active: boolean;
  fingerprint?: string;
  alertedAt?: string;
  alertedReason?: string;
  suppressedLatest: boolean;
}

export function AdminSmokeView(props: Props) {
  const { baseUrl } = props;
  const auth = resolveAuth(props);
  const authKey = auth.mode === "jwt" ? auth.token : auth.secret;
  const colors = useColors();
  const [runs, setRuns] = useState<SmokeRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [internalRefreshMs, setInternalRefreshMs] = useState(60_000);
  const isControlled = props.refreshMs !== undefined && props.onRefreshMsChange !== undefined;
  const refreshMs = isControlled ? props.refreshMs! : internalRefreshMs;
  const setRefreshMs = isControlled ? props.onRefreshMsChange! : setInternalRefreshMs;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showRefreshPicker, setShowRefreshPicker] = useState(false);
  const [pickerAnchor, setPickerAnchor] = useState<{ top: number; right: number } | null>(null);
  const toggleRef = useRef<View>(null);
  const openRefreshPicker = useCallback(() => {
    if (showRefreshPicker) {
      setShowRefreshPicker(false);
      return;
    }
    setShowRefreshPicker(true);
    const node = toggleRef.current;
    if (!node || typeof node.measureInWindow !== "function") {
      return;
    }
    node.measureInWindow((x, y, w, h) => {
      const screenWidth = Dimensions.get("window").width;
      setPickerAnchor({ top: y + h + 4, right: Math.max(0, screenWidth - (x + w)) });
    });
  }, [showRefreshPicker]);
  const [dedupe, setDedupe] = useState<DedupeState | null>(null);
  const [clearingDedupe, setClearingDedupe] = useState(false);
  const [runningSmoke, setRunningSmoke] = useState(false);
  const [cooldown, setCooldown] = useState<
    | { reason: "in-flight" | "cooldown"; until: number }
    | null
  >(null);
  const [now, setNow] = useState(() => Date.now());
  const [runResult, setRunResult] = useState<{
    status: SmokeStatus | "unknown";
    failureCount: number;
    harnessError?: string;
  } | null>(null);
  const runResultTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (runResultTimeoutRef.current) {
        clearTimeout(runResultTimeoutRef.current);
        runResultTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!cooldown) return;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      if (t >= cooldown.until) {
        setCooldown(null);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const cooldownRemaining = cooldown
    ? Math.max(0, Math.ceil((cooldown.until - now) / 1000))
    : 0;

  const fetchDedupe = useCallback(async () => {
    try {
      const res = await fetch(`${baseUrl}/_internal/last-smoke`, {
        headers: buildAuthHeaders(auth),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.dedupe) setDedupe(data.dedupe);
      } else {
        setDedupe(null);
      }
    } catch {
      setDedupe(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl, auth.mode, authKey]);

  const clearDedupe = useCallback(() => {
    Alert.alert(
      "Dedupe temizle",
      "Dedupe durumunu temizlemek istediğinizden emin misiniz?",
      [
        { text: "İptal", style: "cancel" },
        {
          text: "Temizle",
          style: "destructive",
          onPress: async () => {
            setClearingDedupe(true);
            try {
              const res = await fetch(`${baseUrl}/_internal/clear-smoke-dedupe`, {
                method: "POST",
                headers: buildAuthHeaders(auth),
              });
              if (res.ok) {
                const data = await res.json();
                const fp = data.previous?.fingerprint ?? "yok";
                Alert.alert("Dedupe temizlendi", `Önceki parmak izi: ${fp}`);
                await fetchDedupe();
              } else {
                const data = await res.json().catch(() => null);
                Alert.alert("Hata", data?.error ?? `HTTP ${res.status}`);
              }
            } catch {
              Alert.alert("Hata", "Sunucuya bağlanılamadı.");
            } finally {
              setClearingDedupe(false);
            }
          },
        },
      ],
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl, auth.mode, authKey, fetchDedupe]);

  useEffect(() => {
    fetchDedupe();
  }, [fetchDedupe]);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${baseUrl}/_internal/smoke-history`, {
        headers: buildAuthHeaders(auth),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : `HTTP ${res.status}`);
        setRuns([]);
      } else {
        const list: SmokeRun[] = Array.isArray(data?.runs) ? data.runs : [];
        setRuns(list.slice().reverse());
      }
    } catch {
      setError("Sunucuya bağlanılamadı.");
      setRuns([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl, auth.mode, authKey]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (refreshMs > 0) {
      intervalRef.current = setInterval(() => {
        fetchHistory();
        fetchDedupe();
      }, refreshMs);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [refreshMs, fetchHistory, fetchDedupe]);

  const runSmokeNow = useCallback(async () => {
    if (runningSmoke || cooldown) return;
    setRunningSmoke(true);
    if (runResultTimeoutRef.current) {
      clearTimeout(runResultTimeoutRef.current);
      runResultTimeoutRef.current = null;
    }
    setRunResult(null);
    try {
      const res = await fetch(`${baseUrl}/_internal/run-smoke`, {
        method: "POST",
        headers: buildAuthHeaders(auth),
      });
      if (res.status === 429) {
        const data = await res.json().catch(() => null);
        const reasonRaw = data?.reason;
        const reason: "in-flight" | "cooldown" =
          reasonRaw === "in-flight" ? "in-flight" : "cooldown";
        const seconds =
          typeof data?.retryAfterSeconds === "number" && data.retryAfterSeconds > 0
            ? data.retryAfterSeconds
            : Number(res.headers.get("Retry-After")) || 1;
        setCooldown({ reason, until: Date.now() + seconds * 1000 });
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        Alert.alert(
          "Smoke çalıştırılamadı",
          typeof data?.error === "string" ? data.error : `HTTP ${res.status}`,
        );
        return;
      }
      const record = await res.json().catch(() => null);
      const status: SmokeStatus | "unknown" =
        record?.lastStatus === "ok" ||
        record?.lastStatus === "failed" ||
        record?.lastStatus === "harness-error"
          ? record.lastStatus
          : "unknown";
      const failureCount =
        typeof record?.failureCount === "number" ? record.failureCount : 0;
      const harnessError =
        typeof record?.harnessError === "string" ? record.harnessError : undefined;
      setRunResult({ status, failureCount, harnessError });
      if (runResultTimeoutRef.current) {
        clearTimeout(runResultTimeoutRef.current);
      }
      runResultTimeoutRef.current = setTimeout(() => {
        setRunResult(null);
        runResultTimeoutRef.current = null;
      }, 6000);
      await Promise.all([fetchHistory(), fetchDedupe()]);
    } catch {
      Alert.alert("Hata", "Sunucuya bağlanılamadı.");
    } finally {
      setRunningSmoke(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl, auth.mode, authKey, runningSmoke, cooldown, fetchHistory, fetchDedupe]);

  if (loading && runs.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <FlatList
      data={runs}
      keyExtractor={(r, i) => `${r.lastRunAt}-${i}`}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={() => { fetchHistory(); fetchDedupe(); }} tintColor={colors.primary} />
      }
      contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
      ListHeaderComponent={
        <View style={{ marginBottom: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: colors.mutedForeground }}>
              Son smoke kontrolleri (en yenisi en üstte)
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View>
                <Pressable
                  ref={toggleRef}
                  onPress={openRefreshPicker}
                  hitSlop={8}
                  style={[
                    autoRefreshStyles.toggle,
                    {
                      backgroundColor: refreshMs > 0 ? colors.primary + "18" : colors.muted,
                      borderColor: refreshMs > 0 ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Feather
                    name="zap"
                    size={12}
                    color={refreshMs > 0 ? colors.primary : colors.mutedForeground}
                  />
                  <Text
                    style={{
                      fontSize: 10,
                      fontFamily: "Inter_600SemiBold",
                      color: refreshMs > 0 ? colors.primary : colors.mutedForeground,
                    }}
                  >
                    {refreshMs > 0
                      ? REFRESH_OPTIONS.find((o) => o.ms === refreshMs)?.label ?? `${refreshMs / 1000}s`
                      : "Kapalı"}
                  </Text>
                  <Feather
                    name="chevron-down"
                    size={10}
                    color={refreshMs > 0 ? colors.primary : colors.mutedForeground}
                  />
                </Pressable>
                <Modal
                  visible={showRefreshPicker}
                  transparent
                  animationType="none"
                  onRequestClose={() => setShowRefreshPicker(false)}
                >
                  <Pressable
                    testID="refresh-picker-backdrop"
                    style={autoRefreshStyles.modalBackdrop}
                    onPress={() => setShowRefreshPicker(false)}
                  >
                    <View
                      style={[
                        autoRefreshStyles.dropdown,
                        {
                          position: "absolute",
                          top: pickerAnchor?.top ?? 50,
                          right: pickerAnchor?.right ?? 16,
                          backgroundColor: colors.card,
                          borderColor: colors.border,
                        },
                      ]}
                    >
                        {REFRESH_OPTIONS.map((opt) => (
                          <Pressable
                            key={opt.ms}
                            onPress={() => {
                              setRefreshMs(opt.ms);
                              setShowRefreshPicker(false);
                            }}
                            style={[
                              autoRefreshStyles.dropdownItem,
                              opt.ms === refreshMs && {
                                backgroundColor: colors.primary + "18",
                              },
                            ]}
                          >
                            <Text
                              style={{
                                fontSize: 11,
                                fontFamily:
                                  opt.ms === refreshMs
                                    ? "Inter_600SemiBold"
                                    : "Inter_400Regular",
                                color:
                                  opt.ms === refreshMs
                                    ? colors.primary
                                    : colors.foreground,
                              }}
                            >
                              {opt.label}
                            </Text>
                          </Pressable>
                      ))}
                    </View>
                  </Pressable>
                </Modal>
              </View>
              <Pressable onPress={() => { fetchHistory(); fetchDedupe(); }} hitSlop={8} style={{ padding: 4 }}>
                <Feather name="refresh-cw" size={16} color={colors.mutedForeground} />
              </Pressable>
            </View>
          </View>

          <View style={{ marginTop: 10 }}>
            <Pressable
              testID="run-smoke-now"
              onPress={runSmokeNow}
              disabled={runningSmoke || cooldown !== null}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                paddingHorizontal: 12,
                paddingVertical: 9,
                borderRadius: 8,
                backgroundColor: colors.primary,
                opacity: runningSmoke || cooldown !== null ? 0.55 : 1,
              }}
            >
              {runningSmoke ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Feather name="play-circle" size={14} color="#fff" />
              )}
              <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#fff" }}>
                {cooldown
                  ? cooldown.reason === "in-flight"
                    ? `Çalışma sürüyor — ${cooldownRemaining}s`
                    : `Bekleme: ${cooldownRemaining}s`
                  : runningSmoke
                    ? "Çalıştırılıyor…"
                    : "Şimdi çalıştır"}
              </Text>
            </Pressable>
            {runResult ? (() => {
              const status = runResult.status;
              const tint =
                status === "unknown"
                  ? colors.mutedForeground
                  : STATUS_COLOR[status];
              const iconName =
                status === "unknown"
                  ? "help-circle"
                  : status === "ok"
                    ? "check-circle"
                    : status === "failed"
                      ? "x-circle"
                      : "alert-triangle";
              const message =
                status === "unknown"
                  ? "Smoke çalıştırıldı: durum bilinmiyor"
                  : status === "ok"
                    ? `Smoke çalıştırıldı: ${STATUS_LABEL.ok}`
                    : status === "failed"
                      ? `Smoke çalıştırıldı: ${STATUS_LABEL.failed} (${runResult.failureCount} probe)`
                      : `Smoke çalıştırıldı: ${STATUS_LABEL["harness-error"]}${
                          runResult.harnessError ? ` — ${runResult.harnessError}` : ""
                        }`;
              return (
                <View
                  testID="run-smoke-result"
                  style={{
                    marginTop: 8,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    borderRadius: 8,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    backgroundColor: tint + "18",
                    borderWidth: 1,
                    borderColor: tint + "55",
                  }}
                >
                  <Feather name={iconName} size={14} color={tint} />
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 12,
                      fontFamily: "Inter_600SemiBold",
                      color: tint,
                    }}
                  >
                    {message}
                  </Text>
                </View>
              );
            })() : null}
            {cooldown ? (
              <Text
                testID="run-smoke-cooldown-detail"
                style={{
                  marginTop: 6,
                  fontSize: 11,
                  fontFamily: "Inter_400Regular",
                  color: colors.mutedForeground,
                  textAlign: "center",
                }}
              >
                {cooldown.reason === "in-flight"
                  ? `Başka bir smoke çalışması zaten sürüyor. ${cooldownRemaining}s sonra tekrar deneyin.`
                  : `Bekleme penceresi devam ediyor. ${cooldownRemaining}s sonra tekrar deneyin.`}
              </Text>
            ) : null}
          </View>

          <SummaryCard runs={runs} />
          <Sparkline runs={runs} />

          {dedupe?.active ? (
            <View
              style={{
                marginTop: 10,
                padding: 12,
                borderRadius: 12,
                backgroundColor: "#D9770612",
                borderWidth: 1,
                borderColor: "#D9770630",
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <Feather name="shield" size={14} color="#D97706" />
                <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#D97706", flex: 1 }}>
                  Dedupe aktif
                </Text>
              </View>
              <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.foreground, marginBottom: 2 }}>
                Parmak izi: {dedupe.fingerprint ?? "—"}
              </Text>
              {dedupe.alertedAt ? (
                <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginBottom: 2 }}>
                  Uyarı zamanı: {formatRunAt(dedupe.alertedAt)}
                </Text>
              ) : null}
              {dedupe.suppressedLatest ? (
                <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: "#D97706", marginBottom: 4 }}>
                  Son çalışma dedupe tarafından bastırıldı
                </Text>
              ) : null}
              <Pressable
                onPress={clearDedupe}
                disabled={clearingDedupe}
                style={{
                  marginTop: 6,
                  alignSelf: "flex-start",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderRadius: 8,
                  backgroundColor: "#D97706",
                  opacity: clearingDedupe ? 0.6 : 1,
                }}
              >
                {clearingDedupe ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Feather name="trash-2" size={13} color="#fff" />
                )}
                <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#fff" }}>
                  Dedupe temizle
                </Text>
              </Pressable>
            </View>
          ) : null}

          {error ? (
            <View style={{
              marginTop: 10, padding: 10, borderRadius: 8,
              backgroundColor: "#DC262612", borderWidth: 1, borderColor: "#DC262635",
              flexDirection: "row", alignItems: "center", gap: 6,
            }}>
              <Feather name="alert-triangle" size={14} color="#DC2626" />
              <Text style={{ color: "#DC2626", fontSize: 12, fontFamily: "Inter_500Medium", flex: 1 }}>
                {error}
              </Text>
            </View>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        !loading ? (
          <View style={styles.center}>
            <Feather name="activity" size={40} color={colors.mutedForeground} />
            <Text style={{ color: colors.mutedForeground, marginTop: 12, fontFamily: "Inter_400Regular", fontSize: 14, textAlign: "center" }}>
              Henüz smoke kaydı yok.
            </Text>
          </View>
        ) : null
      }
      renderItem={({ item }) => {
        const dotColor = STATUS_COLOR[item.lastStatus];
        return (
          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: colors.foreground }}>
                  {STATUS_LABEL[item.lastStatus]}
                </Text>
                <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 1 }}>
                  {formatRunAt(item.lastRunAt)}
                </Text>
              </View>
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 10,
                  backgroundColor: colors.muted,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>
                  {REASON_LABEL[item.lastReason] ?? item.lastReason}
                </Text>
              </View>
            </View>

            <View style={styles.metaRow}>
              <Feather name="link" size={11} color={colors.mutedForeground} />
              <Text style={[styles.metaText, { color: colors.mutedForeground }]} numberOfLines={1}>
                {item.apiBase || "—"}
              </Text>
            </View>

            <View style={styles.metaRow}>
              <Feather name="hash" size={11} color={colors.mutedForeground} />
              <Text style={[styles.metaText, { color: colors.mutedForeground }]} numberOfLines={2}>
                Set ID&apos;leri: {Array.isArray(item.setIds) && item.setIds.length > 0 ? item.setIds.join(", ") : "—"}
              </Text>
            </View>

            <View style={styles.metaRow}>
              <Feather
                name="x-octagon"
                size={11}
                color={item.failureCount > 0 ? "#DC2626" : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.metaText,
                  item.failureCount > 0
                    ? { color: "#DC2626", fontFamily: "Inter_600SemiBold" }
                    : { color: colors.mutedForeground },
                ]}
              >
                {item.failureCount} probe başarısız
              </Text>
            </View>

            {item.harnessError ? (
              <View
                style={{
                  marginTop: 8,
                  padding: 8,
                  borderRadius: 8,
                  backgroundColor: "#D9770618",
                  borderWidth: 1,
                  borderColor: "#D9770635",
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 2 }}>
                  <Feather name="alert-triangle" size={11} color="#D97706" />
                  <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#D97706" }}>
                    Harness hatası
                  </Text>
                </View>
                <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.foreground }}>
                  {item.harnessError}
                </Text>
              </View>
            ) : null}
          </View>
        );
      }}
    />
  );
}

const autoRefreshStyles = StyleSheet.create({
  toggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  dropdown: {
    minWidth: 80,
    borderRadius: 10,
    borderWidth: 1,
    overflow: "hidden",
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
  },
  modalBackdrop: {
    flex: 1,
  },
  dropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});

const sparkStyles = StyleSheet.create({
  container: {
    marginTop: 10,
  },
  label: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    marginBottom: 6,
  },
  dotRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 3,
  },
  legendRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
  },
});

const summaryStyles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginTop: 10,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  statLabel: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },
  divider: {
    width: 1,
    height: 28,
  },
  latestRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#0001",
  },
  latestText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  latestBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  latestBadgeText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
  },
});

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 12 },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  metaText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
});
