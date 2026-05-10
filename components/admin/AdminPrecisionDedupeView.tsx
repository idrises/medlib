import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import { type AuthConfig, buildAuthHeaders, resolveAuth } from "./adminAuthUtils";
import { DedupeWindowTuner } from "./DedupeWindowTuner";

interface Props {
  baseUrl: string;
  token?: string;
  auth?: AuthConfig;
}

interface PrecisionLossSample {
  column: string;
  queryPreview: string;
  kind: "bigint" | "decimal";
  count: number;
  firstSeen: number;
  lastSeen: number;
  lastRaw: string;
  lastCoerced: number | null;
}

function formatRelative(ms: number, now: number): string {
  const diff = Math.max(0, now - ms);
  if (diff < 1000) return "şimdi";
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s} sn önce`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} dk önce`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} sa önce`;
  const d = Math.floor(h / 24);
  return `${d} gün önce`;
}

export function AdminPrecisionDedupeView(props: Props) {
  const { baseUrl } = props;
  const auth = resolveAuth(props);
  const authKey = auth.mode === "jwt" ? auth.token : auth.secret;
  const colors = useColors();
  const [samples, setSamples] = useState<PrecisionLossSample[]>([]);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const fetchSamples = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${baseUrl}/_internal/precision-loss`, {
        headers: buildAuthHeaders(auth),
      });
      if (!res.ok) {
        setSamples([]);
        return;
      }
      const json = (await res.json()) as { samples?: PrecisionLossSample[] };
      const list = Array.isArray(json.samples) ? json.samples : [];
      setSamples(
        list.map((s) => ({
          column: String(s.column ?? ""),
          queryPreview: String(s.queryPreview ?? ""),
          kind: s.kind === "decimal" ? "decimal" : "bigint",
          count: Number(s.count ?? 0),
          firstSeen: Number(s.firstSeen ?? 0),
          lastSeen: Number(s.lastSeen ?? 0),
          lastRaw: String(s.lastRaw ?? ""),
          lastCoerced:
            typeof s.lastCoerced === "number" ? s.lastCoerced : null,
        })),
      );
    } catch {
      setSamples([]);
    } finally {
      setLoading(false);
      setNow(Date.now());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl, auth.mode, authKey]);

  useEffect(() => {
    fetchSamples();
  }, [fetchSamples]);

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={fetchSamples} tintColor={colors.primary} />
      }
    >
      <DedupeWindowTuner
        baseUrl={baseUrl}
        endpointPath="/_internal/precision-dedupe"
        auth={auth}
        title="Hassasiyet kaybı uyarı dedupe penceresi"
        helpText="0 = dedupe kapalı (her uyarı loglanır). Değer kalıcı değildir; sunucu yeniden başladığında PRECISION_WARN_DEDUPE_WINDOW_MS ortam değişkeninden tekrar okunur. Pencere değiştiğinde aşağıdaki örnek tablosu sıfırlanır."
        // The server clears its precision-loss sample buffer on every
        // window change, so refresh the table to reflect that.
        onAfterChange={fetchSamples}
      />

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
          Son hassasiyet kaybı uyarıları
        </Text>
        <Text style={[styles.sectionMeta, { color: colors.mutedForeground }]}>
          {samples.length === 0 ? "kayıt yok" : `${samples.length} satır`}
        </Text>
      </View>

      {samples.length === 0 ? (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.help, { color: colors.mutedForeground, marginTop: 0 }]}>
            Henüz hassasiyet kaybı uyarısı kaydedilmedi. Pencere değiştirildiğinde
            sayaçlar sıfırlanır; sürücü katmanı yeni bir kesinlik kaybı tespit
            ettiğinde burada listelenir.
          </Text>
        </View>
      ) : (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, padding: 0 }]}>
          <View style={[styles.tableHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.thColumn, { color: colors.mutedForeground }]}>Kolon / Sorgu</Text>
            <Text style={[styles.thCount, { color: colors.mutedForeground }]}>Adet</Text>
            <Text style={[styles.thLast, { color: colors.mutedForeground }]}>Son görülme</Text>
          </View>
          {samples.map((s, idx) => (
            <View
              key={`${s.kind}\u0000${s.column}\u0000${s.queryPreview}`}
              style={[
                styles.tableRow,
                idx < samples.length - 1
                  ? { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }
                  : null,
              ]}
            >
              <View style={styles.tdColumn}>
                <View style={styles.colHeaderRow}>
                  <Text style={[styles.colName, { color: colors.foreground }]} numberOfLines={1}>
                    {s.column || "(bilinmiyor)"}
                  </Text>
                  <View
                    style={[
                      styles.kindBadge,
                      {
                        backgroundColor:
                          (s.kind === "bigint" ? "#0057B8" : "#7C3AED") + "18",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.kindBadgeText,
                        { color: s.kind === "bigint" ? "#0057B8" : "#7C3AED" },
                      ]}
                    >
                      {s.kind}
                    </Text>
                  </View>
                </View>
                <Text
                  style={[styles.queryPreview, { color: colors.mutedForeground }]}
                  numberOfLines={2}
                >
                  {s.queryPreview || "(sorgu bilgisi yok)"}
                </Text>
                <Text
                  style={[styles.rawLine, { color: colors.mutedForeground }]}
                  numberOfLines={1}
                >
                  {s.lastRaw} → {s.lastCoerced ?? "—"}
                </Text>
              </View>
              <Text style={[styles.tdCount, { color: colors.foreground }]}>{s.count}</Text>
              <Text style={[styles.tdLast, { color: colors.mutedForeground }]}>
                {formatRelative(s.lastSeen, now)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, borderWidth: 1, padding: 16 },
  help: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 10, lineHeight: 16 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 22,
    marginBottom: 8,
  },
  sectionLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  sectionMeta: { fontSize: 11, fontFamily: "Inter_400Regular" },
  tableHeader: {
    flexDirection: "row",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  thColumn: { flex: 1, fontSize: 10, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5 },
  thCount: { width: 48, textAlign: "right", fontSize: 10, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5 },
  thLast: { width: 92, textAlign: "right", fontSize: 10, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5 },
  tableRow: { flexDirection: "row", paddingHorizontal: 14, paddingVertical: 10, alignItems: "flex-start" },
  tdColumn: { flex: 1, paddingRight: 8 },
  colHeaderRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  colName: { fontSize: 13, fontFamily: "Inter_600SemiBold", flexShrink: 1 },
  kindBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  kindBadgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold", textTransform: "lowercase" },
  queryPreview: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 3, lineHeight: 14 },
  rawLine: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 4 },
  tdCount: { width: 48, textAlign: "right", fontSize: 14, fontFamily: "Inter_700Bold" },
  tdLast: { width: 92, textAlign: "right", fontSize: 11, fontFamily: "Inter_400Regular" },
});
