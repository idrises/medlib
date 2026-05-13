import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, G, Rect, Text as SvgText } from "react-native-svg";

import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { AdminGroupsView } from "@/components/admin/AdminGroupsView";
import { AdminBlocksView } from "@/components/admin/AdminBlocksView";
import { AdminSmokeView } from "@/components/admin/AdminSmokeView";
import { AdminFineTuneView } from "@/components/admin/AdminFineTuneView";
import { AdminKnowledgeBaseView } from "@/components/admin/AdminKnowledgeBaseView";
import { AdminBadIdsView } from "@/components/admin/AdminBadIdsView";
import { AdminPrecisionDedupeView } from "@/components/admin/AdminPrecisionDedupeView";
import { AdminStartupConfigView } from "@/components/admin/AdminStartupConfigView";

const BASE =
  process.env["EXPO_PUBLIC_API_URL"] ??
  (process.env["EXPO_PUBLIC_DOMAIN"]
    ? `https://${process.env["EXPO_PUBLIC_DOMAIN"]}/api`
    : "https://medical-library-hub.replit.app/api");

type ResetStatus = "pending" | "approved" | "rejected";

interface ResetRequest {
  ID: number;
  UserID: number;
  UserEmail: string;
  UserName: string;
  DeviceType: string;
  NewDeviceId: string;
  Status: ResetStatus;
  CreatedAt: string;
  ProcessedAt: string | null;
  Note: string | null;
}

const DEVICE_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  iphone: "smartphone", ipad: "tablet", mac: "monitor",
};
const DEVICE_LABELS: Record<string, string> = {
  iphone: "iPhone", ipad: "iPad", mac: "Mac",
};

function normalizeSearch(s: string): string {
  return s
    .toLocaleLowerCase("tr-TR")
    .replace(/İ/g, "i").replace(/ı/g, "i").replace(/I/g, "i")
    .replace(/ş/g, "s").replace(/Ş/g, "s")
    .replace(/ğ/g, "g").replace(/Ğ/g, "g")
    .replace(/ü/g, "u").replace(/Ü/g, "u")
    .replace(/ö/g, "o").replace(/Ö/g, "o")
    .replace(/ç/g, "c").replace(/Ç/g, "c");
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Az önce";
  if (mins < 60) return `${mins} dk önce`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} sa önce`;
  return `${Math.floor(hrs / 24)} gün önce`;
}

export default function AdminPanelScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, token } = useAuth();

  const [status, setStatus] = useState<ResetStatus>("pending");
  const [requests, setRequests] = useState<ResetRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // TOTP setup state
  const [activeView, setActiveView] = useState<"requests" | "totp" | "devices" | "groups" | "blocks" | "smoke" | "bad-ids" | "precision" | "config" | "finetune" | "kb">("requests");

  // Device management state
  type DeviceUser = {
    id: number; name: string; email: string;
    expireDate?: string | null; daysLeft?: number | null;
    activate?: number | null; subject?: string | null;
    phone?: string | null;
    devices: { type: string; label: string; uuid: string; model: string | null }[];
  };
  type DeviceStats = {
    total: number; active: number; expiringSoon: number; expired: number;
    devices: { iphone: number; ipad: number; mac: number };
  };
  const [deviceUsers, setDeviceUsers] = useState<DeviceUser[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [deviceActionLoading, setDeviceActionLoading] = useState<string | null>(null);
  const [deviceSearch, setDeviceSearch] = useState("");
  const [deviceStats, setDeviceStats] = useState<DeviceStats | null>(null);
  const [selectedUser, setSelectedUser] = useState<DeviceUser | null>(null);
  type DeviceSort = "name_asc" | "name_desc" | "expire_asc" | "expire_desc";
  const [deviceSort, setDeviceSort] = useState<DeviceSort>("name_asc");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [deviceTypeFilter, setDeviceTypeFilter] = useState<"iphone" | "ipad" | "mac" | null>(null);
  type DeviceStatusFilter = "active" | "expiringSoon" | "expired";
  const [deviceStatusFilter, setDeviceStatusFilter] = useState<DeviceStatusFilter | null>(null);

  const fetchDevices = useCallback(async () => {
    if (!token) return;
    setDevicesLoading(true);
    try {
      const res = await fetch(`${BASE}/admin/devices`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await res.json();
      if (res.ok) setDeviceUsers(d.users ?? []);
    } catch {} finally { setDevicesLoading(false); }
  }, [token]);

  const fetchStats = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${BASE}/admin/stats`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await res.json();
      if (res.ok) setDeviceStats(d);
    } catch {}
  }, [token]);

  const removeDevice = async (userId: number, deviceType: string, label: string) => {
    Alert.alert(
      "Cihazı Kaldır",
      `Bu kullanıcının ${label} kaydı silinecek. Kullanıcı bir sonraki girişte yeni cihazını otomatik kaydetmiş olacak. Devam edilsin mi?`,
      [
        { text: "İptal", style: "cancel" },
        {
          text: "Kaldır", style: "destructive",
          onPress: async () => {
            const key = `${userId}-${deviceType}`;
            setDeviceActionLoading(key);
            try {
              const res = await fetch(`${BASE}/admin/devices/${userId}/${deviceType}`, {
                method: "DELETE", headers: { Authorization: `Bearer ${token}` },
              });
              if (res.ok) {
                setDeviceUsers(prev => prev.map(u => u.id === userId
                  ? { ...u, devices: u.devices.filter(d => d.type !== deviceType) }
                  : u
                ).filter(u => u.devices.length > 0));
              }
            } catch {} finally { setDeviceActionLoading(null); }
          },
        },
      ]
    );
  };

  useEffect(() => {
    if (activeView === "devices") { fetchDevices(); fetchStats(); }
  }, [activeView, fetchDevices, fetchStats]);
  const [smokeRefreshMs, setSmokeRefreshMs] = useState(60_000);
  const [lastSmokeStatus, setLastSmokeStatus] = useState<"ok" | "failed" | "harness-error" | null>(null);

  const fetchLastSmoke = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${BASE}/_internal/last-smoke`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const d = await res.json();
        if (d.lastStatus) setLastSmokeStatus(d.lastStatus);
      }
    } catch {}
  }, [token]);

  useEffect(() => { fetchLastSmoke(); }, [fetchLastSmoke]);

  useEffect(() => {
    if (!token || smokeRefreshMs <= 0) return;
    const id = setInterval(fetchLastSmoke, smokeRefreshMs);
    return () => clearInterval(id);
  }, [token, smokeRefreshMs, fetchLastSmoke]);

  const [badIdCount, setBadIdCount] = useState<number | null>(null);

  const fetchBadIdCount = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${BASE}/_internal/bad-ids`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const d = await res.json();
        if (typeof d.badIdCoercionCount === "number") setBadIdCount(d.badIdCoercionCount);
      }
    } catch {}
  }, [token]);

  useEffect(() => { fetchBadIdCount(); }, [fetchBadIdCount]);

  useEffect(() => {
    if (!token || smokeRefreshMs <= 0) return;
    const id = setInterval(fetchBadIdCount, smokeRefreshMs);
    return () => clearInterval(id);
  }, [token, smokeRefreshMs, fetchBadIdCount]);

  useEffect(() => {
    if (!token) return;
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") fetchBadIdCount();
    });
    return () => sub.remove();
  }, [token, fetchBadIdCount]);

  const [totpStatus, setTotpStatus] = useState<"unknown" | "setup" | "not_setup">("unknown");
  const [totpQr, setTotpQr] = useState<string | null>(null);
  const [totpSecret, setTotpSecret] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [totpMsg, setTotpMsg] = useState<string | null>(null);
  const [totpLoading, setTotpLoading] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom + 80;

  const fetchTotpStatus = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${BASE}/totp/status`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await res.json();
      setTotpStatus(d.setup ? "setup" : "not_setup");
    } catch { setTotpStatus("not_setup"); }
  }, [token]);

  const startTotpSetup = async () => {
    if (!token) return;
    setTotpLoading(true); setTotpMsg(null);
    try {
      const res = await fetch(`${BASE}/totp/setup`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const d = await res.json();
      if (res.ok) { setTotpQr(d.qrDataUrl); setTotpSecret(d.secret); }
      else setTotpMsg(d.error);
    } catch { setTotpMsg("Sunucuya bağlanılamadı."); }
    finally { setTotpLoading(false); }
  };

  const resetTotpSetup = async () => {
    if (!token) return;
    Alert.alert(
      "Sıfırla",
      "Mevcut kurulum silinecek. Authenticator'daki eski MedLib girişini de silmeniz gerekecek. Devam edilsin mi?",
      [
        { text: "İptal", style: "cancel" },
        {
          text: "Sıfırla",
          style: "destructive",
          onPress: async () => {
            setTotpLoading(true); setTotpMsg(null);
            try {
              const res = await fetch(`${BASE}/totp/reset-setup`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
              const d = await res.json();
              if (res.ok) {
                setTotpQr(null); setTotpSecret(null); setTotpCode("");
                setTotpMsg("Sıfırlandı. Şimdi 'TOTP Kurulumunu Başlat'a basın.");
              } else setTotpMsg(d.error);
            } catch { setTotpMsg("Sunucuya bağlanılamadı."); }
            finally { setTotpLoading(false); }
          },
        },
      ]
    );
  };

  const verifyTotpCode = async () => {
    if (!token || !totpCode.trim()) return;
    setTotpLoading(true); setTotpMsg(null);
    try {
      const res = await fetch(`${BASE}/totp/verify`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ code: totpCode.trim() }),
      });
      const d = await res.json();
      if (res.ok) {
        setTotpMsg("TOTP başarıyla etkinleştirildi! Artık her girişte kod sorulacak.");
        setTotpStatus("setup"); setTotpQr(null); setTotpSecret(null); setTotpCode("");
      } else {
        setTotpMsg(d.error ?? "Geçersiz kod.");
      }
    } catch { setTotpMsg("Sunucuya bağlanılamadı."); }
    finally { setTotpLoading(false); }
  };

  useEffect(() => { if (activeView === "totp") fetchTotpStatus(); }, [activeView, fetchTotpStatus]);
  useEffect(() => { if (activeView === "smoke") fetchLastSmoke(); }, [activeView, fetchLastSmoke]);
  useEffect(() => { if (activeView === "bad-ids") fetchBadIdCount(); }, [activeView, fetchBadIdCount]);

  const fetchRequests = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/admin/device-reset-requests?status=${status}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setRequests(Array.isArray(data) ? data : []);
    } catch {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [token, status]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);
  useFocusEffect(useCallback(() => { fetchDevices(); fetchRequests(); }, [fetchDevices, fetchRequests]));

  async function handleAction(id: number, action: "approve" | "reject") {
    setActionLoading(id);
    try {
      const res = await fetch(`${BASE}/admin/device-reset-requests/${id}/${action}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok) {
        setRequests(prev => prev.filter(r => r.ID !== id));
        Alert.alert("Başarılı", data.message);
      } else {
        Alert.alert("Hata", data.error ?? "İşlem başarısız.");
      }
    } catch {
      Alert.alert("Hata", "Sunucuya bağlanılamadı.");
    } finally {
      setActionLoading(null);
    }
  }

  const STATUS_TABS: ResetStatus[] = ["pending", "approved", "rejected"];
  const STATUS_LABELS: Record<ResetStatus, string> = {
    pending: "Bekleyen", approved: "Onaylanan", rejected: "Reddedilen",
  };
  const STATUS_COLORS: Record<ResetStatus, string> = {
    pending: "#D97706", approved: "#16A34A", rejected: "#DC2626",
  };

  // ─── Donut chart (üyelik durumu) ───────────────────────────────────────
  function DonutChart({ stats }: { stats: DeviceStats }) {
    const total = stats.active + stats.expiringSoon + stats.expired || 1;
    const size = 120; const r = 44; const cx = size / 2; const cy = size / 2;
    const circ = 2 * Math.PI * r;
    const segments: { key: DeviceStatusFilter; value: number; color: string; label: string }[] = [
      { key: "active",       value: stats.active,       color: "#16A34A", label: "Aktif" },
      { key: "expiringSoon", value: stats.expiringSoon, color: "#D97706", label: "≤30 gün" },
      { key: "expired",      value: stats.expired,      color: "#DC2626", label: "Süresi doldu" },
    ];
    let offset = 0;
    return (
      <View style={{ alignItems: "center" }}>
        <Svg width={size} height={size}>
          <G rotation="-90" origin={`${cx},${cy}`}>
            {segments.map((seg, i) => {
              const dash = (seg.value / total) * circ;
              const gap = circ - dash;
              const el = (
                <Circle
                  key={i}
                  cx={cx} cy={cy} r={r}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={14}
                  strokeDasharray={`${dash} ${gap}`}
                  strokeDashoffset={-offset}
                />
              );
              offset += dash;
              return el;
            })}
          </G>
          <SvgText x={cx} y={cy - 6} textAnchor="middle" fontSize={20} fontWeight="bold" fill={colors.foreground}>{total}</SvgText>
          <SvgText x={cx} y={cy + 12} textAnchor="middle" fontSize={10} fill={colors.mutedForeground}>kullanıcı</SvgText>
        </Svg>
        <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", justifyContent: "center", marginTop: 6 }}>
          {segments.map(s => {
            const active = deviceStatusFilter === s.key;
            return (
              <Pressable
                key={s.key}
                onPress={() => setDeviceStatusFilter(prev => prev === s.key ? null : s.key)}
                hitSlop={4}
                style={{
                  flexDirection: "row", alignItems: "center", gap: 4,
                  paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999,
                  backgroundColor: active ? s.color + "22" : "transparent",
                  borderWidth: 1, borderColor: active ? s.color : "transparent",
                }}
              >
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: s.color }} />
                <Text style={{ fontSize: 10, color: active ? s.color : colors.mutedForeground, fontFamily: active ? "Inter_600SemiBold" : "Inter_400Regular" }}>
                  {s.label} ({s.value})
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  // ─── Bar chart (cihaz dağılımı) ────────────────────────────────────────
  function DeviceBarChart({ stats }: { stats: DeviceStats }) {
    const bars: { key: "iphone" | "ipad" | "mac"; label: string; value: number; color: string }[] = [
      { key: "iphone", label: "iPhone", value: stats.devices.iphone, color: "#0057B8" },
      { key: "ipad",   label: "iPad",   value: stats.devices.ipad,   color: "#008080" },
      { key: "mac",    label: "Mac",    value: stats.devices.mac,    color: "#6D28D9" },
    ];
    const maxVal = Math.max(...bars.map(b => b.value), 1);
    return (
      <View style={{ flex: 1, paddingLeft: 8 }}>
        <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Cihaz Dağılımı</Text>
        {bars.map(b => {
          const active = deviceTypeFilter === b.key;
          return (
            <Pressable
              key={b.label}
              onPress={() => setDeviceTypeFilter(active ? null : b.key)}
              style={{
                marginBottom: 8, paddingVertical: 4, paddingHorizontal: 6, borderRadius: 6,
                backgroundColor: active ? b.color + "18" : "transparent",
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3, alignItems: "center" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Text style={{ fontSize: 12, fontFamily: active ? "Inter_700Bold" : "Inter_500Medium", color: active ? b.color : colors.foreground }}>{b.label}</Text>
                  {active ? <Feather name="filter" size={10} color={b.color} /> : null}
                </View>
                <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: b.color }}>{b.value}</Text>
              </View>
              <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.border }}>
                <View style={{
                  height: 8, borderRadius: 4, backgroundColor: b.color,
                  width: `${(b.value / maxVal) * 100}%` as any,
                }} />
              </View>
            </Pressable>
          );
        })}
      </View>
    );
  }

  // ─── Kullanıcı detay modal ──────────────────────────────────────────────
  type ActivityData = {
    email: string;
    totals: { chapters: number; videos: number; videoSetEntries: number; articles: number };
    activeDays: number;
    firstActivity: string | null;
    lastActivity: string | null;
    byMonth: { yr: number; mo: number; total: number }[];
    recent: { type: string; title: string; date: string; platform: string }[];
  };

  const MONTH_TR = ["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];
  const TYPE_META: Record<string, { label: string; icon: keyof typeof Feather.glyphMap; color: string }> = {
    chapter:        { label: "Bölüm",    icon: "book-open",   color: "#0057B8" },
    video:          { label: "Video",    icon: "play-circle", color: "#D97706" },
    videoset:       { label: "Video Set",icon: "video",       color: "#7C3AED" },
    videoset_video: { label: "Video Set",icon: "video",       color: "#7C3AED" },
    article:        { label: "Makale",   icon: "file-text",   color: "#059669" },
  };

  function ActivityMonthChart({ byMonth }: { byMonth: { yr: number; mo: number; total: number }[] }) {
    const now = new Date();
    const months: { label: string; total: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const yr = d.getFullYear(); const mo = d.getMonth() + 1;
      const found = byMonth.find(b => b.yr === yr && b.mo === mo);
      months.push({ label: MONTH_TR[mo - 1]!, total: found ? found.total : 0 });
    }
    const maxVal = Math.max(...months.map(m => m.total), 1);
    const barH = 80; const gap = 4; const barW = 18;
    const totalW = months.length * (barW + gap);
    return (
      <View>
        <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Son 12 Ay Aktivite</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Svg width={totalW} height={barH + 22}>
            {months.map((m, i) => {
              const h = Math.max(3, Math.round((m.total / maxVal) * barH));
              const x = i * (barW + gap); const y = barH - h;
              return (
                <G key={i}>
                  <Rect x={x} y={y} width={barW} height={h} rx={3} fill={m.total > 0 ? "#0057B8" : colors.border} />
                  <SvgText x={x + barW / 2} y={barH + 16} textAnchor="middle" fontSize={8} fontFamily="Inter_400Regular" fill={colors.mutedForeground}>{m.label}</SvgText>
                  {m.total > 0 ? (
                    <SvgText x={x + barW / 2} y={y - 3} textAnchor="middle" fontSize={8} fontFamily="Inter_600SemiBold" fill={colors.primary}>{m.total}</SvgText>
                  ) : null}
                </G>
              );
            })}
          </Svg>
        </ScrollView>
      </View>
    );
  }

  function ActivityTypeDonut({ totals }: { totals: ActivityData["totals"] }) {
    const entries = [
      { key: "chapter",  val: totals.chapters },
      { key: "video",    val: totals.videos },
      { key: "videoset", val: totals.videoSetEntries },
      { key: "article",  val: totals.articles },
    ].filter(e => e.val > 0);
    const total = entries.reduce((s, e) => s + e.val, 0);
    if (total === 0) return null;
    const R = 32; const cx = 48; const cy = 48; const sw = 14;
    const circ = 2 * Math.PI * R;
    let cumPct = 0;
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
        <Svg width={96} height={96}>
          <Circle cx={cx} cy={cy} r={R} fill="none" stroke={colors.border} strokeWidth={sw} />
          {entries.map(e => {
            const pct = e.val / total;
            const dash = pct * circ;
            const offset = -cumPct * circ;
            cumPct += pct;
            return (
              <Circle
                key={e.key}
                cx={cx} cy={cy} r={R}
                fill="none"
                stroke={TYPE_META[e.key]!.color}
                strokeWidth={sw}
                strokeDasharray={`${dash} ${circ}`}
                strokeDashoffset={offset}
                rotation={-90}
                originX={cx}
                originY={cy}
              />
            );
          })}
          <SvgText x={cx} y={cy + 5} textAnchor="middle" fontSize={14} fontFamily="Inter_700Bold" fill={colors.foreground}>{total}</SvgText>
        </Svg>
        <View style={{ gap: 7, flex: 1 }}>
          {entries.map(e => (
            <View key={e.key} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: TYPE_META[e.key]!.color }} />
              <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.foreground, flex: 1 }}>{TYPE_META[e.key]!.label}</Text>
              <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>{e.val}</Text>
              <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground, minWidth: 28, textAlign: "right" }}>{Math.round((e.val / total) * 100)}%</Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

  function UserDetailModal({ user, onClose }: { user: DeviceUser; onClose: () => void }) {
    const expDate = user.expireDate ? new Date(user.expireDate) : null;
    const isExpired = expDate ? expDate < new Date() : true;
    const daysLeft = user.daysLeft;
    const statusColor = isExpired ? "#DC2626" : daysLeft != null && daysLeft <= 30 ? "#D97706" : "#16A34A";
    const statusText = isExpired ? "Süresi Dolmuş" : `${daysLeft} gün kaldı`;
    const [modalTab, setModalTab] = useState<"info" | "usage">("info");
    const [activity, setActivity] = useState<ActivityData | null>(null);
    const [actLoading, setActLoading] = useState(false);

    const fetchActivity = useCallback(async () => {
      if (activity || actLoading) return;
      setActLoading(true);
      try {
        const res = await fetch(`${BASE}/admin/user-activity/${user.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const d = await res.json();
        if (res.ok) setActivity(d);
      } catch {} finally { setActLoading(false); }
    }, [activity, actLoading]);

    useEffect(() => {
      if (modalTab === "usage") fetchActivity();
    }, [modalTab]);

    return (
      <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          {/* Modal Header */}
          <View style={{
            flexDirection: "row", alignItems: "center", paddingHorizontal: 20,
            paddingTop: 20, paddingBottom: 0,
            backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border,
          }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 17, fontFamily: "Inter_700Bold", color: colors.foreground }} numberOfLines={1}>{user.name}</Text>
              <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 2 }}>{user.email}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} style={{ padding: 4, marginBottom: 4 }}>
              <Feather name="x" size={22} color={colors.foreground} />
            </Pressable>
          </View>

          {/* Modal Tabs */}
          <View style={{ flexDirection: "row", backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            {(["info", "usage"] as const).map(tab => (
              <Pressable
                key={tab}
                onPress={() => setModalTab(tab)}
                style={{ flex: 1, paddingVertical: 12, alignItems: "center", borderBottomWidth: 2, borderBottomColor: modalTab === tab ? colors.primary : "transparent" }}
              >
                <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: modalTab === tab ? colors.primary : colors.mutedForeground }}>
                  {tab === "info" ? "Genel Bilgiler" : "Kullanım"}
                </Text>
              </Pressable>
            ))}
          </View>

          {modalTab === "info" ? (
            <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }} showsVerticalScrollIndicator={false}>
              {/* Üyelik Durumu */}
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>Üyelik Bilgileri</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: statusColor + "18", alignItems: "center", justifyContent: "center" }}>
                    <Feather name={isExpired ? "x-circle" : "check-circle"} size={20} color={statusColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: statusColor }}>{statusText}</Text>
                    {expDate ? (
                      <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>
                        Bitiş: {expDate.toLocaleDateString("tr-TR")}
                      </Text>
                    ) : null}
                  </View>
                </View>
                {user.subject ? (
                  <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                    <Feather name="tag" size={13} color={colors.mutedForeground} />
                    <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: colors.foreground }}>{user.subject}</Text>
                  </View>
                ) : null}
                <View style={{ flexDirection: "row", gap: 6, alignItems: "center", marginTop: 6 }}>
                  <Feather name="hash" size={13} color={colors.mutedForeground} />
                  <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>Kullanıcı ID: {user.id}</Text>
                </View>
                {user.phone ? (
                  <Pressable
                    onPress={() => Linking.openURL(`https://wa.me/${user.phone!.replace(/\D/g, "")}`)}
                    style={{ flexDirection: "row", gap: 8, alignItems: "center", marginTop: 10, padding: 10, borderRadius: 8, backgroundColor: "#25D36615", borderWidth: 1, borderColor: "#25D36640" }}
                  >
                    <Feather name="phone" size={16} color="#25D366" />
                    <Text style={{ flex: 1, fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#25D366" }}>{user.phone}</Text>
                    <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: "#25D366" }}>WhatsApp</Text>
                  </Pressable>
                ) : null}
              </View>

              {/* Kayıtlı Cihazlar */}
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>
                  Kayıtlı Cihazlar ({user.devices.length})
                </Text>
                {user.devices.map((d, i) => (
                  <View key={d.type} style={{ borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border, paddingTop: i === 0 ? 0 : 12, marginTop: i === 0 ? 0 : 12 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}>
                      <View style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: colors.primary + "15", alignItems: "center", justifyContent: "center" }}>
                        <Feather name={d.type === "ipad" ? "tablet" : d.type === "mac" ? "monitor" : "smartphone"} size={16} color={colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>{d.label}</Text>
                        <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>{d.model ?? "Model bilinmiyor"}</Text>
                      </View>
                      <Pressable
                        onPress={() => { onClose(); setTimeout(() => removeDevice(user.id, d.type, d.label), 400); }}
                        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 6, borderRadius: 8, backgroundColor: "#DC262612" })}
                        hitSlop={8}
                      >
                        <Feather name="log-out" size={16} color="#DC2626" />
                      </Pressable>
                    </View>
                    <Pressable
                      onPress={async () => { await Clipboard.setStringAsync(d.uuid); Alert.alert("Kopyalandı", "UUID panoya kopyalandı."); }}
                      style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.muted, borderRadius: 8, borderWidth: 1, borderColor: colors.border, paddingVertical: 8, paddingHorizontal: 10 }}
                    >
                      <Text style={{ flex: 1, fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground }} numberOfLines={1}>{d.uuid}</Text>
                      <Feather name="copy" size={13} color={colors.mutedForeground} />
                    </Pressable>
                  </View>
                ))}
              </View>
            </ScrollView>
          ) : (
            /* Usage Tab */
            actLoading ? (
              <View style={[styles.center, { flex: 1 }]}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 10 }}>Kullanım verileri yükleniyor…</Text>
              </View>
            ) : !activity ? (
              <View style={[styles.center, { flex: 1 }]}>
                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13 }}>Veri bulunamadı.</Text>
              </View>
            ) : (
              <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }} showsVerticalScrollIndicator={false}>
                {/* 4 stat cards */}
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                  {(["chapter","video","videoset","article"] as const).map(k => {
                    const meta = TYPE_META[k]!;
                    const val = k === "chapter" ? activity.totals.chapters
                      : k === "video" ? activity.totals.videos
                      : k === "videoset" ? activity.totals.videoSetEntries
                      : activity.totals.articles;
                    return (
                      <View key={k} style={{ flex: 1, minWidth: "44%", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, alignItems: "center", gap: 6 }}>
                        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: meta.color + "18", alignItems: "center", justifyContent: "center" }}>
                          <Feather name={meta.icon} size={16} color={meta.color} />
                        </View>
                        <Text style={{ fontSize: 22, fontFamily: "Inter_700Bold", color: colors.foreground }}>{val}</Text>
                        <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>{meta.label}</Text>
                      </View>
                    );
                  })}
                </View>

                {/* Activity summary */}
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>Aktivite Özeti</Text>
                  <View style={{ flexDirection: "row", gap: 0 }}>
                    {[
                      { label: "Aktif Gün", val: activity.activeDays, icon: "calendar" as const },
                      { label: "İlk Erişim", val: activity.firstActivity ? new Date(activity.firstActivity).toLocaleDateString("tr-TR") : "—", icon: "clock" as const },
                      { label: "Son Erişim", val: activity.lastActivity ? new Date(activity.lastActivity).toLocaleDateString("tr-TR") : "—", icon: "activity" as const },
                    ].map((item, i) => (
                      <View key={i} style={{ flex: 1, alignItems: "center", borderLeftWidth: i > 0 ? 1 : 0, borderLeftColor: colors.border, paddingVertical: 4 }}>
                        <Feather name={item.icon} size={14} color={colors.primary} style={{ marginBottom: 4 }} />
                        <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: colors.foreground }}>{item.val}</Text>
                        <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: colors.mutedForeground, textAlign: "center" }}>{item.label}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                {/* Monthly chart */}
                {activity.byMonth.length > 0 ? (
                  <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <ActivityMonthChart byMonth={activity.byMonth} />
                  </View>
                ) : null}

                {/* Content type donut */}
                {(activity.totals.chapters + activity.totals.videos + activity.totals.videoSetEntries + activity.totals.articles) > 0 ? (
                  <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>İçerik Dağılımı</Text>
                    <ActivityTypeDonut totals={activity.totals} />
                  </View>
                ) : null}

                {/* Recent items */}
                {activity.recent.length > 0 ? (
                  <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>Son Açılan İçerikler</Text>
                    {activity.recent.map((item, i) => {
                      const meta = TYPE_META[item.type] ?? TYPE_META["chapter"]!;
                      return (
                        <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 8, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border }}>
                          <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: meta.color + "18", alignItems: "center", justifyContent: "center", marginTop: 1 }}>
                            <Feather name={meta.icon} size={13} color={meta.color} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: colors.foreground }} numberOfLines={2}>{item.title}</Text>
                            <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 2 }}>
                              {meta.label} · {item.platform} · {new Date(item.date).toLocaleDateString("tr-TR")}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ) : null}
              </ScrollView>
            )
          )}
        </View>
      </Modal>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </Pressable>
          <View style={styles.headerCenter}>
            <View style={[styles.adminBadge, { backgroundColor: colors.primary + "15" }]}>
              <Feather name="shield" size={14} color={colors.primary} />
              <Text style={[styles.adminBadgeText, { color: colors.primary }]}>Yönetici</Text>
            </View>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>Cihaz Talepleri</Text>
          </View>
          <Pressable
            onPress={async () => {
              try {
                const res = await fetch(`${BASE}/notifications/test`, {
                  method: "POST",
                  headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();
                if (res.ok) Alert.alert("Test bildirimi gönderildi", "Birkaç saniye içinde telefonunuza ulaşmalı.");
                else Alert.alert("Hata", data.error ?? "Bildirim gönderilemedi.");
              } catch {
                Alert.alert("Hata", "Sunucuya bağlanılamadı.");
              }
            }}
            hitSlop={8}
            style={styles.backBtn}
          >
            <Feather name="bell" size={20} color={colors.mutedForeground} />
          </Pressable>
          <Pressable onPress={fetchRequests} hitSlop={8} style={styles.backBtn}>
            <Feather name="refresh-cw" size={20} color={colors.mutedForeground} />
          </Pressable>
        </View>

        {/* View Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 4 }}>
          <Pressable
            onPress={() => setActiveView("requests")}
            style={[styles.tabBtn, { paddingHorizontal: 14, borderBottomColor: activeView === "requests" ? colors.primary : "transparent" }]}
          >
            <Text style={[styles.tabText, { color: activeView === "requests" ? colors.primary : colors.mutedForeground }]}>Talepler</Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveView("totp")}
            style={[styles.tabBtn, { paddingHorizontal: 14, borderBottomColor: activeView === "totp" ? colors.primary : "transparent" }]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Feather name="lock" size={13} color={activeView === "totp" ? colors.primary : colors.mutedForeground} />
              <Text style={[styles.tabText, { color: activeView === "totp" ? colors.primary : colors.mutedForeground }]}>2FA</Text>
              {totpStatus === "not_setup" ? (
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: "#DC2626" }} />
              ) : totpStatus === "setup" ? (
                <Feather name="check-circle" size={11} color="#16A34A" />
              ) : null}
            </View>
          </Pressable>
          <Pressable
            onPress={() => setActiveView("devices")}
            style={[styles.tabBtn, { paddingHorizontal: 14, borderBottomColor: activeView === "devices" ? colors.primary : "transparent" }]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Feather name="smartphone" size={13} color={activeView === "devices" ? colors.primary : colors.mutedForeground} />
              <Text style={[styles.tabText, { color: activeView === "devices" ? colors.primary : colors.mutedForeground }]}>Cihazlar</Text>
            </View>
          </Pressable>
          <Pressable
            onPress={() => setActiveView("groups")}
            style={[styles.tabBtn, { paddingHorizontal: 14, borderBottomColor: activeView === "groups" ? colors.primary : "transparent" }]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Feather name="users" size={13} color={activeView === "groups" ? colors.primary : colors.mutedForeground} />
              <Text style={[styles.tabText, { color: activeView === "groups" ? colors.primary : colors.mutedForeground }]}>Gruplar</Text>
            </View>
          </Pressable>
          <Pressable
            onPress={() => setActiveView("blocks")}
            style={[styles.tabBtn, { paddingHorizontal: 14, borderBottomColor: activeView === "blocks" ? colors.primary : "transparent" }]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Feather name="user-x" size={13} color={activeView === "blocks" ? colors.primary : colors.mutedForeground} />
              <Text style={[styles.tabText, { color: activeView === "blocks" ? colors.primary : colors.mutedForeground }]}>Bloklar</Text>
            </View>
          </Pressable>
          <Pressable
            onPress={() => setActiveView("smoke")}
            style={[styles.tabBtn, { paddingHorizontal: 14, borderBottomColor: activeView === "smoke" ? colors.primary : "transparent" }]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Feather name="activity" size={13} color={activeView === "smoke" ? colors.primary : colors.mutedForeground} />
              <Text style={[styles.tabText, { color: activeView === "smoke" ? colors.primary : colors.mutedForeground }]}>Smoke</Text>
              {lastSmokeStatus === "failed" ? (
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: "#DC2626" }} />
              ) : lastSmokeStatus === "harness-error" ? (
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: "#D97706" }} />
              ) : null}
            </View>
          </Pressable>
          <Pressable
            onPress={() => setActiveView("bad-ids")}
            style={[styles.tabBtn, { paddingHorizontal: 14, borderBottomColor: activeView === "bad-ids" ? colors.primary : "transparent" }]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Feather name="alert-triangle" size={13} color={activeView === "bad-ids" ? colors.primary : colors.mutedForeground} />
              <Text style={[styles.tabText, { color: activeView === "bad-ids" ? colors.primary : colors.mutedForeground }]}>Bad IDs</Text>
              {badIdCount != null && badIdCount > 0 ? (
                <View style={{ minWidth: 16, height: 16, borderRadius: 8, backgroundColor: "#DC2626", alignItems: "center", justifyContent: "center", paddingHorizontal: 4 }}>
                  <Text style={{ fontSize: 9, fontFamily: "Inter_700Bold", color: "#fff" }}>{badIdCount > 99 ? "99+" : badIdCount}</Text>
                </View>
              ) : null}
            </View>
          </Pressable>
          <Pressable
            onPress={() => setActiveView("precision")}
            style={[styles.tabBtn, { paddingHorizontal: 14, borderBottomColor: activeView === "precision" ? colors.primary : "transparent" }]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Feather name="sliders" size={13} color={activeView === "precision" ? colors.primary : colors.mutedForeground} />
              <Text style={[styles.tabText, { color: activeView === "precision" ? colors.primary : colors.mutedForeground }]}>Precision</Text>
            </View>
          </Pressable>
          <Pressable
            onPress={() => setActiveView("config")}
            style={[styles.tabBtn, { paddingHorizontal: 14, borderBottomColor: activeView === "config" ? colors.primary : "transparent" }]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Feather name="settings" size={13} color={activeView === "config" ? colors.primary : colors.mutedForeground} />
              <Text style={[styles.tabText, { color: activeView === "config" ? colors.primary : colors.mutedForeground }]}>Config</Text>
            </View>
          </Pressable>
          <Pressable
            onPress={() => setActiveView("finetune")}
            style={[styles.tabBtn, { paddingHorizontal: 14, borderBottomColor: activeView === "finetune" ? colors.primary : "transparent" }]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Feather name="cpu" size={13} color={activeView === "finetune" ? colors.primary : colors.mutedForeground} />
              <Text style={[styles.tabText, { color: activeView === "finetune" ? colors.primary : colors.mutedForeground }]}>Fine-Tune</Text>
            </View>
          </Pressable>
          <Pressable
            onPress={() => setActiveView("kb")}
            style={[styles.tabBtn, { paddingHorizontal: 14, borderBottomColor: activeView === "kb" ? colors.primary : "transparent" }]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Feather name="database" size={13} color={activeView === "kb" ? colors.primary : colors.mutedForeground} />
              <Text style={[styles.tabText, { color: activeView === "kb" ? colors.primary : colors.mutedForeground }]}>Bilgi Havuzu</Text>
            </View>
          </Pressable>
        </ScrollView>

        {/* Sub-tabs for requests (only when on requests view) */}
        {activeView === "requests" ? (
          <View style={[styles.tabBar, { borderTopWidth: 1, borderTopColor: colors.border }]}>
            {STATUS_TABS.map(s => (
              <Pressable
                key={s}
                onPress={() => setStatus(s)}
                style={[styles.tabBtn, { borderBottomColor: status === s ? STATUS_COLORS[s] : "transparent" }]}
              >
                <Text style={[styles.tabText, { color: status === s ? STATUS_COLORS[s] : colors.mutedForeground, fontSize: 12 }]}>
                  {STATUS_LABELS[s]}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      {/* TOTP Setup View */}
      {activeView === "totp" ? (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView
            contentContainerStyle={{ padding: 20, paddingBottom: bottomPad + 20 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={{ alignItems: "center", marginBottom: 16 }}>
              <Feather name="lock" size={32} color={colors.primary} />
              <Text style={[styles.userName, { color: colors.foreground, fontSize: 18, marginTop: 10, textAlign: "center" }]}>
                İki Adımlı Doğrulama (TOTP)
              </Text>
            </View>

            {totpStatus === "setup" && !totpQr ? (
              <View style={{ alignItems: "center", gap: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#16A34A18", padding: 12, borderRadius: 10 }}>
                  <Feather name="check-circle" size={18} color="#16A34A" />
                  <Text style={{ color: "#16A34A", fontFamily: "Inter_600SemiBold", fontSize: 14 }}>TOTP aktif</Text>
                </View>
                <Text style={{ color: colors.mutedForeground, fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 18 }}>
                  Her admin girişinde Google Authenticator kodu sorulacak.
                </Text>
              </View>
            ) : totpQr ? (
              <>
                <Text style={{ color: colors.mutedForeground, fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", marginBottom: 14, lineHeight: 18 }}>
                  Google Authenticator uygulamasını açın ve aşağıdaki QR kodu tarayın
                </Text>
                <Image source={{ uri: totpQr }} style={{ width: 200, height: 200, alignSelf: "center", marginBottom: 12 }} />
                {totpSecret ? (
                  <View style={{ marginBottom: 16 }}>
                    <Text style={{ color: colors.mutedForeground, fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center", marginBottom: 6 }}>
                      Manuel giriş kodu:
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.muted, borderRadius: 10, borderWidth: 1, borderColor: colors.border, paddingVertical: 10, paddingHorizontal: 14 }}>
                      <Text style={{ flex: 1, color: colors.foreground, fontSize: 13, fontFamily: "Inter_700Bold", letterSpacing: 2 }} selectable>
                        {totpSecret}
                      </Text>
                      <Pressable
                        onPress={async () => {
                          await Clipboard.setStringAsync(totpSecret);
                          Alert.alert("Kopyalandı", "Gizli anahtar panoya kopyalandı.");
                        }}
                        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 4 })}
                      >
                        <Feather name="copy" size={18} color={colors.primary} />
                      </Pressable>
                    </View>
                    <Text style={{ color: colors.mutedForeground, fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: 6, lineHeight: 15 }}>
                      Google Authenticator → + → Kurulum anahtarı gir → yapıştır
                    </Text>
                  </View>
                ) : null}
                <Text style={{ color: colors.foreground, fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 8 }}>
                  Kurulumu doğrula
                </Text>
                <View style={[styles.inputRow, { borderColor: colors.border, backgroundColor: colors.muted, marginBottom: 12 }]}>
                  <TextInput
                    style={[styles.codeInput, { color: colors.foreground }]}
                    placeholder="000000"
                    placeholderTextColor={colors.mutedForeground}
                    value={totpCode}
                    onChangeText={v => setTotpCode(v.replace(/\D/g, "").slice(0, 6))}
                    keyboardType="number-pad"
                    maxLength={6}
                    returnKeyType="done"
                    onSubmitEditing={verifyTotpCode}
                  />
                </View>
                <Pressable
                  style={[styles.actionBtn, styles.approveBtn, { justifyContent: "center" }]}
                  onPress={verifyTotpCode}
                  disabled={totpLoading || totpCode.length < 6}
                >
                  {totpLoading ? <ActivityIndicator size="small" color="#FFF" /> : (
                    <>
                      <Feather name="check" size={16} color="#FFF" />
                      <Text style={styles.approveBtnText}>Kodu Doğrula</Text>
                    </>
                  )}
                </Pressable>
                <Pressable
                  style={{ marginTop: 10, alignItems: "center", paddingVertical: 8 }}
                  onPress={resetTotpSetup}
                  disabled={totpLoading}
                >
                  <Text style={{ color: "#DC2626", fontSize: 13, fontFamily: "Inter_400Regular" }}>
                    Sıfırla ve yeni QR oluştur
                  </Text>
                </Pressable>
              </>
            ) : totpStatus === "not_setup" ? (
              <>
                <Text style={{ color: colors.mutedForeground, fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", marginBottom: 16, lineHeight: 18 }}>
                  TOTP henüz kurulmamış. Google Authenticator ile admin hesabınızı güvence altına alın.
                </Text>
                <Pressable
                  style={[styles.actionBtn, styles.approveBtn, { justifyContent: "center" }]}
                  onPress={startTotpSetup}
                  disabled={totpLoading}
                >
                  {totpLoading ? <ActivityIndicator size="small" color="#FFF" /> : (
                    <>
                      <Feather name="shield" size={16} color="#FFF" />
                      <Text style={styles.approveBtnText}>TOTP Kurulumunu Başlat</Text>
                    </>
                  )}
                </Pressable>
              </>
            ) : (
              <ActivityIndicator color={colors.primary} />
            )}

            {totpMsg ? (
              <Text style={{ marginTop: 12, color: totpMsg.includes("başarıyla") ? "#16A34A" : "#DC2626", fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" }}>
                {totpMsg}
              </Text>
            ) : null}
          </View>
          </ScrollView>
        </KeyboardAvoidingView>
      ) : null}

      {/* Devices View */}
      {activeView === "devices" ? (
        devicesLoading && deviceUsers.length === 0 ? (
          <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
        ) : (
          <FlatList
            data={(() => {
              const q = normalizeSearch(deviceSearch.trim());
              let filtered = q
                ? deviceUsers.filter(u =>
                    normalizeSearch(u.name).includes(q) ||
                    normalizeSearch(u.email).includes(q)
                  )
                : [...deviceUsers];
              if (deviceTypeFilter) {
                filtered = filtered.filter(u =>
                  u.devices?.some(d => d.type === deviceTypeFilter && d.uuid && String(d.uuid).trim() !== "")
                );
              }
              if (deviceStatusFilter) {
                filtered = filtered.filter(u => {
                  const t = u.expireDate ? new Date(u.expireDate).getTime() : 0;
                  if (!t) return deviceStatusFilter === "expired";
                  const days = Math.ceil((t - Date.now()) / 86400000);
                  if (deviceStatusFilter === "expired") return days < 0;
                  if (deviceStatusFilter === "expiringSoon") return days >= 0 && days <= 30;
                  return days > 30;
                });
              }
              filtered.sort((a, b) => {
                if (deviceSort === "name_asc")
                  return a.name.localeCompare(b.name, "tr-TR");
                if (deviceSort === "name_desc")
                  return b.name.localeCompare(a.name, "tr-TR");
                if (deviceSort === "expire_asc") {
                  const da = a.expireDate ? new Date(a.expireDate).getTime() : 0;
                  const db2 = b.expireDate ? new Date(b.expireDate).getTime() : 0;
                  return da - db2;
                }
                if (deviceSort === "expire_desc") {
                  const da = a.expireDate ? new Date(a.expireDate).getTime() : 0;
                  const db2 = b.expireDate ? new Date(b.expireDate).getTime() : 0;
                  return db2 - da;
                }
                return 0;
              });
              return filtered;
            })()}
            keyExtractor={u => u.id.toString()}
            keyboardShouldPersistTaps="handled"
            refreshControl={<RefreshControl refreshing={devicesLoading} onRefresh={fetchDevices} tintColor={colors.primary} />}
            contentContainerStyle={{ paddingVertical: 12, paddingHorizontal: 16, paddingBottom: bottomPad }}
            ListHeaderComponent={
              <View style={{ marginBottom: 12 }}>
                {/* İstatistik + Grafik Kartı */}
                {deviceStats ? (
                  <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, marginBottom: 14 }]}>
                    <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
                      <DonutChart stats={deviceStats} />
                      <View style={{ width: 1, backgroundColor: colors.border, marginHorizontal: 12, alignSelf: "stretch" }} />
                      <DeviceBarChart stats={deviceStats} />
                    </View>
                  </View>
                ) : null}
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <View style={[styles.inputRow, { flex: 1, borderColor: colors.border, backgroundColor: colors.muted }]}>
                    <Feather name="search" size={16} color={colors.mutedForeground} style={{ marginRight: 8 }} />
                    <TextInput
                      style={{ flex: 1, color: colors.foreground, fontSize: 14, fontFamily: "Inter_400Regular", height: 40 }}
                      placeholder="İsim veya e-posta ile ara..."
                      placeholderTextColor={colors.mutedForeground}
                      value={deviceSearch}
                      onChangeText={setDeviceSearch}
                      autoCorrect={false}
                      autoCapitalize="none"
                      returnKeyType="search"
                    />
                  </View>
                  <Pressable
                    onPress={() => setSortMenuOpen(v => !v)}
                    style={({ pressed }) => ({
                      width: 44, height: 44, borderRadius: 12,
                      backgroundColor: sortMenuOpen ? colors.primary + "20" : colors.muted,
                      borderWidth: 1, borderColor: sortMenuOpen ? colors.primary : colors.border,
                      alignItems: "center", justifyContent: "center",
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Feather name="sliders" size={18} color={sortMenuOpen ? colors.primary : colors.mutedForeground} />
                  </Pressable>
                </View>

                {sortMenuOpen ? (
                  <View style={{
                    marginTop: 6, borderRadius: 12, borderWidth: 1,
                    borderColor: colors.border, backgroundColor: colors.card,
                    overflow: "hidden",
                  }}>
                    {([
                      { key: "name_asc",    label: "İsim  A → Z",       icon: "arrow-up"   },
                      { key: "name_desc",   label: "İsim  Z → A",       icon: "arrow-down" },
                      { key: "expire_asc",  label: "Bitiş  Eskiden Yeniye", icon: "arrow-up"   },
                      { key: "expire_desc", label: "Bitiş  Yeniden Eskiye", icon: "arrow-down" },
                    ] as { key: DeviceSort; label: string; icon: keyof typeof Feather.glyphMap }[]).map((opt, idx) => (
                      <Pressable
                        key={opt.key}
                        onPress={() => { setDeviceSort(opt.key); setSortMenuOpen(false); }}
                        style={({ pressed }) => ({
                          flexDirection: "row", alignItems: "center", gap: 10,
                          paddingVertical: 11, paddingHorizontal: 14,
                          borderTopWidth: idx === 0 ? 0 : 1, borderTopColor: colors.border,
                          backgroundColor: deviceSort === opt.key
                            ? colors.primary + "12"
                            : pressed ? colors.muted : "transparent",
                        })}
                      >
                        <Feather
                          name={opt.icon}
                          size={14}
                          color={deviceSort === opt.key ? colors.primary : colors.mutedForeground}
                        />
                        <Text style={{
                          flex: 1, fontSize: 13, fontFamily: "Inter_500Medium",
                          color: deviceSort === opt.key ? colors.primary : colors.foreground,
                        }}>
                          {opt.label}
                        </Text>
                        {deviceSort === opt.key && (
                          <Feather name="check" size={14} color={colors.primary} />
                        )}
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
            }
            ListEmptyComponent={
              <View style={styles.center}>
                <Feather name="search" size={40} color={colors.mutedForeground} />
                <Text style={{ color: colors.mutedForeground, marginTop: 12, fontFamily: "Inter_400Regular", fontSize: 14, textAlign: "center" }}>
                  {deviceSearch ? "Sonuç bulunamadı." : "Henüz kayıtlı cihaz yok."}
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => setSelectedUser(item)}
                style={({ pressed }) => [styles.card, { backgroundColor: colors.card, borderColor: colors.border, marginBottom: 12, opacity: pressed ? 0.92 : 1 }]}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary + "15", alignItems: "center", justifyContent: "center" }}>
                    <Feather name="user" size={16} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>{item.name}</Text>
                    <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }}>{item.email}</Text>
                    {item.expireDate ? (
                      <Text style={{
                        fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1,
                        color: new Date(item.expireDate) < new Date() ? "#DC2626" : (item.daysLeft != null && item.daysLeft <= 30 ? "#D97706" : "#16A34A"),
                      }}>
                        Üyelik: {item.expireDate.slice(0, 10)}{item.daysLeft != null ? ` (${item.daysLeft > 0 ? item.daysLeft + " gün" : "Süresi doldu"})` : ""}
                      </Text>
                    ) : null}
                    {item.phone ? (
                      <Pressable
                        onPress={(e) => { e.stopPropagation?.(); Linking.openURL(`https://wa.me/${item.phone!.replace(/\D/g, "")}`); }}
                        hitSlop={6}
                        style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}
                      >
                        <Feather name="phone" size={11} color="#25D366" />
                        <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: "#25D366" }}>
                          {item.phone}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                  <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                </View>
                {item.devices.map(d => (
                  <View key={d.type} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border }}>
                    <Feather name={d.type === "ipad" ? "tablet" : d.type === "mac" ? "monitor" : "smartphone"} size={16} color={colors.mutedForeground} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>{d.label}</Text>
                      <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }}>
                        {d.model ?? "Model bilinmiyor"}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => removeDevice(item.id, d.type, d.label)}
                      disabled={deviceActionLoading === `${item.id}-${d.type}`}
                      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 6, borderRadius: 8, backgroundColor: "#DC262612" })}
                      hitSlop={8}
                    >
                      {deviceActionLoading === `${item.id}-${d.type}` ? (
                        <ActivityIndicator size="small" color="#DC2626" />
                      ) : (
                        <Feather name="log-out" size={16} color="#DC2626" />
                      )}
                    </Pressable>
                  </View>
                ))}
              </Pressable>
            )}
          />
        )
      ) : null}

      {/* Groups View */}
      {activeView === "groups" && token ? (
        <AdminGroupsView baseUrl={BASE} token={token} />
      ) : null}

      {/* Blocks View */}
      {activeView === "blocks" && token ? (
        <AdminBlocksView baseUrl={BASE} token={token} />
      ) : null}

      {/* Smoke History View */}
      {activeView === "smoke" && token ? (
        <AdminSmokeView baseUrl={BASE} token={token} refreshMs={smokeRefreshMs} onRefreshMsChange={setSmokeRefreshMs} />
      ) : null}

      {/* Bad IDs View */}
      {activeView === "bad-ids" && token ? (
        <AdminBadIdsView baseUrl={BASE} token={token} />
      ) : null}

      {activeView === "precision" && token ? (
        <AdminPrecisionDedupeView baseUrl={BASE} token={token} />
      ) : null}

      {activeView === "config" && token ? (
        <AdminStartupConfigView baseUrl={BASE} token={token} />
      ) : null}

      {activeView === "finetune" && token ? (
        <AdminFineTuneView baseUrl={BASE} token={token} />
      ) : null}

      {activeView === "kb" && token ? (
        <AdminKnowledgeBaseView baseUrl={BASE} token={token} />
      ) : null}

      {/* User Detail Modal */}
      {selectedUser ? (
        <UserDetailModal user={selectedUser} onClose={() => setSelectedUser(null)} />
      ) : null}

      {/* Requests View */}
      {activeView === "requests" && loading && requests.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : activeView === "requests" ? (
        <FlatList
          data={requests}
          keyExtractor={r => r.ID.toString()}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchRequests} tintColor={colors.primary} />}
          contentContainerStyle={{ paddingVertical: 12, paddingHorizontal: 16, paddingBottom: bottomPad }}
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {/* User info */}
              <View style={styles.cardHeader}>
                <View style={[styles.deviceIcon, { backgroundColor: "#D97706" + "18" }]}>
                  <Feather name={DEVICE_ICONS[item.DeviceType] ?? "smartphone"} size={20} color="#D97706" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.userName, { color: colors.foreground }]} numberOfLines={1}>
                    {item.UserName || item.UserEmail}
                  </Text>
                  <Text style={[styles.userEmail, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {item.UserEmail}
                  </Text>
                </View>
                <Text style={[styles.timeAgo, { color: colors.mutedForeground }]}>
                  {timeAgo(item.CreatedAt)}
                </Text>
              </View>

              {/* Device info */}
              <View style={[styles.deviceRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                <Feather name="info" size={13} color={colors.mutedForeground} />
                <Text style={[styles.deviceText, { color: colors.mutedForeground }]}>
                  {DEVICE_LABELS[item.DeviceType] ?? item.DeviceType} için yeni cihaz kaydı
                </Text>
              </View>

              {/* Actions (only for pending) */}
              {item.Status === "pending" ? (
                <View style={styles.actionRow}>
                  <Pressable
                    style={[styles.actionBtn, styles.rejectBtn]}
                    onPress={() => handleAction(item.ID, "reject")}
                    disabled={actionLoading === item.ID}
                  >
                    {actionLoading === item.ID ? (
                      <ActivityIndicator size="small" color="#DC2626" />
                    ) : (
                      <>
                        <Feather name="x" size={16} color="#DC2626" />
                        <Text style={styles.rejectBtnText}>Reddet</Text>
                      </>
                    )}
                  </Pressable>
                  <Pressable
                    style={[styles.actionBtn, styles.approveBtn]}
                    onPress={() => handleAction(item.ID, "approve")}
                    disabled={actionLoading === item.ID}
                  >
                    {actionLoading === item.ID ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <>
                        <Feather name="check" size={16} color="#FFF" />
                        <Text style={styles.approveBtnText}>Onayla</Text>
                      </>
                    )}
                  </Pressable>
                </View>
              ) : (
                <View style={styles.processedRow}>
                  <Feather
                    name={item.Status === "approved" ? "check-circle" : "x-circle"}
                    size={14}
                    color={STATUS_COLORS[item.Status]}
                  />
                  <Text style={[styles.processedText, { color: STATUS_COLORS[item.Status] }]}>
                    {item.Status === "approved" ? "Onaylandı" : "Reddedildi"}
                    {item.ProcessedAt ? ` — ${timeAgo(item.ProcessedAt)}` : ""}
                  </Text>
                </View>
              )}
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.center}>
              <Feather name="inbox" size={52} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                {STATUS_LABELS[status]} talep yok
              </Text>
            </View>
          }
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { borderBottomWidth: 1, paddingBottom: 0 },
  headerRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 10, gap: 8 },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1, alignItems: "center" },
  adminBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, marginBottom: 2 },
  adminBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  headerTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  tabBar: { flexDirection: "row" },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: "center", borderBottomWidth: 2 },
  tabText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  card: {
    borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 10,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  deviceIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  userName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  userEmail: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  timeAgo: { fontSize: 11, fontFamily: "Inter_400Regular" },
  deviceRow: {
    flexDirection: "row", alignItems: "center", gap: 6, padding: 8,
    borderRadius: 8, borderWidth: 1, marginBottom: 10,
  },
  deviceText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  actionRow: { flexDirection: "row", gap: 8 },
  actionBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 10, borderRadius: 9,
  },
  rejectBtn: { backgroundColor: "#DC262612", borderWidth: 1, borderColor: "#DC262635" },
  rejectBtnText: { color: "#DC2626", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  approveBtn: { backgroundColor: "#16A34A" },
  approveBtnText: { color: "#FFF", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  processedRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  processedText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  inputRow: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, height: 52 },
  codeInput: { flex: 1, fontSize: 24, fontFamily: "Inter_700Bold", letterSpacing: 8, textAlign: "center" },
});
