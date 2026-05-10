import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
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

import { useColors } from "@/hooks/useColors";
import {
  AiConversation,
  AiThread,
  assignConversationToThread,
  createAiThread,
  deleteAiConversation,
  deleteAiThread,
  listAiConversations,
  listAiThreads,
  updateAiThread,
} from "@/services/aiApi";

const UNGROUPED_KEY = "__ungrouped__";

interface Section {
  key: string;
  thread: AiThread | null;
  items: AiConversation[];
}

function isVoice(c: AiConversation): boolean {
  return typeof c.title === "string" && c.title.startsWith("Sesli Sohbet");
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return "";
  }
}

export default function AiChatListScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [items, setItems] = useState<AiConversation[]>([]);
  const [threads, setThreads] = useState<AiThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // Modals
  const [newThreadModal, setNewThreadModal] = useState(false);
  const params = useLocalSearchParams<{ openNewThread?: string }>();
  useEffect(() => {
    if (params.openNewThread === "1") {
      setNewThreadModal(true);
      router.setParams({ openNewThread: undefined } as never);
    }
  }, [params.openNewThread, router]);
  const [newThreadTitle, setNewThreadTitle] = useState("");
  const [newThreadBusy, setNewThreadBusy] = useState(false);

  const [renameTarget, setRenameTarget] = useState<AiThread | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const [assignTarget, setAssignTarget] = useState<AiConversation | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [list, ths] = await Promise.all([listAiConversations(), listAiThreads()]);
      setItems(Array.isArray(list) ? list : []);
      setThreads(Array.isArray(ths) ? ths : []);
    } catch {
      setError("Sohbetler yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  const sections: Section[] = useMemo(() => {
    const byThread = new Map<number, AiConversation[]>();
    const ungrouped: AiConversation[] = [];
    for (const c of items) {
      if (typeof c.threadId === "number" && c.threadId > 0) {
        const arr = byThread.get(c.threadId) ?? [];
        arr.push(c);
        byThread.set(c.threadId, arr);
      } else {
        ungrouped.push(c);
      }
    }
    const out: Section[] = threads.map((t) => ({
      key: `t${t.id}`,
      thread: t,
      items: byThread.get(t.id) ?? [],
    }));
    if (ungrouped.length) {
      out.push({ key: UNGROUPED_KEY, thread: null, items: ungrouped });
    }
    return out;
  }, [items, threads]);

  const handleDeleteConv = useCallback((conv: AiConversation) => {
    Alert.alert("Sohbeti sil", `"${conv.title || "Sohbet"}" silinsin mi?`, [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteAiConversation(conv.id);
            setItems((prev) => prev.filter((c) => c.id !== conv.id));
          } catch {
            Alert.alert("Hata", "Sohbet silinemedi");
          }
        },
      },
    ]);
  }, []);

  const handleConvLongPress = useCallback((conv: AiConversation) => {
    Alert.alert(conv.title || "Sohbet", undefined, [
      { text: "Konu başlığına taşı…", onPress: () => setAssignTarget(conv) },
      { text: "Sil", style: "destructive", onPress: () => handleDeleteConv(conv) },
      { text: "Vazgeç", style: "cancel" },
    ]);
  }, [handleDeleteConv]);

  const handleCreateThread = useCallback(async () => {
    const title = newThreadTitle.trim();
    if (!title) return;
    setNewThreadBusy(true);
    try {
      const t = await createAiThread(title);
      setThreads((prev) => [t, ...prev]);
      setNewThreadModal(false);
      setNewThreadTitle("");
    } catch {
      Alert.alert("Hata", "Konu başlığı oluşturulamadı");
    } finally {
      setNewThreadBusy(false);
    }
  }, [newThreadTitle]);

  const handleRenameThread = useCallback(async () => {
    if (!renameTarget) return;
    const title = renameValue.trim();
    if (!title) return;
    try {
      const updated = await updateAiThread(renameTarget.id, { title });
      setThreads((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      setRenameTarget(null);
      setRenameValue("");
    } catch {
      Alert.alert("Hata", "Yeniden adlandırılamadı");
    }
  }, [renameTarget, renameValue]);

  const handleDeleteThread = useCallback((t: AiThread) => {
    Alert.alert(
      "Konu başlığını sil",
      `"${t.title}" silinsin mi? Sohbetler silinmez, sadece başlığa atamaları kaldırılır.`,
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Sil",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteAiThread(t.id);
              setThreads((prev) => prev.filter((x) => x.id !== t.id));
              setItems((prev) =>
                prev.map((c) => (c.threadId === t.id ? { ...c, threadId: null } : c))
              );
            } catch {
              Alert.alert("Hata", "Silinemedi");
            }
          },
        },
      ]
    );
  }, []);

  const handleAssign = useCallback(
    async (threadId: number | null) => {
      const conv = assignTarget;
      if (!conv) return;
      try {
        await assignConversationToThread(conv.id, threadId);
        setItems((prev) =>
          prev.map((c) => (c.id === conv.id ? { ...c, threadId } : c))
        );
        setAssignTarget(null);
      } catch {
        Alert.alert("Hata", "Atama yapılamadı");
      }
    },
    [assignTarget]
  );

  const renderConv = (item: AiConversation) => {
    const voice = isVoice(item);
    return (
      <Pressable
        key={item.id}
        onPress={() => router.push(`/ai-chat/${item.id}` as never)}
        onLongPress={() => handleConvLongPress(item)}
        style={({ pressed }) => [
          styles.row,
          { backgroundColor: pressed ? colors.muted : colors.card, borderColor: colors.border },
        ]}
      >
        <View style={[styles.iconWrap, { backgroundColor: voice ? colors.primary : colors.muted }]}>
          <Feather name={voice ? "mic" : "message-square"} size={18} color={voice ? "#fff" : colors.text} />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {item.title || (voice ? "Sesli Sohbet" : "Sohbet")}
          </Text>
          <Text style={[styles.date, { color: colors.mutedForeground }]} numberOfLines={1}>
            {formatDate(item.createdAt)}
          </Text>
        </View>
        <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
      </Pressable>
    );
  };

  const renderSection = ({ item: section }: { item: Section }) => {
    const isCollapsed = collapsed[section.key] === true;
    const headerLabel = section.thread ? section.thread.title : "Başlığa atanmamış";
    return (
      <View style={{ marginBottom: 14 }}>
        <View style={[styles.sectionHeader, { borderColor: colors.border }]}>
          <Pressable
            onPress={() => setCollapsed((p) => ({ ...p, [section.key]: !isCollapsed }))}
            style={styles.sectionHeaderLeft}
            hitSlop={6}
          >
            <Feather
              name={isCollapsed ? "chevron-right" : "chevron-down"}
              size={18}
              color={colors.mutedForeground}
            />
            <Feather
              name={section.thread ? "folder" : "inbox"}
              size={15}
              color={section.thread ? colors.primary : colors.mutedForeground}
              style={{ marginLeft: 6 }}
            />
            <Text style={[styles.sectionTitle, { color: colors.text }]} numberOfLines={1}>
              {headerLabel}
            </Text>
            <Text style={[styles.sectionCount, { color: colors.mutedForeground }]}>
              {section.items.length}
            </Text>
          </Pressable>
          {section.thread ? (
            <View style={styles.sectionActions}>
              <Pressable
                hitSlop={8}
                onPress={() => {
                  setRenameTarget(section.thread);
                  setRenameValue(section.thread!.title);
                }}
              >
                <Feather name="edit-2" size={16} color={colors.mutedForeground} />
              </Pressable>
              <Pressable hitSlop={8} onPress={() => handleDeleteThread(section.thread!)}>
                <Feather name="trash-2" size={16} color="#ef4444" />
              </Pressable>
            </View>
          ) : null}
        </View>
        {!isCollapsed && section.items.length === 0 ? (
          <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
            Bu başlıkta henüz sohbet yok. Bir sohbete uzun basıp "Konu başlığına taşı" diyerek ekleyebilirsin.
          </Text>
        ) : null}
        {!isCollapsed
          ? section.items.map((c) => <View key={c.id} style={{ marginTop: 8 }}>{renderConv(c)}</View>)
          : null}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.headerBtn} hitSlop={10}>
          <Feather name="chevron-left" size={26} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>AI Sohbetler</Text>
        <Pressable onPress={() => setNewThreadModal(true)} style={styles.headerBtn} hitSlop={10}>
          <Feather name="folder-plus" size={22} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.actionsRow}>
        <Pressable
          onPress={() => router.push("/ai-chat/new" as never)}
          style={[styles.actionBtn, { backgroundColor: colors.primary }]}
        >
          <Feather name="plus" size={16} color="#fff" />
          <Text style={styles.actionText}>Yeni Sohbet</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push("/ai-realtime" as never)}
          style={[styles.actionBtn, { backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border }]}
        >
          <Feather name="mic" size={16} color={colors.text} />
          <Text style={[styles.actionText, { color: colors.text }]}>Sesli Sohbet</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={{ color: colors.mutedForeground, marginBottom: 12 }}>{error}</Text>
          <Pressable onPress={load} style={[styles.actionBtn, { backgroundColor: colors.primary }]}>
            <Text style={styles.actionText}>Tekrar dene</Text>
          </Pressable>
        </View>
      ) : sections.length === 0 ? (
        <View style={styles.center}>
          <Feather name="message-circle" size={48} color={colors.mutedForeground} />
          <Text style={{ color: colors.mutedForeground, marginTop: 12 }}>Henüz sohbet yok</Text>
        </View>
      ) : (
        <FlatList
          data={sections}
          keyExtractor={(s) => s.key}
          renderItem={renderSection}
          contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 4, paddingBottom: 40 }}
        />
      )}

      {/* New thread modal */}
      <Modal visible={newThreadModal} transparent animationType="fade" onRequestClose={() => setNewThreadModal(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalBackdrop}
        >
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Yeni konu başlığı</Text>
            <Text style={[styles.modalHint, { color: colors.mutedForeground }]}>
              Aynı konudaki sohbetleri bir başlık altında topla. AI bu başlıktaki tüm geçmişi birebir hatırlar.
            </Text>
            <TextInput
              value={newThreadTitle}
              onChangeText={setNewThreadTitle}
              placeholder="Başlık (örn. Rinoplasti vakaları)"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { color: colors.text, backgroundColor: colors.muted, borderColor: colors.border }]}
              autoFocus
              maxLength={120}
            />
            <View style={styles.modalRow}>
              <Pressable
                onPress={() => {
                  setNewThreadModal(false);
                  setNewThreadTitle("");
                }}
                style={[styles.modalBtn, { backgroundColor: colors.muted }]}
              >
                <Text style={[styles.modalBtnText, { color: colors.text }]}>Vazgeç</Text>
              </Pressable>
              <Pressable
                onPress={handleCreateThread}
                disabled={newThreadBusy || !newThreadTitle.trim()}
                style={[
                  styles.modalBtn,
                  { backgroundColor: colors.primary, opacity: newThreadBusy || !newThreadTitle.trim() ? 0.5 : 1 },
                ]}
              >
                <Text style={[styles.modalBtnText, { color: "#fff" }]}>
                  {newThreadBusy ? "Oluşturuluyor…" : "Oluştur"}
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Rename thread modal */}
      <Modal
        visible={!!renameTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameTarget(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalBackdrop}
        >
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Başlığı yeniden adlandır</Text>
            <TextInput
              value={renameValue}
              onChangeText={setRenameValue}
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { color: colors.text, backgroundColor: colors.muted, borderColor: colors.border }]}
              autoFocus
              maxLength={120}
            />
            <View style={styles.modalRow}>
              <Pressable onPress={() => setRenameTarget(null)} style={[styles.modalBtn, { backgroundColor: colors.muted }]}>
                <Text style={[styles.modalBtnText, { color: colors.text }]}>Vazgeç</Text>
              </Pressable>
              <Pressable
                onPress={handleRenameThread}
                disabled={!renameValue.trim()}
                style={[styles.modalBtn, { backgroundColor: colors.primary, opacity: !renameValue.trim() ? 0.5 : 1 }]}
              >
                <Text style={[styles.modalBtnText, { color: "#fff" }]}>Kaydet</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Assign conversation to thread modal */}
      <Modal
        visible={!!assignTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setAssignTarget(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border, maxHeight: "70%" }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Konu başlığına taşı</Text>
            <Text style={[styles.modalHint, { color: colors.mutedForeground }]} numberOfLines={2}>
              "{assignTarget?.title}"
            </Text>
            <ScrollView style={{ maxHeight: 320, marginTop: 8 }}>
              <Pressable
                onPress={() => handleAssign(null)}
                style={[styles.assignRow, { borderColor: colors.border }]}
              >
                <Feather name="inbox" size={16} color={colors.mutedForeground} />
                <Text style={[styles.assignText, { color: colors.text }]}>Başlıktan kaldır (atanmamış)</Text>
                {assignTarget?.threadId == null ? (
                  <Feather name="check" size={16} color={colors.primary} />
                ) : null}
              </Pressable>
              {threads.map((t) => (
                <Pressable
                  key={t.id}
                  onPress={() => handleAssign(t.id)}
                  style={[styles.assignRow, { borderColor: colors.border }]}
                >
                  <Feather name="folder" size={16} color={colors.primary} />
                  <Text style={[styles.assignText, { color: colors.text }]} numberOfLines={1}>
                    {t.title}
                  </Text>
                  {assignTarget?.threadId === t.id ? (
                    <Feather name="check" size={16} color={colors.primary} />
                  ) : null}
                </Pressable>
              ))}
              {threads.length === 0 ? (
                <Text style={[styles.emptyHint, { color: colors.mutedForeground, marginTop: 8 }]}>
                  Henüz konu başlığı yok. Üst sağdaki klasör+ ikonuyla oluşturabilirsin.
                </Text>
              ) : null}
            </ScrollView>
            <View style={[styles.modalRow, { marginTop: 12 }]}>
              <Pressable onPress={() => setAssignTarget(null)} style={[styles.modalBtn, { backgroundColor: colors.muted, flex: 1 }]}>
                <Text style={[styles.modalBtnText, { color: colors.text }]}>Kapat</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: "600" },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 22,
  },
  actionText: { color: "#fff", fontWeight: "600", fontSize: 14 },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 4,
  },
  sectionHeaderLeft: { flexDirection: "row", alignItems: "center", flex: 1, minWidth: 0 },
  sectionTitle: { fontSize: 14, fontWeight: "700", marginLeft: 8, flexShrink: 1 },
  sectionCount: { marginLeft: 8, fontSize: 12, fontWeight: "600" },
  sectionActions: { flexDirection: "row", gap: 14, paddingLeft: 8 },
  emptyHint: { fontSize: 12, paddingHorizontal: 8, paddingVertical: 8, fontStyle: "italic" },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 15, fontWeight: "600" },
  date: { fontSize: 12, marginTop: 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 480,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
  },
  modalTitle: { fontSize: 16, fontWeight: "700", marginBottom: 6 },
  modalHint: { fontSize: 13, marginBottom: 10 },
  input: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginTop: 4,
  },
  modalRow: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 14 },
  modalBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, alignItems: "center" },
  modalBtnText: { fontSize: 14, fontWeight: "600" },

  assignRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  assignText: { fontSize: 14, flex: 1 },
});
