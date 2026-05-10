import { Feather } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ContentActionBar } from "@/components/ContentActionBar";
import { PDFViewerModal } from "@/components/PDFViewerModal";
import { SourceCarousel } from "@/components/SourceCarousel";
import { useApp } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import { api, ApiArticle, openedApi } from "@/services/api";
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

export default function ArticleDetailScreen() {
  const { articleId } = useLocalSearchParams<{ articleId: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { addActivity } = useApp();
  const { token } = useAuth();

  const [article, setArticle] = useState<ApiArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfVisible, setPdfVisible] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const journalColor = article ? pickColor(article.JournalID) : "#0057B8";

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await api.getArticle(articleId!);
        setArticle(data);
        addActivity({
          contentType: "article",
          contentId: articleId!,
          title: data.Title,
          subtitle: data.JournalName,
        });
        if (token) {
          openedApi.article(token, {
            contentId: articleId!,
            title: data.Title,
            subtitle: data.JournalName,
            referencePrimary: data.JournalName,
            sourceScreen: "ArticleDetail",
            platform: Platform.OS,
          });
        }
      } catch (e) {
        console.warn("Article fetch error", e);
      } finally {
        setLoading(false);
      }
    };
    if (articleId) load();
  }, [articleId]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color="#0057B8" />
      </View>
    );
  }

  if (!article) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: "#999" }}>Article not found</Text>
      </View>
    );
  }

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingTop: topPad + 8, paddingHorizontal: 20, paddingBottom: 20,
      borderBottomWidth: 1, borderBottomColor: colors.border,
      backgroundColor: colors.card,
    },
    journalBadge: {
      flexDirection: "row", alignItems: "center", gap: 6,
      paddingHorizontal: 10, paddingVertical: 5,
      borderRadius: 6, alignSelf: "flex-start", marginBottom: 10,
    },
    journalBadgeText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
    articleTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: colors.foreground, lineHeight: 28, marginBottom: 10 },
    authors: { fontSize: 14, color: colors.mutedForeground, fontFamily: "Inter_400Regular", lineHeight: 20, marginBottom: 4 },
    doi: { fontSize: 12, color: colors.primary, fontFamily: "Inter_400Regular" },
    section: { margin: 20 },
    sectionTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: colors.foreground, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
    divider: { height: 1, backgroundColor: colors.border, marginHorizontal: 20 },
    actionBtn: {
      flexDirection: "row", alignItems: "center", gap: 8,
      paddingHorizontal: 16, paddingVertical: 12,
      borderRadius: colors.radius, marginHorizontal: 20, marginBottom: 12,
    },
    actionBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  });

  const publishedDate = article.SortDateUtc
    ? new Date(article.SortDateUtc).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : "";

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: bottomPad + 80 }}>
        <View style={styles.header}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <Feather name="arrow-left" size={24} color={colors.foreground} />
            </Pressable>
            <ContentActionBar
              compact contentType="article" contentId={articleId!}
              title={article.Title} subtitle={article.JournalName}
              pdfUrl={article.pdfUrl ?? undefined}
            />
          </View>
          <View style={[styles.journalBadge, { backgroundColor: journalColor + "20" }]}>
            <Feather name="layers" size={12} color={journalColor} />
            <Text style={[styles.journalBadgeText, { color: journalColor }]}>
              {article.JournalName}
              {article.Volume ? ` · Vol.${article.Volume}` : ""}
              {article.IssueNumber ? ` No.${article.IssueNumber}` : ""}
            </Text>
          </View>
          <Text style={styles.articleTitle}>{article.Title}</Text>
          {article.Author ? (
            <Text style={styles.authors}>{article.Author}</Text>
          ) : null}
          {article.DOI ? (
            <Text style={styles.doi}>DOI: {article.DOI}</Text>
          ) : null}
          {publishedDate ? (
            <Text style={{ fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 4 }}>
              Published: {publishedDate}
            </Text>
          ) : null}
        </View>

        <SourceCarousel currentId={articleId!} />

        {article.pdfUrl ? (
          <View style={{ marginTop: 16 }}>
            <Pressable
              style={({ pressed }) => [styles.actionBtn, { backgroundColor: "#0057B8" + "15", opacity: pressed ? 0.7 : 1 }]}
              onPress={() => setPdfVisible(true)}
            >
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#0057B8" + "20", alignItems: "center", justifyContent: "center" }}>
                <Feather name="file" size={18} color="#0057B8" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.actionBtnText, { color: "#0057B8" }]}>Full Text PDF</Text>
                {article.SizeText ? (
                  <Text style={{ fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular" }}>{article.SizeText}</Text>
                ) : null}
              </View>
              <Feather name="chevron-right" size={16} color="#0057B8" />
            </Pressable>
          </View>
        ) : null}

        <View style={styles.divider} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Citation Info</Text>
          <Text style={{ fontSize: 14, color: colors.foreground, fontFamily: "Inter_400Regular", lineHeight: 22 }}>
            {article.JournalName}
            {article.Volume ? `. ${article.YearText || ""};${article.Volume}` : ""}
            {article.IssueNumber ? `(${article.IssueNumber})` : ""}
            {article.DOI ? `\nDOI: ${article.DOI}` : ""}
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Authors</Text>
          <Text style={{ fontSize: 14, color: colors.foreground, fontFamily: "Inter_400Regular", lineHeight: 24 }}>
            {article.Author || "Authors not available"}
          </Text>
        </View>

        {article.DOI ? (
          <>
            <View style={styles.divider} />
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>External Link</Text>
              <Pressable
                onPress={() => WebBrowser.openBrowserAsync(`https://doi.org/${article.DOI}`)}
                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, flexDirection: "row", alignItems: "center", gap: 6 }]}
              >
                <Feather name="external-link" size={14} color={colors.primary} />
                <Text style={{ fontSize: 14, color: colors.primary, fontFamily: "Inter_400Regular" }}>
                  doi.org/{article.DOI}
                </Text>
              </Pressable>
            </View>
          </>
        ) : null}

      </ScrollView>

      {article.pdfUrl && (
        <PDFViewerModal
          visible={pdfVisible}
          url={article.pdfUrl}
          title={article.Title}
          onClose={() => setPdfVisible(false)}
        />
      )}
    </View>
  );
}
