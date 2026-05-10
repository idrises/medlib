import { fetch } from "expo/fetch";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "./api";

async function authHeaders(): Promise<Record<string, string>> {
  const token = await AsyncStorage.getItem("medlib_auth_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface RealtimeSession {
  id: string;
  client_secret: { value: string; expires_at: number };
  model: string;
}

export async function createRealtimeSession(
  opts?: {
    resumeConvId?: number | null;
    contextType?: string | null;
    contextId?: number | string | null;
  }
): Promise<RealtimeSession> {
  const headers = await authHeaders();
  const body: Record<string, unknown> = {};
  if (opts?.resumeConvId && Number.isFinite(opts.resumeConvId)) {
    body["resumeConvId"] = opts.resumeConvId;
  }
  if (opts?.contextType && opts?.contextId != null) {
    const cid = typeof opts.contextId === "string" ? Number(opts.contextId) : opts.contextId;
    if (Number.isFinite(cid) && cid > 0) {
      body["contextType"] = opts.contextType;
      body["contextId"] = cid;
    }
  }
  const res = await fetch(`${API_BASE_URL}/openai/realtime/session`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Realtime session error ${res.status}: ${text}`);
  }
  return (await res.json()) as RealtimeSession;
}

export interface ToolExecResult {
  content: string;
  block: any | null;
}

export async function execRealtimeTool(
  name: string,
  args: Record<string, unknown>,
  conversationId?: number | null
): Promise<ToolExecResult> {
  const headers = await authHeaders();
  const body: Record<string, unknown> = { name, arguments: args };
  if (conversationId && Number.isFinite(conversationId)) {
    body["conversationId"] = conversationId;
  }
  const res = await fetch(`${API_BASE_URL}/openai/realtime/tool-exec`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    return { content: JSON.stringify({ error: `Tool failed (${res.status})` }), block: null };
  }
  return (await res.json()) as ToolExecResult;
}

export async function extractPdfText(base64: string): Promise<string> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE_URL}/openai/realtime/extract-pdf`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ data: base64 }),
  });
  if (!res.ok) throw new Error(`PDF extraction failed (${res.status})`);
  const j = (await res.json()) as { text?: string };
  return j?.text ?? "";
}

export async function createVoiceConversation(): Promise<{ id: number } | null> {
  try {
    const headers = await authHeaders();
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const title = `Sesli Sohbet — ${pad(now.getDate())}.${pad(now.getMonth() + 1)} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const res = await fetch(`${API_BASE_URL}/openai/conversations`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { id: number };
    return { id: data.id };
  } catch {
    return null;
  }
}

export async function appendVoiceMessage(
  conversationId: number,
  role: "user" | "assistant",
  content: string
): Promise<number | null> {
  try {
    const headers = await authHeaders();
    const r = await fetch(`${API_BASE_URL}/openai/conversations/${conversationId}/raw-message`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ role, content }),
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { messageId?: number };
    return j?.messageId ?? null;
  } catch {
    return null;
  }
}
