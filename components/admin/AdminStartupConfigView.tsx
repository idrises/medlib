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

interface Props {
  baseUrl: string;
  token?: string;
  auth?: AuthConfig;
}

type Source = "env" | "default";

type Resolved<T> = { value: T; source: Source };
type SecretPresence = { set: boolean; length: number; source: Source };
type CsvCount = { count: number; source: Source };

interface StartupConfigSummary {
  server: {
    port: Resolved<number>;
    nodeEnv: Resolved<string>;
    logLevel: Resolved<string>;
  };
  database: {
    server: Resolved<string>;
    database: Resolved<string>;
    user: Resolved<string>;
    password: SecretPresence;
  };
  auth: {
    sessionSecret: SecretPresence;
    adminUserIds: CsvCount;
    superAdminUserIds: CsvCount;
    smokeStatusToken: SecretPresence;
  };
  warnDedupe: {
    badIdWindowMs: Resolved<number>;
    precisionWindowMs: Resolved<number>;
  };
  smokeScheduler: {
    enabled: Resolved<boolean>;
    runOnStartup: Resolved<boolean>;
    startupDelayMs: Resolved<number>;
    cron: Resolved<string>;
    cronTz: Resolved<string>;
    historySize: Resolved<number>;
    historyFilePath: Resolved<string>;
    triggerCooldownS: Resolved<number>;
  };
  smokeWatchdog: {
    enabled: Resolved<boolean>;
    cron: Resolved<string>;
    staleHours: Resolved<number>;
    stalenessStatePath: Resolved<string>;
  };
  smokeProbe: {
    apiBase: Resolved<string>;
    timeoutMs: Resolved<number>;
    videoSetCount: Resolved<number>;
    entriesPerSet: Resolved<number>;
    requireVideo200: Resolved<boolean>;
    videoSetIds: CsvCount;
  };
  smokeAlerter: {
    slackWebhook: SecretPresence;
    expoTokens: CsvCount;
    alertStatePath: Resolved<string>;
    alertDedupeHours: Resolved<number>;
  };
  ai: {
    openaiApiKey: SecretPresence;
  };
}

const SOURCE_LABEL: Record<Source, string> = {
  env: "Ortam değişkeni",
  default: "Varsayılan",
};

const SOURCE_COLOR: Record<Source, string> = {
  env: "#0057B8",
  default: "#6B7280",
};

interface SectionDef {
  key: keyof StartupConfigSummary;
  title: string;
  icon: keyof typeof Feather.glyphMap;
}

const SECTIONS: SectionDef[] = [
  { key: "server", title: "Sunucu", icon: "server" },
  { key: "database", title: "Veritabanı", icon: "database" },
  { key: "auth", title: "Kimlik doğrulama", icon: "shield" },
  { key: "warnDedupe", title: "Uyarı dedupe", icon: "filter" },
  { key: "smokeScheduler", title: "Smoke planlayıcı", icon: "clock" },
  { key: "smokeWatchdog", title: "Smoke watchdog", icon: "eye" },
  { key: "smokeProbe", title: "Smoke probe", icon: "activity" },
  { key: "smokeAlerter", title: "Smoke alerter", icon: "bell" },
  { key: "ai", title: "Yapay zeka", icon: "cpu" },
];

/**
 * Per-section field-name → env-var label map. Keyed by section so that
 * fields with the same JS name in different sections (e.g. `enabled`
 * appears in both `smokeScheduler` and `smokeWatchdog`; `cron` appears
 * in both as well) render the section-specific env var rather than a
 * generic "ENABLED" / "CRON".
 *
 * Keep these in sync with `getStartupConfig()` in
 * `artifacts/api-server/src/lib/startupConfig.ts`.
 */
const FIELD_LABELS: Record<string, Record<string, string>> = {
  server: {
    port: "PORT",
    nodeEnv: "NODE_ENV",
    logLevel: "LOG_LEVEL",
  },
  database: {
    server: "MSSQL_SERVER",
    database: "MSSQL_DATABASE",
    user: "MSSQL_USER",
    password: "MSSQL_PASSWORD",
  },
  auth: {
    sessionSecret: "SESSION_SECRET",
    adminUserIds: "ADMIN_USER_IDS",
    superAdminUserIds: "SUPER_ADMIN_USER_IDS",
    smokeStatusToken: "SMOKE_STATUS_TOKEN",
  },
  warnDedupe: {
    badIdWindowMs: "BAD_ID_WARN_DEDUPE_WINDOW_MS",
    precisionWindowMs: "PRECISION_WARN_DEDUPE_WINDOW_MS",
  },
  smokeScheduler: {
    enabled: "SMOKE_SCHEDULER_ENABLED",
    runOnStartup: "SMOKE_RUN_ON_STARTUP",
    startupDelayMs: "SMOKE_STARTUP_DELAY_MS",
    cron: "SMOKE_CRON",
    cronTz: "SMOKE_CRON_TZ",
    historySize: "SMOKE_HISTORY_SIZE",
    historyFilePath: "SMOKE_HISTORY_FILE_PATH",
    triggerCooldownS: "SMOKE_TRIGGER_COOLDOWN_S",
  },
  smokeWatchdog: {
    enabled: "SMOKE_WATCHDOG_ENABLED",
    cron: "SMOKE_WATCHDOG_CRON",
    staleHours: "SMOKE_STALE_HOURS",
    stalenessStatePath: "SMOKE_STALENESS_STATE_PATH",
  },
  smokeProbe: {
    apiBase: "API_BASE",
    timeoutMs: "SMOKE_TIMEOUT_MS",
    videoSetCount: "SMOKE_VIDEOSET_COUNT",
    entriesPerSet: "SMOKE_ENTRIES_PER_SET",
    requireVideo200: "SMOKE_REQUIRE_VIDEO_200",
    videoSetIds: "SMOKE_VIDEOSET_IDS",
  },
  smokeAlerter: {
    slackWebhook: "SMOKE_ALERT_SLACK_WEBHOOK",
    expoTokens: "SMOKE_ALERT_EXPO_TOKENS",
    alertStatePath: "SMOKE_ALERT_STATE_PATH",
    alertDedupeHours: "SMOKE_ALERT_DEDUPE_HOURS",
  },
  ai: {
    openaiApiKey: "AI_INTEGRATIONS_OPENAI_API_KEY",
  },
};

function isResolved(v: unknown): v is Resolved<unknown> {
  return (
    typeof v === "object" &&
    v !== null &&
    "value" in (v as Record<string, unknown>) &&
    "source" in (v as Record<string, unknown>)
  );
}

function isSecretPresence(v: unknown): v is SecretPresence {
  return (
    typeof v === "object" &&
    v !== null &&
    "set" in (v as Record<string, unknown>) &&
    "length" in (v as Record<string, unknown>)
  );
}

function isCsvCount(v: unknown): v is CsvCount {
  return (
    typeof v === "object" &&
    v !== null &&
    "count" in (v as Record<string, unknown>) &&
    !("set" in (v as Record<string, unknown>))
  );
}

function formatValue(v: unknown): string {
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return v.length === 0 ? "(boş)" : v;
  return JSON.stringify(v);
}

export function AdminStartupConfigView(props: Props) {
  const { baseUrl } = props;
  const auth = resolveAuth(props);
  const authKey = auth.mode === "jwt" ? auth.token : auth.secret;
  const colors = useColors();
  const [config, setConfig] = useState<StartupConfigSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${baseUrl}/_internal/startup-config`, {
        headers: buildAuthHeaders(auth),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(typeof json?.error === "string" ? json.error : `HTTP ${res.status}`);
        setConfig(null);
      } else {
        setConfig(json as StartupConfigSummary);
      }
    } catch {
      setError("Sunucuya bağlanılamadı.");
      setConfig(null);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl, auth.mode, authKey]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  if (loading && !config) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={fetchConfig} tintColor={colors.primary} />
      }
    >
      <View style={styles.headerRow}>
        <Text style={[styles.headerLabel, { color: colors.mutedForeground }]}>
          Aktif sunucu yapılandırması
        </Text>
        <Pressable onPress={fetchConfig} hitSlop={8} style={{ padding: 4 }}>
          <Feather name="refresh-cw" size={16} color={colors.mutedForeground} />
        </Pressable>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Feather name="alert-triangle" size={14} color="#DC2626" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {config
        ? SECTIONS.map((section) => {
            const data = config[section.key] as Record<string, unknown> | undefined;
            if (!data) return null;
            const entries = Object.entries(data);
            return (
              <View
                key={section.key}
                style={[
                  styles.card,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <View style={styles.sectionHeader}>
                  <Feather name={section.icon} size={14} color={colors.primary} />
                  <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                    {section.title}
                  </Text>
                </View>
                {entries.map(([field, raw]) => {
                  const label = FIELD_LABELS[section.key]?.[field] ?? field;
                  let valueText = "";
                  let source: Source = "default";
                  let isSecret = false;
                  if (isSecretPresence(raw)) {
                    isSecret = true;
                    source = raw.source;
                    valueText = raw.set
                      ? `set (${raw.length} karakter)`
                      : "unset";
                  } else if (isCsvCount(raw)) {
                    source = raw.source;
                    valueText =
                      raw.count === 0 ? "(yok)" : `${raw.count} kayıt`;
                  } else if (isResolved(raw)) {
                    source = raw.source;
                    valueText = formatValue(raw.value);
                  } else {
                    valueText = formatValue(raw);
                  }
                  const sourceColor = SOURCE_COLOR[source];
                  return (
                    <View
                      key={field}
                      style={[styles.row, { borderTopColor: colors.border }]}
                    >
                      <View style={styles.rowLabelCol}>
                        <Text
                          style={[
                            styles.fieldLabel,
                            { color: colors.mutedForeground },
                          ]}
                        >
                          {label}
                        </Text>
                        <Text
                          style={[
                            styles.fieldValue,
                            { color: colors.foreground },
                          ]}
                          selectable
                        >
                          {valueText}
                        </Text>
                        {isSecret ? (
                          <Text
                            style={{
                              fontSize: 10,
                              color: colors.mutedForeground,
                              fontFamily: "Inter_400Regular",
                              marginTop: 2,
                            }}
                          >
                            (gizli)
                          </Text>
                        ) : null}
                      </View>
                      <View
                        style={[
                          styles.sourceBadge,
                          { backgroundColor: sourceColor + "18" },
                        ]}
                      >
                        <View
                          style={[styles.sourceDot, { backgroundColor: sourceColor }]}
                        />
                        <Text style={[styles.sourceText, { color: sourceColor }]}>
                          {SOURCE_LABEL[source]}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            );
          })
        : null}

      <Text style={[styles.help, { color: colors.mutedForeground }]}>
        Salt okunur. Değerleri kalıcı olarak değiştirmek için ortam değişkenlerini
        güncelleyip sunucuyu yeniden başlatın. Gizli değerler asla ham olarak
        gösterilmez — sadece set/unset ve uzunluk bildirilir.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 12 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  headerLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  card: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 12 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingBottom: 8,
  },
  sectionTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  rowLabelCol: { flex: 1, minWidth: 0 },
  fieldLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  fieldValue: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },
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
  help: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 6, lineHeight: 16 },
  errorBox: {
    marginBottom: 10,
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
