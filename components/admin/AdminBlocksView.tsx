import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { useColors } from "@/hooks/useColors";

interface Props {
  baseUrl: string;
  token: string;
}

interface Blocked {
  userId: number;
  name: string;
  email: string;
  reason: string;
  createdAt: string;
}

interface UserHit {
  id: number;
  name: string;
  email: string;
}

export function AdminBlocksView({ baseUrl, token }: Props) {
  const colors = useColors();
  const [blocks, setBlocks] = useState<Blocked[]>([]);
  const [loading, setLoading] = useState(false);

  const [adding, setAdding] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [userHits, setUserHits] = useState<UserHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [pendingUser, setPendingUser] = useState<UserHit | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const fetchBlocks = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${baseUrl}/admin/blocks`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (r.ok) setBlocks(d.blocks ?? []);
    } catch {}
    setLoading(false);
  }, [baseUrl, token]);

  useEffect(() => { fetchBlocks(); }, [fetchBlocks]);

  const searchUsers = async (q: string) => {
    setUserSearch(q);
    if (q.trim().length < 2) { setUserHits([]); return; }
    setSearching(true);
    try {
      const r = await fetch(`${baseUrl}/admin/users?email=${encodeURIComponent(q)}`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (r.ok && Array.isArray(d)) setUserHits(d.slice(0, 20).map((u: any) => ({ id: u.id, name: u.name, email: u.email })));
    } catch {}
    setSearching(false);
  };

  const block = () => {
    if (!pendingUser) return;
    const target = pendingUser;
    Alert.alert(
      "Mesajlaşmayı blokla",
      `${target.name || target.email} kullanıcısının mesajlaşmasını bloklamak istediğinden emin misin?`,
      [
        { text: "İptal", style: "cancel" },
        {
          text: "Blokla",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              const r = await fetch(`${baseUrl}/admin/blocks`, {
                method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify({ userId: target.id, reason: reason.trim() }),
              });
              const d = await r.json();
              if (!r.ok) { Alert.alert("Hata", d.error || "Bloklanamadı."); setBusy(false); return; }
              setAdding(false); setPendingUser(null); setReason(""); setUserSearch(""); setUserHits([]);
              await fetchBlocks();
            } catch (e: any) { Alert.alert("Hata", e?.message); }
            setBusy(false);
          },
        },
      ],
    );
  };

  const unblock = (b: Blocked) => {
    Alert.alert("Bloğu kaldır", `${b.name} kullanıcısının mesaj bloğunu kaldır?`, [
      { text: "İptal", style: "cancel" },
      { text: "Kaldır", style: "destructive", onPress: async () => {
        try {
          const r = await fetch(`${baseUrl}/admin/blocks/${b.userId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
          if (r.ok) await fetchBlocks();
          else { const d = await r.json(); Alert.alert("Hata", d.error || "Kaldırılamadı."); }
        } catch (e: any) { Alert.alert("Hata", e?.message); }
      }},
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 12 }}>
        <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: colors.foreground }}>
          {blocks.length} bloklu kullanıcı
        </Text>
        <Pressable onPress={() => { setAdding(true); setPendingUser(null); setReason(""); setUserSearch(""); setUserHits([]); }}
          style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#DC2626", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 }}>
          <Feather name="user-x" size={14} color="#fff" />
          <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 13 }}>Bloka al</Text>
        </Pressable>
      </View>

      {loading ? <ActivityIndicator style={{ marginTop: 24 }} color={colors.primary} /> : (
        <FlatList
          data={blocks}
          keyExtractor={b => String(b.userId)}
          contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 40 }}
          renderItem={({ item }) => (
            <View style={{ backgroundColor: colors.card, borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: "#FECACA" }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: colors.foreground }}>{item.name}</Text>
                  <Text style={{ fontSize: 12, color: colors.mutedForeground }}>{item.email}</Text>
                  {!!item.reason && <Text style={{ fontSize: 12, color: "#991B1B", marginTop: 4, fontStyle: "italic" }}>"{item.reason}"</Text>}
                  <Text style={{ fontSize: 10, color: colors.mutedForeground, marginTop: 4 }}>{new Date(item.createdAt).toLocaleString("tr-TR")}</Text>
                </View>
                <Pressable onPress={() => unblock(item)} style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: colors.secondary }}>
                  <Feather name="user-check" size={12} color={colors.foreground} />
                  <Text style={{ fontSize: 12, color: colors.foreground, fontFamily: "Inter_500Medium" }}>Bloğu kaldır</Text>
                </Pressable>
              </View>
            </View>
          )}
          ListEmptyComponent={<Text style={{ textAlign: "center", color: colors.mutedForeground, marginTop: 40 }}>Bloklu kullanıcı yok.</Text>}
        />
      )}

      <Modal visible={adding} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setAdding(false)}>
        <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: Platform.OS === "web" ? 67 : 0 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 18, color: colors.foreground }}>Mesajlaşmayı blokla</Text>
            <Pressable onPress={() => setAdding(false)}><Feather name="x" size={22} color={colors.mutedForeground} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
            {!pendingUser ? (
              <>
                <Text style={{ fontSize: 12, color: colors.mutedForeground, marginBottom: 6 }}>Kullanıcı ara (e-posta)</Text>
                <TextInput value={userSearch} onChangeText={searchUsers} placeholder="kullanici@ornek.com" placeholderTextColor={colors.mutedForeground} autoCapitalize="none"
                  style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, color: colors.foreground, backgroundColor: colors.card, fontSize: 15 }} />
                {searching ? <ActivityIndicator color={colors.primary} /> : null}
                {userHits.map(u => (
                  <Pressable key={u.id} onPress={() => setPendingUser(u)}
                    style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, color: colors.foreground, fontFamily: "Inter_500Medium" }}>{u.name || "(isim yok)"}</Text>
                      <Text style={{ fontSize: 12, color: colors.mutedForeground }}>{u.email}</Text>
                    </View>
                    <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
                  </Pressable>
                ))}
              </>
            ) : (
              <>
                <View style={{ padding: 12, backgroundColor: colors.muted, borderRadius: 8 }}>
                  <Text style={{ fontFamily: "Inter_600SemiBold", color: colors.foreground }}>{pendingUser.name || "(isim yok)"}</Text>
                  <Text style={{ fontSize: 12, color: colors.mutedForeground }}>{pendingUser.email}</Text>
                  <Pressable onPress={() => setPendingUser(null)} style={{ marginTop: 8 }}>
                    <Text style={{ fontSize: 12, color: colors.primary }}>Değiştir</Text>
                  </Pressable>
                </View>
                <Text style={{ fontSize: 12, color: colors.mutedForeground, marginBottom: 6 }}>Sebep (opsiyonel, sadece adminler görür)</Text>
                <TextInput value={reason} onChangeText={setReason} multiline placeholder="Örn: spam"
                  placeholderTextColor={colors.mutedForeground}
                  style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, color: colors.foreground, backgroundColor: colors.card, fontSize: 14, minHeight: 80 }} />
                <Pressable onPress={block} disabled={busy}
                  style={{ backgroundColor: "#DC2626", padding: 14, borderRadius: 8, alignItems: "center", marginTop: 8, opacity: busy ? 0.6 : 1 }}>
                  {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 15 }}>Mesajlaşmayı blokla</Text>}
                </Pressable>
              </>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
