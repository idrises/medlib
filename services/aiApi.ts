import { fetch } from "expo/fetch";
import { API_BASE_URL } from "./api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { RichBlock } from "@/components/AiRichBlock";

async function getToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem("medlib_auth_token");
  } catch {
    return null;
  }
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface AiConversation {
  id: number;
  title: string;
  createdAt: string;
  threadId?: number | null;
}

export interface AiThread {
  id: number;
  title: string;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  conversationCount?: number;
}

export async function listAiThreads(): Promise<AiThread[]> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE_URL}/openai/threads`, { headers });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json() as Promise<AiThread[]>;
}

export async function createAiThread(title: string, notes?: string): Promise<AiThread> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE_URL}/openai/threads`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ title, notes: notes ?? null }),
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json() as Promise<AiThread>;
}

export async function updateAiThread(
  id: number,
  patch: { title?: string; notes?: string | null }
): Promise<AiThread> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE_URL}/openai/threads/${id}`, {
    method: "PATCH",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json() as Promise<AiThread>;
}

export async function deleteAiThread(id: number): Promise<void> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE_URL}/openai/threads/${id}`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) throw new Error(`${res.status}`);
}

export async function assignConversationToThread(
  conversationId: number,
  threadId: number | null
): Promise<void> {
  const headers = await authHeaders();
  const res = await fetch(
    `${API_BASE_URL}/openai/conversations/${conversationId}/thread`,
    {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ threadId }),
    }
  );
  if (!res.ok) throw new Error(`${res.status}`);
}

export interface AiMessage {
  id?: number;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
  rating?: number | null;
}

export async function postAiFeedback(messageId: number, rating: 1 | -1, comment?: string): Promise<void> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE_URL}/openai/feedback`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ messageId, rating, comment: comment ?? null }),
  });
  if (!res.ok) throw new Error(`${res.status}`);
}

export async function deleteAiFeedback(messageId: number): Promise<void> {
  const headers = await authHeaders();
  await fetch(`${API_BASE_URL}/openai/feedback/${messageId}`, {
    method: "DELETE",
    headers,
  });
}

export type AiAttachment =
  | { type: "image"; data: string }
  | { type: "pdf"; text?: string; data?: string; name?: string }
  | { type: "file"; fileId: string; name?: string; mimeType?: string; sizeBytes?: number };

const BLOCK_OPEN = "<<<MEDLIB_BLOCK>>>";
const BLOCK_CLOSE = "<<<END>>>";

export function parseStoredContent(content: string): { text: string; blocks: RichBlock[] } {
  const blocks: RichBlock[] = [];
  let text = content;
  const re = new RegExp(`${BLOCK_OPEN}([\\s\\S]*?)${BLOCK_CLOSE}`, "g");
  text = text.replace(re, (_full, json) => {
    try {
      blocks.push(JSON.parse(json) as RichBlock);
    } catch {}
    return "";
  });
  return { text: text.trim(), blocks };
}

export async function listAiConversations(): Promise<AiConversation[]> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE_URL}/openai/conversations`, { headers });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json() as Promise<AiConversation[]>;
}

export async function getAiConversation(
  id: number
): Promise<AiConversation & { messages: AiMessage[] }> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE_URL}/openai/conversations/${id}`, { headers });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json() as Promise<AiConversation & { messages: AiMessage[] }>;
}

export async function createAiConversation(
  title: string,
  threadId?: number | null
): Promise<AiConversation> {
  const headers = await authHeaders();
  const body: Record<string, unknown> = { title };
  if (typeof threadId === "number" && threadId > 0) {
    body["threadId"] = threadId;
  }
  const res = await fetch(`${API_BASE_URL}/openai/conversations`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json() as Promise<AiConversation>;
}

export async function deleteAiConversation(id: number): Promise<void> {
  const headers = await authHeaders();
  await fetch(`${API_BASE_URL}/openai/conversations/${id}`, {
    method: "DELETE",
    headers,
  });
}

export type ToolCallPhase = "start" | "done";

export function streamAiMessage(
  conversationId: number,
  content: string,
  onChunk: (chunk: string) => void,
  onToolCall: (name: string, phase: ToolCallPhase) => void,
  onDone: () => void,
  onError: (err: string) => void,
  options?: {
    attachments?: AiAttachment[];
    onRichBlock?: (block: RichBlock) => void;
    onUserBlock?: (block: RichBlock) => void;
    onMessageId?: (role: "user" | "assistant", id: number) => void;
  }
): () => void {
  let cancelled = false;
  const abortController = new AbortController();

  (async () => {
    try {
      const headers = await authHeaders();
      const response = await fetch(
        `${API_BASE_URL}/openai/conversations/${conversationId}/messages`,
        {
          method: "POST",
          headers: {
            ...headers,
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          },
          body: JSON.stringify({ content, attachments: options?.attachments ?? [] }),
          signal: abortController.signal,
        }
      );

      if (!response.ok || !response.body) {
        onError("Yanıt alınamadı");
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        if (cancelled) break;
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (!data) continue;

          try {
            const parsed = JSON.parse(data) as {
              content?: string;
              type?: string;
              name?: string;
              done?: boolean;
              error?: string;
              block?: RichBlock;
            };
            if (parsed.content) {
              onChunk(parsed.content);
            } else if (parsed.type === "tool_call" && parsed.name) {
              onToolCall(parsed.name, "start");
            } else if (parsed.type === "tool_result" && parsed.name) {
              onToolCall(parsed.name, "done");
            } else if (parsed.type === "rich_block" && parsed.block) {
              options?.onRichBlock?.(parsed.block);
            } else if (parsed.type === "user_block" && parsed.block) {
              options?.onUserBlock?.(parsed.block);
            } else if (parsed.type === "user_message_id" && typeof (parsed as any).id === "number") {
              options?.onMessageId?.("user", (parsed as any).id);
            } else if (parsed.type === "assistant_message_id" && typeof (parsed as any).id === "number") {
              options?.onMessageId?.("assistant", (parsed as any).id);
            } else if (parsed.done) {
              onDone();
            } else if (parsed.error) {
              onError(parsed.error);
            }
          } catch {
            // ignore parse errors
          }
        }
      }
    } catch (err) {
      if (!cancelled) {
        onError(String(err));
      }
    }
  })();

  return () => {
    cancelled = true;
    abortController.abort();
  };
}
