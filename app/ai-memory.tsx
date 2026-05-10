import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

const BASE =
  process.env["EXPO_PUBLIC_API_URL"] ??
  (process.env["EXPO_PUBLIC_DOMAIN"]
    ? `https://${process.env["EXPO_PUBLIC_DOMAIN"]}/api`
    : "https://medical-library-hub.replit.app/api");

type Mem = { key: string; value: string; source: string; updatedAt: string };

export default function AiMemoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useAuth();

  const [items, setItems] = useState<Mem[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const r = await fetch(`${BASE}/openai/memory`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      setItems(Array.isArray(d) ? d : []);
    } catch {}
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const removeOne = (key: string) => {
    Alert.alert("Sil", `"${key}" hatırasını silmek istediğine emin misin?`, [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Sil", style: "destructive", onPress: async () => {
          try {
            await fetch(`${BASE}/openai/memory/${encodeURIComponent(key)}`, {
              method: "DELETE", headers: { Authorization: `Bearer ${token}` },
            });
            setItems(prev => prev.filter(m => m.key !== key));
          } catch {}
        },
      },
    ]);
  };

  const clearAll = () => {
    if (items.length === 0) return;
    Alert.alert("Tüm Hafızayı Sil", "AI'ın senin hakkında hatırladığı her şeyi silmek istediğine emin misin?", [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Hepsini Sil", style: "destructive", onPress: async () => {
          try {
            await fetch(`${BASE}/openai/memory`, {
              method: "DELETE", headers: { Authorization: `Bearer ${token}` },
            });
            setItems([]);
          } catch {}
        },
      },
    ]);
  };

  const saveNew = async () => {
    const k = newKey.trim();
    const v = newValue.trim();
    if (!k || !v) {
      Alert.alert("Eksik bilgi", "Anahtar ve değer boş olamaz.");
      return;
    }
    setSaving(true);
    try {
      const r = await fetch(`${BASE}/openai/memory`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ key: k, value: v }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        Alert.alert("Hata", d.error ?? "Kaydedilemedi");
        return;
      }
      setNewKey(""); setNewValue(""); setAdding(false);
      await load();
    } catch {
      Alert.alert("Hata", "Kaydedilemedi");
    } finally { setSaving(false); }
  };

  const topPad = Platform.OS === "web" ? 40 : insets.top;
  const bottomPad = Platform.OS === "web" ? 40 : insets.bottom + 30;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Feather name="chevron-left" size={26} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground }]}>AI Hafızası</Text>
        <Pressable onPress={() => setAdding(v => !v)} hitSlop={12} style={styles.backBtn}>
          <Feather name={adding ? "x" : "plus"} size={22} color={colors.foreground} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomPad }}>
        <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 14, lineHeight: 18 }}>
          AI asistanı, sohbetlerinizden öğrendiklerini burada saklar. Her yanıtı bu bilgilere göre kişiselleştirir. İstediğiniz hatırayı silebilir veya elle ekleyebilirsiniz.
        </Text>

        {adding ? (
          <View style={{ backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 16 }}>
            <Text style={{ color: colors.mutedForeground, fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
              Anahtar
            </Text>
            <TextInput
              value={newKey} onChangeText={setNewKey}
              placeholder="örn. uzmanlik_alani"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              style={{
                borderWidth: 1, borderColor: colors.border, borderRadius: 8,
                padding: 10, color: colors.foreground, fontFamily: "Inter_400Regular", fontSize: 14, marginBottom: 10,
              }}
            />
            <Text style={{ color: colors.mutedForeground, fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
              Değer
            </Text>
            <TextInput
              value={newValue} onChangeText={setNewValue}
              placeholder="örn. Plastik cerrah, rinoplasti uzmanı"
              placeholderTextColor={colors.mutedForeground}
              multiline
              style={{
                borderWidth: 1, borderColor: colors.border, borderRadius: 8,
                padding: 10, color: colors.foreground, fontFamily: "Inter_400Regular", fontSize: 14, minHeight: 60, textAlignVertical: "top", marginBottom: 12,
              }}
            />
            <Pressable
              onPress={saveNew}
              disabled={saving}
              style={{ backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 12, alignItems: "center", opacity: saving ? 0.6 : 1 }}
            >
              {saving ? <ActivityIndicator size="small" color="#fff" /> :
                <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 }}>Kaydet</Text>}
            </Pressable>
          </View>
        ) : null}

        {loading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : items.length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 40 }}>
            <Feather name="cpu" size={42} color={colors.mutedForeground} />
            <Text style={{ color: colors.mutedForeground, marginTop: 12, fontFamily: "Inter_400Regular", fontSize: 13, textAlign: "center", paddingHorizontal: 24 }}>
              Henüz hatıra yok.{"\n"}AI ile sohbet ettikçe burası dolacak.
            </Text>
          </View>
        ) : (
          <>
            {items.map(m => (
              <View key={m.key} style={{
                backgroundColor: colors.card, borderRadius: 12, borderWidth: 1,
                borderColor: colors.border, padding: 14, marginBottom: 10,
              }}>
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>{m.key}</Text>
                    <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 4, lineHeight: 18 }}>{m.value}</Text>
                    <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 10, marginTop: 6, opacity: 0.7 }}>
                      {m.source === "user" ? "Sen ekledin" : "AI öğrendi"} · {new Date(m.updatedAt).toLocaleDateString("tr-TR")}
                    </Text>
                  </View>
                  <Pressable onPress={() => removeOne(m.key)} hitSlop={8} style={{ padding: 4 }}>
                    <Feather name="trash-2" size={16} color={colors.mutedForeground} />
                  </Pressable>
                </View>
              </View>
            ))}

            <Pressable
              onPress={clearAll}
              style={{ marginTop: 12, paddingVertical: 12, alignItems: "center", borderRadius: 10, borderWidth: 1, borderColor: "#DC262640" }}
            >
              <Text style={{ color: "#DC2626", fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                Tüm Hafızayı Sil
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 12, paddingBottom: 12, borderBottomWidth: 1,
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
});
