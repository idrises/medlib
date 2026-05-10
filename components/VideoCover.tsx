import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { formatDuration } from "@/utils/time";
import { useColors } from "@/hooks/useColors";

interface VideoCoverProps {
  title: string;
  duration: number;
  coverColor: string;
  authors?: string[];
  viewCount?: number;
  progress?: number;
  onPress?: () => void;
  horizontal?: boolean;
}

export function VideoCover({ title, duration, coverColor, authors, viewCount, progress, onPress, horizontal }: VideoCoverProps) {
  const colors = useColors();

  if (horizontal) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [hStyles.card, { backgroundColor: colors.card, borderRadius: colors.radius, opacity: pressed ? 0.75 : 1 }]}
      >
        <View style={[hStyles.thumb, { backgroundColor: coverColor + "25", borderRadius: 8 }]}>
          <Feather name="play-circle" size={32} color={coverColor} />
          <Text style={[hStyles.duration, { backgroundColor: "rgba(0,0,0,0.6)" }]}>{formatDuration(duration)}</Text>
        </View>
        <View style={hStyles.info}>
          <Text style={[hStyles.title, { color: colors.foreground }]} numberOfLines={2}>{title}</Text>
          {authors && authors.length > 0 && (
            <Text style={[hStyles.author, { color: colors.mutedForeground }]} numberOfLines={1}>{authors.join(", ")}</Text>
          )}
          {viewCount !== undefined && (
            <Text style={[hStyles.views, { color: colors.mutedForeground }]}>{viewCount.toLocaleString()} views</Text>
          )}
          {progress !== undefined && progress > 0 && (
            <View style={[hStyles.progressTrack, { backgroundColor: colors.border }]}>
              <View style={[hStyles.progressFill, { backgroundColor: coverColor, width: `${Math.min(100, progress * 100)}%` as unknown as number }]} />
            </View>
          )}
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [vStyles.card, { borderRadius: colors.radius, opacity: pressed ? 0.75 : 1 }]}
    >
      <View style={[vStyles.thumb, { backgroundColor: coverColor + "20", borderRadius: colors.radius - 2 }]}>
        <Feather name="play-circle" size={36} color={coverColor} />
        <View style={vStyles.durationBadge}>
          <Text style={vStyles.durationText}>{formatDuration(duration)}</Text>
        </View>
        {progress !== undefined && progress > 0 && (
          <View style={[vStyles.progressBar, { backgroundColor: "rgba(255,255,255,0.3)" }]}>
            <View style={[vStyles.progressFill, { backgroundColor: coverColor, width: `${Math.min(100, progress * 100)}%` as unknown as number }]} />
          </View>
        )}
      </View>
      <Text style={[vStyles.title, { color: colors.foreground }]} numberOfLines={2}>{title}</Text>
      {authors && authors.length > 0 && (
        <Text style={[vStyles.author, { color: colors.mutedForeground }]} numberOfLines={1}>{authors[0]}</Text>
      )}
    </Pressable>
  );
}

const hStyles = StyleSheet.create({
  card: {
    flexDirection: "row",
    padding: 12,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    gap: 12,
  },
  thumb: {
    width: 100,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
  },
  duration: {
    position: "absolute",
    bottom: 4,
    right: 4,
    color: "#FFF",
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
  },
  info: { flex: 1 },
  title: { fontSize: 14, fontFamily: "Inter_600SemiBold", lineHeight: 20, marginBottom: 4 },
  author: { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 2 },
  views: { fontSize: 11, fontFamily: "Inter_400Regular", marginBottom: 4 },
  progressTrack: { height: 3, borderRadius: 1.5, overflow: "hidden" },
  progressFill: { height: 3, borderRadius: 1.5 },
});

const vStyles = StyleSheet.create({
  card: { width: 160, marginRight: 12 },
  thumb: {
    height: 100,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    overflow: "hidden",
  },
  durationBadge: {
    position: "absolute",
    bottom: 6,
    right: 6,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  durationText: { color: "#FFF", fontSize: 10, fontFamily: "Inter_500Medium" },
  progressBar: { position: "absolute", bottom: 0, left: 0, right: 0, height: 3, overflow: "hidden" },
  progressFill: { height: 3 },
  title: { fontSize: 13, fontFamily: "Inter_600SemiBold", lineHeight: 18, marginBottom: 3 },
  author: { fontSize: 11, fontFamily: "Inter_400Regular" },
});
