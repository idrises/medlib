import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import SegmentRow from "@/components/SegmentRow";
import TimeInput from "@/components/TimeInput";
import ToggleRow from "@/components/ToggleRow";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings, WhoCanMessage } from "@/contexts/SettingsContext";
import { MedLibColors } from "@/hooks/useColors";

type Props = {
  colors: MedLibColors;
  isAdmin?: boolean;
  onSavePersist?: () => Promise<void> | void;
};

export default function MessagingSettingsContent({ colors, isAdmin, onSavePersist }: Props) {
  const { settings, setSetting } = useSettings();
  const { token } = useAuth();
  const [nickDraft, setNickDraft] = useState(settings.nickAlias);
  const [blocked, setBlocked] = useState<{ id: number; displayName: string; specialty: string | null }[]>([]);
  const [blockedLoading, setBlockedLoading] = useState(false);

  const loadBlocked = React.useCallback(async () => {
    if (!token) return;
    setBlockedLoading(true);
    try {
      const { messagingApi } = await import("@/services/api");
      const list = await messagingApi.getBlocked(token);
      setBlocked(list);
    } catch (e) {
      console.warn("loadBlocked failed", e);
    } finally {
      setBlockedLoading(false);
    }
  }, [token]);

  useEffect(() => { loadBlocked(); }, [loadBlocked]);

  const onUnblock = async (id: number) => {
    if (!token) return;
    try {
      const { messagingApi } = await import("@/services/api");
      await messagingApi.unblock(token, id);
      setBlocked(prev => prev.filter(u => u.id !== id));
    } catch {
      Alert.alert("Hata", "Engel kaldırılamadı.");
    }
  };

  const requestContactsPermission = async () => {
    try {
      const Contacts = await import("expo-contacts");
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Rehber izni gerekli", "Sadece rehberindeki kişilerin sana mesaj gönderebilmesi için iletişim erişimine izin vermelisin.");
        return false;
      }
      return true;
    } catch {
      Alert.alert("Rehber kullanılamıyor", "Rehber özelliği bu sürümde kullanılamıyor. Lütfen uygulamayı güncelleyin.");
      return false;
    }
  };

  const onWhoChange = async (v: WhoCanMessage) => {
    if (v === "contacts") {
      const ok = await requestContactsPermission();
      if (!ok) return;
    }
    setSetting("msgWhoCanMessage", v);
  };

  const commitNick = () => {
    if (nickDraft !== settings.nickAlias) setSetting("nickAlias", nickDraft.trim());
  };

  const s = makeStyles(colors);
  const whoOptions: { k: WhoCanMessage; l: string }[] = [
    { k: "everyone", l: "Herkes" },
    { k: "contacts", l: "Rehberim" },
    { k: "nobody", l: "Hiç kimse" },
  ];

  return (
    <View>
      <SectionLabel s={s}>Bana kim mesaj gönderebilir</SectionLabel>
      <View style={s.card}>
        <View style={s.segRow}>
          {whoOptions.map(opt => {
            const active = settings.msgWhoCanMessage === opt.k;
            return (
              <Pressable
                key={opt.k}
                style={[s.segBtn, active && { backgroundColor: colors.primary }]}
                onPress={() => onWhoChange(opt.k)}
              >
                <Text style={[s.segText, active && { color: colors.primaryForeground }]}>{opt.l}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <SectionLabel s={s}>Profilimde görünen bilgiler</SectionLabel>
      <View style={s.card}>
        <ToggleRow label="Adım" value={settings.showFirstName} onChange={v => setSetting("showFirstName", v)} colors={colors} disabled={settings.showNickAlias} />
        <ToggleRow label="Soyadım" value={settings.showLastName} onChange={v => setSetting("showLastName", v)} colors={colors} disabled={settings.showNickAlias} />
        <ToggleRow label="Uzmanlık alanım" value={settings.showSpecialty} onChange={v => setSetting("showSpecialty", v)} colors={colors} />
        <ToggleRow label="Kurumum" value={settings.showInstitution} onChange={v => setSetting("showInstitution", v)} colors={colors} />
        <ToggleRow
          label="Takma adımı göster"
          subtitle="Açıldığında adın/soyadın yerine takma adın görünür"
          value={settings.showNickAlias}
          onChange={v => {
            setSetting("showNickAlias", v);
            if (v) {
              setSetting("showFirstName", false);
              setSetting("showLastName", false);
            } else {
              setSetting("showFirstName", true);
              setSetting("showLastName", true);
            }
          }}
          colors={colors}
          last
        />
      </View>

      <SectionLabel s={s}>Takma adım (Nick / Alias)</SectionLabel>
      <View style={[s.card, { padding: 12, opacity: settings.showNickAlias ? 1 : 0.55 }]}>
        <TextInput
          value={nickDraft}
          onChangeText={setNickDraft}
          onBlur={commitNick}
          placeholder={settings.showNickAlias ? "Örn: Dr.Idris" : "Önce 'Takma adımı göster' seçeneğini aç"}
          placeholderTextColor={colors.mutedForeground}
          style={s.nickInput}
          maxLength={40}
          autoCapitalize="none"
          editable={settings.showNickAlias}
        />
        <Text style={[s.rowSub, { marginTop: 8 }]}>
          {settings.showNickAlias
            ? "Bu ad, gerçek adın yerine diğer kullanıcılarda görünür."
            : "Takma ad kullanmak için yukarıdaki 'Takma adımı göster' seçeneğini aç."}
        </Text>
      </View>

      <SectionLabel s={s}>Bildirimler</SectionLabel>
      <View style={s.card}>
        <ToggleRow label="Yeni özel mesaj (DM)" value={settings.notifMessagesPrivate} onChange={v => setSetting("notifMessagesPrivate", v)} colors={colors} />
        <ToggleRow label="Grup mesajları" value={settings.notifMessagesGroup} onChange={v => setSetting("notifMessagesGroup", v)} colors={colors} />
        <ToggleRow label="Paylaşılan içerik" value={settings.notifSharedContent} onChange={v => setSetting("notifSharedContent", v)} colors={colors} />
        {isAdmin && (
          <ToggleRow label="Cihaz onay talepleri" value={settings.notifDeviceApproval} onChange={v => setSetting("notifDeviceApproval", v)} colors={colors} last />
        )}
      </View>

      <SectionLabel s={s}>Bildirim & Ses</SectionLabel>
      <View style={s.card}>
        <ToggleRow label="Tüm mesajları sustur" value={settings.msgMuteAll} onChange={v => setSetting("msgMuteAll", v)} colors={colors} />
        <ToggleRow label="Sadece etiketlendiğimde bildir (@mention)" value={settings.msgMentionOnly} onChange={v => setSetting("msgMentionOnly", v)} colors={colors} />
        <ToggleRow label="Sessiz Saatler" value={settings.msgQuietHoursEnabled} onChange={v => setSetting("msgQuietHoursEnabled", v)} colors={colors} />
        {settings.msgQuietHoursEnabled && (
          <View style={s.quietHoursRow}>
            <TimeInput label="Başlangıç" value={settings.msgQuietHoursStart} onChange={v => setSetting("msgQuietHoursStart", v)} colors={colors} />
            <TimeInput label="Bitiş" value={settings.msgQuietHoursEnd} onChange={v => setSetting("msgQuietHoursEnd", v)} colors={colors} />
          </View>
        )}
        <SegmentRow
          label="Bildirim Sesi" colors={colors}
          options={[{ k: "on", l: "Açık" }, { k: "vibrate", l: "Titreşim" }, { k: "off", l: "Sessiz" }]}
          value={settings.msgSound}
          onChange={v => setSetting("msgSound", v)}
        />
        <ToggleRow label="Mesaj önizlemesini göster" subtitle="Kilit ekranında metni gösterir (KVKK)" value={settings.msgPreview} onChange={v => setSetting("msgPreview", v)} colors={colors} last />
      </View>

      <SectionLabel s={s}>Gizlilik</SectionLabel>
      <View style={s.card}>
        <ToggleRow label="Okundu bilgisi (mavi tik)" value={settings.msgReadReceipts} onChange={v => setSetting("msgReadReceipts", v)} colors={colors} />
        <ToggleRow label="Yazıyor… göstergesi" value={settings.msgTypingIndicator} onChange={v => setSetting("msgTypingIndicator", v)} colors={colors} />
        <ToggleRow label="Son görülme paylaş" value={settings.msgLastSeen} onChange={v => setSetting("msgLastSeen", v)} colors={colors} last />
      </View>

      <SectionLabel s={s}>Görünüm & Medya</SectionLabel>
      <View style={s.card}>
        <SegmentRow
          label="Yazı Boyutu" colors={colors}
          options={[{ k: "small", l: "Küçük" }, { k: "medium", l: "Orta" }, { k: "large", l: "Büyük" }]}
          value={settings.msgFontSize}
          onChange={v => setSetting("msgFontSize", v)}

        />
        <ToggleRow label="Enter ile gönder" value={settings.msgEnterToSend} onChange={v => setSetting("msgEnterToSend", v)} colors={colors} />
        <ToggleRow label="Medyayı sadece Wi-Fi ile otomatik indir" value={settings.msgAutoDownloadWifi} onChange={v => setSetting("msgAutoDownloadWifi", v)} colors={colors} />
        <ToggleRow label="30 gün öncesi mesajları otomatik sil" value={settings.msgAutoDelete30d} onChange={v => setSetting("msgAutoDelete30d", v)} colors={colors} last />
      </View>

      <SectionLabel s={s}>Engellediklerim</SectionLabel>
      <View style={s.card}>
        {blockedLoading ? (
          <Text style={[s.rowSub, { padding: 14 }]}>Yükleniyor…</Text>
        ) : blocked.length === 0 ? (
          <Text style={[s.rowSub, { padding: 14 }]}>Henüz kimseyi engellemedin.</Text>
        ) : (
          blocked.map((u, idx) => (
            <View key={u.id} style={[s.row, idx === blocked.length - 1 && { borderBottomWidth: 0 }]}>
              <View style={{ flex: 1 }}>
                <Text style={s.rowLabel} numberOfLines={1}>{u.displayName}</Text>
                {u.specialty && <Text style={s.rowSub} numberOfLines={1}>{u.specialty}</Text>}
              </View>
              <Pressable
                onPress={() => onUnblock(u.id)}
                style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.muted }}
              >
                <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>Kaldır</Text>
              </Pressable>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

function SectionLabel({ children, s }: { children: React.ReactNode; s: ReturnType<typeof makeStyles> }) {
  return <Text style={s.sectionLabel}>{children}</Text>;
}


const ROW_PADDING_H = 14;

function makeStyles(colors: MedLibColors) {
  return StyleSheet.create({
    sectionLabel: {
      fontSize: 12, fontFamily: "Inter_600SemiBold", textTransform: "uppercase",
      letterSpacing: 0.5, color: colors.mutedForeground,
      paddingHorizontal: 16, paddingTop: 24, paddingBottom: 8,
    },
    card: {
      backgroundColor: colors.card, marginHorizontal: 16, borderRadius: colors.radius ?? 12,
      borderWidth: 1, borderColor: colors.border, overflow: "hidden",
    },
    segRow: {
      flexDirection: "row", margin: 12, borderRadius: 10,
      backgroundColor: colors.muted, padding: 3, gap: 3,
    },
    segBtn: { flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: "center" },
    segText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground },
    row: {
      flexDirection: "row", alignItems: "center",
      paddingHorizontal: ROW_PADDING_H, paddingVertical: 14,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    rowLabel: { flex: 1, fontSize: 15, fontFamily: "Inter_500Medium", color: colors.foreground },
    rowSub: { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 2 },
    quietHoursRow: {
      flexDirection: "row", paddingHorizontal: ROW_PADDING_H, paddingBottom: 12, gap: 12,
    },
    nickInput: {
      borderWidth: 1, borderColor: colors.border, borderRadius: 8,
      paddingHorizontal: 12, paddingVertical: 10, fontSize: 15,
      color: colors.foreground, backgroundColor: colors.background,
      fontFamily: "Inter_400Regular",
    },
  });
}
