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

import { ContentActionBar } from "@/components/ContentActionBar";
import { useApp } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import { useSourceList } from "@/contexts/SourceListContext";
import { api, ApiVideoSetFull, ApiVideoEntry, openedApi } from "@/services/api";
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
function fmtDuration(sec: number): string {
  if (!sec) return "";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function VideoSetDetailScreen() {
  const { videoSetId } = useLocalSearchParams<{ videoSetId: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { addActivity } = useApp();
  const { token } = useAuth();
  const { setSource } = useSourceList();

  const [videoSet, setVideoSet] = useState<ApiVideoSetFull | null>(null);
  const [loading, setLoading] = useState(true);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const coverColor = videoSet ? pickColor(videoSet.VideoSetID) : "#D97706";

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await api.getVideoSet(videoSetId!);
        setVideoSet(data);
        addActivity({ contentType: "videoset", contentId: videoSetId!, title: data.SetName });
        if (token) {
          openedApi.videoset(token, {
            contentId: videoSetId!,
            title: data.SetName,
            subtitle: data.Editors,
            referencePrimary: data.SetName,
            sourceScreen: "VideoSetDetail",
            platform: Platform.OS,
          });
        }
      } catch (e) {
        console.warn("VideoSet fetch error", e);
      } finally {
        setLoading(false);
      }
    };
    if (videoSetId) load();
  }, [videoSetId]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color="#D97706" />
      </View>
    );
  }

  if (!videoSet) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: "#999" }}>Video set not found</Text>
      </View>
    );
  }

  const handleEntryPress = (entry: ApiVideoEntry) => {
    addActivity({ contentType: "videoset_video", contentId: entry.VideoSetEntryID, title: entry.Title, subtitle: videoSet.SetName });
    setSource(
      `Bu Video Setinden`,
      (videoSet.entries ?? []).map((e) => ({
        id: e.VideoSetEntryID,
        type: "video" as const,
        kind: "entry" as const,
        title: e.Title,
        subtitle: videoSet.SetName,
        thumbUrl: e.imageUrl ?? null,
        videoUrl: e.videoUrl ?? null,
      })),
    );
    router.push(`/videos/${entry.VideoSetEntryID}?kind=entry` as never);
  };

  const styles = StyleSheet.create({
    container: { flex: 1 },
    hero: {
      paddingTop: topPad + 8, paddingHorizontal: 20, paddingBottom: 28,
      backgroundColor: coverColor,
    },
    setType: { fontSize: 12, color: "rgba(255,255,255,0.75)", fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.5 },
    setTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#FFF", lineHeight: 30, marginTop: 6 },
    setMeta: { fontSize: 13, color: "rgba(255,255,255,0.85)", fontFamily: "Inter_400Regular", marginTop: 4 },
    statsRow: { flexDirection: "row", gap: 8, marginTop: 14 },
    statChip: {
      flexDirection: "row", alignItems: "center", gap: 4,
      paddingHorizontal: 10, paddingVertical: 6,
      backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 8,
    },
    statText: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#FFF" },
    entryCard: {
      backgroundColor: colors.card,
      marginHorizontal: 20, marginVertical: 5,
      borderRadius: colors.radius, padding: 14,
      flexDirection: "row", alignItems: "center", gap: 12,
      shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
    },
    entryNum: {
      width: 40, height: 40, borderRadius: 8,
      backgroundColor: coverColor + "20",
      alignItems: "center", justifyContent: "center",
    },
    entryTitle: { flex: 1, fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.foreground, lineHeight: 20 },
    entryMeta: { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 2 },
  });

  return (
    <View style={styles.container}>
      <FlatList
        data={videoSet.entries}
        keyExtractor={e => e.VideoSetEntryID}
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
                  contentType="videoset" contentId={videoSetId!}
                  title={videoSet.SetName} subtitle={videoSet.Editors}
                />
              </View>
              <Text style={styles.setType}>{videoSet.Subject}</Text>
              <Text style={styles.setTitle}>{videoSet.SetName}</Text>
              {videoSet.Editors ? (
                <Text style={styles.setMeta}>{videoSet.Editors}</Text>
              ) : null}
              <View style={styles.statsRow}>
                <View style={styles.statChip}>
                  <Feather name="play-circle" size={13} color="#FFF" />
                  <Text style={styles.statText}>{videoSet.entries.length} Videos</Text>
                </View>
              </View>
            </View>
            <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 20, marginTop: 16 }} />
            <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: colors.foreground, marginHorizontal: 20, marginVertical: 14 }}>
              Videos ({videoSet.entries.length})
            </Text>
          </>
        }
        renderItem={({ item, index }) => (
          <Pressable
            style={({ pressed }) => [styles.entryCard, pressed && { opacity: 0.75 }]}
            onPress={() => handleEntryPress(item)}
          >
            <View style={styles.entryNum}>
              {item.imageUrl ? (
                <Image
                  source={{ uri: item.imageUrl }}
                  style={{ width: 40, height: 40, borderRadius: 8 }}
                  resizeMode="cover"
                  onError={() => {}}
                />
              ) : (
                <Feather name="play" size={16} color={coverColor} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.entryTitle} numberOfLines={2}>{item.Title}</Text>
              {item.Author ? (
                <Text style={styles.entryMeta} numberOfLines={1}>{item.Author}</Text>
              ) : null}
              {item.DurationSeconds && item.DurationSeconds > 0 ? (
                <Text style={styles.entryMeta}>{fmtDuration(item.DurationSeconds)}</Text>
              ) : null}
            </View>
            <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingTop: 40 }}>
            <Feather name="video" size={40} color={colors.mutedForeground} />
            <Text style={{ color: colors.mutedForeground, marginTop: 8, fontFamily: "Inter_400Regular" }}>
              No videos in this set
            </Text>
          </View>
        }
      />
    </View>
  );
}
