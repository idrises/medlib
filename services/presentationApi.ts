import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetch } from "expo/fetch";
import { API_BASE_URL } from "./api";

async function getToken(): Promise<string | null> {
  try { return await AsyncStorage.getItem("medlib_auth_token"); } catch { return null; }
}

export type PresProgress =
  | { type: "progress"; stage: "outline" }
  | { type: "progress"; stage: "images"; done: number; total: number }
  | { type: "progress"; stage: "pptx" }
  | { type: "progress"; stage: "done" }
  | { type: "done"; id: number; title: string; slideCount: number; withImages: boolean }
  | { type: "error"; message: string };

export type OutlineSlide = {
  title: string;
  bullets: string[];
  speakerNotes?: string;
  imagePrompt?: string;
  chart?: { type: "bar" | "line" | "pie"; title?: string; data: { label: string; value: number }[] } | null;
};

export type Outline = {
  title: string;
  subtitle?: string;
  slides: OutlineSlide[];
};

export type Presentation = {
  id: number;
  title: string;
  topic: string;
  slideCount: number;
  withImages: boolean;
  pptxBytes: number;
  createdAt: string;
  outline: Outline | null;
};

export async function buildPresentationStream(
  body: { topic: string; slideCount?: number; withImages?: boolean; audience?: string },
  onEvent: (ev: PresProgress) => void
): Promise<{ id: number; title: string; slideCount: number; withImages: boolean }> {
  const token = await getToken();
  const res = await fetch(`${API_BASE_URL}/openai/presentation/build`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    let detail = "";
    try { detail = await res.text(); } catch {}
    throw new Error(`Build başarısız (${res.status}): ${detail.slice(0, 200)}`);
  }

  const reader = (res.body as any).getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let final: { id: number; title: string; slideCount: number; withImages: boolean } | null = null;
  let err: string | null = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split("\n\n");
    buf = parts.pop() ?? "";
    for (const part of parts) {
      const lines = part.split("\n").filter(l => l.startsWith("data:"));
      if (!lines.length) continue;
      const dataStr = lines.map(l => l.slice(5).trim()).join("\n");
      if (!dataStr) continue;
      try {
        const ev = JSON.parse(dataStr) as PresProgress;
        onEvent(ev);
        if (ev.type === "done") final = { id: ev.id, title: ev.title, slideCount: ev.slideCount, withImages: ev.withImages };
        if (ev.type === "error") err = ev.message;
      } catch {}
    }
  }
  if (err) throw new Error(err);
  if (!final) throw new Error("Sunum üretilemedi");
  return final;
}

export async function getPresentation(id: number): Promise<Presentation> {
  const token = await getToken();
  const res = await fetch(`${API_BASE_URL}/openai/presentation/${id}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json() as Promise<Presentation>;
}

export function presentationFileUrl(id: number, token: string | null): string {
  const sep = token ? `?t=${encodeURIComponent(token)}` : "";
  return `${API_BASE_URL}/openai/presentation/${id}/file.pptx${sep}`;
}

export async function getPresentationDownloadUrl(id: number): Promise<string> {
  const token = await getToken();
  return presentationFileUrl(id, token);
}
