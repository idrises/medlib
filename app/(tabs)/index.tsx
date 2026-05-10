import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const screenW = Dimensions.get("window").width;

import { SectionHeader } from "@/components/ContentCard";
import { ContentThumb } from "@/components/ContentThumb";
import { ContentType, useApp } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import { useSourceList } from "@/contexts/SourceListContext";
import { api, API_BASE_URL, ApiHomeItem, ApiHomeResponse } from "@/services/api";
import { useColors } from "@/hooks/useColors";

type ActivityMode = "my" | "all";

const KNOWN_CONTENT_TYPES: readonly ContentType[] = [
  "article",
  "chapter",
  "video",
  "videoset_video",
  "book",
  "journal",
  "videoset",
];

function asContentType(value: unknown): ContentType | null {
  return KNOWN_CONTENT_TYPES.includes(value as ContentType)
    ? (value as ContentType)
    : null;
}

interface AllActivityItem {
  id: string;
  contentType: ContentType;
  contentId: string;
  title: string;
  subtitle?: string;
  // null when the source user picked "Gizli" mode for the activity feed —
  // we render "—" in the UI rather than fabricating a fake placeholder
  // name. Empty/missing strings from the server are coerced to null too.
  userName: string | null;
  timestamp: number;
}

const ACTIVITY_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  article: "file-text",
  chapter: "book-open",
  video: "play-circle",
  videoset_video: "play-circle",
  book: "book",
  journal: "layers",
  videoset: "video",
};

const ROUTES: Record<string, string> = {
  article: "/articles/",
  chapter: "/chapters/",
  video: "/videos/",
  videoset_video: "/videos/",
  book: "/books/",
  journal: "/journals/",
  videoset: "/videosets/",
};

const ACTIVITY_COLORS: Record<string, string> = {
  article: "#0057B8",
  chapter: "#008080",
  video: "#6D28D9",
  videoset_video: "#D97706",
  book: "#008080",
  journal: "#0057B8",
  videoset: "#D97706",
};

const PALETTE = [
  "#0057B8", "#008080", "#6D28D9", "#D97706", "#DC2626",
  "#059669", "#7C3AED", "#DB2777", "#0891B2", "#65A30D",
];
function pickColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

function timeAgo(ts: number): string {
  // Clamp future timestamps (caused by historic DB clock skew or
  // mis-set device clocks) to "now" so we never show negative deltas.
  const diff = Math.max(0, Date.now() - ts);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function CoverImage({
  uri,
  fallbackUri,
  fallbackColor,
  fallbackIcon,
  style,
}: {
  uri?: string | null;
  fallbackUri?: string | null;
  fallbackColor: string;
  fallbackIcon: keyof typeof Feather.glyphMap;
  style: object;
}) {
  const [primaryErrored, setPrimaryErrored] = useState(false);
  const [fallbackErrored, setFallbackErrored] = useState(false);
  const [naturalRatio, setNaturalRatio] = useState<number | null>(null);

  const activeUri =
    uri && !primaryErrored ? uri :
    fallbackUri && !fallbackErrored ? fallbackUri :
    null;

  useEffect(() => {
    if (!activeUri) return;
    let cancelled = false;
    Image.getSize(
      activeUri,
      (w, h) => { if (!cancelled && h > 0) setNaturalRatio(w / h); },
      () => {},
    );
    return () => { cancelled = true; };
  }, [activeUri]);

  if (activeUri) {
    return (
      <View style={[style, { overflow: "hidden" }]}>
        <Image
          source={{ uri: activeUri }}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            aspectRatio: naturalRatio ?? 1.6,
          }}
          resizeMode="cover"
          onError={() => {
            if (uri && !primaryErrored) setPrimaryErrored(true);
            else setFallbackErrored(true);
          }}
        />
      </View>
    );
  }
  return (
    <View style={[style, { backgroundColor: fallbackColor + "20", alignItems: "center", justifyContent: "center" }]}>
      <Feather name={fallbackIcon} size={28} color={fallbackColor} />
    </View>
  );
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { activities, getTotalUnread } = useApp();
  const { token, user } = useAuth();
  const { setSource } = useSourceList();
  const unread = getTotalUnread();

  const [home, setHome] = useState<ApiHomeResponse | null>(null);
  const [homeLoading, setHomeLoading] = useState(true);

  // Recent Activity mode: "my" = user's own (from AppContext.activities),
  // "all" = last 100 across all users (fetched from /all/activity on demand).
  const [activityMode, setActivityMode] = useState<ActivityMode>("my");
  const [allActivities, setAllActivities] = useState<AllActivityItem[] | null>(null);
  const [allActivitiesLoading, setAllActivitiesLoading] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom + 80;

  useEffect(() => {
    const load = async () => {
      setHomeLoading(true);
      try {
        const data = await api.getHome();
        setHome(data);
      } catch (e) {
        console.warn("Home fetch error", e);
      } finally {
        setHomeLoading(false);
      }
    };
    load();
  }, []);

  // Lazy-load /all/activity the first time the user switches to "All",
  // then refresh on subsequent toggles so the list stays current.
  useEffect(() => {
    if (activityMode !== "all" || !token) return;
    let cancelled = false;
    const load = async () => {
      setAllActivitiesLoading(true);
      try {
        const r = await fetch(`${API_BASE_URL}/all/activity`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok) {
          if (!cancelled) setAllActivities([]);
          return;
        }
        const j = await r.json();
        const recent = Array.isArray(j?.recent) ? j.recent : [];
        const items: AllActivityItem[] = recent.flatMap((it: any, idx: number) => {
          const ct = asContentType(it.type);
          if (!ct || !it.contentId) return [];
          // Preserve null vs string distinction: server returns null for users
          // who chose "Gizli" mode. Don't coerce null → "Bir kullanıcı" or
          // we'd silently expose a fake name and defeat their privacy choice.
          const rawName = it.userName;
          const userName: string | null =
            typeof rawName === "string" && rawName.trim().length > 0 ? rawName : null;
          const item: AllActivityItem = {
            id: `all-${ct}-${it.contentId}-${idx}`,
            contentType: ct,
            contentId: String(it.contentId),
            title: it.title || "(başlıksız)",
            subtitle: it.subtitle || undefined,
            userName,
            timestamp: new Date(it.date).getTime(),
          };
          return [item];
        });
        if (!cancelled) setAllActivities(items);
      } catch {
        if (!cancelled) setAllActivities([]);
      } finally {
        if (!cancelled) setAllActivitiesLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [activityMode, token]);

  const latestArticles = home?.latestArticles ?? [];
  const latestBooks = home?.latestBooks ?? [];
  const latestVideoSets = home?.latestVideoSets ?? [];
  const latestVideos = home?.latestVideos ?? [];

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingTop: topPad + 16, paddingHorizontal: 20, paddingBottom: 16,
      backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    appTitle: { fontSize: 26, fontFamily: "Inter_700Bold", color: colors.primary },
    appSub: { fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 2 },
    messageBadge: {
      width: 44, height: 44, borderRadius: 22,
      backgroundColor: colors.muted, alignItems: "center", justifyContent: "center",
    },
    badge: {
      position: "absolute", top: 2, right: 2,
      width: 16, height: 16, borderRadius: 8,
      backgroundColor: colors.destructive, alignItems: "center", justifyContent: "center",
    },
    badgeText: { color: "#FFF", fontSize: 10, fontFamily: "Inter_700Bold" },
    section: { paddingHorizontal: 20, marginTop: 24 },
    activityItem: {
      flexDirection: "row", alignItems: "center", gap: 12,
      paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border + "60",
    },
    segmented: {
      flexDirection: "row",
      backgroundColor: colors.muted,
      borderRadius: 999,
      padding: 3,
      marginTop: 6,
    },
    segmentedItem: {
      paddingHorizontal: 14, paddingVertical: 6,
      borderRadius: 999,
      minWidth: 48, alignItems: "center",
    },
    segmentedText: {
      fontSize: 12, fontFamily: "Inter_600SemiBold",
    },
    activityIcon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
    activityTitle: { fontSize: 14, fontFamily: "Inter_500Medium", color: colors.foreground, flex: 1 },
    activityMeta: { fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 2 },
    articleCard: {
      width: 220, marginRight: 12,
      borderRadius: colors.radius, backgroundColor: colors.card, overflow: "hidden",
      shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08, shadowRadius: 6, elevation: 3,
    },
    articleTop: { height: 120, width: "100%" },
    articleTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.foreground, margin: 8, lineHeight: 18 },
    articleMeta: { fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginHorizontal: 8, marginBottom: 8 },
    bookCard: {
      width: 130, marginRight: 12,
      borderRadius: colors.radius, backgroundColor: colors.card, overflow: "hidden",
      shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08, shadowRadius: 6, elevation: 3,
    },
    bookCover: { width: 130, height: 180 },
    bookTitle: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.foreground, margin: 8, lineHeight: 16 },
    vsCard: {
      width: 200, marginRight: 12,
      borderRadius: colors.radius, backgroundColor: colors.card, overflow: "hidden",
      shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08, shadowRadius: 6, elevation: 3,
    },
    vsHeader: { width: 200, height: 120 },
    vsTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.foreground, margin: 8, lineHeight: 18 },
    vsMeta: { fontSize: 11, color: colors.mutedForeground, marginHorizontal: 8, marginBottom: 8, fontFamily: "Inter_400Regular" },
    videoCard: {
      width: 220, marginRight: 12,
      borderRadius: colors.radius, backgroundColor: colors.card, overflow: "hidden",
      shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08, shadowRadius: 6, elevation: 3,
    },
    videoThumb: { width: 220, height: 124 },
    videoTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.foreground, margin: 8, lineHeight: 18 },
    videoMeta: { fontSize: 11, color: colors.mutedForeground, marginHorizontal: 8, marginBottom: 8, fontFamily: "Inter_400Regular" },
    playOverlay: {
      position: "absolute", top: 0, left: 0, right: 0, height: 124,
      alignItems: "center", justifyContent: "center",
    },
    playCircle: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: "rgba(0,0,0,0.45)",
      alignItems: "center", justifyContent: "center",
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.appTitle}>MedLib</Text>
            <Text style={styles.appSub}>Medical Library</Text>
          </View>
          <Pressable style={styles.messageBadge} onPress={() => router.push("/messages")}>
            <Feather name="message-circle" size={24} color={colors.primary} />
            {unread > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unread > 9 ? "9+" : unread}</Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: bottomPad }}>
        {(() => {
          // Pick the source list based on the active toggle. "My" reads from
          // AppContext.activities (kept in sync with /me/activity). "All"
          // reads from allActivities (lazy-loaded from /all/activity above).
          const isAll = activityMode === "all";
          const list: Array<{
            id: string;
            contentType: ContentType;
            contentId: string;
            title: string;
            subtitle?: string | undefined;
            timestamp: number;
            userName?: string | null;
          }> = isAll
            ? (allActivities ?? [])
            : activities.slice(0, 100);
          const isLoadingAll = isAll && allActivities === null && allActivitiesLoading;
          const isEmptyAll = isAll && allActivities !== null && list.length === 0;
          const isEmptyMy = !isAll && activities.length === 0;

          const pages: typeof list[] = [];
          for (let i = 0; i < list.length; i += 5) pages.push(list.slice(i, i + 5));
          const pageW = screenW;

          const subtitle = isAll
            ? `Tüm kullanıcıların son ${list.length} işlemi`
            : `Last ${list.length} actions`;

          return (
            <View style={{ marginTop: 24 }}>
              <View style={{ paddingHorizontal: 20, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <SectionHeader title="Recent Activity" subtitle={subtitle} />
                </View>
                <View style={styles.segmented}>
                  {(["my", "all"] as ActivityMode[]).map(m => {
                    const active = activityMode === m;
                    return (
                      <Pressable
                        key={m}
                        onPress={() => setActivityMode(m)}
                        style={[
                          styles.segmentedItem,
                          active && { backgroundColor: colors.primary },
                        ]}
                      >
                        <Text style={[
                          styles.segmentedText,
                          { color: active ? "#FFF" : colors.mutedForeground },
                        ]}>
                          {m === "my" ? "My" : "All"}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {isLoadingAll && (
                <View style={{ paddingVertical: 24, alignItems: "center" }}>
                  <ActivityIndicator color={colors.primary} />
                </View>
              )}

              {isEmptyAll && (
                <View style={{ paddingHorizontal: 20, paddingVertical: 16 }}>
                  <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, textAlign: "center" }}>
                    Henüz aktivite yok.
                  </Text>
                </View>
              )}

              {isEmptyMy && (
                <View style={[styles.section, { alignItems: "center", paddingVertical: 24, marginTop: 0 }]}>
                  <Feather name="activity" size={40} color={colors.mutedForeground} />
                  <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 8, fontSize: 14 }}>
                    Your activity will appear here
                  </Text>
                </View>
              )}

              {!isLoadingAll && !isEmptyAll && !isEmptyMy && pages.length > 0 && (
                <>
                  <FlatList
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    data={pages}
                    keyExtractor={(_, i) => `${activityMode}-p${i}`}
                    extraData={activityMode}
                    getItemLayout={(_, i) => ({ length: pageW, offset: pageW * i, index: i })}
                    renderItem={({ item: page, index: idx }) => (
                      <View key={idx} style={{ width: pageW, paddingHorizontal: 20 }}>
                        {page.map(act => (
                          <Pressable
                            key={act.id}
                            style={({ pressed }) => [styles.activityItem, pressed && { opacity: 0.7 }]}
                            onPress={() => {
                              const isVideoset = act.contentType === "videoset_video" || act.contentType === "videoset";
                              const isVideo = act.contentType === "video";
                              const isArticle = act.contentType === "article";
                              // "Geçmişten" source list only makes sense for the
                              // user's OWN history, so skip it in All mode.
                              if (!isAll && (isVideo || isVideoset || isArticle)) {
                                const wantArticle = isArticle;
                                setSource(
                                  "Geçmişten",
                                  activities
                                    .filter((a) => wantArticle ? a.contentType === "article" : (a.contentType === "video" || a.contentType === "videoset_video" || a.contentType === "videoset"))
                                    .map((a) => ({
                                      id: a.contentId,
                                      type: wantArticle ? ("article" as const) : ("video" as const),
                                      kind: a.contentType === "videoset_video" || a.contentType === "videoset" ? ("entry" as const) : ("book" as const),
                                      title: a.title,
                                      subtitle: a.subtitle,
                                      thumbUrl: null,
                                    })),
                                );
                              }
                              const base = (ROUTES[act.contentType] || "/") + act.contentId;
                              const target = isVideoset ? `${base}?kind=entry` : base;
                              router.push(target as never);
                            }}
                          >
                            <ContentThumb
                              contentType={act.contentType}
                              contentId={act.contentId}
                              fallbackIcon={ACTIVITY_ICONS[act.contentType] || "file"}
                              fallbackColor={ACTIVITY_COLORS[act.contentType] || colors.primary}
                              style={styles.activityIcon}
                            />
                            <View style={{ flex: 1 }}>
                              <Text style={styles.activityTitle} numberOfLines={2}>{act.title}</Text>
                              {isAll ? (
                                <Text style={[styles.activityMeta, { color: colors.primary }]} numberOfLines={1}>
                                  {act.userName ?? "—"}
                                </Text>
                              ) : null}
                              {act.subtitle && <Text style={styles.activityMeta} numberOfLines={1}>{act.subtitle}</Text>}
                            </View>
                            <Text style={{ fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_400Regular" }}>{timeAgo(act.timestamp)}</Text>
                          </Pressable>
                        ))}
                      </View>
                    )}
                  />
                  {pages.length > 1 && (
                    <Text style={{ fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: 6 }}>
                      Yana kaydır ({pages.length} sayfa)
                    </Text>
                  )}
                </>
              )}
            </View>
          );
        })()}

        <View style={styles.section}>
          <SectionHeader title="Latest Articles" subtitle="Recently published medical literature" />
          {homeLoading ? (
            <ActivityIndicator color={colors.primary} style={{ paddingVertical: 20 }} />
          ) : (
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={latestArticles}
              keyExtractor={a => a.id}
              renderItem={({ item }) => {
                const color = pickColor(item.id);
                return (
                  <Pressable
                    style={({ pressed }) => [styles.articleCard, pressed && { opacity: 0.75 }]}
                    onPress={() => {
                      setSource(
                        "Ana Sayfa - Son Makaleler",
                        latestArticles.map((a) => ({
                          id: a.id, type: "article" as const, title: a.title, subtitle: a.subtitle, thumbUrl: a.issueCoverUrl ?? a.journalCoverUrl ?? null,
                        })),
                      );
                      router.push(`/articles/${item.id}` as never);
                    }}
                  >
                    <CoverImage
                      uri={item.issueCoverUrl}
                      fallbackUri={item.journalCoverUrl}
                      fallbackColor={color}
                      fallbackIcon="file-text"
                      style={styles.articleTop}
                    />
                    <Text style={styles.articleTitle} numberOfLines={3}>{item.title}</Text>
                    {item.source && (
                      <Text style={styles.articleMeta} numberOfLines={1}>{item.source}</Text>
                    )}
                  </Pressable>
                );
              }}
            />
          )}
        </View>

        <View style={styles.section}>
          <SectionHeader title="Latest Books" subtitle="Recently added medical references" />
          {homeLoading ? (
            <ActivityIndicator color={colors.primary} style={{ paddingVertical: 20 }} />
          ) : (
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={latestBooks}
              keyExtractor={b => b.id}
              renderItem={({ item }) => {
                const color = pickColor(item.id);
                return (
                  <Pressable
                    style={({ pressed }) => [styles.bookCard, pressed && { opacity: 0.75 }]}
                    onPress={() => router.push(`/books/${item.id}` as never)}
                  >
                    <CoverImage
                      uri={item.coverUrl}
                      fallbackColor={color}
                      fallbackIcon="book"
                      style={styles.bookCover}
                    />
                    <Text style={styles.bookTitle} numberOfLines={3}>{item.title}</Text>
                  </Pressable>
                );
              }}
            />
          )}
        </View>

        <View style={styles.section}>
          <SectionHeader title="Video Sets" subtitle="Courses and conference recordings" />
          {homeLoading ? (
            <ActivityIndicator color={colors.primary} style={{ paddingVertical: 20 }} />
          ) : (
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={latestVideoSets}
              keyExtractor={vs => vs.id}
              renderItem={({ item }) => {
                const color = pickColor(item.id);
                return (
                  <Pressable
                    style={({ pressed }) => [styles.vsCard, pressed && { opacity: 0.75 }]}
                    onPress={() => router.push(`/videosets/${item.id}` as never)}
                  >
                    <CoverImage
                      uri={item.coverUrl}
                      fallbackColor={color}
                      fallbackIcon="video"
                      style={styles.vsHeader}
                    />
                    <Text style={styles.vsTitle} numberOfLines={2}>{item.title}</Text>
                    {item.source && <Text style={styles.vsMeta}>{item.source}</Text>}
                  </Pressable>
                );
              }}
            />
          )}
        </View>

        <View style={styles.section}>
          <SectionHeader title="Latest Videos" subtitle="Recently added book and journal videos" />
          {homeLoading ? (
            <ActivityIndicator color={colors.primary} style={{ paddingVertical: 20 }} />
          ) : (
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={latestVideos}
              keyExtractor={v => v.id}
              renderItem={({ item }) => {
                const color = pickColor(item.id);
                return (
                  <Pressable
                    style={({ pressed }) => [styles.videoCard, pressed && { opacity: 0.75 }]}
                    onPress={() => {
                      setSource(
                        "Ana Sayfa - Son Videolar",
                        latestVideos.map((v) => ({
                          id: v.id, type: "video" as const, kind: "book" as const, title: v.title, subtitle: v.subtitle, thumbUrl: v.imageUrl ?? null, videoUrl: v.videoUrl ?? null,
                        })),
                      );
                      router.push(`/videos/${item.id}` as never);
                    }}
                  >
                    <View>
                      <CoverImage
                        uri={item.imageUrl}
                        fallbackColor={color}
                        fallbackIcon="play-circle"
                        style={styles.videoThumb}
                      />
                      {item.imageUrl && (
                        <View style={styles.playOverlay} pointerEvents="none">
                          <View style={styles.playCircle}>
                            <Feather name="play" size={18} color="#fff" />
                          </View>
                        </View>
                      )}
                    </View>
                    <Text style={styles.videoTitle} numberOfLines={2}>{item.title}</Text>
                    {item.source && (
                      <Text style={styles.videoMeta} numberOfLines={1}>{item.source}</Text>
                    )}
                  </Pressable>
                );
              }}
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
}
