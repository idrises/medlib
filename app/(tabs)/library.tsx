import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState, useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SearchBar } from "@/components/SearchBar";
import { useSourceList } from "@/contexts/SourceListContext";
import { api, ApiBook, ApiJournal, ApiVideo, ApiVideoSet, proxyImageUrl } from "@/services/api";
import { useColors } from "@/hooks/useColors";

const SEGMENTS = ["Journals", "Books", "Videos"] as const;
type Segment = typeof SEGMENTS[number];

const VIDEO_TABS = ["Video Sets", "Book Videos", "Article Videos"];

const PALETTE = [
  "#0057B8", "#008080", "#6D28D9", "#D97706", "#DC2626",
  "#059669", "#7C3AED", "#DB2777", "#0891B2", "#65A30D",
];
function pickColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

function abbrev(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words.slice(0, 3).map(w => w[0]).join("").toUpperCase();
}

function CoverImage({
  uri,
  width,
  height,
  borderRadius = 6,
  fallback,
}: {
  uri?: string | null;
  width: number;
  height: number;
  borderRadius?: number;
  fallback: React.ReactNode;
}) {
  const [failed, setFailed] = React.useState(false);
  const resolvedUri = proxyImageUrl(uri);
  if (!resolvedUri || failed) return <>{fallback}</>;
  return (
    <Image
      source={{ uri: resolvedUri }}
      style={{ width, height, borderRadius }}
      resizeMode="cover"
      onError={() => setFailed(true)}
    />
  );
}

const PAGE_SIZE = 20;

export default function LibraryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { setSource } = useSourceList();

  const [segment, setSegment] = useState<Segment>("Journals");
  const [search, setSearch] = useState("");
  const [videoTab, setVideoTab] = useState(0);

  const [journals, setJournals] = useState<ApiJournal[]>([]);
  const [journalPage, setJournalPage] = useState(1);
  const [journalTotal, setJournalTotal] = useState(0);
  const [journalLoading, setJournalLoading] = useState(false);

  const [books, setBooks] = useState<ApiBook[]>([]);
  const [bookPage, setBookPage] = useState(1);
  const [bookTotal, setBookTotal] = useState(0);
  const [bookLoading, setBookLoading] = useState(false);
  const [bookSubject, setBookSubject] = useState<string | undefined>(undefined);
  const [bookSubjects, setBookSubjects] = useState<{ label: string; value: string }[]>([]);

  const [videoSets, setVideoSets] = useState<ApiVideoSet[]>([]);
  const [vsPage, setVsPage] = useState(1);
  const [vsTotal, setVsTotal] = useState(0);
  const [vsLoading, setVsLoading] = useState(false);

  const [bookVideos, setBookVideos] = useState<ApiVideo[]>([]);
  const [bvPage, setBvPage] = useState(1);
  const [bvTotal, setBvTotal] = useState(0);
  const [bvLoading, setBvLoading] = useState(false);
  const [bvBookFilter, setBvBookFilter] = useState<string | undefined>(undefined);
  const [videoBooks, setVideoBooks] = useState<{ BookID: string; Title: string; videoCount: number; coverUrl?: string | null }[]>([]);
  const [bookFilterOpen, setBookFilterOpen] = useState(false);
  const [bookFilterSearch, setBookFilterSearch] = useState("");

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const journalEpoch = useRef(0);
  const bookEpoch = useRef(0);
  const vsEpoch = useRef(0);
  const bvEpoch = useRef(0);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom + 80;

  // Deduplicate lists defensively so duplicate keys never reach FlatList
  const uniqueJournals = useMemo(() => {
    const seen = new Set<string>();
    return journals.filter(j => { if (seen.has(j.JournalID)) return false; seen.add(j.JournalID); return true; });
  }, [journals]);
  const uniqueBooks = useMemo(() => {
    const seen = new Set<string>();
    return books.filter(b => { if (seen.has(b.BookID)) return false; seen.add(b.BookID); return true; });
  }, [books]);
  const uniqueVideoSets = useMemo(() => {
    const seen = new Set<string>();
    return videoSets.filter(v => { if (seen.has(v.VideoSetID)) return false; seen.add(v.VideoSetID); return true; });
  }, [videoSets]);

  const loadJournals = useCallback(async (page: number, q: string, reset = false) => {
    const epoch = reset ? ++journalEpoch.current : journalEpoch.current;
    setJournalLoading(true);
    try {
      const res = await api.getJournals(page, PAGE_SIZE, q || undefined);
      if (epoch !== journalEpoch.current) return;
      setJournals(prev => reset ? res.data : [...prev, ...res.data]);
      setJournalTotal(res.total);
      setJournalPage(page);
    } catch (e) {
      console.warn("Journals fetch error", e);
    } finally {
      if (epoch === journalEpoch.current) setJournalLoading(false);
    }
  }, []);

  const loadBooks = useCallback(async (page: number, subject: string | undefined, reset = false, q?: string) => {
    const epoch = reset ? ++bookEpoch.current : bookEpoch.current;
    setBookLoading(true);
    try {
      const res = await api.getBooks(page, PAGE_SIZE, subject, q || undefined);
      if (epoch !== bookEpoch.current) return;
      setBooks(prev => reset ? res.data : [...prev, ...res.data]);
      setBookTotal(res.total);
      setBookPage(page);
    } catch (e) {
      console.warn("Books fetch error", e);
    } finally {
      if (epoch === bookEpoch.current) setBookLoading(false);
    }
  }, []);

  const loadVideoSets = useCallback(async (page: number, q: string, reset = false) => {
    const epoch = reset ? ++vsEpoch.current : vsEpoch.current;
    setVsLoading(true);
    try {
      const res = await api.getVideoSets(page, PAGE_SIZE, q || undefined);
      if (epoch !== vsEpoch.current) return;
      setVideoSets(prev => reset ? res.data : [...prev, ...res.data]);
      setVsTotal(res.total);
      setVsPage(page);
    } catch (e) {
      console.warn("VideoSets fetch error", e);
    } finally {
      if (epoch === vsEpoch.current) setVsLoading(false);
    }
  }, []);

  const loadBookVideos = useCallback(async (page: number, q: string, bookId: string | undefined, reset = false) => {
    const epoch = reset ? ++bvEpoch.current : bvEpoch.current;
    setBvLoading(true);
    try {
      const res = await api.getAllVideos(page, PAGE_SIZE, q || undefined, bookId);
      if (epoch !== bvEpoch.current) return;
      setBookVideos(prev => reset ? res.data : [...prev, ...res.data]);
      setBvTotal(res.total);
      setBvPage(page);
    } catch (e) {
      console.warn("BookVideos fetch error", e);
    } finally {
      if (epoch === bvEpoch.current) setBvLoading(false);
    }
  }, []);

  useEffect(() => {
    loadJournals(1, "", true);
    loadBooks(1, undefined, true);
    loadVideoSets(1, "", true);
    api.getBookSubjects().then(res => setBookSubjects(res.data)).catch(() => {});
    api.getVideoBooks().then(res => setVideoBooks(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      if (segment === "Journals") loadJournals(1, search, true);
      else if (segment === "Books") loadBooks(1, bookSubject, true, search);
      else if (segment === "Videos" && videoTab === 0) loadVideoSets(1, search, true);
      else if (segment === "Videos" && videoTab === 1) loadBookVideos(1, search, bvBookFilter, true);
    }, 400);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search, segment, videoTab, bvBookFilter]);

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingTop: topPad + 16,
      paddingHorizontal: 20,
      paddingBottom: 0,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    segmentBar: { flexDirection: "row", gap: 0, marginTop: 12 },
    segBtn: {
      flex: 1, paddingVertical: 10, alignItems: "center",
      borderBottomWidth: 2, borderBottomColor: "transparent",
    },
    segBtnActive: { borderBottomColor: colors.primary },
    segText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground },
    segTextActive: { color: colors.primary },
    subBar: {
      backgroundColor: colors.card, paddingHorizontal: 20,
      paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    filterRow: { flexDirection: "row", gap: 6 },
    chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
    chipText: { fontSize: 12, fontFamily: "Inter_500Medium" },
    videoSubTabs: {
      flexDirection: "row", gap: 4, paddingHorizontal: 20, paddingVertical: 10,
      backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    videoSubTab: { flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: "center" },
    videoSubTabText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
    journalCard: {
      backgroundColor: colors.card,
      marginHorizontal: 20, marginVertical: 6,
      borderRadius: colors.radius, padding: 16,
      flexDirection: "row", alignItems: "center", gap: 14,
      shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
    },
    coverBox: { width: 56, height: 72, borderRadius: 6, alignItems: "center", justifyContent: "center" },
    abbrev: { color: "#FFF", fontSize: 13, fontFamily: "Inter_700Bold", textAlign: "center", paddingHorizontal: 4 },
    jTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.foreground, marginBottom: 3, lineHeight: 20 },
    jMeta: { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginBottom: 2 },
    bookCard: {
      backgroundColor: colors.card,
      marginHorizontal: 20, marginVertical: 6,
      borderRadius: colors.radius, padding: 16,
      flexDirection: "row", gap: 14,
      shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
    },
    bookCoverBox: { width: 56, height: 78, borderRadius: 6, alignItems: "center", justifyContent: "center" },
    yearText: { color: "#FFF", fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 4 },
    bTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.foreground, marginBottom: 3, lineHeight: 20 },
    bAuthors: { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginBottom: 4 },
    metaRow: { flexDirection: "row", gap: 8 },
    metaChip: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 4 },
    metaText: { fontSize: 10, fontFamily: "Inter_500Medium" },
    vsCard: {
      backgroundColor: colors.card,
      marginHorizontal: 20, marginVertical: 6,
      borderRadius: colors.radius, overflow: "hidden",
      shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.07, shadowRadius: 6, elevation: 3,
    },
    vsTop: { padding: 14, flexDirection: "row", gap: 12, alignItems: "center" },
    vsCover: { width: 56, height: 56, borderRadius: 8, alignItems: "center", justifyContent: "center" },
    vsTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.foreground, lineHeight: 20 },
    vsMeta: { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 2 },
    emptyBox: { alignItems: "center", paddingTop: 80 },
    emptyText: { color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14, marginTop: 12 },
    footerLoader: { paddingVertical: 20, alignItems: "center" },
    totalBadge: { fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign: "center", paddingBottom: 4 },
    comingSoon: { alignItems: "center", paddingTop: 80, paddingHorizontal: 40 },
    comingSoonText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: colors.foreground, marginTop: 12 },
    comingSoonSub: { fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: 8 },
    videoRow: {
      flexDirection: "row", alignItems: "center", gap: 12,
      backgroundColor: colors.card,
      marginHorizontal: 16, marginVertical: 5,
      borderRadius: 12, padding: 10,
      shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
    },
    videoRowThumb: { width: 80, height: 60, borderRadius: 8, backgroundColor: colors.muted },
    videoRowTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.foreground, lineHeight: 19 },
    videoRowMeta: { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 2 },
    filterBtn: {
      width: 40, height: 40, borderRadius: colors.radius,
      alignItems: "center", justifyContent: "center",
    },
    filterDot: {
      position: "absolute", top: 8, right: 8, width: 7, height: 7, borderRadius: 4,
      backgroundColor: "#FFF", borderWidth: 1, borderColor: colors.primary,
    },
    activeFilterBar: {
      flexDirection: "row", alignItems: "center", gap: 8,
      paddingHorizontal: 16, paddingVertical: 8,
      backgroundColor: colors.muted,
    },
    activeFilterText: {
      flex: 1, fontSize: 13, color: colors.foreground, fontFamily: "Inter_500Medium",
    },
    modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
    modalSheet: {
      maxHeight: "80%", borderTopLeftRadius: 20, borderTopRightRadius: 20,
      paddingTop: 8, paddingHorizontal: 16, paddingBottom: 16,
    },
    modalHandle: {
      alignSelf: "center", width: 40, height: 4, borderRadius: 2,
      backgroundColor: colors.border, marginBottom: 8,
    },
    modalHeader: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingVertical: 8,
    },
    modalTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
    modalSearch: {
      flexDirection: "row", alignItems: "center", gap: 8,
      paddingHorizontal: 12, paddingVertical: 9, marginVertical: 10,
    },
    modalRow: {
      flexDirection: "row", alignItems: "center", gap: 12,
      paddingVertical: 14, paddingHorizontal: 4,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    modalRowTitle: { fontSize: 14, lineHeight: 19 },
    modalCover: { width: 40, height: 52, borderRadius: 6, backgroundColor: colors.muted },
  });

  const renderJournal = ({ item }: { item: ApiJournal }) => {
    const color = pickColor(item.JournalID);
    return (
      <Pressable
        style={({ pressed }) => [styles.journalCard, pressed && { opacity: 0.75 }]}
        onPress={() => router.push(`/journals/${item.JournalID}` as never)}
      >
        <View style={[styles.coverBox, { backgroundColor: color, overflow: "hidden" }]}>
          <CoverImage
            uri={item.coverUrl}
            width={56}
            height={72}
            borderRadius={6}
            fallback={<Text style={styles.abbrev}>{abbrev(item.JournalName)}</Text>}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.jTitle} numberOfLines={2}>{item.JournalName}</Text>
          {item.Subject ? <Text style={styles.jMeta}>{item.Subject}</Text> : null}
          {item.ISSNElectronic ? (
            <Text style={styles.jMeta}>eISSN {item.ISSNElectronic}</Text>
          ) : null}
        </View>
        <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
      </Pressable>
    );
  };

  const renderBook = ({ item }: { item: ApiBook }) => {
    const color = pickColor(item.BookID);
    return (
      <Pressable
        style={({ pressed }) => [styles.bookCard, pressed && { opacity: 0.75 }]}
        onPress={() => router.push(`/books/${item.BookID}` as never)}
      >
        <View style={[styles.bookCoverBox, { backgroundColor: color, overflow: "hidden" }]}>
          <CoverImage
            uri={item.coverUrl}
            width={56}
            height={78}
            borderRadius={6}
            fallback={
              <>
                <Feather name="book" size={24} color="#FFF" />
                <Text style={styles.yearText}>{item.YearText}</Text>
              </>
            }
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.bTitle} numberOfLines={2}>{item.Title}</Text>
          {item.Editors ? (
            <Text style={styles.bAuthors} numberOfLines={1}>{item.Editors}</Text>
          ) : null}
          <View style={styles.metaRow}>
            {item.Subject
              ? Array.from(new Set(item.Subject.trim().split(/\s+/))).slice(0, 3).map((kw: string, ki: number) => {
                  const label = kw.replace(/[_]/g, " ").replace(/[/]/g, " / ");
                  return (
                    <View key={`${kw}-${ki}`} style={[styles.metaChip, { backgroundColor: color + "15" }]}>
                      <Feather name="tag" size={11} color={color} />
                      <Text style={[styles.metaText, { color }]}>{label}</Text>
                    </View>
                  );
                })
              : null}
          </View>
        </View>
        <Feather name="chevron-right" size={18} color={colors.mutedForeground} style={{ alignSelf: "center" }} />
      </Pressable>
    );
  };

  const renderVideoSet = ({ item }: { item: ApiVideoSet }) => {
    const color = pickColor(item.VideoSetID);
    return (
      <Pressable
        style={({ pressed }) => [styles.vsCard, pressed && { opacity: 0.8 }]}
        onPress={() => router.push(`/videosets/${item.VideoSetID}` as never)}
      >
        <View style={styles.vsTop}>
          <View style={[styles.vsCover, { backgroundColor: color + "20", overflow: "hidden" }]}>
            <CoverImage
              uri={item.coverUrl}
              width={56}
              height={56}
              borderRadius={8}
              fallback={<Feather name="video" size={28} color={color} />}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.vsTitle} numberOfLines={2}>{item.SetName}</Text>
            {item.Editors ? <Text style={styles.vsMeta} numberOfLines={1}>{item.Editors}</Text> : null}
            <Text style={styles.vsMeta}>{item.EntryCount} videos · {item.Subject}</Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        </View>
      </Pressable>
    );
  };

  const journalFooter = () => (
    journalLoading
      ? <ActivityIndicator style={styles.footerLoader} color={colors.primary} />
      : uniqueJournals.length > 0
        ? <Text style={styles.totalBadge}>{uniqueJournals.length} / {journalTotal} journals</Text>
        : null
  );

  const bookFooter = () => (
    bookLoading
      ? <ActivityIndicator style={styles.footerLoader} color={colors.primary} />
      : uniqueBooks.length > 0
        ? <Text style={styles.totalBadge}>{uniqueBooks.length} / {bookTotal} books</Text>
        : null
  );

  const vsFooter = () => (
    vsLoading
      ? <ActivityIndicator style={styles.footerLoader} color={colors.primary} />
      : uniqueVideoSets.length > 0
        ? <Text style={styles.totalBadge}>{uniqueVideoSets.length} / {vsTotal} video sets</Text>
        : null
  );

  const comingSoon = (icon: keyof typeof Feather.glyphMap, label: string) => (
    <View style={styles.comingSoon}>
      <Feather name={icon} size={48} color={colors.mutedForeground} />
      <Text style={styles.comingSoonText}>{label}</Text>
      <Text style={styles.comingSoonSub}>Coming soon — these videos are linked to books and articles</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ flex: 1 }}>
            <SearchBar
              value={search}
              onChangeText={setSearch}
              placeholder={`Search ${segment.toLowerCase()}...`}
            />
          </View>
          {segment === "Videos" && videoTab === 1 && (
            <Pressable
              onPress={() => setBookFilterOpen(true)}
              style={({ pressed }) => [
                styles.filterBtn,
                {
                  backgroundColor: bvBookFilter ? colors.primary : colors.muted,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
            >
              <Feather name="filter" size={16} color={bvBookFilter ? "#FFF" : colors.foreground} />
              {bvBookFilter && <View style={styles.filterDot} />}
            </Pressable>
          )}
        </View>
        <View style={styles.segmentBar}>
          {SEGMENTS.map(s => (
            <Pressable
              key={s}
              onPress={() => { setSegment(s); setSearch(""); }}
              style={[styles.segBtn, segment === s && styles.segBtnActive]}
            >
              <Text style={[styles.segText, segment === s && styles.segTextActive]}>{s}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {segment === "Journals" && (
        <FlatList
          data={uniqueJournals}
          keyExtractor={j => j.JournalID}
          renderItem={renderJournal}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: bottomPad }}
          ListFooterComponent={journalFooter}
          onEndReached={() => {
            if (!journalLoading && uniqueJournals.length < journalTotal) {
              loadJournals(journalPage + 1, search);
            }
          }}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            journalLoading ? null : (
              <View style={styles.emptyBox}>
                <Feather name="layers" size={48} color={colors.mutedForeground} />
                <Text style={styles.emptyText}>No journals found</Text>
              </View>
            )
          }
        />
      )}

      {segment === "Books" && (
        <>
          {bookSubjects.length > 0 && (
            <View style={styles.subBar}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.filterRow}>
                  {[{ label: "All", value: "" }, ...bookSubjects].map(cat => {
                    const isActive = cat.value === "" ? !bookSubject : bookSubject === cat.value;
                    return (
                      <Pressable
                        key={cat.value || "all"}
                        onPress={() => {
                          const sub = cat.value === "" ? undefined : cat.value;
                          setBookSubject(sub);
                          loadBooks(1, sub, true, search || undefined);
                        }}
                        style={[styles.chip, { backgroundColor: isActive ? colors.primary : colors.muted }]}
                      >
                        <Text style={[styles.chipText, { color: isActive ? "#FFF" : colors.mutedForeground }]}>
                          {cat.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          )}
          <FlatList
            data={uniqueBooks}
            keyExtractor={b => b.BookID}
            renderItem={renderBook}
            contentContainerStyle={{ paddingTop: 12, paddingBottom: bottomPad }}
            ListFooterComponent={bookFooter}
            onEndReached={() => {
              if (!bookLoading && uniqueBooks.length < bookTotal) {
                loadBooks(bookPage + 1, bookSubject, false, search || undefined);
              }
            }}
            onEndReachedThreshold={0.3}
            ListEmptyComponent={
              bookLoading ? null : (
                <View style={styles.emptyBox}>
                  <Feather name="book" size={48} color={colors.mutedForeground} />
                  <Text style={styles.emptyText}>No books found</Text>
                </View>
              )
            }
          />
        </>
      )}

      {segment === "Videos" && (
        <>
          <View style={styles.videoSubTabs}>
            {VIDEO_TABS.map((tab, i) => (
              <Pressable
                key={tab}
                onPress={() => setVideoTab(i)}
                style={[styles.videoSubTab, { backgroundColor: videoTab === i ? colors.primary : colors.muted }]}
              >
                <Text style={[styles.videoSubTabText, { color: videoTab === i ? "#FFF" : colors.mutedForeground }]}>{tab}</Text>
              </Pressable>
            ))}
          </View>

          {videoTab === 0 && (
            <FlatList
              data={uniqueVideoSets}
              keyExtractor={vs => vs.VideoSetID}
              renderItem={renderVideoSet}
              contentContainerStyle={{ paddingTop: 12, paddingBottom: bottomPad }}
              ListFooterComponent={vsFooter}
              onEndReached={() => {
                if (!vsLoading && uniqueVideoSets.length < vsTotal) {
                  loadVideoSets(vsPage + 1, search);
                }
              }}
              onEndReachedThreshold={0.3}
              ListEmptyComponent={
                vsLoading ? null : (
                  <View style={styles.emptyBox}>
                    <Feather name="video" size={48} color={colors.mutedForeground} />
                    <Text style={styles.emptyText}>No video sets found</Text>
                  </View>
                )
              }
            />
          )}
          {videoTab === 1 && (
            <>
              {bvBookFilter && (
                <View style={styles.activeFilterBar}>
                  <Feather name="book" size={13} color={colors.primary} />
                  <Text style={styles.activeFilterText} numberOfLines={1}>
                    {videoBooks.find(b => b.BookID === bvBookFilter)?.Title || "Selected book"}
                  </Text>
                  <Pressable onPress={() => setBvBookFilter(undefined)} hitSlop={8}>
                    <Feather name="x" size={15} color={colors.mutedForeground} />
                  </Pressable>
                </View>
              )}
              <FlatList
                data={bookVideos}
                keyExtractor={v => v.VideoID}
                contentContainerStyle={{ paddingTop: 12, paddingBottom: bottomPad }}
                renderItem={({ item }) => (
                  <Pressable
                    style={({ pressed }) => [styles.videoRow, pressed && { opacity: 0.75 }]}
                    onPress={() => {
                      setSource(
                        bvBookFilter ? "Bu Kitabın Videoları" : "Tüm Kitap Videoları",
                        bookVideos.map((v) => ({
                          id: v.VideoID,
                          type: "video" as const,
                          kind: "book" as const,
                          title: v.Title,
                          subtitle: v.BookTitle ?? v.Author ?? "",
                          thumbUrl: v.imageUrl ?? null,
                          videoUrl: v.videoUrl ?? null,
                        })),
                      );
                      router.push(`/videos/${item.VideoID}` as never);
                    }}
                  >
                    {item.imageUrl ? (
                      <Image source={{ uri: item.imageUrl }} style={styles.videoRowThumb} resizeMode="cover" />
                    ) : (
                      <View style={[styles.videoRowThumb, { alignItems: "center", justifyContent: "center", backgroundColor: colors.muted }]}>
                        <Feather name="video" size={22} color={colors.mutedForeground} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.videoRowTitle} numberOfLines={2}>{item.Title}</Text>
                      {item.BookTitle ? (
                        <Text style={styles.videoRowMeta} numberOfLines={1}>{item.BookTitle}</Text>
                      ) : null}
                      {item.Author ? (
                        <Text style={styles.videoRowMeta} numberOfLines={1}>{item.Author}</Text>
                      ) : null}
                    </View>
                    <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                  </Pressable>
                )}
                ListFooterComponent={
                  bvLoading
                    ? <ActivityIndicator style={styles.footerLoader} color={colors.primary} />
                    : bookVideos.length > 0
                      ? <Text style={styles.totalBadge}>{bookVideos.length} / {bvTotal} videos</Text>
                      : null
                }
                onEndReached={() => {
                  if (!bvLoading && bookVideos.length < bvTotal) {
                    loadBookVideos(bvPage + 1, search, bvBookFilter, false);
                  }
                }}
                onEndReachedThreshold={0.3}
                ListEmptyComponent={
                  bvLoading ? null : (
                    <View style={styles.emptyBox}>
                      <Feather name="play-circle" size={48} color={colors.mutedForeground} />
                      <Text style={styles.emptyText}>No book videos found</Text>
                    </View>
                  )
                }
              />
            </>
          )}
          {videoTab === 2 && comingSoon("film", "Article Videos")}
        </>
      )}

      <Modal
        visible={bookFilterOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setBookFilterOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setBookFilterOpen(false)}>
          <Pressable style={[styles.modalSheet, { backgroundColor: colors.background }]} onPress={() => {}}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Filter by book</Text>
              <Pressable onPress={() => setBookFilterOpen(false)} hitSlop={10}>
                <Feather name="x" size={22} color={colors.foreground} />
              </Pressable>
            </View>
            <View style={[styles.modalSearch, { backgroundColor: colors.muted, borderRadius: colors.radius }]}>
              <Feather name="search" size={16} color={colors.mutedForeground} />
              <TextInput
                value={bookFilterSearch}
                onChangeText={setBookFilterSearch}
                placeholder="Search book..."
                placeholderTextColor={colors.mutedForeground}
                style={{ flex: 1, color: colors.foreground, fontFamily: "Inter_400Regular", fontSize: 14, padding: 0 }}
              />
              {bookFilterSearch.length > 0 && (
                <Pressable onPress={() => setBookFilterSearch("")} hitSlop={8}>
                  <Feather name="x-circle" size={16} color={colors.mutedForeground} />
                </Pressable>
              )}
            </View>
            <FlatList
              data={[
                { BookID: "", Title: "All books", videoCount: bvTotal },
                ...videoBooks.filter(b =>
                  !bookFilterSearch ||
                  b.Title.toLowerCase().includes(bookFilterSearch.toLowerCase())
                ),
              ]}
              keyExtractor={b => b.BookID || "all"}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const isActive = item.BookID === "" ? !bvBookFilter : bvBookFilter === item.BookID;
                return (
                  <Pressable
                    onPress={() => {
                      setBvBookFilter(item.BookID === "" ? undefined : item.BookID);
                      setBookFilterOpen(false);
                      setBookFilterSearch("");
                    }}
                    style={({ pressed }) => [
                      styles.modalRow,
                      { borderBottomColor: colors.border, opacity: pressed ? 0.7 : 1 },
                    ]}
                  >
                    {item.BookID === "" ? (
                      <View style={[styles.modalCover, { alignItems: "center", justifyContent: "center", backgroundColor: colors.muted }]}>
                        <Feather name="layers" size={20} color={colors.mutedForeground} />
                      </View>
                    ) : item.coverUrl ? (
                      <Image source={{ uri: item.coverUrl }} style={styles.modalCover} resizeMode="cover" />
                    ) : (
                      <View style={[styles.modalCover, { alignItems: "center", justifyContent: "center", backgroundColor: colors.muted }]}>
                        <Feather name="book" size={20} color={colors.mutedForeground} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.modalRowTitle,
                          { color: isActive ? colors.primary : colors.foreground, fontFamily: isActive ? "Inter_600SemiBold" : "Inter_400Regular" },
                        ]}
                        numberOfLines={2}
                      >
                        {item.Title}
                      </Text>
                      <Text style={{ fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 2 }}>
                        {item.videoCount} video{item.videoCount === 1 ? "" : "s"}
                      </Text>
                    </View>
                    {isActive && <Feather name="check" size={18} color={colors.primary} />}
                  </Pressable>
                );
              }}
              ListEmptyComponent={
                <View style={{ padding: 24, alignItems: "center" }}>
                  <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular" }}>No books match</Text>
                </View>
              }
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
