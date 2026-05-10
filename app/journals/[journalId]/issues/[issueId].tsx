import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ContentActionBar } from "@/components/ContentActionBar";
import { useApp } from "@/contexts/AppContext";
import { useSourceList } from "@/contexts/SourceListContext";
import { api, ApiArticleListItem, ApiJournalIssue } from "@/services/api";
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

export default function IssueDetailScreen() {
  const { journalId, issueId } = useLocalSearchParams<{ journalId: string; issueId: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { addActivity } = useApp();
  const { setSource } = useSourceList();

  const [articles, setArticles] = useState<ApiArticleListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const coverColor = pickColor(journalId ?? "0");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.getIssueArticles(issueId!, 1, 50);
        setArticles(res.data);
        setTotal(res.total);
        setPage(1);
      } catch (e) {
        console.warn("Issue articles fetch error", e);
      } finally {
        setLoading(false);
      }
    };
    if (issueId) load();
  }, [issueId]);

  const handleArticlePress = (article: ApiArticleListItem) => {
    addActivity({
      contentType: "article",
      contentId: article.ArticleID,
      title: article.Title,
      subtitle: article.Author,
    });
    setSource(
      "Bu Sayıdaki Diğer Makaleler",
      articles.map((a) => ({
        id: a.ArticleID,
        type: "article" as const,
        title: a.Title,
        subtitle: a.JournalName ?? a.IssueTitle ?? "",
        thumbUrl: null,
        pdfUrl: a.pdfUrl ?? null,
      })),
    );
    router.push(`/articles/${article.ArticleID}` as never);
  };

  const loadMore = async () => {
    if (loading || articles.length >= total) return;
    const nextPage = page + 1;
    setLoading(true);
    try {
      const res = await api.getIssueArticles(issueId!, nextPage, 50);
      setArticles(prev => [...prev, ...res.data]);
      setPage(nextPage);
    } catch (e) {
      console.warn("Load more articles error", e);
    } finally {
      setLoading(false);
    }
  };

  const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
      paddingTop: topPad + 8, paddingHorizontal: 20, paddingBottom: 20,
      backgroundColor: coverColor,
    },
    issueName: { fontSize: 13, color: "rgba(255,255,255,0.8)", fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5 },
    journalName: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#FFF", marginTop: 2, lineHeight: 26 },
    issueMeta: { fontSize: 13, color: "rgba(255,255,255,0.8)", fontFamily: "Inter_400Regular", marginTop: 4 },
    articleCard: {
      backgroundColor: colors.card,
      marginHorizontal: 20, marginVertical: 6,
      borderRadius: colors.radius, padding: 14,
      shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
    },
    articleTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.foreground, lineHeight: 22, marginBottom: 6 },
    authors: { fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginBottom: 6 },
    metaRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
    metaBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 4 },
    metaText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  });

  return (
    <View style={styles.container}>
      <FlatList
        data={articles}
        keyExtractor={a => a.ArticleID}
        contentContainerStyle={{ paddingTop: 12, paddingBottom: bottomPad + 80 }}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <Pressable onPress={() => router.back()} hitSlop={8}>
                <Feather name="arrow-left" size={24} color="#FFF" />
              </Pressable>
              <ContentActionBar
                compact iconColor="rgba(255,255,255,0.85)"
                contentType="journal" contentId={issueId!}
                title={`Issue ${issueId}`}
              />
            </View>
            <Text style={styles.issueName}>Journal Issue</Text>
            <Text style={styles.journalName}>{total} Articles</Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <Pressable
            style={({ pressed }) => [styles.articleCard, pressed && { opacity: 0.75 }]}
            onPress={() => handleArticlePress(item)}
          >
            <Text style={{ fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_500Medium", marginBottom: 4 }}>
              ARTICLE {index + 1}
              {item.DOI ? ` · DOI: ${item.DOI.slice(0, 20)}...` : ""}
            </Text>
            <Text style={styles.articleTitle}>{item.Title}</Text>
            {item.Author ? (
              <Text style={styles.authors} numberOfLines={1}>{item.Author}</Text>
            ) : null}
            <View style={styles.metaRow}>
              {item.PdfLink ? (
                <View style={[styles.metaBadge, { backgroundColor: "#0057B8" + "15" }]}>
                  <Feather name="file" size={12} color="#0057B8" />
                  <Text style={[styles.metaText, { color: "#0057B8" }]}>PDF</Text>
                </View>
              ) : null}
              {item.DOI ? (
                <View style={[styles.metaBadge, { backgroundColor: colors.muted }]}>
                  <Feather name="external-link" size={12} color={colors.mutedForeground} />
                  <Text style={[styles.metaText, { color: colors.mutedForeground }]}>DOI</Text>
                </View>
              ) : null}
            </View>
          </Pressable>
        )}
        ListFooterComponent={
          loading ? <ActivityIndicator color={colors.primary} style={{ paddingVertical: 16 }} /> : null
        }
        ListEmptyComponent={
          !loading ? (
            <View style={{ alignItems: "center", paddingTop: 40 }}>
              <Feather name="file-text" size={40} color={colors.mutedForeground} />
              <Text style={{ color: colors.mutedForeground, marginTop: 8, fontFamily: "Inter_400Regular" }}>
                No articles in this issue
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}
