import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import { type AuthConfig, buildAuthHeaders } from "./adminAuthUtils";

/**
 * Reusable "operator-tunable dedupe window" card. Mirrors the
 * `tunableNumber` helper on the API side: shows the active value, its
 * effective source (env / default / manual), and lets the operator
 * apply a manual override or reset to env/default.
 *
 * Used by both the bad-ID dedupe and precision-loss dedupe admin
 * panels so the two knobs share a single, consistent widget. New
 * tunable knobs registered via `createTunableNumber` on the server
 * can be wired up here without further duplication — point at the
 * matching `/_internal/<knob>` endpoint and pass a copy/help string.
 */

export interface DedupeInfo {
  windowMs: number;
  source: "env" | "default";
  manualOverride: boolean;
  effectiveSource: "env" | "default" | "manual";
}

export interface DedupeWindowTunerProps {
  baseUrl: string;
  /** e.g. `"/_internal/bad-id-dedupe"` — same path for GET and PUT. */
  endpointPath: string;
  auth: AuthConfig;
  /** Header above the active-value card. */
  title: string;
  /** Footnote shown under the input. */
  helpText: string;
  /**
   * Optional hook fired after a successful PUT (apply or reset). The
   * AdminPrecisionDedupeView uses this to refresh its sample buffer,
   * which the server clears on every window change.
   */
  onAfterChange?: () => void;
}

const SOURCE_LABEL: Record<DedupeInfo["effectiveSource"], string> = {
  env: "Ortam değişkeni",
  default: "Varsayılan",
  manual: "Manuel ayar",
};

const SOURCE_COLOR: Record<DedupeInfo["effectiveSource"], string> = {
  env: "#0057B8",
  default: "#6B7280",
  manual: "#D97706",
};

function formatWindow(ms: number): string {
  if (ms === 0) return "0 ms (kapalı)";
  if (ms < 1000) return `${ms} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s} sn`;
  const m = s / 60;
  if (m < 60) return `${m.toFixed(m % 1 === 0 ? 0 : 1)} dk`;
  const h = m / 60;
  return `${h.toFixed(h % 1 === 0 ? 0 : 1)} sa`;
}

function parseInfo(json: unknown): DedupeInfo {
  const obj = (json ?? {}) as Record<string, unknown>;
  return {
    windowMs: Number(obj.windowMs ?? 0),
    source: obj.source === "env" ? "env" : "default",
    manualOverride: obj.manualOverride === true,
    effectiveSource:
      obj.effectiveSource === "manual"
        ? "manual"
        : obj.effectiveSource === "env"
          ? "env"
          : "default",
  };
}

export function DedupeWindowTuner(props: DedupeWindowTunerProps) {
  const { baseUrl, endpointPath, auth, title, helpText, onAfterChange } = props;
  const authKey = auth.mode === "jwt" ? auth.token : auth.secret;
  const colors = useColors();
  const [info, setInfo] = useState<DedupeInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const fetchInfo = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${baseUrl}${endpointPath}`, {
        headers: buildAuthHeaders(auth),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(typeof json?.error === "string" ? json.error : `HTTP ${res.status}`);
        setInfo(null);
      } else {
        const next = parseInfo(json);
        setInfo(next);
        setDraft(String(next.windowMs));
      }
    } catch {
      setError("Sunucuya bağlanılamadı.");
      setInfo(null);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl, endpointPath, auth.mode, authKey]);

  useEffect(() => {
    fetchInfo();
  }, [fetchInfo]);

  const submit = useCallback(
    async (windowMs: number | null) => {
      setSaving(true);
      setError(null);
      try {
        const res = await fetch(`${baseUrl}${endpointPath}`, {
          method: "PUT",
          headers: { ...buildAuthHeaders(auth), "Content-Type": "application/json" },
          body: JSON.stringify({ windowMs }),
        });
        const json = await res.json();
        if (!res.ok) {
          const msg = typeof json?.error === "string" ? json.error : `HTTP ${res.status}`;
          setError(msg);
          Alert.alert("Hata", msg);
        } else {
          const next = parseInfo(json);
          setInfo(next);
          setDraft(String(next.windowMs));
          onAfterChange?.();
        }
      } catch {
        setError("Sunucuya bağlanılamadı.");
        Alert.alert("Hata", "Sunucuya bağlanılamadı.");
      } finally {
        setSaving(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [baseUrl, endpointPath, auth.mode, authKey, onAfterChange],
  );

  const onApply = () => {
    const trimmed = draft.trim();
    const parsed = Number(trimmed);
    if (!Number.isInteger(parsed) || parsed < 0) {
      Alert.alert("Geçersiz değer", "Negatif olmayan tam sayı girin (ms).");
      return;
    }
    submit(parsed);
  };

  const onReset = () => {
    Alert.alert(
      "Varsayılana dön",
      "Manuel ayar kaldırılacak ve ortam değişkeni / varsayılan değer geri yüklenecek. Devam edilsin mi?",
      [
        { text: "İptal", style: "cancel" },
        { text: "Sıfırla", style: "destructive", onPress: () => submit(null) },
      ],
    );
  };

  const effective = info?.effectiveSource ?? "default";
  const sourceColor = SOURCE_COLOR[effective];

  return (
    <View>
      <View style={styles.headerRow}>
        <Text style={[styles.headerLabel, { color: colors.mutedForeground }]}>{title}</Text>
        <Pressable onPress={fetchInfo} hitSlop={8} style={{ padding: 4 }}>
          {loading ? (
            <ActivityIndicator size="small" color={colors.mutedForeground} />
          ) : (
            <Feather name="refresh-cw" size={16} color={colors.mutedForeground} />
          )}
        </Pressable>
      </View>

      {info ? (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.rowBetween}>
            <Text style={[styles.cardLabel, { color: colors.mutedForeground }]}>Aktif değer</Text>
            <View style={[styles.sourceBadge, { backgroundColor: sourceColor + "18" }]}>
              <View style={[styles.sourceDot, { backgroundColor: sourceColor }]} />
              <Text style={[styles.sourceText, { color: sourceColor }]}>
                {SOURCE_LABEL[effective]}
              </Text>
            </View>
          </View>
          <Text style={[styles.value, { color: colors.foreground }]}>
            {formatWindow(info.windowMs)}
          </Text>
          <Text style={[styles.subValue, { color: colors.mutedForeground }]}>
            {info.windowMs} ms
          </Text>
          {info.manualOverride ? (
            <Text style={[styles.note, { color: colors.mutedForeground }]}>
              Modül başlatıldığında değer:{" "}
              {info.source === "env" ? "ortam değişkeninden" : "varsayılandan"} alınmıştı.
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 12 }]}>
        <Text style={[styles.cardLabel, { color: colors.mutedForeground, marginBottom: 8 }]}>
          Yeni değer (ms)
        </Text>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          keyboardType="numeric"
          editable={!saving}
          placeholder="örn. 300000"
          placeholderTextColor={colors.mutedForeground}
          style={[
            styles.input,
            {
              borderColor: colors.border,
              backgroundColor: colors.background,
              color: colors.foreground,
            },
          ]}
        />
        <View style={styles.actionRow}>
          <Pressable
            onPress={onApply}
            disabled={saving}
            style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: saving ? 0.6 : 1 }]}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Feather name="check" size={13} color="#fff" />
            )}
            <Text style={styles.primaryBtnText}>Uygula</Text>
          </Pressable>
          <Pressable
            onPress={onReset}
            disabled={saving || !info?.manualOverride}
            style={[
              styles.secondaryBtn,
              {
                borderColor: colors.border,
                opacity: saving || !info?.manualOverride ? 0.5 : 1,
              },
            ]}
          >
            <Feather name="rotate-ccw" size={13} color={colors.foreground} />
            <Text style={[styles.secondaryBtnText, { color: colors.foreground }]}>
              Varsayılana dön
            </Text>
          </Pressable>
        </View>
        <Text style={[styles.help, { color: colors.mutedForeground }]}>{helpText}</Text>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Feather name="alert-triangle" size={14} color="#DC2626" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  headerLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  card: { borderRadius: 14, borderWidth: 1, padding: 16 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5 },
  value: { fontSize: 26, fontFamily: "Inter_700Bold", marginTop: 8 },
  subValue: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  note: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 8 },
  sourceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
  },
  sourceDot: { width: 7, height: 7, borderRadius: 4 },
  sourceText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
  },
  primaryBtnText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
  },
  secondaryBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  help: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 10, lineHeight: 16 },
  errorBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#DC262612",
    borderWidth: 1,
    borderColor: "#DC262635",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  errorText: { color: "#DC2626", fontSize: 12, fontFamily: "Inter_500Medium", flex: 1 },
});
