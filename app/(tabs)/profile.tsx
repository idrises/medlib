import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ActivityData } from "@/components/ActivityView";
import { ContentThumb } from "@/components/ContentThumb";
import DeviceStatsHeader, { DeviceStats, StatusFilter, DeviceFilter } from "@/components/DeviceStatsHeader";
import UsageView, { UsageViewUser } from "@/components/UsageView";
import { useApp } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import { useSourceList, SourceCarouselItem } from "@/contexts/SourceListContext";
import { formatDuration } from "@/utils/time";
import { useColors } from "@/hooks/useColors";

type AdminUserRow = {
  id: number;
  email: string;
  name: string;
  phone: string | null;
  expireDate: string | null;
  activate: number | null;
  subject: string | null;
  devices: { iphone: string; ipad: string; mac: string };
};

const BASE =
  process.env["EXPO_PUBLIC_API_URL"] ??
  (process.env["EXPO_PUBLIC_DOMAIN"]
    ? `https://${process.env["EXPO_PUBLIC_DOMAIN"]}/api`
    : "https://medical-library-hub.replit.app/api");

const BASE_TABS = ["Viewed", "Liked", "Saved", "Downloads"] as const;
type Tab = typeof BASE_TABS[number] | "Kullanım" | "Kullanıcılar";

const TYPE_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  article: "file-text",
  chapter: "book-open",
  video: "play-circle",
  videoset_video: "play-circle",
  book: "book",
  journal: "layers",
  videoset: "video",
};

const TYPE_COLORS: Record<string, string> = {
  article: "#0057B8", chapter: "#008080", video: "#6D28D9",
  videoset_video: "#D97706", book: "#008080", journal: "#0057B8", videoset: "#D97706",
};

const ROUTES: Record<string, string> = {
  article: "/articles/", chapter: "/chapters/", video: "/videos/",
  videoset_video: "/videos/", book: "/books/", journal: "/journals/", videoset: "/videosets/",
};

function routeFor(contentType: string, contentId: string): string {
  if (contentType === "videoset" || contentType === "videoset_video") return `/videos/${contentId}?kind=entry`;
  return (ROUTES[contentType] || "/") + contentId;
}

function toCarouselItem(it: { contentType: string; contentId: string; title: string; subtitle?: string }): SourceCarouselItem | null {
  if (it.contentType === "video") {
    return { id: it.contentId, type: "video", kind: "book", title: it.title, subtitle: it.subtitle, thumbUrl: null };
  }
  if (it.contentType === "videoset_video" || it.contentType === "videoset") {
    return { id: it.contentId, type: "video", kind: "entry", title: it.title, subtitle: it.subtitle, thumbUrl: null };
  }
  if (it.contentType === "article") {
    return { id: it.contentId, type: "article", title: it.title, subtitle: it.subtitle, thumbUrl: null };
  }
  return null;
}

function buildSourceFromList<T extends { contentType: string }>(
  items: T[],
  tappedType: string,
  toItem: (x: T) => SourceCarouselItem | null,
): SourceCarouselItem[] {
  const wantArticle = tappedType === "article";
  return items
    .filter((x) => (wantArticle ? x.contentType === "article" : x.contentType === "video" || x.contentType === "videoset_video" || x.contentType === "videoset"))
    .map(toItem)
    .filter((x): x is SourceCarouselItem => x !== null);
}

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("Viewed");
  const { user, token } = useAuth();
  const {
    likedItems, bookmarkedItems,
    downloadedVideos, videoProgresses, removeDownload,
    activities,
  } = useApp();
  const { setSource } = useSourceList();

  const handleListPress = (
    label: string,
    list: Array<{ contentType: string; contentId: string; title: string; subtitle?: string }>,
    tapped: { contentType: string; contentId: string; title: string; subtitle?: string },
  ) => {
    const items = buildSourceFromList(list, tapped.contentType, toCarouselItem);
    if (items.length > 0) setSource(label, items);
    router.push(routeFor(tapped.contentType, tapped.contentId) as never);
  };

  const [pendingCount, setPendingCount] = useState(0);

  const isAdmin = !!user?.isAdmin;
  const extraTab: Tab = isAdmin ? "Kullanıcılar" : "Kullanım";
  const tabs: Tab[] = [...BASE_TABS, extraTab];

  const pagerRef = React.useRef<ScrollView>(null);
  const screenW = Dimensions.get("window").width;
  const goToTab = (tab: Tab) => {
    const idx = tabs.indexOf(tab);
    if (idx >= 0) {
      setActiveTab(tab);
      pagerRef.current?.scrollTo({ x: idx * screenW, animated: true });
    }
  };

  const [meActivity, setMeActivity] = useState<ActivityData | null>(null);
  const [meLoading, setMeLoading] = useState(false);

  const [adminUsers, setAdminUsers] = useState<AdminUserRow[]>([]);
  const [adminUsersLoading, setAdminUsersLoading] = useState(false);
  const [userQuery, setUserQuery] = useState("");
  const [sortKey, setSortKey] = useState<"name" | "expire">("expire");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedUser, setSelectedUser] = useState<AdminUserRow | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<ActivityData | null>(null);
  const [selectedLoading, setSelectedLoading] = useState(false);
  const [deviceStats, setDeviceStats] = useState<DeviceStats | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter | null>(null);
  const [deviceFilter, setDeviceFilter] = useState<DeviceFilter | null>(null);

  useEffect(() => {
    if (!isAdmin || !token) return;
    fetch(`${BASE}/admin/device-reset-requests/count`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => setPendingCount(d.count ?? 0))
      .catch(() => {});
  }, [isAdmin, token]);

  useEffect(() => {
    if (isAdmin || !token || activeTab !== "Kullanım" || meActivity) return;
    setMeLoading(true);
    fetch(`${BASE}/me/activity`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setMeActivity(d))
      .catch(() => {})
      .finally(() => setMeLoading(false));
  }, [isAdmin, token, activeTab, meActivity]);

  useEffect(() => {
    if (!isAdmin || !token || activeTab !== "Kullanıcılar" || deviceStats) return;
    fetch(`${BASE}/admin/stats`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setDeviceStats(d))
      .catch(() => {});
  }, [isAdmin, token, activeTab, deviceStats]);

  useEffect(() => {
    if (!isAdmin || !token || activeTab !== "Kullanıcılar") return;
    const t = setTimeout(() => {
      setAdminUsersLoading(true);
      const params = new URLSearchParams();
      if (userQuery.trim()) params.set("email", userQuery.trim());
      if (statusFilter) params.set("status", statusFilter);
      const qs = params.toString() ? `?${params.toString()}` : "";
      fetch(`${BASE}/admin/users${qs}`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(d => setAdminUsers(Array.isArray(d) ? d : []))
        .catch(() => setAdminUsers([]))
        .finally(() => setAdminUsersLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [isAdmin, token, activeTab, userQuery, statusFilter]);

  useEffect(() => {
    if (!selectedUser || !token) return;
    setSelectedLoading(true);
    setSelectedActivity(null);
    fetch(`${BASE}/admin/user-activity/${selectedUser.id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setSelectedActivity(d))
      .catch(() => {})
      .finally(() => setSelectedLoading(false));
  }, [selectedUser, token]);

  const displayName = user ? `${user.firstName} ${user.lastName}`.trim() || user.email : "Kullanıcı";
  const initials = user
    ? ((user.firstName?.[0] ?? "") + (user.lastName?.[0] ?? "")).toUpperCase() || "U"
    : "U";

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom + 80;

  const downloadedWithProgress = downloadedVideos.map(d => ({
    ...d,
    progress: videoProgresses[d.videoId],
  }));

  const tabCounts: Partial<Record<Tab, number>> = {
    Viewed: activities.length,
    Liked: likedItems.length,
    Saved: bookmarkedItems.length,
    Downloads: downloadedVideos.length,
  };

  const meAsUsageUser: UsageViewUser | null = user ? {
    id: user.id,
    email: user.email,
    subject: user.subject ?? null,
    expireDate: user.expireDate ?? null,
  } : null;

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
    avatarRow: {
      flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 20,
    },
    avatar: {
      width: 60, height: 60, borderRadius: 30,
      backgroundColor: colors.primary,
      alignItems: "center", justifyContent: "center",
    },
    avatarText: { color: "#FFF", fontSize: 24, fontFamily: "Inter_700Bold" },
    userName: { fontSize: 20, fontFamily: "Inter_700Bold", color: colors.foreground },
    userRole: { fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 3 },
    statsRow: {
      flexDirection: "row", marginBottom: 2, gap: 0,
    },
    statItem: {
      flex: 1, alignItems: "center", paddingVertical: 6, borderRadius: 8,
    },
    statItemActive: {
      backgroundColor: colors.primary + "12",
    },
    statDivider: {
      width: 1, backgroundColor: colors.border, marginVertical: 6,
    },
    statNum: { fontSize: 18, fontFamily: "Inter_700Bold", color: colors.mutedForeground },
    statNumActive: { color: colors.primary },
    statLabel: { fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 2 },
    tabBar: { flexDirection: "row", flexGrow: 1 },
    tabBtn: {
      flex: 1, paddingVertical: 8, paddingHorizontal: 4, alignItems: "center",
      borderBottomWidth: 2, borderBottomColor: "transparent",
    },
    tabBtnActive: { borderBottomColor: colors.primary },
    tabBtnText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground },
    tabBtnTextActive: { color: colors.primary },
    tabCount: {
      fontSize: 11, fontFamily: "Inter_600SemiBold",
      color: colors.mutedForeground, marginLeft: 3,
    },
    tabCountActive: { color: colors.primary },
    item: {
      backgroundColor: colors.card,
      marginHorizontal: 20, marginVertical: 5,
      borderRadius: colors.radius, padding: 14,
      flexDirection: "row", alignItems: "center", gap: 12,
      shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
    },
    icon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    itemTitle: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium", color: colors.foreground, lineHeight: 20 },
    itemMeta: { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 2 },
    emptyBox: { alignItems: "center", paddingTop: 80 },
    emptyText: { color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14, marginTop: 12 },
    deleteBtn: { padding: 8 },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatarRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.userName} numberOfLines={2}>{displayName}</Text>
            {user?.subject ? (
              <Text style={styles.userRole} numberOfLines={2}>{user.subject}</Text>
            ) : null}
            {user?.expireDate ? (
              <Text style={[styles.userRole, { fontSize: 11, marginTop: 1 }]}>
                Üyelik: {user.expireDate}
              </Text>
            ) : null}
            <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
              {user?.isAdmin ? (
                <Pressable
                  style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary + "15", alignItems: "center", justifyContent: "center" }}
                  onPress={() => router.push("/admin-panel" as never)}
                >
                  <Feather name="shield" size={16} color={colors.primary} />
                  {pendingCount > 0 ? (
                    <View style={{
                      position: "absolute", top: -2, right: -2,
                      backgroundColor: "#DC2626", borderRadius: 8,
                      minWidth: 16, height: 16, alignItems: "center", justifyContent: "center", paddingHorizontal: 3,
                    }}>
                      <Text style={{ color: "#FFF", fontSize: 9, fontFamily: "Inter_700Bold" }}>
                        {pendingCount > 9 ? "9+" : pendingCount}
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
              ) : null}
              <Pressable
                style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center" }}
                onPress={() => router.push("/messages" as never)}
              >
                <Feather name="mail" size={16} color={colors.mutedForeground} />
              </Pressable>
              {user?.aiAccess ? (
                <Pressable
                  style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center" }}
                  onPress={() => router.push("/ai-memory" as never)}
                >
                  <Feather name="cpu" size={16} color={colors.mutedForeground} />
                </Pressable>
              ) : null}
              {user?.aiAccess ? (
                <Pressable
                  style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center" }}
                  onPress={() => router.push("/files" as never)}
                >
                  <Feather name="folder" size={16} color={colors.mutedForeground} />
                </Pressable>
              ) : null}
            </View>
          </View>
          <Pressable
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center", alignSelf: "flex-start", marginLeft: 8 }}
            onPress={() => router.push("/settings" as never)}
            hitSlop={8}
          >
            <Feather name="settings" size={18} color={colors.foreground} />
          </Pressable>
        </View>

        <View style={styles.statsRow}>
          {tabs.map((tab, idx) => {
            const num = tab === "Viewed" ? activities.length
              : tab === "Liked" ? likedItems.length
              : tab === "Saved" ? bookmarkedItems.length
              : tab === "Downloads" ? downloadedVideos.length
              : tab === "Kullanıcılar" ? (isAdmin ? (deviceStats?.total ?? adminUsers.length) : 0)
              : activities.length;
            const isActive = activeTab === tab;
            return (
              <React.Fragment key={tab}>
                {idx > 0 && <View style={styles.statDivider} />}
                <Pressable style={[styles.statItem, isActive && styles.statItemActive]} onPress={() => setActiveTab(tab)}>
                  <Text style={[styles.statNum, isActive && styles.statNumActive]}>{num}</Text>
                </Pressable>
              </React.Fragment>
            );
          })}
        </View>

        <View style={styles.tabBar}>
          {tabs.map(tab => (
            <Pressable
              key={tab}
              onPress={() => goToTab(tab)}
              style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
            >
              <Text style={[styles.tabBtnText, activeTab === tab && styles.tabBtnTextActive]}>{tab}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView
        ref={pagerRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e) => {
          const i = Math.round(e.nativeEvent.contentOffset.x / screenW);
          if (tabs[i] && tabs[i] !== activeTab) setActiveTab(tabs[i]!);
        }}
        style={{ flex: 1 }}
      >
      <View key="Viewed" style={{ width: screenW, flex: 1 }}>
        <FlatList
          data={activities}
          keyExtractor={i => i.id}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: bottomPad }}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.item, pressed && { opacity: 0.7 }]}
              onPress={() => handleListPress("Geçmişten", activities, item)}
            >
              <ContentThumb
                contentType={item.contentType}
                contentId={item.contentId}
                fallbackIcon={TYPE_ICONS[item.contentType] || "file"}
                fallbackColor={TYPE_COLORS[item.contentType] || colors.primary}
                style={styles.icon}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
                {item.subtitle ? <Text style={styles.itemMeta} numberOfLines={1}>{item.subtitle}</Text> : null}
              </View>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Feather name="eye" size={48} color={colors.mutedForeground} />
              <Text style={styles.emptyText}>Henüz görüntülenen içerik yok</Text>
            </View>
          }
        />
      </View>

      <View key="Liked" style={{ width: screenW, flex: 1 }}>
        <FlatList
          data={likedItems}
          keyExtractor={i => i.id}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: bottomPad }}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.item, pressed && { opacity: 0.7 }]}
              onPress={() => handleListPress("Beğendiklerin", likedItems, item)}
            >
              <ContentThumb
                contentType={item.contentType}
                contentId={item.contentId}
                fallbackIcon={TYPE_ICONS[item.contentType] || "file"}
                fallbackColor={TYPE_COLORS[item.contentType] || colors.primary}
                style={styles.icon}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
                {item.subtitle && <Text style={styles.itemMeta} numberOfLines={1}>{item.subtitle}</Text>}
              </View>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Feather name="heart" size={48} color={colors.mutedForeground} />
              <Text style={styles.emptyText}>No liked content yet</Text>
            </View>
          }
        />
      </View>

      <View key="Saved" style={{ width: screenW, flex: 1 }}>
        <FlatList
          data={bookmarkedItems}
          keyExtractor={i => i.id}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: bottomPad }}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.item, pressed && { opacity: 0.7 }]}
              onPress={() => handleListPress("Kaydettiklerin", bookmarkedItems, item)}
            >
              <ContentThumb
                contentType={item.contentType}
                contentId={item.contentId}
                fallbackIcon={TYPE_ICONS[item.contentType] || "file"}
                fallbackColor={TYPE_COLORS[item.contentType] || colors.primary}
                style={styles.icon}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
                {item.subtitle && <Text style={styles.itemMeta} numberOfLines={1}>{item.subtitle}</Text>}
              </View>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Feather name="bookmark" size={48} color={colors.mutedForeground} />
              <Text style={styles.emptyText}>No saved content yet</Text>
            </View>
          }
        />
      </View>

      <View key="Downloads" style={{ width: screenW, flex: 1 }}>
        <FlatList
          data={downloadedWithProgress}
          keyExtractor={d => d.videoId}
          extraData={videoProgresses}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: bottomPad }}
          renderItem={({ item }) => {
            const progressRatio = item.progress && item.progress.duration > 0
              ? item.progress.progress / item.progress.duration : 0;
            return (
              <Pressable
                style={({ pressed }) => [styles.item, pressed && { opacity: 0.7 }]}
                onPress={() => {
                  setSource(
                    "İndirdiklerin",
                    (downloadedVideos ?? []).map((d: any) => ({
                      id: d.videoId,
                      type: "video" as const,
                      kind: d.kind === "entry" ? ("entry" as const) : ("book" as const),
                      title: d.title,
                      subtitle: "",
                      thumbUrl: null,
                      videoUrl: d.localUri ?? d.videoUrl ?? null,
                    })),
                  );
                  router.push(`/videos/${item.videoId}${item.kind === "entry" ? "?kind=entry" : ""}` as never);
                }}
              >
                <ContentThumb
                  contentType="video"
                  contentId={item.videoId}
                  fallbackIcon="download"
                  fallbackColor="#6D28D9"
                  style={styles.icon}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
                  <Text style={styles.itemMeta}>{(item.size / 1024 / 1024).toFixed(1)} MB offline</Text>
                  {progressRatio > 0 && (
                    <>
                      <View style={{ marginTop: 6, height: 4, backgroundColor: colors.border, borderRadius: 2, overflow: "hidden" }}>
                        <View style={{ height: 4, backgroundColor: "#6D28D9", borderRadius: 2, width: `${Math.min(100, Math.round(progressRatio * 100))}%` as any }} />
                      </View>
                      <Text style={{ fontSize: 10, color: "#6D28D9", fontFamily: "Inter_500Medium", marginTop: 2 }}>
                        {Math.min(100, Math.round(progressRatio * 100))}% watched
                      </Text>
                    </>
                  )}
                </View>
                <Pressable style={styles.deleteBtn} onPress={() => removeDownload(item.videoId)}>
                  <Feather name="trash-2" size={18} color={colors.destructive} />
                </Pressable>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Feather name="download" size={48} color={colors.mutedForeground} />
              <Text style={styles.emptyText}>No downloaded videos</Text>
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 6, paddingHorizontal: 40, textAlign: "center" }}>
                Download videos to watch them offline
              </Text>
            </View>
          }
        />
      </View>

      <View key="extra" style={{ width: screenW, flex: 1 }}>
      {!isAdmin ? (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomPad, gap: 14 }}>
          {meLoading && !meActivity ? (
            <View style={{ paddingVertical: 40, alignItems: "center" }}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : (
            <UsageView user={meAsUsageUser} activity={meActivity} showDevices={false} />
          )}
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>
          {selectedUser ? (
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomPad, gap: 14 }}>
              <Pressable
                onPress={() => { setSelectedUser(null); setSelectedActivity(null); }}
                style={{ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingVertical: 6, paddingRight: 12 }}
              >
                <Feather name="chevron-left" size={20} color={colors.primary} />
                <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>Listeye dön</Text>
              </Pressable>
              <View style={{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 14 }}>
                <Text style={{ fontFamily: "Inter_700Bold", color: colors.foreground, fontSize: 16 }}>{selectedUser.name || selectedUser.email}</Text>
                <Text style={{ fontFamily: "Inter_400Regular", color: colors.mutedForeground, fontSize: 12, marginTop: 2 }}>{selectedUser.email}</Text>
                {selectedUser.phone ? (
                  <View style={{ flexDirection: "row", gap: 8, alignItems: "center", marginTop: 10 }}>
                    <Feather name="phone" size={13} color={colors.mutedForeground} />
                    <Text style={{ flex: 1, fontSize: 14, fontFamily: "Inter_500Medium", color: colors.foreground }}>{selectedUser.phone}</Text>
                    <Pressable
                      onPress={() => Linking.openURL(`tel:${selectedUser.phone!.replace(/\s/g, "")}`)}
                      style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: colors.primary + "1A" }}
                    >
                      <Feather name="phone" size={12} color={colors.primary} />
                      <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: colors.primary }}>Ara</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => Linking.openURL(`https://wa.me/${selectedUser.phone!.replace(/\D/g, "")}`)}
                      style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: "#25D36622" }}
                    >
                      <Feather name="message-circle" size={12} color="#25D366" />
                      <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: "#25D366" }}>WhatsApp</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
              {selectedLoading ? (
                <View style={{ paddingVertical: 30, alignItems: "center" }}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              ) : (
                <UsageView
                  user={{
                    id: selectedUser.id,
                    email: selectedUser.email,
                    subject: selectedUser.subject,
                    expireDate: selectedUser.expireDate,
                    devices: selectedUser.devices,
                  }}
                  activity={selectedActivity}
                />
              )}
            </ScrollView>
          ) : (
            <View style={{ flex: 1 }}>
              <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, height: 40 }}>
                  <Feather name="search" size={16} color={colors.mutedForeground} />
                  <TextInput
                    value={userQuery}
                    onChangeText={setUserQuery}
                    placeholder="E-posta ile ara…"
                    placeholderTextColor={colors.mutedForeground}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={{ flex: 1, color: colors.foreground, fontFamily: "Inter_400Regular", fontSize: 14, paddingVertical: 0 }}
                  />
                  {userQuery.length > 0 ? (
                    <Pressable onPress={() => setUserQuery("")} hitSlop={8}>
                      <Feather name="x" size={16} color={colors.mutedForeground} />
                    </Pressable>
                  ) : null}
                </View>
              </View>
              <View style={{ flexDirection: "row", paddingHorizontal: 16, paddingBottom: 8, gap: 8, alignItems: "center" }}>
                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 12 }}>Sırala:</Text>
                <Pressable
                  onPress={() => setSortKey("expire")}
                  style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: sortKey === "expire" ? colors.primary : colors.muted }}
                >
                  <Text style={{ color: sortKey === "expire" ? "#FFF" : colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>Üyelik tarihi</Text>
                </Pressable>
                <Pressable
                  onPress={() => setSortKey("name")}
                  style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: sortKey === "name" ? colors.primary : colors.muted }}
                >
                  <Text style={{ color: sortKey === "name" ? "#FFF" : colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>İsim</Text>
                </Pressable>
                <View style={{ flex: 1 }} />
                <Pressable
                  onPress={() => setSortDir(d => d === "asc" ? "desc" : "asc")}
                  hitSlop={8}
                  style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.muted }}
                >
                  <Feather name={sortDir === "asc" ? "arrow-up" : "arrow-down"} size={14} color={colors.foreground} />
                  <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>
                    {sortDir === "asc" ? "Artan" : "Azalan"}
                  </Text>
                </Pressable>
              </View>
              <FlatList
                data={[...adminUsers].filter(u => {
                  if (statusFilter) {
                    const t = u.expireDate ? new Date(u.expireDate).getTime() : 0;
                    if (!t) {
                      if (statusFilter !== "expired") return false;
                    } else {
                      const days = Math.ceil((t - Date.now()) / 86400000);
                      if (statusFilter === "expired" && days >= 0) return false;
                      if (statusFilter === "expiringSoon" && (days < 0 || days > 30)) return false;
                      if (statusFilter === "active" && days <= 30) return false;
                    }
                  }
                  if (deviceFilter) {
                    if ((u.devices as any)[deviceFilter] !== "kayıtlı") return false;
                  }
                  return true;
                }).sort((a, b) => {
                  const dir = sortDir === "asc" ? 1 : -1;
                  if (sortKey === "name") {
                    return (a.name || a.email || "").localeCompare(b.name || b.email || "", "tr") * dir;
                  }
                  const at = a.expireDate ? new Date(a.expireDate).getTime() : 0;
                  const bt = b.expireDate ? new Date(b.expireDate).getTime() : 0;
                  return (at - bt) * dir;
                })}
                keyExtractor={u => String(u.id)}
                contentContainerStyle={{ paddingTop: 4, paddingBottom: bottomPad }}
                ListHeaderComponent={
                  <View>
                    <DeviceStatsHeader
                      stats={deviceStats}
                      activeFilter={statusFilter}
                      onSelect={k => setStatusFilter(prev => prev === k ? null : k)}
                      activeDeviceFilter={deviceFilter}
                      onDeviceSelect={k => setDeviceFilter(prev => prev === k ? null : k)}
                    />
                  </View>
                }
                ListEmptyComponent={
                  <View style={{ alignItems: "center", paddingTop: 40 }}>
                    {adminUsersLoading ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <>
                        <Feather name="users" size={42} color={colors.mutedForeground} />
                        <Text style={{ color: colors.mutedForeground, marginTop: 10, fontFamily: "Inter_400Regular" }}>
                          Kullanıcı bulunamadı
                        </Text>
                      </>
                    )}
                  </View>
                }
                renderItem={({ item }) => {
                  const labels: Record<string, string> = { iphone: "iPhone", ipad: "iPad", mac: "Mac" };
                  const regList = ["iphone","ipad","mac"]
                    .filter(k => (item.devices as any)[k] === "kayıtlı")
                    .map(k => labels[k]);
                  const deviceText = regList.length > 0 ? regList.join(" · ") : "Cihaz yok";
                  return (
                    <Pressable
                      onPress={() => setSelectedUser(item)}
                      style={({ pressed }) => [styles.item, pressed && { opacity: 0.7 }]}
                    >
                      <View style={[styles.icon, { backgroundColor: colors.primary + "18" }]}>
                        <Feather name="user" size={20} color={colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemTitle} numberOfLines={1}>{item.name || item.email}</Text>
                        <Text style={styles.itemMeta} numberOfLines={1}>{item.email}</Text>
                        <Text style={[styles.itemMeta, { marginTop: 1 }]} numberOfLines={1}>
                          {deviceText} · {item.expireDate ? `Üyelik: ${item.expireDate}` : "Üyelik: —"}
                        </Text>
                        {item.phone ? (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                            <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.foreground }}>
                              {item.phone}
                            </Text>
                            <Pressable
                              onPress={(e) => { e.stopPropagation?.(); Linking.openURL(`tel:${item.phone!.replace(/\s/g, "")}`); }}
                              hitSlop={8}
                              style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.primary + "1A", alignItems: "center", justifyContent: "center" }}
                            >
                              <Feather name="phone" size={12} color={colors.primary} />
                            </Pressable>
                            <Pressable
                              onPress={(e) => { e.stopPropagation?.(); Linking.openURL(`https://wa.me/${item.phone!.replace(/\D/g, "")}`); }}
                              hitSlop={8}
                              style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: "#25D36622", alignItems: "center", justifyContent: "center" }}
                            >
                              <Feather name="message-circle" size={12} color="#25D366" />
                            </Pressable>
                          </View>
                        ) : null}
                      </View>
                      <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
                    </Pressable>
                  );
                }}
              />
            </View>
          )}
        </View>
      )}
      </View>
      </ScrollView>

    </View>
  );
}
