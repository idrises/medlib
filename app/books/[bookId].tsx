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
import { api, ApiBookFull, ApiChapter, ApiVideo } from "@/services/api";
import { useColors } from "@/hooks/useColors";
import { Image } from "expo-image";

const PALETTE = [
  "#0057B8", "#008080", "#6D28D9", "#D97706", "#DC2626",
  "#059669", "#7C3AED", "#DB2777", "#0891B2", "#65A30D",
];
function pickColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export default function BookDetailScreen() {
  const { bookId } = useLocalSearchParams<{ bookId: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { addActivity } = useApp();
  const { setSource } = useSourceList();

  const [book, setBook] = useState<ApiBookFull | null>(null);
  const [videos, setVideos] = useState<ApiVideo[]>([]);
  const [loading, setLoading] = useState(true);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const coverColor = book ? pickColor(book.BookID) : "#0057B8";

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [data, vidRes] = await Promise.all([
          api.getBook(bookId!),
          api.getBookVideos(bookId!).catch(() => ({ data: [] as ApiVideo[] })),
        ]);
        setBook(data);
        setVideos(vidRes.data || []);
        addActivity({ contentType: "book", contentId: bookId!, title: data.Title });
      } catch (e) {
        console.warn("Book fetch error", e);
      } finally {
        setLoading(false);
      }
    };
    if (bookId) load();
  }, [bookId]);

  const handleChapterPress = (chapter: ApiChapter, index: number) => {
    addActivity({
      contentType: "chapter",
      contentId: chapter.ChapterID,
      title: chapter.Title,
      subtitle: book?.Title,
    });
    router.push(`/chapters/${chapter.ChapterID}` as never);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color="#0057B8" />
      </View>
    );
  }

  if (!book) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: "#999" }}>Book not found</Text>
      </View>
    );
  }

  const styles = StyleSheet.create({
    container: { flex: 1 },
    hero: {
      paddingTop: topPad + 8,
      paddingHorizontal: 20,
      paddingBottom: 28,
      backgroundColor: coverColor,
    },
    bookMeta: { fontSize: 12, color: "rgba(255,255,255,0.75)", fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.5 },
    bookTitle: { fontSize: 24, fontFamily: "Inter_700Bold", color: "#FFF", lineHeight: 32, marginTop: 6 },
    authors: { fontSize: 14, color: "rgba(255,255,255,0.85)", fontFamily: "Inter_400Regular", marginTop: 6 },
    statsRow: { flexDirection: "row", gap: 8, marginTop: 16, flexWrap: "wrap" },
    statChip: {
      flexDirection: "row", alignItems: "center", gap: 5,
      paddingHorizontal: 10, paddingVertical: 6,
      backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 8,
    },
    statText: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#FFF" },
    sectionTitle: {
      fontSize: 18, fontFamily: "Inter_700Bold",
      color: "#666", margin: 20, marginBottom: 10,
    },
    chapterCard: {
      backgroundColor: "#fff",
      marginHorizontal: 20, marginVertical: 5,
      borderRadius: 12,
      padding: 14,
      flexDirection: "row", alignItems: "center", gap: 12,
      shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
    },
    chNum: {
      width: 36, height: 36, borderRadius: 8,
      backgroundColor: coverColor + "20",
      alignItems: "center", justifyContent: "center",
    },
    chNumText: { fontSize: 13, fontFamily: "Inter_700Bold", color: coverColor },
    chTitle: { flex: 1, fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#111", lineHeight: 20 },
    chAuthors: { fontSize: 12, color: "#999", fontFamily: "Inter_400Regular", marginTop: 2 },
    videoCard: {
      width: 200, marginLeft: 12,
      backgroundColor: "#fff", borderRadius: 12, overflow: "hidden",
      shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2,
    },
    videoThumb: { width: "100%", height: 112, backgroundColor: "#eee" },
    videoTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#111", padding: 10, paddingBottom: 4, lineHeight: 18 },
    videoMeta: { fontSize: 11, color: "#888", fontFamily: "Inter_400Regular", paddingHorizontal: 10, paddingBottom: 10 },
  });

  return (
    <View style={styles.container}>
      <FlatList
        data={book.chapters}
        keyExtractor={c => c.ChapterID}
        contentContainerStyle={{ paddingBottom: bottomPad + 80 }}
        ListHeaderComponent={
          <>
            <View style={styles.hero}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <Pressable onPress={() => router.back()} hitSlop={8}>
                  <Feather name="arrow-left" size={24} color="#FFF" />
                </Pressable>
                <ContentActionBar
                  compact iconColor="rgba(255,255,255,0.85)"
                  contentType="book" contentId={bookId!}
                  title={book.Title} subtitle={book.Editors}
                />
              </View>
              <Text style={styles.bookMeta}>{book.Subject} · {book.Publisher} · {book.YearText}</Text>
              <Text style={styles.bookTitle}>{book.Title}</Text>
              {book.Editors ? (
                <Text style={styles.authors}>{book.Editors} (Ed.)</Text>
              ) : null}
              <View style={styles.statsRow}>
                <View style={styles.statChip}>
                  <Feather name="book-open" size={13} color="#FFF" />
                  <Text style={styles.statText}>{book.chapters.length} Chapters</Text>
                </View>
                {book.ISBNPrint || book.ISBNOnline ? (
                  <View style={styles.statChip}>
                    <Feather name="hash" size={13} color="#FFF" />
                    <Text style={styles.statText}>ISBN {(book.ISBNPrint || book.ISBNOnline).slice(-4)}</Text>
                  </View>
                ) : null}
              </View>
            </View>
            <View style={{ height: 1, backgroundColor: "#eee", marginHorizontal: 20 }} />
            {videos.length > 0 ? (
              <>
                <Text style={styles.sectionTitle}>Videos ({videos.length})</Text>
                <FlatList
                  data={videos}
                  keyExtractor={v => v.VideoID}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingRight: 12, paddingBottom: 8 }}
                  renderItem={({ item }) => (
                    <Pressable
                      style={({ pressed }) => [styles.videoCard, pressed && { opacity: 0.8 }]}
                      onPress={() => {
                        addActivity({
                          contentType: "video",
                          contentId: item.VideoID,
                          title: item.Title,
                          subtitle: book?.Title,
                        });
                        setSource(
                          "Bu Kitabın Videoları",
                          videos.map((v) => ({
                            id: v.VideoID,
                            type: "video" as const,
                            kind: "book" as const,
                            title: v.Title,
                            subtitle: v.BookTitle ?? book?.Title,
                            thumbUrl: v.imageUrl ?? null,
                            videoUrl: v.videoUrl ?? null,
                          })),
                        );
                        router.push(`/videos/${item.VideoID}` as never);
                      }}
                    >
                      {item.imageUrl ? (
                        <Image source={{ uri: item.imageUrl }} style={styles.videoThumb} contentFit="cover" />
                      ) : (
                        <View style={[styles.videoThumb, { alignItems: "center", justifyContent: "center", backgroundColor: coverColor + "30" }]}>
                          <Feather name="video" size={28} color={coverColor} />
                        </View>
                      )}
                      <Text style={styles.videoTitle} numberOfLines={2}>{item.Title}</Text>
                      {item.Author ? (
                        <Text style={styles.videoMeta} numberOfLines={1}>{item.Author}</Text>
                      ) : null}
                    </Pressable>
                  )}
                />
                <View style={{ height: 1, backgroundColor: "#eee", marginHorizontal: 20, marginTop: 8 }} />
              </>
            ) : null}
            <Text style={styles.sectionTitle}>Chapters ({book.chapters.length})</Text>
          </>
        }
        renderItem={({ item, index }) => (
          <Pressable
            style={({ pressed }) => [styles.chapterCard, pressed && { opacity: 0.75 }]}
            onPress={() => handleChapterPress(item, index)}
          >
            <View style={styles.chNum}>
              <Text style={styles.chNumText}>{index + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.chTitle} numberOfLines={2}>{item.Title}</Text>
              {item.Editors ? (
                <Text style={styles.chAuthors} numberOfLines={1}>{item.Editors}</Text>
              ) : null}
            </View>
            <Feather name="chevron-right" size={16} color="#999" />
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingTop: 40 }}>
            <Text style={{ color: "#999", fontFamily: "Inter_400Regular" }}>No chapters found</Text>
          </View>
        }
      />
    </View>
  );
}
