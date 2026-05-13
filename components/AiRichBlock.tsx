import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, AppState, Image as RNImage, Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import AsyncStorage from "@react-native-async-storage/async-storage";

import CitationChip from "@/components/CitationChip";
import ImageActionsSheet from "@/components/ImageActionsSheet";
import { useColors } from "@/hooks/useColors";
import { API_BASE_URL } from "@/services/api";
import { getPresentation } from "@/services/presentationApi";

let ExpoImage: any = null;
try { ExpoImage = require("expo-image").Image; } catch {}

let SvgMod: any = null;
try { SvgMod = require("react-native-svg"); } catch {}

let WebViewMod: any = null;
try { WebViewMod = require("react-native-webview").WebView; } catch {}

let useVideoPlayerHook: any = null;
let VideoViewComp: any = null;
try {
  const ev = require("expo-video");
  useVideoPlayerHook = ev.useVideoPlayer;
  VideoViewComp = ev.VideoView;
} catch {}

export type RichBlock =
  | { type: "image"; url: string; alt?: string }
  | { type: "chart"; chartType: "bar" | "line" | "pie"; title?: string; data: { label: string; value: number }[] }
  | { type: "diagram"; mermaid: string; title?: string }
  | {
      type: "card";
      kind: "article" | "book" | "chapter" | "video" | "videoset" | "journal";
      id: number;
      title: string;
      subtitle?: string;
      thumb?: string;
      meta?: string;
      pdfUrl?: string;
      videoUrl?: string;
    }
  | {
      type: "presentation";
      id: number;
      title: string;
      subtitle?: string;
      slideCount: number;
      withImages: boolean;
      status?: "processing" | "ready" | "failed";
    }
  | {
      type: "file_citation";
      fileId: string;
      fileName: string;
      pageNum: number | null;
    }
  | {
      // User-uploaded file rendered as a rich card in the chat bubble
      // (next to the user's text). Tap → file detail screen.
      type: "user_file";
      fileId: string;
      fileName: string;
      mimeType?: string;
      sizeBytes?: number;
      pageCount?: number;
    }
  | {
      // Generated file from code interpreter / agent tools. Renders as
      // a download card so the user can fetch the artifact even if the
      // model never explicitly mentioned it in prose.
      type: "code_artifact";
      fileId: string;
      fileName: string;
      mimeType?: string;
      sizeBytes?: number;
    }
  | {
      // Plain text output from a tool call (run_python stdout, etc.)
      // surfaced as a monospace block so the user can see what the
      // agent produced.
      type: "code_output";
      label?: string;
      text: string;
    };

const PALETTE = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];

const PREVIEW_HEIGHT = 480;

interface Props {
  block: RichBlock;
}

export default function AiRichBlock({ block }: Props) {
  if (block.type === "image") return <ImageBlock block={block} />;
  if (block.type === "chart") return <ChartBlock block={block} />;
  if (block.type === "diagram") return <DiagramBlock block={block} />;
  if (block.type === "card") return <CardBlock block={block} />;
  if (block.type === "presentation") return <PresentationBlock block={block} />;
  if (block.type === "file_citation")
    return (
      <CitationChip
        fileId={block.fileId}
        fileName={block.fileName}
        pageNum={block.pageNum}
      />
    );
  if (block.type === "user_file") return <UserFileBlock block={block} />;
  if (block.type === "code_artifact") return <CodeArtifactBlock block={block} />;
  if (block.type === "code_output") return <CodeOutputBlock block={block} />;
  return null;
}

function UserFileBlock({
  block,
}: {
  block: Extract<RichBlock, { type: "user_file" }>;
}) {
  const colors = useColors();
  const router = useRouter();
  const sizeLabel =
    typeof block.sizeBytes === "number"
      ? block.sizeBytes < 1024
        ? `${block.sizeBytes} B`
        : block.sizeBytes < 1024 * 1024
          ? `${(block.sizeBytes / 1024).toFixed(0)} KB`
          : `${(block.sizeBytes / 1024 / 1024).toFixed(1)} MB`
      : null;
  const isPdf =
    (block.mimeType ?? "").toLowerCase() === "application/pdf" ||
    /\.pdf$/i.test(block.fileName);
  const ext = (block.fileName.split(".").pop() ?? "").toUpperCase();
  const typeLabel = isPdf ? "PDF" : ext || "DOSYA";
  const metaParts = [typeLabel];
  if (sizeLabel) metaParts.push(sizeLabel);
  if (typeof block.pageCount === "number" && block.pageCount > 0) {
    metaParts.push(`${block.pageCount} sayfa`);
  }
  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: "/files/[id]",
          params: { id: block.fileId },
        } as never)
      }
      style={({ pressed }) => [
        artStyles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View
        style={[
          artStyles.icon,
          { backgroundColor: colors.primary + "1A" },
        ]}
      >
        <Feather
          name={isPdf ? "file-text" : "paperclip"}
          size={20}
          color={colors.primary}
        />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[artStyles.label, { color: colors.mutedForeground }]}>
          YÜKLENEN DOSYA
        </Text>
        <Text
          style={[artStyles.name, { color: colors.foreground }]}
          numberOfLines={2}
        >
          {block.fileName}
        </Text>
        <Text style={[artStyles.meta, { color: colors.mutedForeground }]}>
          {metaParts.join(" · ")}
        </Text>
      </View>
      <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
    </Pressable>
  );
}

function isImageArtifact(
  block: Extract<RichBlock, { type: "code_artifact" }>,
): boolean {
  const mt = (block.mimeType ?? "").toLowerCase();
  if (mt.startsWith("image/")) return true;
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(block.fileName ?? "");
}

function InlineCodeImageBlock({
  block,
}: {
  block: Extract<RichBlock, { type: "code_artifact" }>;
}) {
  const colors = useColors();
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem("medlib_auth_token")
      .then(setToken)
      .catch(() => setToken(null));
  }, []);
  const url = `${API_BASE_URL}/files/${block.fileId}/download`;
  const Img: any = ExpoImage ?? RNImage;
  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: "/files/[id]",
          params: { id: block.fileId },
        } as never)
      }
      onLongPress={() => setSheetOpen(true)}
      delayLongPress={350}
      style={({ pressed }) => [
        artStyles.inlineImageWrap,
        { borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      {token ? (
        <Img
          source={{ uri: url, headers: { Authorization: `Bearer ${token}` } }}
          style={artStyles.inlineImage}
          contentFit="cover"
          resizeMode="cover"
        />
      ) : (
        <View style={[artStyles.inlineImage, { alignItems: "center", justifyContent: "center" }]}>
          <ActivityIndicator size="small" color={colors.mutedForeground} />
        </View>
      )}
      <View style={artStyles.inlineImageCaption}>
        <Feather name="image" size={11} color="#fff" />
        <Text style={artStyles.inlineImageCaptionText} numberOfLines={1}>
          {block.fileName}
        </Text>
      </View>
      <ImageActionsSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        imageUrl={url}
        authToken={token}
        fileName={block.fileName}
      />
    </Pressable>
  );
}

function CodeArtifactBlock({
  block,
}: {
  block: Extract<RichBlock, { type: "code_artifact" }>;
}) {
  if (isImageArtifact(block)) return <InlineCodeImageBlock block={block} />;
  return <CodeArtifactDownloadBlock block={block} />;
}

function CodeArtifactDownloadBlock({
  block,
}: {
  block: Extract<RichBlock, { type: "code_artifact" }>;
}) {
  const colors = useColors();
  const [busy, setBusy] = useState(false);
  const sizeLabel =
    typeof block.sizeBytes === "number"
      ? block.sizeBytes < 1024
        ? `${block.sizeBytes} B`
        : block.sizeBytes < 1024 * 1024
          ? `${(block.sizeBytes / 1024).toFixed(0)} KB`
          : `${(block.sizeBytes / 1024 / 1024).toFixed(1)} MB`
      : null;

  const onOpen = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const token = await AsyncStorage.getItem("medlib_auth_token");
      if (!token) throw new Error("Oturum bulunamadı.");
      const safe = (block.fileName || "dosya").replace(
        /[\\/:"<>|?*\x00-\x1f]/g,
        "_",
      );
      const target = `${FileSystem.cacheDirectory}${block.fileId}-${safe}`;
      const dl = await FileSystem.downloadAsync(
        `${API_BASE_URL}/files/${block.fileId}/download`,
        target,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (dl.status >= 400) throw new Error(`İndirme hatası (${dl.status})`);
      if (Platform.OS === "web") {
        if (typeof window !== "undefined") window.open(dl.uri, "_blank");
      } else {
        const can = await Sharing.isAvailableAsync();
        if (can) await Sharing.shareAsync(dl.uri);
      }
    } catch (e) {
      Alert.alert(
        "Dosya açılamadı",
        e instanceof Error ? e.message : "Bağlantı hatası. Tekrar deneyin.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pressable
      onPress={onOpen}
      disabled={busy}
      style={({ pressed }) => [
        artStyles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: busy ? 0.6 : pressed ? 0.85 : 1,
        },
      ]}
    >
      <View
        style={[
          artStyles.icon,
          { backgroundColor: colors.primary + "1A" },
        ]}
      >
        <Feather
          name={busy ? "download" : "file-plus"}
          size={20}
          color={colors.primary}
        />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[artStyles.label, { color: colors.mutedForeground }]}>
          ÜRETİLEN DOSYA
        </Text>
        <Text
          style={[artStyles.name, { color: colors.foreground }]}
          numberOfLines={2}
        >
          {block.fileName}
        </Text>
        {sizeLabel ? (
          <Text style={[artStyles.meta, { color: colors.mutedForeground }]}>
            {sizeLabel}
          </Text>
        ) : null}
      </View>
      {busy ? (
        <ActivityIndicator size="small" color={colors.mutedForeground} />
      ) : (
        <Feather name="download" size={16} color={colors.mutedForeground} />
      )}
    </Pressable>
  );
}

function CodeOutputBlock({
  block,
}: {
  block: Extract<RichBlock, { type: "code_output" }>;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        artStyles.outputWrap,
        { backgroundColor: colors.muted, borderColor: colors.border },
      ]}
    >
      {block.label ? (
        <Text style={[artStyles.outputLabel, { color: colors.mutedForeground }]}>
          {block.label}
        </Text>
      ) : null}
      <Text style={[artStyles.outputText, { color: colors.foreground }]}>
        {block.text}
      </Text>
    </View>
  );
}

const artStyles = StyleSheet.create({
  card: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  name: { fontSize: 13, fontFamily: "Inter_600SemiBold", lineHeight: 17 },
  meta: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  outputWrap: {
    marginTop: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  outputLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  outputText: {
    fontSize: 12,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    lineHeight: 17,
  },
  inlineImageWrap: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    backgroundColor: "#0001",
  },
  inlineImage: {
    width: "100%",
    aspectRatio: 4 / 3,
  },
  inlineImageCaption: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: "rgba(0,0,0,0.55)",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  inlineImageCaptionText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    flex: 1,
  },
});

function PresentationBlock({ block }: { block: Extract<RichBlock, { type: "presentation" }> }) {
  const colors = useColors();
  const router = useRouter();

  // Live status — başlangıç block.status (server'dan gelen), sonra poll ile güncellenir.
  const initialStatus: "processing" | "ready" | "failed" = block.status ?? "ready";
  const [status, setStatus] = useState<"processing" | "ready" | "failed">(initialStatus);
  const [title, setTitle] = useState<string>(block.title);
  const [slideCount, setSlideCount] = useState<number>(block.slideCount);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  // Poll while processing; stop on ready/failed. Re-poll when app returns to foreground.
  useEffect(() => {
    cancelledRef.current = false;
    if (status !== "processing") return;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      if (cancelledRef.current) return;
      try {
        const p = await getPresentation(block.id);
        if (cancelledRef.current) return;
        const s = (p.status as any) ?? "ready";
        if (p.title) setTitle(p.title);
        if (p.slideCount) setSlideCount(p.slideCount);
        if (s === "ready") { setStatus("ready"); return; }
        if (s === "failed") { setStatus("failed"); setErrorMsg(p.error ?? "Üretim başarısız"); return; }
      } catch {
        // sessizce sürdür — geçici ağ hatası olabilir
      }
      timer = setTimeout(tick, 4000);
    };

    tick();
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active" && status === "processing") {
        // ön plana dönüldü → hemen yenile
        if (timer) { clearTimeout(timer); timer = null; }
        tick();
      }
    });

    return () => {
      cancelledRef.current = true;
      if (timer) clearTimeout(timer);
      sub.remove();
    };
  }, [status, block.id]);

  const isProcessing = status === "processing";
  const isFailed = status === "failed";
  const open = () => {
    if (isProcessing || isFailed) return;
    router.push({ pathname: "/presentation/[id]" as any, params: { id: String(block.id) } });
  };

  return (
    <Pressable
      onPress={open}
      disabled={isProcessing || isFailed}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed && !isProcessing && !isFailed ? 0.8 : 1, alignItems: "center" },
      ]}
    >
      <View style={[styles.cardIcon, { backgroundColor: isFailed ? "#ef4444" : colors.primary }]}>
        {isProcessing
          ? <ActivityIndicator color="#fff" size="small" />
          : <Feather name={isFailed ? "alert-triangle" : "layout"} size={22} color="#fff" />}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.cardKind, { color: colors.mutedForeground }]} numberOfLines={1}>
          {isProcessing ? `SUNUM · HAZIRLANIYOR…` : isFailed ? `SUNUM · HATA` : `SUNUM · ${slideCount} SLAYT${block.withImages ? " · GÖRSELLİ" : ""}`}
        </Text>
        <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={2}>
          {title}
        </Text>
        {isProcessing ? (
          <Text style={[styles.cardSub, { color: colors.mutedForeground }]} numberOfLines={2}>
            30 sn - 2 dk sürebilir. Uygulamayı arka plana alabilirsin, hazır olunca burada görünecek.
          </Text>
        ) : isFailed ? (
          <Text style={[styles.cardSub, { color: "#ef4444" }]} numberOfLines={3}>
            {errorMsg ?? "Sunum üretilemedi"}
          </Text>
        ) : block.subtitle ? (
          <Text style={[styles.cardSub, { color: colors.mutedForeground }]} numberOfLines={1}>{block.subtitle}</Text>
        ) : null}
        {!isProcessing && !isFailed ? (
          <View style={styles.cardActions}>
            <View style={[styles.cardBtn, { backgroundColor: colors.primary }]}>
              <Feather name="eye" size={12} color={colors.primaryForeground} />
              <Text style={[styles.cardBtnText, { color: colors.primaryForeground }]}>Önizle &amp; İndir</Text>
            </View>
          </View>
        ) : null}
      </View>
      {!isProcessing && !isFailed
        ? <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
        : null}
    </Pressable>
  );
}

function ImageBlock({ block }: { block: Extract<RichBlock, { type: "image" }> }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const url = String(block.url ?? "");
  const safe = url.startsWith("data:image/") || url.startsWith("https://") || url.startsWith("http://");
  if (!safe) return null;
  const inner = ExpoImage ? (
    <ExpoImage
      source={{ uri: url }}
      style={styles.image}
      contentFit="cover"
      transition={200}
      accessibilityLabel={block.alt}
    />
  ) : (
    <RNImage source={{ uri: url }} style={styles.image} resizeMode="cover" accessibilityLabel={block.alt} />
  );
  return (
    <Pressable
      onLongPress={() => setSheetOpen(true)}
      delayLongPress={350}
      style={({ pressed }) => [styles.imageWrap, { opacity: pressed ? 0.9 : 1 }]}
    >
      {inner}
      <ImageActionsSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        imageUrl={url}
        fileName={block.alt}
      />
    </Pressable>
  );
}

function ChartBlock({ block }: { block: Extract<RichBlock, { type: "chart" }> }) {
  const colors = useColors();

  if (!SvgMod) {
    return (
      <View style={[styles.chartWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {block.title ? <Text style={[styles.chartTitle, { color: colors.foreground }]}>{block.title}</Text> : null}
        {block.data.map((d, i) => {
          const max = Math.max(...block.data.map(x => x.value), 1);
          const w = (d.value / max) * 100;
          return (
            <View key={i} style={{ width: "100%", marginVertical: 4 }}>
              <Text style={[styles.aiBarLabel, { color: colors.foreground }]} numberOfLines={1}>
                {d.label} — {d.value}
              </Text>
              <View style={[styles.aiBarTrack, { backgroundColor: colors.muted }]}>
                <View style={[styles.aiBarFill, { width: `${w}%`, backgroundColor: PALETTE[i % PALETTE.length] }]} />
              </View>
            </View>
          );
        })}
      </View>
    );
  }

  const Svg = SvgMod.default;
  const { Circle, G, Line, Path, Polyline, Rect, Text: SvgText } = SvgMod;
  const w = 280;
  const h = 200;
  const data = block.data;
  const max = Math.max(...data.map(d => d.value), 1);

  const renderBar = () => {
    const padL = 30, padB = 36, padT = 8;
    const chartW = w - padL - 8;
    const chartH = h - padT - padB;
    const barW = (chartW / data.length) * 0.7;
    const gap = (chartW / data.length) * 0.3;
    return (
      <Svg width={w} height={h}>
        <Line x1={padL} y1={padT + chartH} x2={padL + chartW} y2={padT + chartH} stroke={colors.mutedForeground} strokeWidth={1} />
        {data.map((d, i) => {
          const barH = (d.value / max) * chartH;
          const x = padL + i * (barW + gap) + gap / 2;
          const y = padT + chartH - barH;
          return (
            <G key={i}>
              <Rect x={x} y={y} width={barW} height={barH} fill={PALETTE[i % PALETTE.length]} rx={3} />
              <SvgText x={x + barW / 2} y={padT + chartH + 14} fontSize={9} fill={colors.mutedForeground} textAnchor="middle">
                {d.label.length > 8 ? d.label.slice(0, 7) + "…" : d.label}
              </SvgText>
              <SvgText x={x + barW / 2} y={y - 4} fontSize={9} fill={colors.foreground} textAnchor="middle">
                {d.value}
              </SvgText>
            </G>
          );
        })}
      </Svg>
    );
  };

  const renderLine = () => {
    const padL = 30, padB = 30, padT = 12;
    const chartW = w - padL - 8;
    const chartH = h - padT - padB;
    const stepX = data.length > 1 ? chartW / (data.length - 1) : 0;
    const points = data.map((d, i) => `${padL + i * stepX},${padT + chartH - (d.value / max) * chartH}`).join(" ");
    return (
      <Svg width={w} height={h}>
        <Line x1={padL} y1={padT + chartH} x2={padL + chartW} y2={padT + chartH} stroke={colors.mutedForeground} strokeWidth={1} />
        <Polyline points={points} fill="none" stroke={colors.primary} strokeWidth={2} />
        {data.map((d, i) => {
          const x = padL + i * stepX;
          const y = padT + chartH - (d.value / max) * chartH;
          return (
            <G key={i}>
              <Circle cx={x} cy={y} r={3} fill={colors.primary} />
              <SvgText x={x} y={padT + chartH + 14} fontSize={9} fill={colors.mutedForeground} textAnchor="middle">
                {d.label.length > 6 ? d.label.slice(0, 5) + "…" : d.label}
              </SvgText>
            </G>
          );
        })}
      </Svg>
    );
  };

  const renderPie = () => {
    const total = data.reduce((s, d) => s + d.value, 0) || 1;
    const cx = w / 2, cy = h / 2;
    const radius = Math.min(w, h) / 2 - 18;
    let acc = 0;
    const slices = data.map((d, i) => {
      const start = (acc / total) * Math.PI * 2 - Math.PI / 2;
      acc += d.value;
      const end = (acc / total) * Math.PI * 2 - Math.PI / 2;
      const x1 = cx + Math.cos(start) * radius;
      const y1 = cy + Math.sin(start) * radius;
      const x2 = cx + Math.cos(end) * radius;
      const y2 = cy + Math.sin(end) * radius;
      const large = end - start > Math.PI ? 1 : 0;
      return { path: `M${cx},${cy} L${x1},${y1} A${radius},${radius} 0 ${large} 1 ${x2},${y2} Z`, color: PALETTE[i % PALETTE.length], label: d.label, pct: ((d.value / total) * 100).toFixed(0) };
    });
    return (
      <View>
        <Svg width={w} height={h}>
          {slices.map((s, i) => <Path key={i} d={s.path} fill={s.color} />)}
        </Svg>
        <View style={styles.legend}>
          {slices.map((s, i) => (
            <View key={i} style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: s.color }]} />
              <Text style={[styles.legendText, { color: colors.foreground }]} numberOfLines={1}>
                {s.label} • {s.pct}%
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.chartWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {block.title ? <Text style={[styles.chartTitle, { color: colors.foreground }]}>{block.title}</Text> : null}
      {block.chartType === "bar" && renderBar()}
      {block.chartType === "line" && renderLine()}
      {block.chartType === "pie" && renderPie()}
    </View>
  );
}

function DiagramBlock({ block }: { block: Extract<RichBlock, { type: "diagram" }> }) {
  const colors = useColors();
  const safeMermaid = JSON.stringify(String(block.mermaid).slice(0, 8000));
  const isDark = colors.background.toLowerCase() === "#000" || colors.background.toLowerCase().startsWith("#0");
  const themeName = isDark ? "dark" : "default";
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:12px;background:${colors.card};color:${colors.foreground};font-family:-apple-system,Roboto,sans-serif;}#out{display:flex;justify-content:center;}</style></head><body><div id="out"></div><script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script><script>(function(){try{mermaid.initialize({startOnLoad:false,theme:'${themeName}',securityLevel:'strict'});var code=${safeMermaid};mermaid.render('g',code).then(function(r){document.getElementById('out').innerHTML=r.svg;}).catch(function(e){document.getElementById('out').textContent='Diagram error';});}catch(e){document.getElementById('out').textContent='Diagram error';}})();</script></body></html>`;

  if (Platform.OS === "web") {
    return (
      <View style={[styles.diagramWrap, { backgroundColor: colors.card, borderColor: colors.border, height: 240 }]}>
        {block.title ? <Text style={[styles.chartTitle, { color: colors.foreground }]}>{block.title}</Text> : null}
        <View style={{ flex: 1, overflow: "hidden", borderRadius: 8 }}>
          {/* @ts-ignore */}
          <iframe srcDoc={html} style={{ border: 0, width: "100%", height: "100%" }} />
        </View>
      </View>
    );
  }

  if (!WebViewMod) {
    return (
      <View style={[styles.diagramWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {block.title ? <Text style={[styles.chartTitle, { color: colors.foreground }]}>{block.title}</Text> : null}
        <Text style={[styles.fallbackText, { color: colors.mutedForeground }]} selectable>
          {block.mermaid}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.diagramWrap, { backgroundColor: colors.card, borderColor: colors.border, height: 260 }]}>
      {block.title ? <Text style={[styles.chartTitle, { color: colors.foreground }]}>{block.title}</Text> : null}
      <WebViewMod
        originWhitelist={["*"]}
        source={{ html }}
        style={{ backgroundColor: "transparent", flex: 1 }}
      />
    </View>
  );
}

function CardBlock({ block }: { block: Extract<RichBlock, { type: "card" }> }) {
  const colors = useColors();

  const iconMap: Record<string, keyof typeof Feather.glyphMap> = {
    article: "file-text",
    book: "book",
    chapter: "bookmark",
    video: "video",
    journal: "layers",
  };

  const [expanded, setExpanded] = useState<"pdf" | "video" | null>(null);

  const togglePdf = () => setExpanded((s) => (s === "pdf" ? null : "pdf"));
  const toggleVideo = () => setExpanded((s) => (s === "video" ? null : "video"));

  const hasPdf = !!block.pdfUrl;
  const hasVideo = !!block.videoUrl;
  const onCardPress = () => {
    if (hasPdf) togglePdf();
    else if (hasVideo) toggleVideo();
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, flexDirection: "column", alignItems: "stretch" }]}>
      <Pressable
        onPress={onCardPress}
        disabled={!hasPdf && !hasVideo}
        style={({ pressed }) => [{ flexDirection: "row", gap: 12, opacity: pressed && (hasPdf || hasVideo) ? 0.7 : 1 }]}
      >
        <View style={[styles.cardIcon, { backgroundColor: colors.secondary }]}>
          <Feather name={iconMap[block.kind] ?? "file"} size={22} color={colors.primary} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.cardKind, { color: colors.mutedForeground }]} numberOfLines={1}>
            {kindLabel(block.kind)}
          </Text>
          <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={2}>
            {block.title}
          </Text>
          {block.subtitle ? (
            <Text style={[styles.cardSub, { color: colors.mutedForeground }]} numberOfLines={1}>{block.subtitle}</Text>
          ) : null}
          {block.meta ? (
            <Text style={[styles.cardMeta, { color: colors.mutedForeground }]} numberOfLines={1}>{block.meta}</Text>
          ) : null}
          <View style={styles.cardActions}>
            {hasPdf ? (
              <Pressable onPress={togglePdf} style={({ pressed }) => [styles.cardBtn, { backgroundColor: expanded === "pdf" ? colors.primary : colors.secondary, opacity: pressed ? 0.8 : 1 }]}>
                <Feather name={expanded === "pdf" ? "chevron-up" : "file-text"} size={12} color={expanded === "pdf" ? colors.primaryForeground : colors.foreground} />
                <Text style={[styles.cardBtnText, { color: expanded === "pdf" ? colors.primaryForeground : colors.foreground }]}>{expanded === "pdf" ? "Kapat" : "PDF Önizle"}</Text>
              </Pressable>
            ) : null}
            {hasVideo ? (
              <Pressable onPress={toggleVideo} style={({ pressed }) => [styles.cardBtn, { backgroundColor: expanded === "video" ? colors.primary : colors.secondary, opacity: pressed ? 0.8 : 1 }]}>
                <Feather name={expanded === "video" ? "chevron-up" : "play"} size={12} color={expanded === "video" ? colors.primaryForeground : colors.foreground} />
                <Text style={[styles.cardBtnText, { color: expanded === "video" ? colors.primaryForeground : colors.foreground }]}>{expanded === "video" ? "Kapat" : "İzle"}</Text>
              </Pressable>
            ) : null}
            {!hasPdf && !hasVideo ? (
              <Text style={[styles.cardBtnText, { color: colors.mutedForeground, fontStyle: "italic" }]}>Önizleme mevcut değil</Text>
            ) : null}
          </View>
        </View>
      </Pressable>

      {expanded === "pdf" && block.pdfUrl ? (
        <InlinePdf url={block.pdfUrl} />
      ) : null}
      {expanded === "video" && block.videoUrl ? (
        <InlineVideo url={block.videoUrl} />
      ) : null}
    </View>
  );
}

function InlinePdf({ url }: { url: string }) {
  const colors = useColors();
  const [loading, setLoading] = useState(true);
  if (!WebViewMod) {
    return (
      <View style={[styles.previewBox, { borderColor: colors.border, backgroundColor: colors.background, padding: 16 }]}>
        <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>
          PDF önizleme bu sürümde desteklenmiyor.
        </Text>
      </View>
    );
  }
  const isPdf = /\.pdf(\?|$)/i.test(url);
  const src =
    Platform.OS === "android" && isPdf
      ? `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(url)}`
      : url;
  return (
    <View style={[styles.previewBox, { borderColor: colors.border, backgroundColor: "#000" }]}>
      <WebViewMod
        source={{ uri: src }}
        style={{ flex: 1, backgroundColor: "#000" }}
        startInLoadingState
        onLoadEnd={() => setLoading(false)}
        allowsInlineMediaPlayback
        javaScriptEnabled
        domStorageEnabled
      />
      {loading ? (
        <View style={styles.previewLoading} pointerEvents="none">
          <Text style={{ color: "#fff", fontSize: 13 }}>Yükleniyor…</Text>
        </View>
      ) : null}
    </View>
  );
}

function InlineVideo({ url }: { url: string }) {
  const colors = useColors();
  if (!useVideoPlayerHook || !VideoViewComp) {
    return (
      <View style={[styles.previewBox, { borderColor: colors.border, backgroundColor: colors.background, padding: 16 }]}>
        <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>
          Video oynatıcı bu sürümde desteklenmiyor.
        </Text>
      </View>
    );
  }
  return <InlineVideoPlayer url={url} />;
}

function InlineVideoPlayer({ url }: { url: string }) {
  const colors = useColors();
  const player = useVideoPlayerHook(url, (p: any) => {
    try { p.timeUpdateEventInterval = 1; } catch {}
  });
  return (
    <View style={[styles.previewBox, { borderColor: colors.border, aspectRatio: 16 / 9, height: undefined, backgroundColor: "#000" }]}>
      <VideoViewComp
        player={player}
        style={{ flex: 1 }}
        allowsFullscreen
        allowsPictureInPicture
        nativeControls
      />
    </View>
  );
}

function kindLabel(kind: string) {
  switch (kind) {
    case "article": return "MAKALE";
    case "book": return "KİTAP";
    case "chapter": return "BÖLÜM";
    case "video": return "VİDEO";
    case "videoset": return "VİDEO SETİ";
    case "journal": return "DERGİ";
    default: return kind.toUpperCase();
  }
}

const styles = StyleSheet.create({
  imageWrap: { marginTop: 8, borderRadius: 12, overflow: "hidden" },
  image: { width: "100%", aspectRatio: 1, borderRadius: 12 },
  chartWrap: { marginTop: 8, padding: 10, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, alignItems: "center" },
  chartTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 6, textAlign: "center" },
  legend: { marginTop: 8, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  diagramWrap: { marginTop: 8, padding: 8, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  fallbackText: { fontSize: 11, fontFamily: "Inter_400Regular", padding: 8 },
  aiBarLabel: { fontSize: 11, fontFamily: "Inter_500Medium", marginBottom: 2 },
  aiBarTrack: { height: 8, borderRadius: 4, overflow: "hidden" },
  aiBarFill: { height: "100%", borderRadius: 4 },
  card: { marginTop: 8, flexDirection: "row", gap: 12, padding: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, alignItems: "flex-start" },
  cardIcon: { width: 44, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  cardKind: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5, marginBottom: 2 },
  cardTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", lineHeight: 18 },
  cardSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  cardMeta: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  cardActions: { flexDirection: "row", gap: 6, marginTop: 8, flexWrap: "wrap" },
  cardBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  cardBtnText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  previewBox: { marginTop: 10, height: PREVIEW_HEIGHT, borderRadius: 10, overflow: "hidden", borderWidth: StyleSheet.hairlineWidth },
  previewLoading: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.6)" },
});
