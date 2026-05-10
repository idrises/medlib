import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
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

import { SourceCarousel } from "@/components/SourceCarousel";
import { VideoPlayer } from "@/components/VideoPlayer";
import { useApp } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import { api, ApiVideo, ApiVideoEntry, openedApi } from "@/services/api";

const ACCENT = "#F59E0B";
const BG = "#0B1220";
const SURFACE = "#111827";
const SURFACE_2 = "#1F2937";
const FG = "#F9FAFB";
const MUTED = "rgba(249,250,251,0.65)";

type VideoData =
  | { kind: "book"; data: ApiVideo }
  | { kind: "entry"; data: ApiVideoEntry };

export default function VideoDetailScreen() {
  const params = useLocalSearchParams<{ videoId: string; kind?: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { addActivity, addDownload, removeDownload, isDownloaded } = useApp();
  const { token } = useAuth();
  const [downloading, setDownloading] = useState(false);
  const [videoData, setVideoData] = useState<VideoData | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [videoId, setVideoId] = useState<string>(params.videoId!);
  const [kind, setKind] = useState<string | undefined>(params.kind);

  const topPad = Platform.OS === "web" ? 24 : insets.top + 8;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom + 16;

  useEffect(() => {
    const load = async () => {
      try {
        if (kind === "entry") {
          const entry = await api.getVideoSetEntry(videoId!);
          setVideoData({ kind: "entry", data: entry });
          addActivity({
            contentType: "videoset_video",
            contentId: videoId!,
            title: entry.Title,
            subtitle: (entry as any).SetName ?? "",
          });
          if (token) {
            // Use the entry-specific endpoint so the ID is recorded in
            // MatchedVideoSetEntryID. /opened/video would put it in
            // MatchedVideoID, which then comes back from /me/activity as a
            // bogus type='video' row that 404s when tapped.
            openedApi.videosetEntry(token, {
              contentId: videoId!,
              parentSetId: (entry as any).VideoSetID,
              title: entry.Title,
              subtitle: (entry as any).SetName ?? "",
              referencePrimary: (entry as any).SetName ?? "",
              sourceScreen: "VideoSetEntryDetail",
              platform: Platform.OS,
            });
          }
        } else {
          const bookVideo = await api.getVideo(videoId!);
          setVideoData({ kind: "book", data: bookVideo });
          addActivity({
            contentType: "video",
            contentId: videoId!,
            title: bookVideo.Title,
            subtitle: bookVideo.BookTitle,
          });
          if (token) {
            openedApi.video(token, {
              contentId: videoId!,
              title: bookVideo.Title,
              subtitle: bookVideo.BookTitle,
              referencePrimary: bookVideo.BookTitle,
              sourceScreen: "VideoDetail",
              platform: Platform.OS,
            });
          }
        }
      } catch {
        setVideoData(null);
      } finally {
        setInitialLoading(false);
      }
    };
    if (videoId) load();
  }, [videoId, kind]);

  const downloaded = isDownloaded(videoId!);

  const handleDownload = async () => {
    if (downloaded) {
      removeDownload(videoId!);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return;
    }
    const title = videoData ? videoData.data.Title : videoId!;
    setDownloading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await new Promise((res) => setTimeout(res, 1500));
    addDownload({
      videoId: videoId!,
      kind: kind === "entry" ? "entry" : "book",
      title,
      localUri: "",
      size: Math.floor(Math.random() * 500 + 100) * 1024 * 1024,
      timestamp: Date.now(),
    });
    setDownloading(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  if (initialLoading && !videoData) {
    return (
      <View style={[styles.center, { backgroundColor: BG }]}>
        <ActivityIndicator size="large" color={ACCENT} />
      </View>
    );
  }

  if (!videoData) {
    return (
      <View style={[styles.container, { paddingTop: topPad }]}>
        <Pressable style={styles.pillBtn} onPress={() => router.back()}>
          <Feather name="chevron-left" size={18} color={FG} />
          <Text style={styles.pillText}>Close</Text>
        </Pressable>
        <View style={[styles.center, { flex: 1 }]}>
          <Feather name="alert-triangle" size={48} color={MUTED} />
          <Text style={{ color: MUTED, marginTop: 12, fontFamily: "Inter_400Regular" }}>
            Video not found
          </Text>
        </View>
      </View>
    );
  }

  const isBookVideo = videoData.kind === "book";
  const data = videoData.data;
  const title = data.Title;
  const author = data.Author;
  const videoUrl = data.videoUrl ?? null;
  const imageUrl = data.imageUrl ?? null;
  const sourceLabel = isBookVideo ? "Book / Journal" : "Video Set";
  const sourceTitle = isBookVideo
    ? (data as ApiVideo).BookTitle ?? ""
    : (data as any).SetName ?? "";

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingTop: topPad, paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <Pressable style={styles.pillBtn} onPress={() => router.back()} hitSlop={8}>
            <Feather name="chevron-left" size={18} color={FG} />
            <Text style={styles.pillText}>Close</Text>
          </Pressable>
          <Pressable
            style={[styles.pillBtn, downloading && { opacity: 0.6 }]}
            onPress={handleDownload}
            disabled={downloading}
            hitSlop={8}
          >
            {downloading ? (
              <ActivityIndicator size="small" color={FG} />
            ) : (
              <Feather
                name={downloaded ? "check-circle" : "download"}
                size={16}
                color={downloaded ? "#22C55E" : FG}
              />
            )}
            <Text style={[styles.pillText, downloaded && { color: "#22C55E" }]}>
              {downloaded ? "Downloaded" : "Download"}
            </Text>
          </Pressable>
        </View>

        <Text style={styles.nowLabel}>PLAYING NOW</Text>
        <Text style={styles.title} numberOfLines={4}>
          {title}
        </Text>

        <View style={styles.playerWrap}>
          <VideoPlayer
            videoId={videoId!}
            videoUrl={videoUrl || ""}
            title={title}
            thumbnailUrl={imageUrl || undefined}
          />
        </View>

        {sourceTitle ? (
          <View style={styles.detailsCard}>
            <Text style={styles.detailsHeader}>Video details</Text>
            <View style={styles.detailsInner}>
              <View style={styles.detailsIcon}>
                <Feather
                  name={isBookVideo ? "book-open" : "video"}
                  size={20}
                  color={ACCENT}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailsLabel}>{sourceLabel}</Text>
                <Text style={styles.detailsTitle} numberOfLines={3}>
                  {sourceTitle}
                </Text>
                {author ? (
                  <Text style={styles.detailsAuthor} numberOfLines={3}>
                    {author}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>
        ) : null}

        <SourceCarousel
          currentId={videoId!}
          variant="dark"
          onChange={(it) => {
            if (it.type === "article") {
              router.replace(`/articles/${it.id}` as never);
              return;
            }
            setVideoId(it.id);
            setKind(it.kind === "entry" ? "entry" : undefined);
          }}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  pillBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: SURFACE_2,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  pillText: { color: FG, fontFamily: "Inter_600SemiBold", fontSize: 14 },
  nowLabel: {
    color: ACCENT,
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    letterSpacing: 1.2,
    paddingHorizontal: 20,
    marginBottom: 6,
  },
  title: {
    color: FG,
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    lineHeight: 28,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  playerWrap: {
    marginHorizontal: 16,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  detailsCard: {
    marginTop: 18,
    marginHorizontal: 16,
    padding: 14,
    borderRadius: 14,
    backgroundColor: SURFACE,
  },
  detailsHeader: {
    color: FG,
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    marginBottom: 10,
  },
  detailsInner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: SURFACE_2,
    padding: 12,
    borderRadius: 12,
  },
  detailsIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: ACCENT + "20",
    alignItems: "center",
    justifyContent: "center",
  },
  detailsLabel: {
    color: MUTED,
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    marginBottom: 2,
  },
  detailsTitle: {
    color: FG,
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    lineHeight: 19,
  },
  detailsAuthor: {
    color: MUTED,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
});
