import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ContentThumb } from "@/components/ContentThumb";
import { useApp } from "@/contexts/AppContext";
import { timeAgo } from "@/utils/time";
import { useColors } from "@/hooks/useColors";

const ACTIVITY_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  article: "file-text",
  chapter: "book-open",
  video: "play-circle",
  videoset_video: "play-circle",
  book: "book",
  journal: "layers",
  videoset: "video",
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

const ROUTES: Record<string, (id: string) => string> = {
  article: (id) => `/articles/${id}`,
  chapter: (id) => `/chapters/${id}`,
  video: (id) => `/videos/${id}`,
  videoset_video: (id) => `/videos/${id}?kind=entry`,
  book: (id) => `/books/${id}`,
  journal: (id) => `/journals/${id}`,
  videoset: (id) => `/videosets/${id}`,
};

const TYPE_LABELS: Record<string, string> = {
  article: "Article",
  chapter: "Chapter",
  video: "Book Video",
  videoset_video: "Video",
  book: "Book",
  journal: "Journal",
  videoset: "Video Set",
};

const FILTER_CHIPS = [
  { key: "all", label: "All" },
  { key: "downloads", label: "Downloads" },
  { key: "article", label: "Articles" },
  { key: "journal", label: "Journals" },
  { key: "book", label: "Books" },
  { key: "chapter", label: "Chapters" },
  { key: "videoset", label: "Video Sets" },
  { key: "videoset_video", label: "Videos" },
  { key: "video", label: "Book Videos" },
];

export default function HistoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { activities, downloads, pauseDownload, resumeDownload, deleteDownload, isDownloadComplete } = useApp();
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom + 80;

  const activeDownloads = useMemo(() =>
    downloads.filter(d => d.status !== "completed"), [downloads]);

  const showDownloadsSection = (activeFilter === "all" || activeFilter === "downloads") && activeDownloads.length > 0;

  const filteredActivities = useMemo(() => {
    if (activeFilter === "downloads") return [];
    return activities.filter(a => {
      const matchType = activeFilter === "all" || a.contentType === activeFilter;
      const q = search.trim().toLowerCase();
      const matchSearch = !q || a.title.toLowerCase().includes(q) || (a.subtitle || "").toLowerCase().includes(q);
      return matchType && matchSearch;
    });
  }, [activities, activeFilter, search]);

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingTop: topPad + 16,
      paddingHorizontal: 20,
      paddingBottom: 12,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 12,
    },
    titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    title: { fontSize: 26, fontFamily: "Inter_700Bold", color: colors.foreground },
    subtitle: { fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 2 },
    searchBox: {
      flexDirection: "row", alignItems: "center", gap: 8,
      backgroundColor: colors.muted,
      borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9,
    },
    searchInput: {
      flex: 1, fontSize: 15, fontFamily: "Inter_400Regular",
      color: colors.foreground, padding: 0,
    },
    sectionHeader: {
      flexDirection: "row", alignItems: "center", gap: 8,
      paddingHorizontal: 20, paddingVertical: 10,
      backgroundColor: colors.muted + "80",
      borderBottomWidth: 1, borderBottomColor: colors.border + "50",
    },
    sectionTitle: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.6 },
    dlItem: {
      paddingHorizontal: 20, paddingVertical: 14,
      borderBottomWidth: 1, borderBottomColor: colors.border + "40",
      backgroundColor: colors.card, gap: 10,
    },
    dlRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    dlInfo: { flex: 1 },
    dlTitle: { fontSize: 14, fontFamily: "Inter_500Medium", color: colors.foreground, lineHeight: 20 },
    dlMeta: { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 1 },
    dlControls: { flexDirection: "row", alignItems: "center", gap: 6 },
    dlBtn: {
      width: 34, height: 34, borderRadius: 17,
      alignItems: "center", justifyContent: "center",
      backgroundColor: colors.muted,
    },
    progressTrack: { height: 4, borderRadius: 2, backgroundColor: colors.border, overflow: "hidden" },
    progressFill: { height: 4, borderRadius: 2 },
    progressRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    progressPct: { fontSize: 11, fontFamily: "Inter_600SemiBold", minWidth: 36, textAlign: "right" },
    item: {
      flexDirection: "row", alignItems: "center", gap: 14,
      paddingHorizontal: 20, paddingVertical: 14,
      borderBottomWidth: 1, borderBottomColor: colors.border + "50",
      backgroundColor: colors.card,
    },
    iconWrap: {
      width: 42, height: 42, borderRadius: 21,
      alignItems: "center", justifyContent: "center",
    },
    info: { flex: 1 },
    itemTitle: { fontSize: 14, fontFamily: "Inter_500Medium", color: colors.foreground, lineHeight: 20 },
    itemMeta: { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 2 },
    typeBadge: {
      paddingHorizontal: 7, paddingVertical: 3,
      borderRadius: 4, alignSelf: "flex-start", marginTop: 4,
    },
    typeText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
    emptyBox: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80 },
    emptyText: { color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 15, marginTop: 16 },
    emptyHint: { color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 8, textAlign: "center", paddingHorizontal: 40 },
  });

  const renderDownloadItem = (dl: typeof downloads[0]) => {
    const color = ACTIVITY_COLORS[dl.contentType] || colors.primary;
    const icon = ACTIVITY_ICONS[dl.contentType] || "file";
    const isDownloading = dl.status === "downloading";
    const isPaused = dl.status === "paused";
    const pct = Math.round(dl.progress);

    return (
      <View key={dl.id} style={styles.dlItem}>
        <View style={styles.dlRow}>
          <View style={[styles.iconWrap, { width: 38, height: 38, borderRadius: 19, backgroundColor: color + "15" }]}>
            <Feather name={icon} size={18} color={color} />
          </View>
          <View style={styles.dlInfo}>
            <Text style={styles.dlTitle} numberOfLines={1}>{dl.title}</Text>
            {dl.subtitle ? <Text style={styles.dlMeta} numberOfLines={1}>{dl.subtitle}</Text> : null}
          </View>
          <View style={styles.dlControls}>
            {isDownloading && (
              <Pressable style={styles.dlBtn} onPress={() => pauseDownload(dl.contentId)}>
                <Feather name="pause" size={15} color={colors.foreground} />
              </Pressable>
            )}
            {isPaused && (
              <Pressable style={styles.dlBtn} onPress={() => resumeDownload(dl.contentId)}>
                <Feather name="play" size={15} color={colors.foreground} />
              </Pressable>
            )}
            <Pressable style={[styles.dlBtn, { backgroundColor: "#FF444420" }]} onPress={() => deleteDownload(dl.contentId)}>
              <Feather name="trash-2" size={15} color="#FF4444" />
            </Pressable>
          </View>
        </View>
        <View style={styles.progressRow}>
          <View style={[styles.progressTrack, { flex: 1 }]}>
            <View style={[styles.progressFill, {
              width: `${pct}%` as any,
              backgroundColor: isDownloading ? color : isPaused ? colors.mutedForeground : color,
            }]} />
          </View>
          <Text style={[styles.progressPct, { color: isDownloading ? color : colors.mutedForeground }]}>
            {pct}%
          </Text>
          <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>
            {isDownloading ? "İndiriliyor..." : "Duraklatıldı"}
          </Text>
        </View>
      </View>
    );
  };

  const totalDisplayed = activeFilter === "downloads" ? 0 : filteredActivities.length;
  const totalBase = activeFilter === "downloads" ? 0 : activities.length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View>
            <Text style={styles.title}>History</Text>
            <Text style={styles.subtitle}>
              {activeFilter === "downloads"
                ? `${activeDownloads.length} active download${activeDownloads.length !== 1 ? "s" : ""}`
                : `${totalDisplayed} / ${totalBase} item${totalBase !== 1 ? "s" : ""}`}
            </Text>
          </View>
          {(search || activeFilter !== "all") && (
            <Pressable
              onPress={() => { setSearch(""); setActiveFilter("all"); }}
              style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.muted, borderRadius: 8 }}
            >
              <Feather name="x" size={13} color={colors.mutedForeground} />
              <Text style={{ fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_500Medium" }}>Clear</Text>
            </Pressable>
          )}
        </View>

        {activeFilter !== "downloads" && (
          <View style={styles.searchBox}>
            <Feather name="search" size={16} color={colors.mutedForeground} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search history..."
              placeholderTextColor={colors.mutedForeground}
              returnKeyType="search"
            />
          </View>
        )}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 8, flexDirection: "row" }}>
          {FILTER_CHIPS.map(chip => {
            const isActive = activeFilter === chip.key;
            const chipColor = chip.key === "all" ? colors.primary : chip.key === "downloads" ? "#059669" : (ACTIVITY_COLORS[chip.key] || colors.primary);
            const badge = chip.key === "downloads" && activeDownloads.length > 0 ? activeDownloads.length : null;
            return (
              <Pressable
                key={chip.key}
                onPress={() => setActiveFilter(chip.key)}
                style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: isActive ? chipColor : colors.muted }}
              >
                <Text style={{ fontSize: 13, fontFamily: isActive ? "Inter_600SemiBold" : "Inter_400Regular", color: isActive ? "#FFF" : colors.mutedForeground }}>
                  {chip.label}
                </Text>
                {badge !== null && (
                  <View style={{ backgroundColor: isActive ? "rgba(255,255,255,0.3)" : "#059669", borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1, minWidth: 16, alignItems: "center" }}>
                    <Text style={{ fontSize: 10, fontFamily: "Inter_700Bold", color: "#FFF" }}>{badge}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {activeFilter === "downloads" ? (
        activeDownloads.length === 0 ? (
          <View style={styles.emptyBox}>
            <Feather name="download" size={48} color={colors.mutedForeground} />
            <Text style={styles.emptyText}>No active downloads</Text>
            <Text style={styles.emptyHint}>Bookmark content to automatically start downloading it offline</Text>
          </View>
        ) : (
          <FlatList
            data={activeDownloads}
            keyExtractor={d => d.id}
            renderItem={({ item }) => renderDownloadItem(item)}
            contentContainerStyle={{ paddingBottom: bottomPad }}
          />
        )
      ) : (
        <FlatList
          data={filteredActivities}
          keyExtractor={a => a.id}
          ListHeaderComponent={showDownloadsSection ? (
            <View>
              <View style={styles.sectionHeader}>
                <Feather name="download" size={13} color={colors.mutedForeground} />
                <Text style={styles.sectionTitle}>Downloading ({activeDownloads.length})</Text>
              </View>
              {activeDownloads.map(dl => renderDownloadItem(dl))}
              {filteredActivities.length > 0 && (
                <View style={[styles.sectionHeader, { marginTop: 4 }]}>
                  <Feather name="clock" size={13} color={colors.mutedForeground} />
                  <Text style={styles.sectionTitle}>Recent Activity</Text>
                </View>
              )}
            </View>
          ) : null}
          renderItem={({ item }) => {
            const color = ACTIVITY_COLORS[item.contentType] || colors.primary;
            const icon = ACTIVITY_ICONS[item.contentType] || "file";
            const routeFn = ROUTES[item.contentType];
            const route = routeFn ? routeFn(item.contentId) : "/";
            const label = TYPE_LABELS[item.contentType] || item.contentType;
            const dlComplete = isDownloadComplete(item.contentId);
            const isLocked = !dlComplete;
            return (
              <Pressable
                style={({ pressed }) => [styles.item, pressed && !isLocked && { opacity: 0.7 }, isLocked && { opacity: 0.55 }]}
                onPress={() => { if (!isLocked) router.push(route as never); }}
                disabled={isLocked}
              >
                {isLocked ? (
                  <View style={[styles.iconWrap, { backgroundColor: color + "18" }]}>
                    <Feather name="lock" size={20} color={colors.mutedForeground} />
                  </View>
                ) : (
                  <ContentThumb
                    contentType={item.contentType}
                    contentId={item.contentId}
                    fallbackIcon={icon}
                    fallbackColor={color}
                    style={styles.iconWrap}
                  />
                )}
                <View style={styles.info}>
                  <Text style={[styles.itemTitle, isLocked && { color: colors.mutedForeground }]} numberOfLines={2}>{item.title}</Text>
                  {item.subtitle && (
                    <Text style={styles.itemMeta} numberOfLines={1}>{item.subtitle}</Text>
                  )}
                  {isLocked ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
                      <Feather name="download" size={10} color={colors.mutedForeground} />
                      <Text style={{ fontSize: 10, fontFamily: "Inter_500Medium", color: colors.mutedForeground }}>
                        İndirme tamamlanana kadar açılamaz
                      </Text>
                    </View>
                  ) : (
                    <View style={[styles.typeBadge, { backgroundColor: color + "15" }]}>
                      <Text style={[styles.typeText, { color }]}>{label}</Text>
                    </View>
                  )}
                </View>
                <View style={{ alignItems: "flex-end", gap: 6 }}>
                  <Text style={{ fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_400Regular" }}>
                    {timeAgo(item.timestamp)}
                  </Text>
                  {isLocked
                    ? <Feather name="lock" size={14} color={colors.mutedForeground} />
                    : <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                  }
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            activities.length === 0 ? (
              <View style={styles.emptyBox}>
                <Feather name="clock" size={56} color={colors.mutedForeground} />
                <Text style={styles.emptyText}>Your activity will appear here</Text>
                <Text style={styles.emptyHint}>Read articles, watch videos, or browse books to see your history</Text>
              </View>
            ) : (
              <View style={styles.emptyBox}>
                <Feather name="search" size={48} color={colors.mutedForeground} />
                <Text style={styles.emptyText}>No results found</Text>
                <Text style={styles.emptyHint}>Try a different search or filter</Text>
              </View>
            )
          }
          contentContainerStyle={{ paddingBottom: bottomPad }}
        />
      )}
    </View>
  );
}
