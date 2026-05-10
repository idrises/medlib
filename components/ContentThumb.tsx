import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { Image, View, ViewStyle } from "react-native";

import { api } from "@/services/api";
import { useColors } from "@/hooks/useColors";

type ContentType = "article" | "chapter" | "video" | "videoset_video" | "book" | "journal" | "videoset";

const cache = new Map<string, string | null>();
const inflight = new Map<string, Promise<string | null>>();

async function fetchThumb(contentType: ContentType, contentId: string): Promise<string | null> {
  const key = `${contentType}:${contentId}`;
  if (cache.has(key)) return cache.get(key) ?? null;
  const existing = inflight.get(key);
  if (existing) return existing;
  const p = (async () => {
    try {
      let url: string | null | undefined = null;
      if (contentType === "book") {
        const b = await api.getBook(contentId);
        url = b?.coverUrl;
      } else if (contentType === "chapter") {
        const c = await api.getChapter(contentId);
        url = c?.bookCoverUrl;
      } else if (contentType === "video") {
        const v = await api.getVideo(contentId);
        url = v?.imageUrl;
      } else if (contentType === "videoset_video") {
        // Entry IDs are not in the videos table — must use the entry endpoint.
        const e = await api.getVideoSetEntry(contentId);
        url = (e as any)?.imageUrl;
      } else if (contentType === "videoset") {
        const vs = await api.getVideoSet(contentId);
        url = vs?.coverUrl;
      } else if (contentType === "journal") {
        const j = await api.getJournal(contentId);
        url = j?.coverUrl;
      } else if (contentType === "article") {
        const a = await api.getArticle(contentId) as any;
        url = a?.issueCoverUrl || a?.journalCoverUrl;
      }
      cache.set(key, url ?? null);
      return url ?? null;
    } catch {
      cache.set(key, null);
      return null;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

interface Props {
  contentType: ContentType;
  contentId: string;
  fallbackIcon?: keyof typeof Feather.glyphMap;
  fallbackColor?: string;
  style?: ViewStyle;
}

export function ContentThumb({ contentType, contentId, fallbackIcon = "file", fallbackColor, style }: Props) {
  const colors = useColors();
  const [url, setUrl] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetchThumb(contentType, contentId).then(u => { if (!cancelled) setUrl(u); });
    return () => { cancelled = true; };
  }, [contentType, contentId]);

  const baseStyle: ViewStyle = {
    width: 44, height: 44, borderRadius: 8,
    backgroundColor: (fallbackColor || colors.primary) + "20",
    alignItems: "center", justifyContent: "center",
    overflow: "hidden",
    ...style,
  };

  if (url) {
    return (
      <View style={baseStyle}>
        <Image source={{ uri: url }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
      </View>
    );
  }
  return (
    <View style={baseStyle}>
      <Feather name={fallbackIcon} size={20} color={fallbackColor || colors.primary} />
    </View>
  );
}
