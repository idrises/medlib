import { Feather } from "@expo/vector-icons";
import React from "react";
import { ScrollView, Text, View } from "react-native";
import Svg, { Circle, G, Rect, Text as SvgText } from "react-native-svg";

import { useColors } from "@/hooks/useColors";

export type ActivityData = {
  email: string;
  totals: { chapters: number; videos: number; videoSetEntries: number; articles: number };
  activeDays: number;
  firstActivity: string | null;
  lastActivity: string | null;
  byMonth: { yr: number; mo: number; total: number }[];
  recent: { type: string; title: string; date: string; platform: string; subtitle?: string | null; contentId?: string | null }[];
};

const MONTH_TR = ["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];
const TYPE_META: Record<string, { label: string; icon: keyof typeof Feather.glyphMap; color: string }> = {
  chapter:        { label: "Bölüm",     icon: "book-open",   color: "#0057B8" },
  video:          { label: "Video",     icon: "play-circle", color: "#D97706" },
  videoset:       { label: "Video Set", icon: "video",       color: "#7C3AED" },
  videoset_video: { label: "Video Set", icon: "video",       color: "#7C3AED" },
  article:        { label: "Makale",    icon: "file-text",   color: "#059669" },
};

function ActivityMonthChart({ byMonth }: { byMonth: { yr: number; mo: number; total: number }[] }) {
  const colors = useColors();
  const now = new Date();
  const months: { label: string; total: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const yr = d.getFullYear(); const mo = d.getMonth() + 1;
    const found = byMonth.find(b => b.yr === yr && b.mo === mo);
    months.push({ label: MONTH_TR[mo - 1]!, total: found ? found.total : 0 });
  }
  const maxVal = Math.max(...months.map(m => m.total), 1);
  const barH = 80; const gap = 4; const barW = 18;
  const totalW = months.length * (barW + gap);
  return (
    <View>
      <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Son 12 Ay Aktivite</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Svg width={totalW} height={barH + 22}>
          {months.map((m, i) => {
            const h = Math.max(3, Math.round((m.total / maxVal) * barH));
            const x = i * (barW + gap); const y = barH - h;
            return (
              <G key={i}>
                <Rect x={x} y={y} width={barW} height={h} rx={3} fill={m.total > 0 ? "#0057B8" : colors.border} />
                <SvgText x={x + barW / 2} y={barH + 16} textAnchor="middle" fontSize={8} fontFamily="Inter_400Regular" fill={colors.mutedForeground}>{m.label}</SvgText>
                {m.total > 0 ? (
                  <SvgText x={x + barW / 2} y={y - 3} textAnchor="middle" fontSize={8} fontFamily="Inter_600SemiBold" fill={colors.primary}>{m.total}</SvgText>
                ) : null}
              </G>
            );
          })}
        </Svg>
      </ScrollView>
    </View>
  );
}

function ActivityTypeDonut({ totals }: { totals: ActivityData["totals"] }) {
  const colors = useColors();
  const entries = [
    { key: "chapter",  val: totals.chapters },
    { key: "video",    val: totals.videos },
    { key: "videoset", val: totals.videoSetEntries },
    { key: "article",  val: totals.articles },
  ].filter(e => e.val > 0);
  const total = entries.reduce((s, e) => s + e.val, 0);
  if (total === 0) return null;
  const R = 32; const cx = 48; const cy = 48; const sw = 14;
  const circ = 2 * Math.PI * R;
  let cumPct = 0;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
      <Svg width={96} height={96}>
        <Circle cx={cx} cy={cy} r={R} fill="none" stroke={colors.border} strokeWidth={sw} />
        {entries.map(e => {
          const pct = e.val / total;
          const dash = pct * circ;
          const offset = -cumPct * circ;
          cumPct += pct;
          return (
            <Circle
              key={e.key}
              cx={cx} cy={cy} r={R}
              fill="none"
              stroke={TYPE_META[e.key]!.color}
              strokeWidth={sw}
              strokeDasharray={`${dash} ${circ}`}
              strokeDashoffset={offset}
              rotation={-90}
              originX={cx}
              originY={cy}
            />
          );
        })}
        <SvgText x={cx} y={cy + 5} textAnchor="middle" fontSize={14} fontFamily="Inter_700Bold" fill={colors.foreground}>{String(total)}</SvgText>
      </Svg>
      <View style={{ gap: 7, flex: 1 }}>
        {entries.map(e => (
          <View key={e.key} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: TYPE_META[e.key]!.color }} />
            <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.foreground, flex: 1 }}>{TYPE_META[e.key]!.label}</Text>
            <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>{e.val}</Text>
            <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground, minWidth: 28, textAlign: "right" }}>{Math.round((e.val / total) * 100)}%</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function ActivityView({ activity }: { activity: ActivityData }) {
  const colors = useColors();
  const card = {
    backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1,
    borderRadius: colors.radius, padding: 14,
  };

  const tiles = [
    { key: "chapters",        label: "Bölüm",     val: activity.totals.chapters,         icon: "book-open" as const,   color: "#0057B8" },
    { key: "videos",          label: "Video",     val: activity.totals.videos,           icon: "play-circle" as const, color: "#D97706" },
    { key: "videoSetEntries", label: "Video Set", val: activity.totals.videoSetEntries,  icon: "video" as const,       color: "#7C3AED" },
    { key: "articles",        label: "Makale",    val: activity.totals.articles,         icon: "file-text" as const,   color: "#059669" },
  ];

  return (
    <View style={{ gap: 14 }}>
      {/* Tiles */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {tiles.map(t => (
          <View key={t.key} style={[card, { flexBasis: "48%", flexGrow: 1, alignItems: "center", paddingVertical: 18 }]}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.color + "18", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
              <Feather name={t.icon} size={18} color={t.color} />
            </View>
            <Text style={{ fontSize: 22, fontFamily: "Inter_700Bold", color: colors.foreground }}>{t.val}</Text>
            <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 2 }}>{t.label}</Text>
          </View>
        ))}
      </View>

      {/* Summary */}
      <View style={card}>
        <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>Aktivite Özeti</Text>
        <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
          {[
            { label: "Aktif Gün",   val: String(activity.activeDays),                                                                          icon: "calendar" as const },
            { label: "İlk Erişim",  val: activity.firstActivity ? new Date(activity.firstActivity).toLocaleDateString("tr-TR") : "—",          icon: "clock" as const },
            { label: "Son Erişim",  val: activity.lastActivity  ? new Date(activity.lastActivity).toLocaleDateString("tr-TR")  : "—",          icon: "activity" as const },
          ].map((s, i) => (
            <View key={i} style={{ alignItems: "center" }}>
              <Feather name={s.icon} size={16} color={colors.primary} />
              <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: colors.foreground, marginTop: 6 }}>{s.val}</Text>
              <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 2 }}>{s.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Monthly chart */}
      {activity.byMonth.length > 0 ? (
        <View style={card}>
          <ActivityMonthChart byMonth={activity.byMonth} />
        </View>
      ) : null}

      {/* Donut */}
      {(activity.totals.chapters + activity.totals.videos + activity.totals.videoSetEntries + activity.totals.articles) > 0 ? (
        <View style={card}>
          <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>İçerik Dağılımı</Text>
          <ActivityTypeDonut totals={activity.totals} />
        </View>
      ) : null}

      {/* Recent items */}
      {activity.recent.length > 0 ? (
        <View style={card}>
          <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>Son Açılan İçerikler</Text>
          {activity.recent.map((item, i) => {
            const meta = TYPE_META[item.type] ?? TYPE_META["chapter"]!;
            return (
              <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 8, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border }}>
                <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: meta.color + "18", alignItems: "center", justifyContent: "center", marginTop: 1 }}>
                  <Feather name={meta.icon} size={13} color={meta.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: colors.foreground }} numberOfLines={2}>{item.title}</Text>
                  <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 2 }}>
                    {meta.label} · {item.platform} · {new Date(item.date).toLocaleDateString("tr-TR")}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
