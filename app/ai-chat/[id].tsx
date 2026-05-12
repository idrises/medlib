import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";

let ImagePicker: any = null;
try { ImagePicker = require("expo-image-picker"); } catch {}
let DocumentPicker: any = null;
try { DocumentPicker = require("expo-document-picker"); } catch {}
import {
  ActivityIndicator,
  Alert,
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
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import {
  AiAttachment,
  AiConversation,
  AiMessage,
  AiThread,
  assignConversationToThread,
  createAiConversation,
  getAiConversation,
  listAiThreads,
  parseStoredContent,
  streamAiMessage,
  postAiFeedback,
  deleteAiFeedback,
} from "@/services/aiApi";
import {
  startRecording,
  stopRecording,
  cancelRecording,
  sendVoiceMessage,
  playAudioBase64,
  stopCurrentPlayback,
  onSilenceDetected,
} from "@/services/voiceApi";
import { uploadUserFile } from "@/services/filesApi";
import AiRichBlock, { type RichBlock } from "@/components/AiRichBlock";
import MarkdownText from "@/components/MarkdownText";
import MessageActionBar from "@/components/MessageActionBar";

const TOOL_LABELS: Record<string, string> = {
  search_library: "Kütüphane aranıyor",
  get_article: "Makale getiriliyor",
  get_book: "Kitap getiriliyor",
  get_journal: "Dergi getiriliyor",
  get_chapter: "Bölüm getiriliyor",
  get_video: "Video getiriliyor",
  list_journals: "Dergiler listeleniyor",
  list_books: "Kitaplar listeleniyor",
  get_home_feed: "İçerik yükleniyor",
  read_pdf_content: "PDF okunuyor",
  search_pubmed: "PubMed'de aranıyor",
  search_web: "İnternette aranıyor",
  fetch_url: "Sayfa okunuyor",
  generate_image: "Görsel oluşturuluyor",
  generate_chart: "Grafik çiziliyor",
  generate_diagram: "Diyagram hazırlanıyor",
};

const SUGGESTED = [
  "Kardiyovasküler araştırmaları bul",
  "Rinoplasti anatomisini çiz",
  "Son 5 yılın enfeksiyon oranı grafiği",
  "Septoplasti algoritması diyagramı",
];

let msgCounter = 0;
function genId() {
  msgCounter++;
  return `m-${Date.now()}-${msgCounter}-${Math.random().toString(36).slice(2, 7)}`;
}

interface RetryPayload {
  text: string;
  attachmentsForSend: AiAttachment[];
  userBlocks: RichBlock[];
  displayContent: string;
}

interface LocalMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  blocks?: RichBlock[];
  serverId?: number;
  rating?: number | null;
  isError?: boolean;
  retryPayload?: RetryPayload;
}

interface PendingAttachment {
  id: string;
  type: "image" | "pdf" | "file";
  data?: string;
  text?: string;
  name?: string;
  preview?: string;
  // Populated for `type: "file"` (and any picker that uses the new
  // /api/files/upload endpoint). Once Task #139 lands, the chat send
  // path will reference these by fileId instead of inlining base64.
  fileId?: string;
  mimeType?: string;
  sizeBytes?: number;
  uploading?: boolean;
}

export default function AiChatScreen() {
  const { id, threadId: threadIdParam } = useLocalSearchParams<{
    id: string;
    threadId?: string;
  }>();
  const initialThreadId = (() => {
    if (typeof threadIdParam !== "string") return null;
    const n = Number(threadIdParam);
    return Number.isFinite(n) && n > 0 ? n : null;
  })();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();

  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 67 : insets.top;
  const bottomPad = isWeb ? 34 : insets.bottom;
  const isNew = id === "new";

  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(!isNew);
  const [isStreaming, setIsStreaming] = useState(false);
  const [showTyping, setShowTyping] = useState(false);
  const [activeTools, setActiveTools] = useState<string[]>([]);
  const [convId, setConvId] = useState<number | null>(isNew ? null : Number(id));
  const [conv, setConv] = useState<AiConversation | null>(null);
  const [threads, setThreads] = useState<AiThread[]>([]);
  const [showThreadModal, setShowThreadModal] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showMenuDrawer, setShowMenuDrawer] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [voiceToast, setVoiceToast] = useState<string | null>(null);
  const voiceToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showVoiceToast = useCallback((msg: string) => {
    if (voiceToastTimerRef.current) clearTimeout(voiceToastTimerRef.current);
    setVoiceToast(msg);
    voiceToastTimerRef.current = setTimeout(() => setVoiceToast(null), 2500);
  }, []);

  const inputRef = useRef<TextInput>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const silenceCleanupRef = useRef<(() => void) | null>(null);
  const initializedRef = useRef(false);
  const voiceActiveRef = useRef(false);
  const convIdRef = useRef<number | null>(convId);

  useEffect(() => { convIdRef.current = convId; }, [convId]);

  useEffect(() => {
    if (!isNew && !initializedRef.current) {
      initializedRef.current = true;
      getAiConversation(Number(id))
        .then((data) => {
          setConv(data);
          setMessages(
            data.messages.map((m: AiMessage) => {
              const parsed = parseStoredContent(m.content);
              return {
                id: genId(),
                role: m.role,
                content: parsed.text,
                blocks: parsed.blocks,
                serverId: typeof m.id === "number" ? m.id : undefined,
                rating: m.rating ?? null,
              };
            })
          );
        })
        .catch(() => {})
        .finally(() => setIsLoading(false));
    }
  }, [id, isNew]);

  useEffect(() => {
    return () => {
      cleanupRef.current?.();
      silenceCleanupRef.current?.();
      cancelRecording();
      stopCurrentPlayback();
      voiceActiveRef.current = false;
    };
  }, []);

  const pickImage = useCallback(async () => {
    setShowAttachMenu(false);
    if (!ImagePicker) {
      Alert.alert("Mevcut değil", "Bu özellik için uygulamayı güncelleyin.");
      return;
    }
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("İzin gerekli", "Galeriye erişim izni gerekli.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        base64: true,
      });
      if (!result.canceled && result.assets?.[0]?.base64) {
        const a = result.assets[0];
        setPendingAttachments(prev => [...prev, {
          id: genId(),
          type: "image",
          data: a.base64!,
          preview: a.uri,
        }]);
      }
    } catch (e) {
      Alert.alert("Hata", "Görsel seçilemedi.");
    }
  }, []);

  const takePhoto = useCallback(async () => {
    setShowAttachMenu(false);
    if (!ImagePicker) {
      Alert.alert("Mevcut değil", "Bu özellik için uygulamayı güncelleyin.");
      return;
    }
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("İzin gerekli", "Kamera erişim izni gerekli.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        base64: true,
      });
      if (!result.canceled && result.assets?.[0]?.base64) {
        const a = result.assets[0];
        setPendingAttachments(prev => [...prev, {
          id: genId(),
          type: "image",
          data: a.base64!,
          preview: a.uri,
        }]);
      }
    } catch (e) {
      Alert.alert("Hata", "Fotoğraf çekilemedi.");
    }
  }, []);

  const pickFile = useCallback(async () => {
    setShowAttachMenu(false);
    if (!DocumentPicker) {
      Alert.alert("Mevcut değil", "Dosya yükleme için uygulamayı güncelleyin.");
      return;
    }
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      } as any);
      if (result.canceled || !result.assets?.[0]) return;
      const a = result.assets[0];
      const localId = genId();
      const fallbackName = a.name ?? "dosya";
      const declaredMime: string =
        (a as { mimeType?: string }).mimeType ?? "application/octet-stream";
      // Optimistic chip while the multipart upload is in flight; the
      // user gets immediate feedback and we replace it with the
      // server-confirmed metadata when the response arrives.
      setPendingAttachments((prev) => [
        ...prev,
        {
          id: localId,
          type: "file",
          name: fallbackName,
          mimeType: declaredMime,
          sizeBytes: typeof a.size === "number" ? a.size : undefined,
          uploading: true,
        },
      ]);
      try {
        const uploaded = await uploadUserFile(a.uri, fallbackName, declaredMime);
        setPendingAttachments((prev) =>
          prev.map((p) =>
            p.id === localId
              ? {
                  ...p,
                  uploading: false,
                  fileId: uploaded.fileId,
                  name: uploaded.name,
                  mimeType: uploaded.mimeType,
                  sizeBytes: uploaded.sizeBytes,
                }
              : p,
          ),
        );
      } catch (err) {
        setPendingAttachments((prev) => prev.filter((p) => p.id !== localId));
        const msg = err instanceof Error ? err.message : "Dosya yüklenemedi.";
        Alert.alert("Yükleme hatası", msg);
      }
    } catch (e) {
      Alert.alert("Hata", "Dosya seçilemedi.");
    }
  }, []);

  const removeAttachment = useCallback((attId: string) => {
    setPendingAttachments(prev => prev.filter(a => a.id !== attId));
  }, []);

  const processVoiceAndSend = useCallback(async () => {
    setIsRecording(false);
    silenceCleanupRef.current?.();
    silenceCleanupRef.current = null;
    setIsProcessingVoice(true);
    setShowTyping(true);
    setActiveTools([]);

    try {
      const audioBase64 = await stopRecording();
      if (!audioBase64) {
        setIsProcessingVoice(false);
        setShowTyping(false);
        if (voiceActiveRef.current) autoStartListening();
        return;
      }

      let targetId = convIdRef.current;
      if (!targetId) {
        // Inherit thread from URL param so a "Yeni Sohbet" launched from a
        // thread-scoped drawer stays under that thread.
        const newConv = await createAiConversation("Sesli Sohbet", initialThreadId);
        targetId = newConv.id;
        setConvId(newConv.id);
        convIdRef.current = newConv.id;
        setConv(newConv);
        queryClient.invalidateQueries({ queryKey: ["ai-conversations"] });
      }

      let fullContent = "";
      let assistantAdded = false;

      cleanupRef.current = await sendVoiceMessage(
        targetId,
        audioBase64,
        (userText) => {
          setMessages((prev) => [...prev, { id: genId(), role: "user", content: userText }]);
        },
        (chunk) => {
          fullContent += chunk;
          if (!assistantAdded) {
            setShowTyping(false);
            setMessages((prev) => [...prev, { id: genId(), role: "assistant", content: fullContent, blocks: [] }]);
            assistantAdded = true;
          } else {
            setMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = { ...updated[updated.length - 1], content: fullContent };
              return updated;
            });
          }
        },
        (name, phase) => {
          if (phase === "start") {
            setActiveTools((prev) => [...prev, name]);
          } else {
            setActiveTools((prev) => prev.filter((t) => t !== name));
          }
        },
        async (base64Mp3) => {
          try {
            await playAudioBase64(base64Mp3);
          } catch {}
        },
        () => {
          setIsProcessingVoice(false);
          setIsStreaming(false);
          setShowTyping(false);
          setActiveTools([]);
          if (voiceActiveRef.current) {
            setTimeout(() => autoStartListening(), 400);
          }
        },
        (err) => {
          setIsProcessingVoice(false);
          setShowTyping(false);
          setActiveTools([]);
          if (!assistantAdded) {
            const isStt =
              typeof err === "string" &&
              (err.includes("anlaşılamadı") || err.includes("No audio"));
            if (isStt) {
              showVoiceToast("Ses anlaşılamadı, tekrar deneyin");
            } else {
              setMessages((prev) => [
                ...prev,
                { id: genId(), role: "assistant", content: `Hata: ${err}` },
              ]);
            }
          }
          if (voiceActiveRef.current) {
            setTimeout(() => autoStartListening(), 1000);
          }
        },
        (role, id) => {
          setMessages((prev) => {
            const updated = [...prev];
            for (let i = updated.length - 1; i >= 0; i--) {
              if (updated[i].role === role && !updated[i].serverId) {
                updated[i] = { ...updated[i], serverId: id };
                break;
              }
            }
            return updated;
          });
        },
      );
    } catch {
      setIsProcessingVoice(false);
      setShowTyping(false);
      setMessages((prev) => [
        ...prev,
        { id: genId(), role: "assistant", content: "Ses kaydı gönderilemedi. Tekrar deneyin." },
      ]);
      if (voiceActiveRef.current) {
        setTimeout(() => autoStartListening(), 1000);
      }
    }
  }, [queryClient]);

  const autoStartListening = useCallback(async () => {
    if (!voiceActiveRef.current) return;
    try {
      await startRecording();
      setIsRecording(true);
      silenceCleanupRef.current = onSilenceDetected(() => {
        processVoiceAndSend();
      });
    } catch {
      voiceActiveRef.current = false;
      setIsRecording(false);
    }
  }, [processVoiceAndSend]);

  const handleMicPress = useCallback(async () => {
    if (isStreaming || isProcessingVoice) return;
    stopCurrentPlayback();
    cancelRecording();
    silenceCleanupRef.current?.();
    cleanupRef.current?.();
    voiceActiveRef.current = false;
    if (convId) {
      router.push({
        pathname: "/ai-realtime",
        params: { resumeConvId: String(convId) },
      } as any);
    } else {
      router.push("/ai-realtime" as any);
    }
  }, [isStreaming, isProcessingVoice, router, convId]);

  const handleStopVoice = useCallback(() => {
    voiceActiveRef.current = false;
    silenceCleanupRef.current?.();
    silenceCleanupRef.current = null;
    if (isRecording) {
      cancelRecording();
      setIsRecording(false);
    }
    stopCurrentPlayback();
  }, [isRecording]);

  const performSend = useCallback(async (
    text: string,
    attachmentsForSend: AiAttachment[],
    userBlocks: RichBlock[],
    displayContent: string,
    opts: { addUserMessage?: boolean } = {},
  ) => {
    const addUserMessage = opts.addUserMessage !== false;
    const retryPayload: RetryPayload = { text, attachmentsForSend, userBlocks, displayContent };

    if (addUserMessage) {
      const userMsg: LocalMessage = { id: genId(), role: "user", content: displayContent, blocks: userBlocks };
      setMessages((prev) => [...prev, userMsg]);
    }
    setIsStreaming(true);
    setShowTyping(true);
    setActiveTools([]);

    let targetId = convId;

    if (!targetId) {
      try {
        const newConv = await createAiConversation(
          (text || "Görsel sohbeti").slice(0, 60) + ((text || "").length > 60 ? "…" : ""),
          initialThreadId
        );
        targetId = newConv.id;
        setConvId(newConv.id);
        setConv(newConv);
        queryClient.invalidateQueries({ queryKey: ["ai-conversations"] });
      } catch {
        setIsStreaming(false);
        setShowTyping(false);
        setMessages((prev) => [
          ...prev,
          { id: genId(), role: "assistant", content: "Bağlantı hatası oluştu. Tekrar deneyin.", isError: true, retryPayload },
        ]);
        return;
      }
    }

    let fullContent = "";
    let assistantAdded = false;
    const collectedBlocks: RichBlock[] = [];

    const ensureAssistantMsg = () => {
      if (!assistantAdded) {
        setShowTyping(false);
        setMessages((prev) => [...prev, { id: genId(), role: "assistant", content: fullContent, blocks: [...collectedBlocks] }]);
        assistantAdded = true;
      }
    };

    cleanupRef.current = streamAiMessage(
      targetId,
      text,
      (chunk) => {
        fullContent += chunk;
        ensureAssistantMsg();
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { ...updated[updated.length - 1], content: fullContent };
          return updated;
        });
      },
      (name, phase) => {
        if (phase === "start") {
          setActiveTools((prev) => [...prev, name]);
        } else {
          setActiveTools((prev) => prev.filter((t) => t !== name));
        }
      },
      () => {
        setIsStreaming(false);
        setShowTyping(false);
        setActiveTools([]);
      },
      (err) => {
        setShowTyping(false);
        setIsStreaming(false);
        setActiveTools([]);
        if (!assistantAdded) {
          setMessages((prev) => [
            ...prev,
            { id: genId(), role: "assistant", content: `Hata: ${err}`, isError: true, retryPayload },
          ]);
        }
      },
      {
        attachments: attachmentsForSend,
        onMessageId: (role, id) => {
          setMessages((prev) => {
            const updated = [...prev];
            for (let i = updated.length - 1; i >= 0; i--) {
              if (updated[i].role === role && !updated[i].serverId) {
                updated[i] = { ...updated[i], serverId: id };
                break;
              }
            }
            return updated;
          });
        },
        onRichBlock: (block) => {
          collectedBlocks.push(block);
          ensureAssistantMsg();
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            updated[updated.length - 1] = { ...last, blocks: [...(last.blocks ?? []), block] };
            return updated;
          });
        },
      }
    );
  }, [convId, queryClient, initialThreadId]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if ((!text && pendingAttachments.length === 0) || isStreaming || isProcessingVoice) return;

    // Block sending while any pending file is still uploading — otherwise
    // the user could fire off a chat that references a fileId the server
    // hasn't yet acknowledged.
    if (pendingAttachments.some((a) => a.uploading)) {
      Alert.alert("Bekleyin", "Dosya yüklemesi tamamlanıyor.");
      return;
    }

    setInput("");
    inputRef.current?.focus();

    const userBlocks: RichBlock[] = [];
    const attachmentsForSend: AiAttachment[] = [];
    for (const a of pendingAttachments) {
      if (a.type === "image" && a.data) {
        attachmentsForSend.push({ type: "image", data: a.data });
        userBlocks.push({ type: "image", url: `data:image/jpeg;base64,${a.data}`, alt: "Yüklenen görsel" });
      } else if (a.type === "pdf") {
        attachmentsForSend.push({ type: "pdf", data: a.data, text: a.text, name: a.name });
      }
      // `type === "file"` (new fileId-based uploads) are not yet wired
      // into the chat backend — Task #139 will do that. For now they
      // still appear as pending chips and remain saved in the user's
      // file storage; we just don't include them in the chat payload.
    }
    const userPdfNames = pendingAttachments.filter(a => a.type === "pdf").map(a => a.name ?? "document.pdf");
    const displayContent = text + (userPdfNames.length ? `\n📎 ${userPdfNames.join(", ")}` : "");
    setPendingAttachments([]);

    await performSend(text, attachmentsForSend, userBlocks, displayContent);
  }, [input, pendingAttachments, isStreaming, isProcessingVoice, performSend]);

  const handleRetry = useCallback((errorMsgId: string, payload: RetryPayload) => {
    if (isStreaming || isProcessingVoice) return;
    setMessages((prev) => prev.filter((m) => m.id !== errorMsgId));
    performSend(payload.text, payload.attachmentsForSend, payload.userBlocks, payload.displayContent, { addUserMessage: false });
  }, [isStreaming, isProcessingVoice, performSend]);

  const reversed = [...messages].reverse();

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingTop: topPad + 6,
      paddingBottom: 10,
      paddingHorizontal: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: colors.background,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    backBtn: { padding: 4 },
    headerTitleBlock: { flex: 1, minWidth: 0 },
    headerTitle: {
      fontSize: 16,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
    },
    headerSub: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
    },
    voiceToast: {
      position: "absolute",
      top: topPad + 56,
      alignSelf: "center",
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: "rgba(217, 119, 6, 0.95)",
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      zIndex: 10,
    },
    voiceToastText: {
      color: "#fff",
      fontSize: 13,
      fontFamily: "Inter_500Medium",
    },
    loadingCenter: { flex: 1, alignItems: "center", justifyContent: "center" },
    list: { flex: 1 },
    listContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
    bubble: {
      maxWidth: "85%",
      marginBottom: 12,
      borderRadius: colors.radius,
    },
    userBubble: {
      alignSelf: "flex-end",
      backgroundColor: colors.primary,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderBottomRightRadius: 4,
    },
    userText: {
      fontSize: 15,
      fontFamily: "Inter_400Regular",
      color: colors.primaryForeground,
      lineHeight: 22,
    },
    aiBubbleRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 8,
      alignSelf: "flex-start",
      maxWidth: "92%",
      marginBottom: 12,
    },
    aiAvatar: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: colors.secondary,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 2,
    },
    aiBubble: {
      backgroundColor: colors.card,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: colors.radius,
      borderBottomLeftRadius: 4,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      flex: 1,
    },
    aiText: {
      fontSize: 15,
      fontFamily: "Inter_400Regular",
      color: colors.foreground,
      lineHeight: 22,
    },
    typingRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 8,
      paddingBottom: 12,
      paddingHorizontal: 16,
    },
    typingBubble: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderBottomLeftRadius: 4,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 12,
      flexDirection: "row",
      gap: 6,
      alignItems: "center",
    },
    typingDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: colors.primary,
    },
    toolRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 4,
    },
    toolText: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
    },
    inputWrapper: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: bottomPad + 12,
    },
    inputRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 8,
    },
    plusBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.secondary,
      alignItems: "center",
      justifyContent: "center",
    },
    input: {
      flex: 1,
      backgroundColor: colors.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 10,
      fontSize: 15,
      fontFamily: "Inter_400Regular",
      color: colors.foreground,
      maxHeight: 120,
    },
    sendBtn: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    sendBtnDisabled: { backgroundColor: colors.muted },
    emptyWrap: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 32,
    },
    emptyIcon: {
      width: 72,
      height: 72,
      borderRadius: 22,
      backgroundColor: colors.secondary,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 18,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
      textAlign: "center",
      marginBottom: 8,
    },
    emptyDesc: {
      fontSize: 14,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      textAlign: "center",
      lineHeight: 20,
      marginBottom: 24,
    },
    suggestions: { width: "100%", gap: 8 },
    suggestionBtn: {
      backgroundColor: colors.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: colors.radius,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    suggestionText: {
      fontSize: 14,
      fontFamily: "Inter_400Regular",
      color: colors.foreground,
    },
    attachStrip: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 8,
    },
    attachChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.secondary,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 16,
    },
    attachChipText: {
      fontSize: 12,
      fontFamily: "Inter_500Medium",
      color: colors.foreground,
      maxWidth: 140,
    },
    attachThumb: { width: 32, height: 32, borderRadius: 6 },
    attachMenu: {
      position: "absolute",
      bottom: 60 + bottomPad,
      left: 16,
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      paddingVertical: 6,
      shadowColor: "#000",
      shadowOpacity: 0.15,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
      minWidth: 200,
      zIndex: 100,
    },
    attachMenuItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 11,
    },
    attachMenuText: {
      fontSize: 14,
      fontFamily: "Inter_500Medium",
      color: colors.foreground,
    },
  });

  const handleRate = useCallback(async (msgId: string, serverId: number, newRating: 1 | -1, currentRating?: number | null) => {
    const target = currentRating === newRating ? null : newRating;
    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, rating: target } : m)));
    try {
      if (target === null) await deleteAiFeedback(serverId);
      else await postAiFeedback(serverId, target);
    } catch {
      setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, rating: currentRating ?? null } : m)));
    }
  }, []);

  const renderMessage = ({ item }: { item: LocalMessage }) => {
    if (item.role === "user") {
      return (
        <View style={[styles.bubble, styles.userBubble]}>
          {item.content ? <Text style={styles.userText}>{item.content}</Text> : null}
          {item.blocks?.map((b, i) => <AiRichBlock key={i} block={b} />)}
        </View>
      );
    }
    const sid = item.serverId;
    const r = item.rating ?? null;
    const isErr = item.isError === true;
    return (
      <View style={styles.aiBubbleRow}>
        <View style={styles.aiAvatar}>
          <Feather name={isErr ? "alert-circle" : "cpu"} size={16} color={isErr ? "#ef4444" : colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={[styles.aiBubble, isErr && { borderColor: "#ef4444", borderWidth: 1, backgroundColor: "#ef444411" }]}>
            {item.content ? <MarkdownText text={item.content} baseColor={isErr ? "#ef4444" : colors.foreground} baseSize={14} /> : null}
            {item.blocks?.map((b, i) => <AiRichBlock key={i} block={b} />)}
          </View>
          {isErr && item.retryPayload ? (
            <Pressable
              onPress={() => handleRetry(item.id, item.retryPayload!)}
              disabled={isStreaming || isProcessingVoice}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                alignSelf: "flex-start",
                marginTop: 6,
                marginLeft: 4,
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 16,
                backgroundColor: colors.primary,
                opacity: (isStreaming || isProcessingVoice) ? 0.4 : (pressed ? 0.7 : 1),
              })}
              hitSlop={6}
            >
              <Feather name="refresh-cw" size={13} color="#fff" />
              <Text style={{ color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" }}>Tekrar Dene</Text>
            </Pressable>
          ) : null}
          {sid && !isErr && item.content ? (
            <MessageActionBar
              messageId={item.id}
              content={item.content}
              rating={r}
              onRate={(newRating) => handleRate(item.id, sid, newRating, r)}
              disabled={isStreaming}
            />
          ) : null}
        </View>
      </View>
    );
  };

  const TypingIndicator = () => (
    <View style={styles.typingRow}>
      <View style={[styles.aiAvatar, { marginBottom: 0 }]}>
        <Feather name="cpu" size={16} color={colors.primary} />
      </View>
      <View style={styles.typingBubble}>
        {activeTools.length > 0 ? (
          <View>
            {activeTools.map((tool, i) => (
              <View key={i} style={styles.toolRow}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.toolText}>{TOOL_LABELS[tool] ?? tool}</Text>
              </View>
            ))}
          </View>
        ) : (
          <>
            <View style={styles.typingDot} />
            <View style={styles.typingDot} />
            <View style={styles.typingDot} />
          </>
        )}
      </View>
    </View>
  );

  const convTitle = conv?.title ?? (isNew ? "Yeni Sohbet" : "Sohbet");
  const currentThread = conv?.threadId
    ? threads.find((t) => t.id === conv.threadId) ?? null
    : null;

  const openThreadModal = useCallback(async () => {
    setShowThreadModal(true);
    try {
      const ths = await listAiThreads();
      setThreads(Array.isArray(ths) ? ths : []);
    } catch {}
  }, []);

  const handleAssignThread = useCallback(async (threadId: number | null) => {
    if (!convId) return;
    try {
      await assignConversationToThread(convId, threadId);
      setConv((prev) => (prev ? { ...prev, threadId } : prev));
      setShowThreadModal(false);
    } catch {
      Alert.alert("Hata", "Atama yapılamadı");
    }
  }, [convId]);

  const micColor = isRecording ? "#ef4444" : isProcessingVoice ? colors.muted : colors.primary;
  const micIcon = isRecording ? "mic-off" : "mic";
  const canSend = (input.trim().length > 0 || pendingAttachments.length > 0);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.5 : 1 }]}
          onPress={() => {
            stopCurrentPlayback();
            cancelRecording();
            silenceCleanupRef.current?.();
            cleanupRef.current?.();
            voiceActiveRef.current = false;
            router.back();
          }}
        >
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Pressable
          onPress={() => setShowMenuDrawer(true)}
          hitSlop={8}
          style={({ pressed }) => [
            styles.backBtn,
            { opacity: pressed ? 0.5 : 1, marginLeft: -4, marginRight: 2 },
          ]}
        >
          <Feather name="menu" size={22} color={colors.foreground} />
        </Pressable>
        <View style={styles.headerTitleBlock}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {convTitle}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
            <Text style={styles.headerSub}>MedLib AI</Text>
            {!isNew && convId ? (
              <Pressable
                onPress={openThreadModal}
                hitSlop={6}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  marginLeft: 8,
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 10,
                  backgroundColor: pressed
                    ? colors.muted
                    : currentThread
                    ? colors.primary + "22"
                    : colors.muted,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: currentThread ? colors.primary : colors.border,
                })}
              >
                <Feather
                  name={currentThread ? "folder" : "folder-plus"}
                  size={11}
                  color={currentThread ? colors.primary : colors.mutedForeground}
                />
                <Text
                  numberOfLines={1}
                  style={{
                    marginLeft: 4,
                    fontSize: 11,
                    fontWeight: "600",
                    color: currentThread ? colors.primary : colors.mutedForeground,
                    maxWidth: 140,
                  }}
                >
                  {currentThread ? currentThread.title : "Başlığa ekle"}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>

      {voiceToast && (
        <View style={styles.voiceToast} pointerEvents="none">
          <Feather name="mic-off" size={14} color="#fff" />
          <Text style={styles.voiceToastText}>{voiceToast}</Text>
        </View>
      )}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={0}>
        {isLoading ? (
          <View style={styles.loadingCenter}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : messages.length === 0 && !showTyping ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIcon}>
              <Feather name="cpu" size={32} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>Ne öğrenmek istersin?</Text>
            <Text style={styles.emptyDesc}>
              Tıbbi kütüphanede ara, makaleleri özetle, anatomik resim çiz, grafik veya akış şeması iste, görsel/PDF yükle.
            </Text>
            <Pressable
              onPress={() => router.push("/ai-memory" as never)}
              style={{
                marginTop: 16,
                marginBottom: 8,
                paddingVertical: 12,
                paddingHorizontal: 16,
                borderRadius: 14,
                backgroundColor: colors.primary + "12",
                borderWidth: 1,
                borderColor: colors.primary + "33",
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                alignSelf: "stretch",
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Feather name="cpu" size={18} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "600", fontSize: 14, color: colors.text }}>
                  İlgi Alanlarını Ekle
                </Text>
                <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 2 }}>
                  Uzmanlık ve ilgi alanlarını kaydet — AI sana özel öneri versin
                </Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </Pressable>
            <View style={styles.suggestions}>
              {SUGGESTED.map((s) => (
                <Pressable
                  key={s}
                  style={({ pressed }) => [styles.suggestionBtn, { opacity: pressed ? 0.7 : 1 }]}
                  onPress={() => setInput(s)}
                >
                  <Text style={styles.suggestionText}>{s}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          <FlatList
            data={reversed}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            inverted={messages.length > 0}
            ListHeaderComponent={showTyping ? <TypingIndicator /> : null}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            scrollEnabled={!!messages.length}
          />
        )}

        {showAttachMenu ? (
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={() => setShowAttachMenu(false)}
          >
            <View style={styles.attachMenu} pointerEvents="box-none">
              <Pressable style={styles.attachMenuItem} onPress={pickImage}>
                <Feather name="image" size={18} color={colors.primary} />
                <Text style={styles.attachMenuText}>Galeri</Text>
              </Pressable>
              <Pressable style={styles.attachMenuItem} onPress={takePhoto}>
                <Feather name="camera" size={18} color={colors.primary} />
                <Text style={styles.attachMenuText}>Fotoğraf çek</Text>
              </Pressable>
              <Pressable style={styles.attachMenuItem} onPress={pickFile}>
                <Feather name="file-text" size={18} color={colors.primary} />
                <Text style={styles.attachMenuText}>Dosya yükle</Text>
              </Pressable>
            </View>
          </Pressable>
        ) : null}

        <View style={styles.inputWrapper}>
          {pendingAttachments.length > 0 ? (
            <View style={styles.attachStrip}>
              {pendingAttachments.map(a => {
                const label =
                  a.type === "image"
                    ? "Görsel"
                    : a.type === "pdf"
                      ? (a.name ?? "PDF")
                      : (a.name ?? "Dosya");
                return (
                  <Pressable key={a.id} style={styles.attachChip} onPress={() => removeAttachment(a.id)}>
                    {a.type === "image" && a.preview ? (
                      <Image source={{ uri: a.preview }} style={styles.attachThumb} />
                    ) : (
                      <Feather name="file-text" size={14} color={colors.foreground} />
                    )}
                    <Text style={styles.attachChipText} numberOfLines={1}>
                      {a.uploading ? `${label} · yükleniyor…` : label}
                    </Text>
                    {a.uploading ? (
                      <ActivityIndicator size="small" color={colors.mutedForeground} />
                    ) : (
                      <Feather name="x" size={14} color={colors.mutedForeground} />
                    )}
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          {isRecording && (
            <View style={bottomBarStyles.listeningRow}>
              <View style={bottomBarStyles.listeningDot} />
              <Text style={[bottomBarStyles.listeningText, { color: colors.mutedForeground }]}>
                Dinleniyor... sessizlikte otomatik gönderilecek
              </Text>
            </View>
          )}
          <View style={styles.inputRow}>
            <Pressable
              style={({ pressed }) => [styles.plusBtn, { opacity: pressed ? 0.7 : 1 }]}
              onPress={() => setShowAttachMenu(prev => !prev)}
              disabled={isStreaming || isProcessingVoice || isRecording}
              testID="attach-btn"
            >
              <Feather name="plus" size={20} color={colors.foreground} />
            </Pressable>
            <TextInput
              ref={inputRef}
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="Bir şey sor…"
              placeholderTextColor={colors.mutedForeground}
              multiline
              blurOnSubmit={false}
              returnKeyType="send"
              onSubmitEditing={handleSend}
              editable={!isStreaming && !isProcessingVoice && !isRecording}
              testID="chat-input"
            />
            {canSend ? (
              <Pressable
                style={({ pressed }) => [
                  styles.sendBtn,
                  isStreaming && styles.sendBtnDisabled,
                  { opacity: pressed ? 0.8 : 1 },
                ]}
                onPress={() => {
                  handleSend();
                  inputRef.current?.focus();
                }}
                disabled={!canSend || isStreaming}
                testID="send-btn"
              >
                {isStreaming ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Feather name="send" size={18} color="#fff" />
                )}
              </Pressable>
            ) : (
              <Pressable
                style={({ pressed }) => [
                  bottomBarStyles.micBtn,
                  { backgroundColor: micColor },
                  { opacity: pressed ? 0.8 : 1 },
                ]}
                onPress={isRecording ? handleStopVoice : handleMicPress}
                disabled={isStreaming || isProcessingVoice}
                testID="mic-btn"
              >
                {isProcessingVoice ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Feather name={micIcon} size={18} color="#fff" />
                )}
              </Pressable>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={showThreadModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowThreadModal(false)}
      >
        <View style={threadModalStyles.backdrop}>
          <View
            style={[
              threadModalStyles.card,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[threadModalStyles.title, { color: colors.text }]}>
              Konu başlığına taşı
            </Text>
            <Text
              style={[threadModalStyles.hint, { color: colors.mutedForeground }]}
              numberOfLines={2}
            >
              AI bu başlıktaki tüm geçmişi birebir hatırlar (recall_from_thread).
            </Text>
            <ScrollView style={{ maxHeight: 340, marginTop: 8 }}>
              <Pressable
                onPress={() => handleAssignThread(null)}
                style={[threadModalStyles.row, { borderColor: colors.border }]}
              >
                <Feather name="inbox" size={16} color={colors.mutedForeground} />
                <Text style={[threadModalStyles.rowText, { color: colors.text }]}>
                  Başlıktan kaldır (atanmamış)
                </Text>
                {conv?.threadId == null ? (
                  <Feather name="check" size={16} color={colors.primary} />
                ) : null}
              </Pressable>
              {threads.map((t) => (
                <Pressable
                  key={t.id}
                  onPress={() => handleAssignThread(t.id)}
                  style={[threadModalStyles.row, { borderColor: colors.border }]}
                >
                  <Feather name="folder" size={16} color={colors.primary} />
                  <Text
                    style={[threadModalStyles.rowText, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {t.title}
                  </Text>
                  {conv?.threadId === t.id ? (
                    <Feather name="check" size={16} color={colors.primary} />
                  ) : null}
                </Pressable>
              ))}
              {threads.length === 0 ? (
                <Text
                  style={{
                    color: colors.mutedForeground,
                    fontSize: 12,
                    fontStyle: "italic",
                    paddingVertical: 12,
                    paddingHorizontal: 8,
                  }}
                >
                  Henüz konu başlığı yok. AI Sohbetler ekranındaki klasör+ ikonundan oluşturabilirsin.
                </Text>
              ) : null}
            </ScrollView>
            <Pressable
              onPress={() => setShowThreadModal(false)}
              style={[
                threadModalStyles.closeBtn,
                { backgroundColor: colors.muted },
              ]}
            >
              <Text style={{ color: colors.text, fontWeight: "600" }}>Kapat</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showMenuDrawer}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMenuDrawer(false)}
      >
        <View style={{ flex: 1, flexDirection: "row" }}>
          <View
            style={{
              width: 280,
              maxWidth: "85%",
              height: "100%",
              backgroundColor: colors.card,
              borderRightWidth: StyleSheet.hairlineWidth,
              borderRightColor: colors.border,
              paddingTop: topPad + 8,
              paddingHorizontal: 12,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 8,
                paddingVertical: 8,
                marginBottom: 8,
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
                Menü
              </Text>
              <Pressable onPress={() => setShowMenuDrawer(false)} hitSlop={10}>
                <Feather name="x" size={22} color={colors.mutedForeground} />
              </Pressable>
            </View>
            {[
              {
                icon: "message-square" as const,
                label: "Geçmiş Sohbetler",
                hint: "Tüm sohbetler ve klasörler",
                onPress: () => {
                  setShowMenuDrawer(false);
                  router.push("/ai-chat" as never);
                },
              },
              {
                icon: "plus-circle" as const,
                label: conv?.threadId ? "Bu Klasörde Yeni Sohbet" : "Yeni Sohbet",
                hint: conv?.threadId
                  ? `"${currentThread?.title ?? "Klasör"}" altında yeni sohbet`
                  : "Boş bir sohbet başlat",
                onPress: () => {
                  setShowMenuDrawer(false);
                  if (isNew && !conv?.threadId) return;
                  // Carry the current conversation's thread (if any) into the
                  // new chat so the user stays in the same folder context.
                  const tid = conv?.threadId;
                  router.replace(
                    (tid ? `/ai-chat/new?threadId=${tid}` : "/ai-chat/new") as never
                  );
                },
              },
              {
                icon: "folder-plus" as const,
                label: "Yeni Klasör",
                hint: "Yeni bir konu başlığı oluştur",
                onPress: () => {
                  setShowMenuDrawer(false);
                  router.push("/ai-chat?openNewThread=1" as never);
                },
              },
              {
                icon: "edit-3" as const,
                label: "Bu Sohbete Başlık Ata",
                hint: convId
                  ? "Bir konu başlığı seç veya kaldır"
                  : "Önce bir mesaj gönder",
                disabled: !convId,
                onPress: () => {
                  setShowMenuDrawer(false);
                  if (!convId) return;
                  openThreadModal();
                },
              },
            ].map((item) => (
              <Pressable
                key={item.label}
                onPress={item.onPress}
                disabled={item.disabled}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                  marginVertical: 2,
                  borderRadius: 10,
                  backgroundColor: pressed ? colors.muted : "transparent",
                  opacity: item.disabled ? 0.45 : 1,
                })}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: colors.primary + "18",
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 12,
                  }}
                >
                  <Feather name={item.icon} size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{ fontSize: 14, fontWeight: "600", color: colors.text }}
                  >
                    {item.label}
                  </Text>
                  <Text
                    style={{
                      fontSize: 11,
                      color: colors.mutedForeground,
                      marginTop: 2,
                    }}
                    numberOfLines={1}
                  >
                    {item.hint}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
          <Pressable
            style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }}
            onPress={() => setShowMenuDrawer(false)}
          />
        </View>
      </Modal>
    </View>
  );
}

const threadModalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  card: {
    width: "100%",
    maxWidth: 480,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
    maxHeight: "75%",
  },
  title: { fontSize: 16, fontWeight: "700", marginBottom: 4 },
  hint: { fontSize: 13 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText: { fontSize: 14, flex: 1, marginLeft: 10 },
  closeBtn: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
});

const bottomBarStyles = StyleSheet.create({
  micBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  listeningRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  listeningDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ef4444",
  },
  listeningText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
});
