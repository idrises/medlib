import { Feather } from "@expo/vector-icons";
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
import { useApp } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import { api, ApiChapterFull, openedApi } from "@/services/api";
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

export default function ChapterDetailScreen() {
  const { chapterId } = useLocalSearchParams<{ chapterId: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { addActivity } = useApp();
  const { token } = useAuth();

  const [chapter, setChapter] = useState<ApiChapterFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfVisible, setPdfVisible] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const coverColor = chapter ? pickColor(chapter.BookID) : "#008080";

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await api.getChapter(chapterId!);
        setChapter(data);
        addActivity({
          contentType: "chapter",
          contentId: chapterId!,
          title: data.Title,
          subtitle: data.BookTitle,
        });
        if (token) {
          openedApi.chapter(token, {
            contentId: chapterId!,
            bookId: data.BookID,
            title: data.Title,
            subtitle: data.BookTitle,
            referencePrimary: data.BookTitle,
            sourceScreen: "ChapterDetail",
            platform: Platform.OS,
          });
        }
      } catch (e) {
        console.warn("Chapter fetch error", e);
      } finally {
        setLoading(false);
      }
    };
    if (chapterId) load();
  }, [chapterId]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color="#008080" />
      </View>
    );
  }

  if (!chapter) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: "#999" }}>Chapter not found</Text>
      </View>
    );
  }

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingTop: topPad + 8, paddingHorizontal: 20, paddingBottom: 20,
      backgroundColor: coverColor,
    },
    bookName: { fontSize: 12, color: "rgba(255,255,255,0.75)", fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.5 },
    chTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#FFF", lineHeight: 28, marginTop: 4 },
    chMeta: { fontSize: 13, color: "rgba(255,255,255,0.8)", fontFamily: "Inter_400Regular", marginTop: 4 },
    section: { margin: 20 },
    sectionTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: colors.foreground, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
    divider: { height: 1, backgroundColor: colors.border, marginHorizontal: 20 },
    actionBtn: {
      flexDirection: "row", alignItems: "center", gap: 8,
      paddingHorizontal: 16, paddingVertical: 12,
      borderRadius: colors.radius, marginHorizontal: 20, marginBottom: 12,
    },
  });

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: bottomPad + 80 }}>
        <View style={styles.header}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <Feather name="arrow-left" size={24} color="#FFF" />
            </Pressable>
            <ContentActionBar
              compact iconColor="rgba(255,255,255,0.85)"
              contentType="chapter" contentId={chapterId!}
              title={chapter.Title} subtitle={chapter.BookTitle}
              pdfUrl={chapter.pdfUrl || undefined}
            />
          </View>
          <Text style={styles.bookName}>{chapter.BookTitle}</Text>
          <Text style={styles.chTitle}>{chapter.Title}</Text>
          {chapter.Editors ? (
            <Text style={styles.chMeta}>{chapter.Editors}</Text>
          ) : null}
        </View>

        {chapter.pdfUrl ? (
          <View style={{ marginTop: 16 }}>
            <Pressable
              style={({ pressed }) => [styles.actionBtn, { backgroundColor: coverColor + "15", opacity: pressed ? 0.7 : 1 }]}
              onPress={() => setPdfVisible(true)}
            >
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: coverColor + "20", alignItems: "center", justifyContent: "center" }}>
                <Feather name="file" size={18} color={coverColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: coverColor }}>Full Text PDF</Text>
                {chapter.SizeText ? (
                  <Text style={{ fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular" }}>{chapter.SizeText}</Text>
                ) : null}
              </View>
              <Feather name="external-link" size={16} color={coverColor} />
            </Pressable>
          </View>
        ) : null}

        <View style={styles.divider} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Book</Text>
          <Pressable
            onPress={() => router.push(`/books/${chapter.BookID}` as never)}
            style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 10, opacity: pressed ? 0.7 : 1 }]}
          >
            <View style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: coverColor + "20", alignItems: "center", justifyContent: "center" }}>
              <Feather name="book" size={20} color={coverColor} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>{chapter.BookTitle}</Text>
              {chapter.Publisher ? (
                <Text style={{ fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular" }}>{chapter.Publisher}</Text>
              ) : null}
            </View>
            <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
          </Pressable>
        </View>

        <View style={styles.divider} />

        {chapter.Editors ? (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Authors / Editors</Text>
              <Text style={{ fontSize: 14, color: colors.foreground, fontFamily: "Inter_400Regular", lineHeight: 22 }}>
                {chapter.Editors}
              </Text>
            </View>
            <View style={styles.divider} />
          </>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Publication Info</Text>
          <Text style={{ fontSize: 14, color: colors.foreground, fontFamily: "Inter_400Regular", lineHeight: 22 }}>
            {chapter.BookTitle}
            {chapter.YearText ? `\nYear: ${chapter.YearText}` : ""}
            {chapter.ISBN ? `\nISBN: ${chapter.ISBN}` : ""}
          </Text>
        </View>
      </ScrollView>

      {chapter.pdfUrl && (
        <PDFViewerModal
          visible={pdfVisible}
          url={chapter.pdfUrl}
          title={chapter.Title}
          onClose={() => setPdfVisible(false)}
        />
      )}
    </View>
  );
}
