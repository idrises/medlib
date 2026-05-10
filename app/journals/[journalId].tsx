import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ContentActionBar } from "@/components/ContentActionBar";
import { useApp } from "@/contexts/AppContext";
import { api, ApiJournalFull, ApiJournalIssue } from "@/services/api";
import { useColors } from "@/hooks/useColors";

const PALETTE = [
  "#0057B8", "#008080", "#6D28D9", "#D97706", "#DC2626",
  "#059669", "#7C3AED", "#DB2777", "#0891B2", "#65A30D",
];
function pickColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}
function abbrev(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 4).toUpperCase();
  return words.slice(0, 3).map(w => w[0]).join("").toUpperCase();
}

interface IssuesByYear {
  [year: number]: ApiJournalIssue[];
}

export default function JournalDetailScreen() {
  const { journalId } = useLocalSearchParams<{ journalId: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { addActivity } = useApp();

  const [journal, setJournal] = useState<ApiJournalFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedYear, setExpandedYear] = useState<number | null>(null);

  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const coverColor = journal ? pickColor(journal.JournalID) : "#0057B8";

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await api.getJournal(journalId!);
        setJournal(data);
        addActivity({ contentType: "journal", contentId: journalId!, title: data.JournalName });
      } catch (e) {
        console.warn("Journal fetch error", e);
      } finally {
        setLoading(false);
      }
    };
    if (journalId) load();
  }, [journalId]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color="#0057B8" />
      </View>
    );
  }

  if (!journal) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: "#999" }}>Journal not found</Text>
      </View>
    );
  }

  const issuesByYear: IssuesByYear = {};
  journal.issues.forEach(issue => {
    const year = issue.YearText
      ? parseInt(issue.YearText)
      : issue.SortDateUtc
        ? new Date(issue.SortDateUtc).getFullYear()
        : 0;
    if (!issuesByYear[year]) issuesByYear[year] = [];
    issuesByYear[year].push(issue);
  });
  const years = Object.keys(issuesByYear).map(Number).sort((a, b) => b - a);

  const handleIssuePress = (issue: ApiJournalIssue) => {
    addActivity({
      contentType: "journal",
      contentId: journalId!,
      title: journal.JournalName,
      subtitle: `Vol.${issue.Volume} No.${issue.IssueNumber}`,
    });
    router.push(`/journals/${journalId}/issues/${issue.JournalIssueID}` as never);
  };

  const styles = StyleSheet.create({
    container: { flex: 1 },
    hero: {
      paddingTop: topPad + 8, paddingHorizontal: 20, paddingBottom: 24,
      backgroundColor: coverColor,
    },
    journalAbbr: { fontSize: 48, fontFamily: "Inter_700Bold", color: "#FFF", opacity: 0.9 },
    journalTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#FFF", lineHeight: 28, marginTop: 4 },
    journalMeta: { fontSize: 14, color: "rgba(255,255,255,0.8)", fontFamily: "Inter_400Regular", marginTop: 6 },
    statsRow: { flexDirection: "row", gap: 12, marginTop: 16 },
    statBox: { flex: 1, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 8, padding: 10, alignItems: "center" },
    statNum: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#FFF" },
    statLabel: { fontSize: 11, color: "rgba(255,255,255,0.8)", fontFamily: "Inter_400Regular", marginTop: 2 },
    yearRow: {
      backgroundColor: colors.card, borderRadius: colors.radius,
      marginBottom: 8, overflow: "hidden",
      shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
    },
    yearHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14 },
    yearText: { flex: 1, fontSize: 17, fontFamily: "Inter_700Bold", color: colors.foreground },
    issueItem: {
      paddingHorizontal: 16, paddingVertical: 12,
      borderTopWidth: 1, borderTopColor: colors.border,
      flexDirection: "row", alignItems: "center",
    },
    issueInfo: { flex: 1 },
    issueTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    issueMeta: { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 2 },
  });

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: bottomPad + 80 }}>
        <View style={styles.hero}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <Feather name="arrow-left" size={24} color="#FFF" />
            </Pressable>
            <ContentActionBar
              compact iconColor="rgba(255,255,255,0.85)"
              contentType="journal" contentId={journalId!}
              title={journal.JournalName}
            />
          </View>
          <Text style={styles.journalAbbr}>{abbrev(journal.JournalName)}</Text>
          <Text style={styles.journalTitle}>{journal.JournalName}</Text>
          {journal.ISSNElectronic ? (
            <Text style={styles.journalMeta}>eISSN {journal.ISSNElectronic}</Text>
          ) : null}
          {journal.Subject ? (
            <Text style={styles.journalMeta}>{journal.Subject}</Text>
          ) : null}
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{years.length || "—"}</Text>
              <Text style={styles.statLabel}>Years</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{journal.issues.length}</Text>
              <Text style={styles.statLabel}>Issues</Text>
            </View>
          </View>
        </View>

        <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
          <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: colors.foreground, marginBottom: 12 }}>
            Issues by Year
          </Text>
          {years.length === 0 && (
            <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular" }}>No issues available</Text>
          )}
          {years.map(year => {
            const expanded = expandedYear === year;
            const issues = issuesByYear[year];
            return (
              <View key={year} style={styles.yearRow}>
                <Pressable
                  style={styles.yearHeader}
                  onPress={() => setExpandedYear(expanded ? null : year)}
                >
                  <Text style={styles.yearText}>{year || "Unknown"}</Text>
                  <Text style={{ fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginRight: 8 }}>
                    {issues.length} issue{issues.length !== 1 ? "s" : ""}
                  </Text>
                  <Feather name={expanded ? "chevron-up" : "chevron-down"} size={18} color={colors.mutedForeground} />
                </Pressable>
                {expanded && issues.map(issue => (
                  <Pressable
                    key={issue.JournalIssueID}
                    style={styles.issueItem}
                    onPress={() => handleIssuePress(issue)}
                  >
                    <View style={{ width: 36, height: 36, borderRadius: 6, backgroundColor: coverColor + "20", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                      <Feather name="layers" size={18} color={coverColor} />
                    </View>
                    <View style={styles.issueInfo}>
                      <Text style={styles.issueTitle}>
                        {issue.IssueTitle || `Vol.${issue.Volume} No.${issue.IssueNumber}`}
                      </Text>
                      <Text style={styles.issueMeta}>
                        {issue.SortDateUtc ? new Date(issue.SortDateUtc).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : ""}
                      </Text>
                    </View>
                    <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                  </Pressable>
                ))}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
