import { Feather } from "@expo/vector-icons";
import { useVideoPlayer, VideoView } from "expo-video";
import React, { useEffect, useRef } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

interface VideoPlayerProps {
  videoId: string;
  videoUrl: string;
  title: string;
  thumbnailUrl?: string;
  onClose?: () => void;
}

export function VideoPlayer({ videoId, videoUrl, title, thumbnailUrl, onClose }: VideoPlayerProps) {
  const colors = useColors();
  const { updateVideoProgress, getVideoProgress } = useApp();

  const updateRef = useRef(updateVideoProgress);
  const videoIdRef = useRef(videoId);
  useEffect(() => {
    updateRef.current = updateVideoProgress;
    videoIdRef.current = videoId;
  });

  const player = useVideoPlayer(videoUrl || null, p => {
    p.timeUpdateEventInterval = 1;
    const saved = getVideoProgress(videoId);
    if (saved?.progress && saved.progress > 5) {
      p.currentTime = saved.progress;
    }
  });

  useEffect(() => {
    const timeSub = player.addListener("timeUpdate", (payload) => {
      const t = Math.floor(payload.currentTime ?? 0);
      const d = Math.floor(player.duration ?? 0);
      if (t > 0) {
        updateRef.current(videoIdRef.current, t, d > 0 ? d : t + 1);
      }
    });

    const playingSub = player.addListener("playingChange", (payload) => {
      if (!payload.isPlaying) {
        const t = Math.floor(player.currentTime ?? 0);
        const d = Math.floor(player.duration ?? 0);
        if (t > 0) {
          updateRef.current(videoIdRef.current, t, d > 0 ? d : t + 1);
        }
      }
    });

    return () => {
      timeSub.remove();
      playingSub.remove();
    };
  }, [player]);

  if (!videoUrl) {
    return (
      <View style={[styles.container, { alignItems: "center", justifyContent: "center" }]}>
        <Feather name="play-circle" size={48} color={colors.mutedForeground} />
        <Text style={{ color: colors.mutedForeground, marginTop: 8, fontFamily: "Inter_400Regular", fontSize: 14 }}>
          Video not available
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <VideoView
        player={player}
        style={styles.video}
        nativeControls
        contentFit="contain"
        allowsFullscreen
        allowsPictureInPicture={Platform.OS !== "web"}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  video: {
    flex: 1,
  },
});
