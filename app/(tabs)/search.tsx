import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SearchBar } from "@/components/SearchBar";
import { useSourceList, SourceCarouselItem } from "@/contexts/SourceListContext";
import { api, ApiSearchResult } from "@/services/api";
import { useColors } from "@/hooks/useColors";

function splitHighlight(
  text: string,
  words: string[]
): Array<{ part: string; match: boolean }> {
  if (!words.length) return [{ part: text, match: false }];
  const result: Array<{ part: string; match: boolean }> = [];
  const lowerText = text.toLocaleLowerCase("tr-TR");
  const lowerWords = words.map(w => w.toLocaleLowerCase("tr-TR"));
  let i = 0;
  while (i < text.length) {
    let matchedLen = 0;
    for (const lw of lowerWords) {
      if (lw && lowerText.startsWith(lw, i)) {
        matchedLen = lw.length;
        break;
      }
    }
    if (matchedLen > 0) {
      result.push({ part: text.slice(i, i + matchedLen), match: true });
      i += matchedLen;
    } else {
      let nextMatch = text.length;
      for (const lw of lowerWords) {
        if (!lw) continue;
        const pos = lowerText.indexOf(lw, i);
        if (pos !== -1 && pos < nextMatch) nextMatch = pos;
      }
      if (nextMatch > i) result.push({ part: text.slice(i, nextMatch), match: false });
      i = nextMatch;
    }
  }
  return result;
}

function HighlightText({
  text,
  query,
  style,
  highlightColor,
  numberOfLines,
}: {
  text: string;
  query: string;
  style?: object;
  highlightColor: string;
  numberOfLines?: number;
}) {
  if (!query.trim()) return <Text style={style} numberOfLines={numberOfLines}>{text}</Text>;
  const words = query.trim().split(/\s+/).filter(Boolean);
  const parts = splitHighlight(text, words);
  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {parts.map((p, i) =>
        p.match ? (
          <Text
            key={i}
            style={{ backgroundColor: highlightColor + "35", color: highlightColor, fontFamily: "Inter_700Bold" }}
          >
            {p.part}
          </Text>
        ) : (
          p.part
        )
      )}
    </Text>
  );
}

const TYPE_META: Record<string, { label: string; icon: keyof typeof Feather.glyphMap; color: string }> = {
  article:  { label: "Articles",   icon: "file-text",  color: "#0057B8" },
  journal:  { label: "Journals",   icon: "layers",     color: "#0057B8" },
  book:     { label: "Books",      icon: "book",       color: "#008080" },
  chapter:  { label: "Chapters",   icon: "book-open",  color: "#008080" },
  videoset: { label: "Video Sets", icon: "video",      color: "#D97706" },
  video:    { label: "Videos",     icon: "play-circle",color: "#6D28D9" },
};

const POPULAR_FALLBACK = [
  "rhinoplasty", "breast reconstruction", "microsurgery",
  "facelift", "liposuction", "blepharoplasty",
];

const TYPE_ORDER = ["article", "journal", "book", "chapter", "videoset", "video"];

function routeForResult(r: ApiSearchResult): string {
  switch (r.type) {
    case "article":  return `/articles/${r.id}`;
    case "journal":  return `/journals/${r.id}`;
    case "book":     return `/books/${r.id}`;
    case "chapter":  return `/chapters/${r.id}`;
    case "videoset": return `/videosets/${r.id}`;
    case "video":    return `/videos/${r.id}`;
    case "videoset_video": return `/videos/${r.id}?kind=entry`;
    default:         return `/`;
  }
}

function searchResultsToCarousel(results: ApiSearchResult[], wantArticle: boolean): SourceCarouselItem[] {
  return results
    .filter((r) => wantArticle ? r.type === "article" : (r.type === "video" || r.type === "videoset_video"))
    .map((r) => {
      if (wantArticle) {
        return { id: r.id, type: "article" as const, title: r.title, subtitle: r.subtitle, thumbUrl: null };
      }
      return {
        id: r.id, type: "video" as const,
        kind: r.type === "videoset_video" ? ("entry" as const) : ("book" as const),
        title: r.title, subtitle: r.subtitle, thumbUrl: null,
      };
    });
}

export default function SearchScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { setSource } = useSourceList();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ApiSearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [popular, setPopular] = useState<string[]>(POPULAR_FALLBACK);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLoggedQuery = useRef<string>("");

  useEffect(() => {
    let cancelled = false;
    api.getPopularSearches(6, 30)
      .then(terms => {
        if (cancelled) return;
        if (terms.length > 0) setPopular(terms);
      })
      .catch(() => { /* keep fallback */ });
    return () => { cancelled = true; };
  }, []);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom + 80;

  const fetchResults = async (q: string, p: number, reset: boolean) => {
    if (!q.trim()) { setResults([]); setTotal(0); return; }
    setLoading(true);
    try {
      const res = await api.search(q, undefined, p, 30);
      setResults(prev => reset ? res.data : [...prev, ...res.data]);
      setTotal(res.total);
      setPage(p);
      // Schedule a settle log: only log if the user stops typing for 2s AND there were results
      if (reset && p === 1 && res.total > 0) {
        if (settleTimer.current) clearTimeout(settleTimer.current);
        const settledQuery = q.trim();
        settleTimer.current = setTimeout(() => {
          if (lastLoggedQuery.current === settledQuery) return;
          lastLoggedQuery.current = settledQuery;
          api.logSearch(settledQuery, res.total, res.keywords?.length ?? 0)
            .catch(() => { /* swallow */ });
        }, 2000);
      }
    } catch (e) {
      console.warn("Search error", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (settleTimer.current) clearTimeout(settleTimer.current);
    if (!query.trim()) { setResults([]); setTotal(0); return; }
    timer.current = setTimeout(() => fetchResults(query, 1, true), 350);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
  }, [query]);

  const grouped = TYPE_ORDER.reduce<Record<string, ApiSearchResult[]>>((acc, t) => {
    const items = results.filter(r => r.type === t);
    if (items.length) acc[t] = items;
    return acc;
  }, {});

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingTop: topPad + 16, paddingHorizontal: 20, paddingBottom: 16,
      backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    title: { fontSize: 26, fontFamily: "Inter_700Bold", color: colors.foreground, marginBottom: 12 },
    section: { paddingHorizontal: 20, marginTop: 20 },
    sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: colors.foreground, marginBottom: 10 },
    resultItem: {
      flexDirection: "row", alignItems: "center", gap: 12,
      paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border + "50",
    },
    iconBox: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    resultTitle: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium", color: colors.foreground, lineHeight: 20 },
    resultMeta: { fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 1 },
    typeLabel: {
      fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_600SemiBold",
      textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, marginTop: 16,
    },
    popularTag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, margin: 4 },
    popularText: { fontSize: 13, fontFamily: "Inter_500Medium" },
    countRow: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 },
    countText: { fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
  });

  const renderResultItem = (item: ApiSearchResult) => {
    const meta = TYPE_META[item.type] ?? TYPE_META["article"];
    const formattedDate = item.date ? new Date(item.date).getFullYear().toString() : "";
    return (
      <Pressable
        key={item.id + item.type}
        style={({ pressed }) => [styles.resultItem, pressed && { opacity: 0.7 }]}
        onPress={() => {
          if (item.type === "article" || item.type === "video" || item.type === "videoset_video") {
            const wantArticle = item.type === "article";
            const items = searchResultsToCarousel(results, wantArticle);
            if (items.length > 0) setSource(`Arama: "${query}"`, items);
          }
          router.push(routeForResult(item) as never);
        }}
      >
        <View style={[styles.iconBox, { backgroundColor: meta.color + "20" }]}>
          <Feather name={meta.icon} size={20} color={meta.color} />
        </View>
        <View style={{ flex: 1 }}>
          <HighlightText
            text={item.title}
            query={query}
            style={styles.resultTitle}
            highlightColor={meta.color}
            numberOfLines={2}
          />
          <HighlightText
            text={item.subtitle ? item.subtitle : formattedDate}
            query={query}
            style={styles.resultMeta}
            highlightColor={meta.color}
            numberOfLines={1}
          />
        </View>
        <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Search</Text>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Search all content..." />
      </View>

      {!query.trim() ? (
        <ScrollView contentContainerStyle={{ paddingBottom: bottomPad }}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Popular Searches</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {popular.map(p => (
                <Pressable
                  key={p}
                  onPress={() => setQuery(p)}
                  style={({ pressed }) => [styles.popularTag, { backgroundColor: colors.secondary, opacity: pressed ? 0.7 : 1 }]}
                >
                  <Text style={[styles.popularText, { color: colors.primary }]}>{p}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </ScrollView>
      ) : (
        <>
          <View style={styles.countRow}>
            {loading && results.length === 0 ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text style={styles.countText}>
                {total > 0 ? `${total} results for "${query}"` : `No results for "${query}"`}
              </Text>
            )}
          </View>
          <FlatList
            data={results}
            keyExtractor={r => r.id + r.type}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: bottomPad }}
            onEndReached={() => {
              if (!loading && results.length < total) {
                fetchResults(query, page + 1, false);
              }
            }}
            onEndReachedThreshold={0.3}
            ListFooterComponent={
              loading && results.length > 0
                ? <ActivityIndicator color={colors.primary} style={{ paddingVertical: 16 }} />
                : null
            }
            renderItem={({ item, index }) => {
              const prevType = index > 0 ? results[index - 1]?.type : null;
              const showHeader = item.type !== prevType;
              const meta = TYPE_META[item.type] ?? TYPE_META["article"];
              return (
                <>
                  {showHeader && (
                    <Text style={styles.typeLabel}>{meta.label}</Text>
                  )}
                  {renderResultItem(item)}
                </>
              );
            }}
            ListEmptyComponent={
              !loading ? (
                <View style={{ alignItems: "center", paddingTop: 60 }}>
                  <Feather name="search" size={48} color={colors.mutedForeground} />
                  <Text style={[{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14, marginTop: 12 }]}>
                    No results for "{query}"
                  </Text>
                </View>
              ) : null
            }
          />
        </>
      )}
    </View>
  );
}
