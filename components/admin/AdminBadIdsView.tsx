import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
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

interface BadIdsData {
  badIdCoercionCount: number;
  byRoute: Record<string, Record<string, number>>;
  byRouteCapped: boolean;
  suppressedWarnings: Record<string, Record<string, number>>;
}

export function AdminBadIdsView(props: Props) {
  const { baseUrl } = props;
  const auth = resolveAuth(props);
  const authKey = auth.mode === "jwt" ? auth.token : auth.secret;
  const colors = useColors();
  const [data, setData] = useState<BadIdsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBadIds = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${baseUrl}/_internal/bad-ids`, {
        headers: buildAuthHeaders(auth),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(typeof json?.error === "string" ? json.error : `HTTP ${res.status}`);
        setData(null);
      } else {
        setData({
          badIdCoercionCount: json.badIdCoercionCount ?? 0,
          byRoute: json.byRoute ?? {},
          byRouteCapped: json.byRouteCapped === true,
          suppressedWarnings: json.suppressedWarnings ?? {},
        });
      }
    } catch {
      setError("Sunucuya bağlanılamadı.");
      setData(null);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl, auth.mode, authKey]);

  useEffect(() => {
    fetchBadIds();
  }, [fetchBadIds]);

  if (loading && !data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const hasData = data !== null;
  const count = data?.badIdCoercionCount ?? 0;
  const hasWarning = hasData && count > 0;
  const isClean = hasData && count === 0 && !error;
  const suppressedWarnings = data?.suppressedWarnings ?? {};
  const sumValues = (record: Record<string, number> | undefined) =>
    record ? Object.values(record).reduce((s, v) => s + v, 0) : 0;
  const routeEntries = data?.byRoute ? Object.entries(data.byRoute) : [];
  routeEntries.sort(([routeA, fieldsA], [routeB, fieldsB]) => {
    const suppressedDiff =
      sumValues(suppressedWarnings[routeB]) - sumValues(suppressedWarnings[routeA]);
    if (suppressedDiff !== 0) return suppressedDiff;
    const failureDiff = sumValues(fieldsB) - sumValues(fieldsA);
    if (failureDiff !== 0) return failureDiff;
    return routeA.localeCompare(routeB);
  });
  const byRouteCapped = data?.byRouteCapped === true;
  const totalSuppressed = Object.values(suppressedWarnings).reduce(
    (sum, fields) => sum + Object.values(fields).reduce((s, v) => s + v, 0),
    0,
  );

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={fetchBadIds} tintColor={colors.primary} />
      }
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: colors.mutedForeground }}>
          Bad-ID dönüşüm sayacı
        </Text>
        <Pressable onPress={fetchBadIds} hitSlop={8} style={{ padding: 4 }}>
          <Feather name="refresh-cw" size={16} color={colors.mutedForeground} />
        </Pressable>
      </View>

      <View
        style={[
          styles.counterCard,
          {
            backgroundColor: hasWarning ? "#DC262612" : error && !hasData ? "#D9770612" : colors.card,
            borderColor: hasWarning ? "#DC262635" : error && !hasData ? "#D9770635" : colors.border,
          },
        ]}
      >
        <View style={styles.counterRow}>
          <View style={[styles.counterIcon, { backgroundColor: hasWarning ? "#DC262618" : error && !hasData ? "#D9770618" : colors.muted }]}>
            <Feather
              name={error && !hasData ? "help-circle" : "alert-triangle"}
              size={22}
              color={hasWarning ? "#DC2626" : error && !hasData ? "#D97706" : colors.mutedForeground}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={[
                styles.counterValue,
                { color: hasWarning ? "#DC2626" : error && !hasData ? "#D97706" : colors.foreground },
              ]}
            >
              {error && !hasData ? "—" : count}
            </Text>
            <Text style={[styles.counterLabel, { color: colors.mutedForeground }]}>
              ID dönüşümü
            </Text>
            {hasData && totalSuppressed > 0 ? (
              <View style={styles.suppressedSummaryRow}>
                <Feather name="volume-x" size={11} color="#D97706" />
                <Text style={styles.suppressedSummaryText}>
                  {totalSuppressed} bastırılan uyarı
                </Text>
              </View>
            ) : null}
          </View>
          {hasWarning ? (
            <View style={styles.warningBadge}>
              <Text style={styles.warningBadgeText}>Dikkat</Text>
            </View>
          ) : isClean ? (
            <View style={[styles.okBadge, { backgroundColor: "#16A34A18" }]}>
              <Feather name="check-circle" size={12} color="#16A34A" />
              <Text style={[styles.okBadgeText, { color: "#16A34A" }]}>Temiz</Text>
            </View>
          ) : error ? (
            <View style={[styles.okBadge, { backgroundColor: "#D9770618" }]}>
              <Feather name="alert-circle" size={12} color="#D97706" />
              <Text style={[styles.okBadgeText, { color: "#D97706" }]}>Bilinmiyor</Text>
            </View>
          ) : null}
        </View>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Feather name="alert-triangle" size={14} color="#DC2626" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={{ marginTop: 20 }}>
        <DedupeWindowTuner
          baseUrl={baseUrl}
          endpointPath="/_internal/bad-id-dedupe"
          auth={auth}
          title="Bad-ID uyarı dedupe penceresi"
          helpText="0 = dedupe kapalı (her uyarı loglanır). Değer kalıcı değildir; sunucu yeniden başladığında BAD_ID_WARN_DEDUPE_WINDOW_MS ortam değişkeninden tekrar okunur."
        />
      </View>

      {byRouteCapped ? (
        <View style={styles.cappedBanner}>
          <Feather name="alert-triangle" size={14} color="#D97706" />
          <Text style={styles.cappedBannerText}>
            Rota dağılımı 200 rota ile sınırlandı; liste eksik olabilir.
          </Text>
        </View>
      ) : null}

      {routeEntries.length > 0 ? (
        <View style={{ marginTop: 16 }}>
          <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Rota bazında dağılım
          </Text>
          {routeEntries.map(([route, fields]) => {
            const fieldEntries = Object.entries(fields);
            const routeTotal = fieldEntries.reduce((sum, [, v]) => sum + v, 0);
            const routeSuppressed = suppressedWarnings[route];
            return (
              <View
                key={route}
                style={[styles.routeCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={styles.routeHeader}>
                  <Feather name="git-branch" size={12} color={colors.mutedForeground} />
                  <Text style={[styles.routePath, { color: colors.foreground }]} numberOfLines={1}>
                    {route}
                  </Text>
                  <View style={[styles.routeCountBadge, { backgroundColor: "#DC262618" }]}>
                    <Text style={styles.routeCountText}>{routeTotal}</Text>
                  </View>
                </View>
                {fieldEntries.map(([field, fieldCount]) => {
                  const suppressed = routeSuppressed?.[field] ?? 0;
                  return (
                    <View key={field} style={styles.fieldRow}>
                      <Feather name="hash" size={10} color={colors.mutedForeground} />
                      <Text style={[styles.fieldName, { color: colors.mutedForeground }]}>{field}</Text>
                      {suppressed > 0 ? (
                        <View style={styles.suppressedBadge}>
                          <Feather name="volume-x" size={9} color="#D97706" />
                          <Text style={styles.suppressedText}>{suppressed}</Text>
                        </View>
                      ) : null}
                      <Text style={[styles.fieldCount, { color: "#DC2626" }]}>{fieldCount}</Text>
                    </View>
                  );
                })}
              </View>
            );
          })}
        </View>
      ) : data && count === 0 ? (
        <View style={[styles.center, { paddingTop: 40 }]}>
          <Feather name="shield" size={40} color={colors.mutedForeground} />
          <Text style={{ color: colors.mutedForeground, marginTop: 12, fontFamily: "Inter_400Regular", fontSize: 14, textAlign: "center" }}>
            Hiçbir ID dönüşümü algılanmadı.
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    gap: 12,
  },
  counterCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
  counterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  counterIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  counterValue: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
  },
  counterLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginTop: 1,
  },
  warningBadge: {
    backgroundColor: "#DC262618",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  warningBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#DC2626",
  },
  okBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  okBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
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
  errorText: {
    color: "#DC2626",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    flex: 1,
  },
  routeCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    marginBottom: 8,
  },
  routeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  routePath: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
  },
  routeCountBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  routeCountText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#DC2626",
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 3,
    paddingLeft: 18,
  },
  fieldName: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  fieldCount: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  suppressedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#D9770614",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
  },
  suppressedText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: "#D97706",
  },
  suppressedSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
    alignSelf: "flex-start",
    backgroundColor: "#D9770614",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  suppressedSummaryText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#D97706",
  },
  cappedBanner: {
    marginTop: 12,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#D9770612",
    borderWidth: 1,
    borderColor: "#D9770635",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  cappedBannerText: {
    color: "#D97706",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    flex: 1,
  },
});
