import { Feather } from "@expo/vector-icons";
import * as Application from "expo-application";
import * as MailComposer from "expo-mail-composer";
import { useRouter } from "expo-router";
import * as Updates from "expo-updates";
import * as WebBrowser from "expo-web-browser";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
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
import AsyncStorage from "@react-native-async-storage/async-storage";

import MessagingSettingsContent from "@/components/MessagingSettingsContent";
import SegmentRow from "@/components/SegmentRow";
import TimeInput from "@/components/TimeInput";
import ToggleRow from "@/components/ToggleRow";
import { useApp } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { MedLibColors, useColors } from "@/hooks/useColors";

type FeatherIconName = React.ComponentProps<typeof Feather>["name"];

const BASE =
  process.env["EXPO_PUBLIC_API_URL"] ??
  (process.env["EXPO_PUBLIC_DOMAIN"]
    ? `https://${process.env["EXPO_PUBLIC_DOMAIN"]}/api`
    : "https://medical-library-hub.replit.app/api");

const SUPPORT_EMAIL = "destek@medlib.com";

type CategoryKey = "appearance" | "messages" | "content" | "account" | "about";
type SettingsView = "index" | CategoryKey;

const CATEGORIES: { key: CategoryKey; title: string; subtitle: string; icon: FeatherIconName }[] = [
  { key: "appearance", title: "Görünüm", subtitle: "Tema, yazı boyutu, dil", icon: "layout" },
  { key: "messages",   title: "Mesajlar", subtitle: "Bildirim, gizlilik, görünüm", icon: "message-circle" },
  { key: "content",    title: "İçerik & Veri", subtitle: "İndirme, önbellek, içerik bildirimleri", icon: "hard-drive" },
  { key: "account",    title: "Hesap & Güvenlik", subtitle: "Cihaz, şifre, biyometri", icon: "shield" },
  { key: "about",      title: "Hakkında", subtitle: "Sürüm, geri bildirim, yasal", icon: "info" },
];

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, token, logout } = useAuth();
  const { settings, setSetting, resetSettings, pushActivityPrivacyToServer } = useSettings();
  const { downloadedVideos, removeDownload } = useApp();

  // Local draft for the alias input — only flushed to the server when the
  // user taps "Kaydet". Keeping it local avoids hammering the API on every
  // keystroke and lets server-side validation errors leave the draft intact
  // for editing.
  const [aliasDraft, setAliasDraft] = useState<string>(settings.activityAlias);
  const [activitySaving, setActivitySaving] = useState(false);
  // Pending UI selection: when the user taps the "Rumuz" segment without a
  // valid alias yet, we want to show the input WITHOUT actually changing
  // the persisted privacy mode — otherwise the segment would lie about the
  // server state (server still serves the old mode until Kaydet succeeds).
  // pendingMode === 'alias' means "show the input UI" but the truthful
  // selected mode is still settings.activityNameMode until save resolves.
  const [pendingAliasOpen, setPendingAliasOpen] = useState(false);
  // Each save dispatches a token so a slow earlier response can't overwrite
  // a fresher one — protects against rapid segment taps causing the wrong
  // persisted mode to win.
  const saveSeqRef = useRef(0);
  // Re-sync the local draft whenever the settings update from the server
  // (login sync, refresh from another device, etc).
  useEffect(() => {
    setAliasDraft(settings.activityAlias);
  }, [settings.activityAlias]);

  const saveActivityPrivacy = useCallback(
    async (mode: typeof settings.activityNameMode, alias: string) => {
      if (!token) return;
      const mySeq = ++saveSeqRef.current;
      setActivitySaving(true);
      try {
        await pushActivityPrivacyToServer(token, { mode, alias });
        // Only the latest dispatched call gets to clear the pending UI state.
        if (mySeq === saveSeqRef.current && mode !== "alias") {
          setPendingAliasOpen(false);
        }
        if (mySeq === saveSeqRef.current && mode === "alias") {
          setPendingAliasOpen(false);
        }
      } catch (e: any) {
        if (mySeq === saveSeqRef.current) {
          Alert.alert("Kaydedilemedi", e?.message ?? "Bilinmeyen hata.");
        }
      } finally {
        if (mySeq === saveSeqRef.current) setActivitySaving(false);
      }
    },
    [token, pushActivityPrivacyToServer],
  );

  const onSelectActivityMode = useCallback(
    (mode: typeof settings.activityNameMode) => {
      // Race guard: ignore taps while a save is in flight so the segment
      // can't dispatch overlapping PUTs whose responses arrive out of order.
      if (activitySaving) return;
      if (mode === "alias") {
        // Reveal the alias input. Do NOT touch settings.activityNameMode yet
        // — the persisted/server state must only change once the user
        // actually saves a valid alias via the Kaydet button.
        setPendingAliasOpen(true);
        return;
      }
      // For non-alias modes the alias text is irrelevant; pass empty so the
      // server doesn't bounce on its 2–24 length rule.
      setPendingAliasOpen(false);
      saveActivityPrivacy(mode, "");
    },
    [activitySaving, saveActivityPrivacy],
  );

  const onSaveAlias = useCallback(() => {
    if (activitySaving) return;
    saveActivityPrivacy("alias", aliasDraft);
  }, [activitySaving, aliasDraft, saveActivityPrivacy]);

  // The visual segment value follows the truthful server state by default,
  // but reflects the user's pending intent when they're mid-flow choosing
  // alias mode. The server state is what actually controls the feed.
  const visibleActivityMode = pendingAliasOpen ? "alias" : settings.activityNameMode;
  const showAliasInput = pendingAliasOpen || settings.activityNameMode === "alias";

  const [view, setView] = useState<SettingsView>("index");
  const [cacheSize, setCacheSize] = useState<number>(0);
  const [pwModal, setPwModal] = useState(false);
  const [emailModal, setEmailModal] = useState(false);

  const calcCacheSize = useCallback(async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const items = await AsyncStorage.multiGet(keys);
      let bytes = 0;
      for (const [, v] of items) bytes += v ? v.length : 0;
      setCacheSize(bytes);
    } catch {}
  }, []);
  useEffect(() => { calcCacheSize(); }, [calcCacheSize]);

  const handleClearCache = useCallback(() => {
    Alert.alert(
      "Önbelleği Temizle",
      "Geçici veriler ve resimler silinecek. İndirmeleriniz ve oturumunuz korunacak.",
      [
        { text: "İptal", style: "cancel" },
        {
          text: "Temizle", style: "destructive",
          onPress: async () => {
            try {
              const keys = await AsyncStorage.getAllKeys();
              const toDelete = keys.filter(k =>
                k.startsWith("rq-") || k.startsWith("cache_") || k.startsWith("img_cache_")
              );
              if (toDelete.length > 0) await AsyncStorage.multiRemove(toDelete);
              await calcCacheSize();
              Alert.alert("Tamamlandı", "Önbellek temizlendi.");
            } catch (e: any) {
              Alert.alert("Hata", e.message);
            }
          },
        },
      ],
    );
  }, [calcCacheSize]);

  const handleClearDownloads = useCallback(() => {
    if (downloadedVideos.length === 0) {
      Alert.alert("Bilgi", "Silinecek indirme yok.");
      return;
    }
    Alert.alert(
      "Tüm İndirmeleri Sil",
      `${downloadedVideos.length} video silinecek. Bu işlem geri alınamaz.`,
      [
        { text: "İptal", style: "cancel" },
        {
          text: "Sil", style: "destructive",
          onPress: async () => {
            for (const v of downloadedVideos) await removeDownload(v.videoId);
            Alert.alert("Tamamlandı", "Tüm indirmeler silindi.");
          },
        },
      ],
    );
  }, [downloadedVideos, removeDownload]);

  const handleCheckUpdates = useCallback(async () => {
    if (__DEV__) {
      Alert.alert("Geliştirme Modu", "Güncelleme kontrolü sadece üretim sürümünde çalışır.");
      return;
    }
    try {
      const result = await Updates.checkForUpdateAsync();
      if (result.isAvailable) {
        await Updates.fetchUpdateAsync();
        Alert.alert("Güncelleme Hazır", "Yeni sürüm indirildi. Uygulama yeniden başlatılacak.", [
          { text: "Tamam", onPress: () => Updates.reloadAsync() },
        ]);
      } else {
        Alert.alert("Güncelleme Yok", "En güncel sürümü kullanıyorsunuz.");
      }
    } catch (e: any) {
      Alert.alert("Hata", e.message);
    }
  }, []);

  const handleSendFeedback = useCallback(async () => {
    const subject = `MedLib Geri Bildirim — ${user?.email ?? ""}`;
    const body = `\n\n---\nKullanıcı: ${user?.email}\nSürüm: ${Application.nativeApplicationVersion} (${Application.nativeBuildVersion})\nPlatform: ${Platform.OS} ${Platform.Version}`;
    try {
      const available = await MailComposer.isAvailableAsync();
      if (available) {
        await MailComposer.composeAsync({ recipients: [SUPPORT_EMAIL], subject, body });
      } else {
        Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
      }
    } catch (e: any) {
      Alert.alert("Hata", e.message);
    }
  }, [user]);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      "Hesabı Silme Talebi",
      "Hesap silme talebiniz yöneticiye iletilecek. Onaylandıktan sonra tüm verileriniz silinecektir.",
      [
        { text: "İptal", style: "cancel" },
        {
          text: "Talep Gönder", style: "destructive",
          onPress: async () => {
            try {
              const res = await fetch(`${BASE}/me/delete-request`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
              });
              if (res.ok) {
                Alert.alert("Talep Gönderildi", "Yönetici onayı bekleniyor.");
              } else {
                Alert.alert("Bilgi", "Hesap silme isteği yöneticinize iletilemedi. Lütfen kurum yetkilinizle iletişime geçin.");
              }
            } catch {
              Alert.alert("Bilgi", "Lütfen kurum yetkilinizle iletişime geçin.");
            }
          },
        },
      ],
    );
  }, [token]);

  const handleLogout = useCallback(() => {
    Alert.alert("Çıkış", "Oturumu kapatmak istediğinize emin misiniz?", [
      { text: "İptal", style: "cancel" },
      { text: "Çıkış Yap", style: "destructive", onPress: async () => { await logout(); router.replace("/login" as never); } },
    ]);
  }, [logout, router]);

  const styles = makeStyles(colors);
  const topPad = Platform.OS === "web" ? 40 : insets.top;
  const bottomPad = Platform.OS === "web" ? 40 : insets.bottom + 30;

  const headerTitle = view === "index" ? "Ayarlar" : (CATEGORIES.find(c => c.key === view)?.title ?? "Ayarlar");
  const onBack = () => {
    if (view === "index") router.back();
    else setView("index");
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <Pressable onPress={onBack} hitSlop={12} style={styles.backBtn}>
          <Feather name="chevron-left" size={26} color={colors.foreground} />
        </Pressable>
        <Text style={styles.title}>{headerTitle}</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: bottomPad }}>
        {view === "index" && (
          <View style={{ marginTop: 18, marginHorizontal: 16 }}>
            <View style={styles.sectionBody}>
              {CATEGORIES.map((c, idx) => (
                <Pressable
                  key={c.key}
                  onPress={() => setView(c.key)}
                  style={({ pressed }) => [styles.catRow, idx === CATEGORIES.length - 1 && { borderBottomWidth: 0 }, pressed && { opacity: 0.55 }]}
                >
                  <View style={[styles.catIcon, { backgroundColor: colors.primary + "15" }]}>
                    <Feather name={c.icon} size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.catTitle}>{c.title}</Text>
                    <Text style={styles.catSubtitle}>{c.subtitle}</Text>
                  </View>
                  <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
                </Pressable>
              ))}
            </View>
            <Text style={styles.footer}>MedLib · {user?.email}</Text>
          </View>
        )}

        {view === "appearance" && (
          <Section title="Görünüm" icon="layout" colors={colors}>
            <SegmentRow
              label="Tema" colors={colors}
              options={[{ k: "system", l: "Sistem" }, { k: "light", l: "Açık" }, { k: "dark", l: "Koyu" }]}
              value={settings.theme}
              onChange={v => setSetting("theme", v)}
            />
            <SegmentRow
              label="Yazı Boyutu" colors={colors}
              options={[{ k: "small", l: "Küçük" }, { k: "medium", l: "Orta" }, { k: "large", l: "Büyük" }]}
              value={settings.fontSize}
              onChange={v => setSetting("fontSize", v)}
            />
            <SegmentRow
              label="Dil" colors={colors}
              options={[{ k: "tr", l: "Türkçe" }, { k: "en", l: "English" }]}
              value={settings.language}
              onChange={v => setSetting("language", v)}
            />
          </Section>
        )}

        {view === "messages" && (
          <MessagingSettingsContent colors={colors} isAdmin={user?.isAdmin} />
        )}

        {view === "content" && (
          <>
            <Section title="İçerik Bildirimleri" icon="bell" colors={colors}>
              <ToggleRow label="Yeni makaleler" value={settings.notifNewArticles} onChange={v => setSetting("notifNewArticles", v)} colors={colors} />
              <ToggleRow label="Yeni kitap & video setleri" value={settings.notifNewBooksVideos} onChange={v => setSetting("notifNewBooksVideos", v)} colors={colors} />
            </Section>

            <Section title="İndirme & Veri" icon="hard-drive" colors={colors}>
              <SegmentRow
                label="İndirme Kalitesi" colors={colors}
                options={[{ k: "low", l: "Düşük" }, { k: "medium", l: "Orta" }, { k: "high", l: "Yüksek" }]}
                value={settings.downloadQuality}
                onChange={v => setSetting("downloadQuality", v)}
              />
              <ToggleRow label="Sadece Wi-Fi ile indir" value={settings.downloadWifiOnly} onChange={v => setSetting("downloadWifiOnly", v)} colors={colors} />
              <ToggleRow label="Videoları sadece Wi-Fi ile oynat" value={settings.videoWifiOnly} onChange={v => setSetting("videoWifiOnly", v)} colors={colors} />
              <ActionRow label={`Önbellek: ${(cacheSize / 1024).toFixed(0)} KB · Temizle`} icon="trash" destructive={false} onPress={handleClearCache} colors={colors} />
              <ActionRow label={`Tüm indirmeleri sil (${downloadedVideos.length})`} icon="trash-2" destructive={true} onPress={handleClearDownloads} colors={colors} />
            </Section>
          </>
        )}

        {view === "account" && (
          <>
            <Section title="Hesap & Güvenlik" icon="shield" colors={colors}>
              <NavRow label="Cihazlarımı yönet" icon="smartphone" onPress={() => router.push("/devices" as never)} colors={colors} />
              <NavRow label="Şifre değiştir" icon="key" onPress={() => setPwModal(true)} colors={colors} />
              <NavRow label="E-posta değiştir" icon="mail" onPress={() => setEmailModal(true)} colors={colors} />
              <ToggleRow label="Oturumu açık tut" value={settings.keepLoggedIn} onChange={v => setSetting("keepLoggedIn", v)} colors={colors} />
              <ToggleRow label="Açılışta Face ID / Touch ID iste" subtitle="Sonraki açılışlarda biyometrik kilit" value={settings.biometricUnlock} onChange={v => setSetting("biometricUnlock", v)} colors={colors} />
              {settings.biometricUnlock && (
                <SegmentRow
                  label="Yeniden kilitleme süresi" colors={colors}
                  options={[{ k: "immediate", l: "Hemen" }, { k: "1m", l: "1 dk" }, { k: "5m", l: "5 dk" }, { k: "15m", l: "15 dk" }]}
                  value={settings.backgroundRelockDelay}
                  onChange={v => setSetting("backgroundRelockDelay", v)}
                />
              )}
            </Section>

            <Section title="Aktivite Listesinde Görünüm" icon="eye" colors={colors}>
              <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
                <Text style={{ fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular", lineHeight: 18 }}>
                  Ana sayfada "Tümü" sekmesinde diğer kullanıcılar adınızı nasıl görsün?
                </Text>
              </View>
              <SegmentRow
                label="Görünüm" colors={colors}
                options={[
                  { k: "initials", l: "Baş Harf" },
                  { k: "name", l: "Tam Ad" },
                  { k: "alias", l: "Rumuz" },
                  { k: "hidden", l: "Gizli" },
                ]}
                value={visibleActivityMode}
                onChange={onSelectActivityMode}
              />
              {showAliasInput && (
                <View style={{ paddingHorizontal: 16, paddingVertical: 12, gap: 8 }}>
                  <Text style={{ fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_500Medium" }}>
                    Rumuz (2–24 karakter, harf/rakam/boşluk)
                  </Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TextInput
                      value={aliasDraft}
                      onChangeText={setAliasDraft}
                      placeholder="Örn: Cerrah42"
                      placeholderTextColor={colors.mutedForeground}
                      maxLength={24}
                      autoCapitalize="none"
                      autoCorrect={false}
                      style={{
                        flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 8,
                        paddingHorizontal: 10, paddingVertical: 9,
                        color: colors.foreground, fontFamily: "Inter_500Medium",
                        backgroundColor: colors.background,
                      }}
                    />
                    <Pressable
                      onPress={onSaveAlias}
                      disabled={activitySaving || aliasDraft.trim().length < 2 || aliasDraft === settings.activityAlias}
                      style={({ pressed }) => [{
                        paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8,
                        backgroundColor: (aliasDraft.trim().length < 2 || aliasDraft === settings.activityAlias) ? colors.muted : colors.primary,
                        alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1,
                      }]}
                    >
                      {activitySaving
                        ? <ActivityIndicator size="small" color="#FFF" />
                        : <Text style={{ color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 13 }}>Kaydet</Text>}
                    </Pressable>
                  </View>
                </View>
              )}
            </Section>

            <Section title="Tehlikeli Bölge" icon="alert-triangle" colors={colors} danger>
              <ActionRow label="Tüm ayarları sıfırla" icon="rotate-ccw" onPress={() => Alert.alert("Sıfırla", "Tüm ayarlar varsayılana dönecek.", [{ text: "İptal", style: "cancel" }, { text: "Sıfırla", style: "destructive", onPress: resetSettings }])} colors={colors} />
              <ActionRow label="Hesabı sil" icon="user-minus" destructive onPress={handleDeleteAccount} colors={colors} />
              <ActionRow label="Çıkış yap" icon="log-out" destructive onPress={handleLogout} colors={colors} />
            </Section>
          </>
        )}

        {view === "about" && (
          <Section title="Hakkında" icon="info" colors={colors}>
            <InfoRow label="Sürüm" value={`${Application.nativeApplicationVersion ?? "-"} (${Application.nativeBuildVersion ?? "-"})`} colors={colors} />
            <ActionRow label="Güncellemeleri kontrol et" icon="refresh-cw" onPress={handleCheckUpdates} colors={colors} />
            <ActionRow label="Geri bildirim / Hata bildir" icon="send" onPress={handleSendFeedback} colors={colors} />
            <ActionRow label="Gizlilik politikası" icon="file-text" onPress={() => WebBrowser.openBrowserAsync("https://medical-library-hub.replit.app/privacy")} colors={colors} />
            <ActionRow label="Kullanım şartları" icon="file" onPress={() => WebBrowser.openBrowserAsync("https://medical-library-hub.replit.app/terms")} colors={colors} />
          </Section>
        )}
      </ScrollView>

      <SimpleModal
        visible={pwModal} onClose={() => setPwModal(false)}
        title="Şifre Değiştir"
        message="Şifrenizi değiştirmek için lütfen kurum yetkilinizle iletişime geçin. Lisans anahtarınız da güncellenmek zorundadır."
        colors={colors}
      />
      <SimpleModal
        visible={emailModal} onClose={() => setEmailModal(false)}
        title="E-posta Değiştir"
        message="E-postanızı değiştirmek için lütfen kurum yetkilinizle iletişime geçin."
        colors={colors}
      />
    </View>
  );
}

function Section({ title, icon, colors, children, danger }: {
  title: string;
  icon: FeatherIconName;
  colors: MedLibColors;
  children: React.ReactNode;
  danger?: boolean;
}) {
  const s = makeStyles(colors);
  return (
    <View style={s.sectionWrap}>
      <View style={s.sectionHeader}>
        <Feather name={icon} size={14} color={danger ? colors.destructive : colors.mutedForeground} />
        <Text style={[s.sectionTitle, danger && { color: colors.destructive }]}>{title}</Text>
      </View>
      <View style={s.sectionBody}>{children}</View>
    </View>
  );
}

function NavRow({ label, icon, onPress, colors }: {
  label: string;
  icon: FeatherIconName;
  onPress: () => void;
  colors: MedLibColors;
}) {
  const s = makeStyles(colors);
  return (
    <Pressable style={({ pressed }) => [s.row, pressed && { opacity: 0.6 }]} onPress={onPress}>
      <Feather name={icon} size={16} color={colors.mutedForeground} />
      <Text style={[s.rowLabel, { flex: 1, marginLeft: 10 }]}>{label}</Text>
      <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
    </Pressable>
  );
}

function ActionRow({ label, icon, onPress, destructive, colors }: {
  label: string;
  icon: FeatherIconName;
  onPress: () => void;
  destructive?: boolean;
  colors: MedLibColors;
}) {
  const s = makeStyles(colors);
  const tint = destructive ? colors.destructive : colors.primary;
  return (
    <Pressable style={({ pressed }) => [s.row, pressed && { opacity: 0.6 }]} onPress={onPress}>
      <Feather name={icon} size={16} color={tint} />
      <Text style={[s.rowLabel, { flex: 1, marginLeft: 10, color: tint }]}>{label}</Text>
    </Pressable>
  );
}

function InfoRow({ label, value, colors }: {
  label: string;
  value: string;
  colors: MedLibColors;
}) {
  const s = makeStyles(colors);
  return (
    <View style={s.row}>
      <Text style={[s.rowLabel, { flex: 1 }]}>{label}</Text>
      <Text style={s.infoValue}>{value}</Text>
    </View>
  );
}

function SimpleModal({ visible, onClose, title, message, colors }: {
  visible: boolean;
  onClose: () => void;
  title: string;
  message: string;
  colors: MedLibColors;
}) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 20, width: "100%", maxWidth: 400 }}>
          <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: colors.foreground, marginBottom: 10 }}>{title}</Text>
          <Text style={{ fontSize: 14, color: colors.mutedForeground, fontFamily: "Inter_400Regular", lineHeight: 20, marginBottom: 18 }}>{message}</Text>
          <Pressable onPress={onClose} style={{ backgroundColor: colors.primary, padding: 12, borderRadius: 10, alignItems: "center" }}>
            <Text style={{ color: "#FFF", fontFamily: "Inter_600SemiBold" }}>Tamam</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(colors: MedLibColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: 16, paddingBottom: 12,
      backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    backBtn: { padding: 4 },
    title: { fontSize: 17, fontFamily: "Inter_700Bold", color: colors.foreground },
    sectionWrap: { marginTop: 22, marginHorizontal: 16 },
    sectionHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8, paddingHorizontal: 4 },
    sectionTitle: {
      fontSize: 11, fontFamily: "Inter_700Bold",
      color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.6,
    },
    sectionBody: {
      backgroundColor: colors.card, borderRadius: 14,
      borderWidth: 1, borderColor: colors.border, overflow: "hidden",
    },
    catRow: {
      flexDirection: "row", alignItems: "center", gap: 14,
      paddingHorizontal: 16, paddingVertical: 16,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
    },
    catIcon: {
      width: 38, height: 38, borderRadius: 19,
      alignItems: "center", justifyContent: "center",
    },
    catTitle: { fontSize: 15, color: colors.foreground, fontFamily: "Inter_600SemiBold" },
    catSubtitle: { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 2 },
    row: {
      flexDirection: "row", alignItems: "center",
      paddingHorizontal: 16, paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
      gap: 4,
    },
    rowLabel: { fontSize: 14, color: colors.foreground, fontFamily: "Inter_500Medium" },
    rowSubtitle: { fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 2 },
    infoValue: { fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    footer: {
      textAlign: "center", marginTop: 30, color: colors.mutedForeground,
      fontSize: 11, fontFamily: "Inter_400Regular",
    },
  });
}
