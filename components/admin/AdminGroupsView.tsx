import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { useColors } from "@/hooks/useColors";

interface Props {
  baseUrl: string;
  token: string;
}

interface AdminGroup {
  id: number;
  slug: string;
  name: string;
  description: string;
  displayOrder: number;
  memberCount: number;
}

interface Member {
  userId: number;
  name: string;
  email: string;
  specialty: string | null;
}

interface UserHit {
  id: number;
  name: string;
  email: string;
}

export function AdminGroupsView({ baseUrl, token }: Props) {
  const colors = useColors();
  const [groups, setGroups] = useState<AdminGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<AdminGroup | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [displayOrder, setDisplayOrder] = useState("99");
  const [busy, setBusy] = useState(false);

  const [memberModalGroup, setMemberModalGroup] = useState<AdminGroup | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  const [userSearch, setUserSearch] = useState("");
  const [userHits, setUserHits] = useState<UserHit[]>([]);
  const [searching, setSearching] = useState(false);

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${baseUrl}/admin/groups`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (r.ok) setGroups(d.groups ?? []);
    } catch {}
    setLoading(false);
  }, [baseUrl, token]);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  const openCreate = () => {
    setEditing(null);
    setCreating(true);
    setName(""); setDescription(""); setDisplayOrder("99");
  };

  const openEdit = (g: AdminGroup) => {
    setCreating(false);
    setEditing(g);
    setName(g.name); setDescription(g.description); setDisplayOrder(String(g.displayOrder));
  };

  const closeForm = () => { setCreating(false); setEditing(null); };

  const submit = async () => {
    if (!name.trim()) { Alert.alert("Hata", "Grup adı boş olamaz."); return; }
    setBusy(true);
    try {
      const url = editing ? `${baseUrl}/admin/groups/${editing.id}` : `${baseUrl}/admin/groups`;
      const method = editing ? "PATCH" : "POST";
      const r = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim(), displayOrder: parseInt(displayOrder) || 99 }),
      });
      const d = await r.json();
      if (!r.ok) { Alert.alert("Hata", d.error || "İşlem başarısız."); setBusy(false); return; }
      closeForm();
      await fetchGroups();
    } catch (e: any) { Alert.alert("Hata", e?.message || "Bağlantı hatası."); }
    setBusy(false);
  };

  const removeGroup = (g: AdminGroup) => {
    Alert.alert(
      "Grubu sil",
      `"${g.name}" grubunu ve tüm mesajlarını silmek istediğine emin misin?`,
      [
        { text: "İptal", style: "cancel" },
        { text: "Sil", style: "destructive", onPress: async () => {
          try {
            const r = await fetch(`${baseUrl}/admin/groups/${g.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
            if (r.ok) { await fetchGroups(); }
            else { const d = await r.json(); Alert.alert("Hata", d.error || "Silinemedi."); }
          } catch (e: any) { Alert.alert("Hata", e?.message); }
        }},
      ]
    );
  };

  const openMembers = async (g: AdminGroup) => {
    setMemberModalGroup(g);
    setMembers([]); setUserSearch(""); setUserHits([]);
    setMembersLoading(true);
    try {
      const r = await fetch(`${baseUrl}/admin/groups/${g.id}/members`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (r.ok) setMembers(d.members ?? []);
    } catch {}
    setMembersLoading(false);
  };

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

  const addMember = async (uid: number) => {
    if (!memberModalGroup) return;
    try {
      const r = await fetch(`${baseUrl}/admin/groups/${memberModalGroup.id}/members`, {
        method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ userId: uid }),
      });
      const d = await r.json();
      if (!r.ok) { Alert.alert("Hata", d.error || "Eklenemedi."); return; }
      await openMembers(memberModalGroup);
      await fetchGroups();
    } catch (e: any) { Alert.alert("Hata", e?.message); }
  };

  const removeMember = (m: Member) => {
    if (!memberModalGroup) return;
    Alert.alert("Üyeyi çıkar", `${m.name} bu gruptan çıkarılsın mı?`, [
      { text: "İptal", style: "cancel" },
      { text: "Çıkar", style: "destructive", onPress: async () => {
        try {
          const r = await fetch(`${baseUrl}/admin/groups/${memberModalGroup.id}/members/${m.userId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
          if (r.ok) { await openMembers(memberModalGroup); await fetchGroups(); }
        } catch (e: any) { Alert.alert("Hata", e?.message); }
      }},
    ]);
  };

  const formVisible = creating || !!editing;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 12 }}>
        <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: colors.foreground }}>
          {groups.length} grup
        </Text>
        <Pressable onPress={openCreate} style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 }}>
          <Feather name="plus" size={14} color="#fff" />
          <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 13 }}>Yeni grup</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={colors.primary} />
      ) : (
        <FlatList
          data={groups}
          keyExtractor={g => String(g.id)}
          contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 40 }}
          renderItem={({ item }) => (
            <View style={{ backgroundColor: colors.card, borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: colors.border }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 15, color: colors.foreground }}>{item.name}</Text>
                  {!!item.description && <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 2 }} numberOfLines={2}>{item.description}</Text>}
                  <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 4 }}>
                    #{item.slug} · sıra: {item.displayOrder} · {item.memberCount} üye
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                <Pressable onPress={() => openMembers(item)} style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: colors.secondary }}>
                  <Feather name="users" size={12} color={colors.foreground} />
                  <Text style={{ fontSize: 12, color: colors.foreground, fontFamily: "Inter_500Medium" }}>Üyeler</Text>
                </Pressable>
                <Pressable onPress={() => openEdit(item)} style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: colors.secondary }}>
                  <Feather name="edit-2" size={12} color={colors.foreground} />
                  <Text style={{ fontSize: 12, color: colors.foreground, fontFamily: "Inter_500Medium" }}>Düzenle</Text>
                </Pressable>
                <Pressable onPress={() => removeGroup(item)} style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: "#FEE2E2" }}>
                  <Feather name="trash-2" size={12} color="#DC2626" />
                  <Text style={{ fontSize: 12, color: "#DC2626", fontFamily: "Inter_500Medium" }}>Sil</Text>
                </Pressable>
              </View>
            </View>
          )}
          ListEmptyComponent={<Text style={{ textAlign: "center", color: colors.mutedForeground, marginTop: 40 }}>Grup yok.</Text>}
        />
      )}

      {/* Create/Edit form modal */}
      <Modal visible={formVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeForm}>
        <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: Platform.OS === "web" ? 67 : 0 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 18, color: colors.foreground }}>
              {editing ? "Grubu düzenle" : "Yeni grup"}
            </Text>
            <Pressable onPress={closeForm}><Feather name="x" size={22} color={colors.mutedForeground} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
            <View>
              <Text style={{ fontSize: 12, color: colors.mutedForeground, marginBottom: 6 }}>Grup adı</Text>
              <TextInput value={name} onChangeText={setName} placeholder="Örn: Genç Cerrahlar" placeholderTextColor={colors.mutedForeground}
                style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, color: colors.foreground, backgroundColor: colors.card, fontSize: 15 }} />
            </View>
            <View>
              <Text style={{ fontSize: 12, color: colors.mutedForeground, marginBottom: 6 }}>Açıklama (opsiyonel)</Text>
              <TextInput value={description} onChangeText={setDescription} multiline placeholder="Kısa açıklama" placeholderTextColor={colors.mutedForeground}
                style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, color: colors.foreground, backgroundColor: colors.card, fontSize: 14, minHeight: 80 }} />
            </View>
            <View>
              <Text style={{ fontSize: 12, color: colors.mutedForeground, marginBottom: 6 }}>Sıralama (küçük olan üstte)</Text>
              <TextInput value={displayOrder} onChangeText={setDisplayOrder} keyboardType="number-pad"
                style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, color: colors.foreground, backgroundColor: colors.card, fontSize: 15 }} />
            </View>
            <Pressable onPress={submit} disabled={busy}
              style={{ backgroundColor: colors.primary, padding: 14, borderRadius: 8, alignItems: "center", marginTop: 8, opacity: busy ? 0.6 : 1 }}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 15 }}>{editing ? "Kaydet" : "Oluştur"}</Text>}
            </Pressable>
          </ScrollView>
        </View>
      </Modal>

      {/* Members modal */}
      <Modal visible={!!memberModalGroup} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setMemberModalGroup(null)}>
        <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: Platform.OS === "web" ? 67 : 0 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 18, color: colors.foreground }}>{memberModalGroup?.name}</Text>
              <Text style={{ fontSize: 12, color: colors.mutedForeground }}>{members.length} üye</Text>
            </View>
            <Pressable onPress={() => setMemberModalGroup(null)}><Feather name="x" size={22} color={colors.mutedForeground} /></Pressable>
          </View>

          <View style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.muted }}>
            <Text style={{ fontSize: 12, color: colors.mutedForeground, marginBottom: 6, fontFamily: "Inter_600SemiBold" }}>Üye ekle (e-posta ile ara)</Text>
            <TextInput value={userSearch} onChangeText={searchUsers} placeholder="kullanici@ornek.com" placeholderTextColor={colors.mutedForeground} autoCapitalize="none"
              style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, color: colors.foreground, backgroundColor: colors.card, fontSize: 14 }} />
            {searching ? <ActivityIndicator size="small" style={{ marginTop: 6 }} color={colors.primary} /> : null}
            {userHits.length > 0 && (
              <View style={{ marginTop: 6, backgroundColor: colors.card, borderRadius: 8, borderWidth: 1, borderColor: colors.border, maxHeight: 200 }}>
                <ScrollView>
                  {userHits.map(u => {
                    const already = members.some(m => m.userId === u.id);
                    return (
                      <Pressable key={u.id} onPress={() => !already && addMember(u.id)} disabled={already}
                        style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 10, borderBottomWidth: 1, borderBottomColor: colors.border, opacity: already ? 0.5 : 1 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 13, color: colors.foreground, fontFamily: "Inter_500Medium" }}>{u.name || "(isim yok)"}</Text>
                          <Text style={{ fontSize: 11, color: colors.mutedForeground }}>{u.email}</Text>
                        </View>
                        {already ? <Text style={{ fontSize: 11, color: colors.mutedForeground }}>üye</Text>
                          : <Feather name="plus-circle" size={18} color={colors.primary} />}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            )}
          </View>

          {membersLoading ? <ActivityIndicator style={{ marginTop: 24 }} color={colors.primary} /> : (
            <FlatList
              data={members}
              keyExtractor={m => String(m.userId)}
              contentContainerStyle={{ padding: 12 }}
              renderItem={({ item }) => (
                <View style={{ flexDirection: "row", alignItems: "center", padding: 12, backgroundColor: colors.card, borderRadius: 8, marginBottom: 6, borderWidth: 1, borderColor: colors.border }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: "Inter_500Medium", fontSize: 14, color: colors.foreground }}>{item.name}</Text>
                    <Text style={{ fontSize: 11, color: colors.mutedForeground }}>{item.email}</Text>
                    {item.specialty ? <Text style={{ fontSize: 10, color: colors.mutedForeground, fontStyle: "italic" }}>{item.specialty}</Text> : null}
                  </View>
                  <Pressable onPress={() => removeMember(item)} style={{ padding: 8 }}>
                    <Feather name="user-minus" size={18} color="#DC2626" />
                  </Pressable>
                </View>
              )}
              ListEmptyComponent={<Text style={{ textAlign: "center", color: colors.mutedForeground, marginTop: 40 }}>Henüz üye yok.</Text>}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}
