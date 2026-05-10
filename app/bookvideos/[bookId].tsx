import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/contexts/AppContext";
import { useSourceList } from "@/contexts/SourceListContext";
import { api, ApiVideo } from "@/services/api";
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

export default function BookVideosScreen() {
  const { bookId } = useLocalSearchParams<{ bookId: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { addActivity } = useApp();
  const { setSource } = useSourceList();

  const [videos, setVideos] = useState<ApiVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookTitle, setBookTitle] = useState("");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const coverColor = pickColor(bookId ?? "0");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.getBookVideos(bookId!);
        setVideos(res.data);
        if (res.data.length > 0 && res.data[0].BookTitle) {
          setBookTitle(res.data[0].BookTitle ?? "");
        }
      } catch (e) {
        console.warn("Book videos fetch error", e);
      } finally {
        setLoading(false);
      }
    };
    if (bookId) load();
  }, [bookId]);

  const handleVideoPress = (video: ApiVideo) => {
    addActivity({ contentType: "video", contentId: video.VideoID, title: video.Title, subtitle: bookTitle });
    setSource(
      "Bu Kitabın Videoları",
      videos.map((v) => ({
        id: v.VideoID,
        type: "video" as const,
        kind: "book" as const,
        title: v.Title,
        subtitle: v.BookTitle ?? bookTitle,
        thumbUrl: v.imageUrl ?? null,
        videoUrl: v.videoUrl ?? null,
      })),
    );
    router.push(`/videos/${video.VideoID}` as never);
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingTop: topPad + 8, paddingHorizontal: 20, paddingBottom: 20,
      backgroundColor: coverColor,
    },
    bookName: { fontSize: 12, color: "rgba(255,255,255,0.75)", fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.5 },
    title: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#FFF", marginTop: 4, lineHeight: 28 },
    count: { fontSize: 13, color: "rgba(255,255,255,0.8)", fontFamily: "Inter_400Regular", marginTop: 4 },
    videoCard: {
      backgroundColor: colors.card,
      marginHorizontal: 20, marginVertical: 6,
      borderRadius: colors.radius, padding: 14,
      flexDirection: "row", alignItems: "center", gap: 12,
      shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
    },
    videoIcon: { width: 56, height: 56, borderRadius: 10, alignItems: "center", justifyContent: "center", overflow: "hidden" },
    videoTitle: { flex: 1, fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.foreground, lineHeight: 20 },
    videoMeta: { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 2 },
  });

  return (
    <View style={styles.container}>
      <FlatList
        data={videos}
        keyExtractor={v => v.VideoID}
        contentContainerStyle={{ paddingTop: 12, paddingBottom: bottomPad + 80 }}
        ListHeaderComponent={
          <View style={[styles.header, { marginHorizontal: 0, marginBottom: 0 }]}>
            <Pressable onPress={() => router.back()} hitSlop={8} style={{ marginBottom: 12 }}>
              <Feather name="arrow-left" size={24} color="#FFF" />
            </Pressable>
            {bookTitle ? <Text style={styles.bookName}>{bookTitle}</Text> : null}
            <Text style={styles.title}>Book Videos</Text>
            <Text style={styles.count}>{loading ? "Loading..." : `${videos.length} videos`}</Text>
          </View>
        }
        ListFooterComponent={
          loading ? <ActivityIndicator color={colors.primary} style={{ paddingVertical: 20 }} /> : null
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.videoCard, pressed && { opacity: 0.75 }]}
            onPress={() => handleVideoPress(item)}
          >
            <View style={[styles.videoIcon, { backgroundColor: coverColor + "20" }]}>
              {item.imageUrl ? (
                <Image
                  source={{ uri: item.imageUrl }}
                  style={{ width: 56, height: 56 }}
                  resizeMode="cover"
                  onError={() => {}}
                />
              ) : (
                <Feather name="play-circle" size={26} color={coverColor} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.videoTitle} numberOfLines={2}>{item.Title}</Text>
              {item.Author ? (
                <Text style={styles.videoMeta} numberOfLines={1}>{item.Author}</Text>
              ) : null}
              {item.Subject ? (
                <Text style={styles.videoMeta}>{item.Subject}</Text>
              ) : null}
            </View>
            <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
          </Pressable>
        )}
        ListEmptyComponent={
          !loading ? (
            <View style={{ alignItems: "center", paddingTop: 40 }}>
              <Feather name="play-circle" size={40} color={colors.mutedForeground} />
              <Text style={{ color: colors.mutedForeground, marginTop: 8, fontFamily: "Inter_400Regular" }}>
                No videos for this book
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}
