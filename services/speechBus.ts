import { Audio } from "expo-av";
import { cacheDirectory, writeAsStringAsync, EncodingType } from "expo-file-system/legacy";
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "./api";

export type SpeechState = "idle" | "loading" | "playing";

let activeId: string | null = null;
let state: SpeechState = "idle";
let sound: Audio.Sound | null = null;
let reqId = 0;
let currentAbort: AbortController | null = null;
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

async function getToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem("medlib_auth_token");
  } catch {
    return null;
  }
}

async function unloadCurrent() {
  if (sound) {
    const s = sound;
    sound = null;
    try { await s.stopAsync(); } catch {}
    try { await s.unloadAsync(); } catch {}
  }
}

export async function stop(): Promise<void> {
  reqId++;
  // Cancel any in-flight TTS request so the server can stop reading
  // bytes from OpenAI and we stop wasting bandwidth/CPU on audio we
  // are no longer going to play.
  if (currentAbort) {
    try { currentAbort.abort(); } catch {}
    currentAbort = null;
  }
  await unloadCurrent();
  activeId = null;
  state = "idle";
  notify();
}

// Drain a fetch Response body to a single base64 string. Works on
// platforms whose fetch lacks `body.getReader()` (older RN shims) by
// falling back to arrayBuffer(). Honors the AbortSignal — if the signal
// fires mid-read we cancel the reader and bail.
async function drainResponseToBase64(res: Response, signal: AbortSignal): Promise<string> {
  const anyBody = (res as any).body;
  if (anyBody && typeof anyBody.getReader === "function") {
    const reader = anyBody.getReader();
    const chunks: Uint8Array[] = [];
    try {
      while (true) {
        if (signal.aborted) {
          try { await reader.cancel(); } catch {}
          throw new DOMException("Aborted", "AbortError");
        }
        const { value, done } = await reader.read();
        if (done) break;
        if (value) chunks.push(value);
      }
    } finally {
      try { reader.releaseLock?.(); } catch {}
    }
    const merged = Buffer.concat(chunks.map(u => Buffer.from(u)));
    return merged.toString("base64");
  }
  const ab = await res.arrayBuffer();
  return Buffer.from(new Uint8Array(ab)).toString("base64");
}

// Download from the streaming endpoint. Returns the cache file path
// containing the full MP3, or null on any non-fatal failure (caller
// then falls back to the legacy JSON endpoint). The streaming endpoint
// is preferred because it avoids the ~33% base64 inflation and the
// JSON.parse cost of the legacy path, and lets the server tear down
// the upstream OpenAI read promptly when the client aborts.
//
// NOTE: We do not attempt true progressive playback on native. expo-av's
// Audio.Sound.loadAsync reads the file fully at load time and will not
// pick up bytes appended afterwards. The win here is purely the
// shorter end-to-end byte path; first-audio latency is dominated by
// OpenAI generation time, not transport.
async function fetchStreamingTtsToFile(
  my: number,
  text: string,
  token: string | null,
  signal: AbortSignal,
): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/openai/tts/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ text: text.slice(0, 4000) }),
      signal,
    });
    if (my !== reqId) return null;
    if (!res.ok) return null;
    const b64 = await drainResponseToBase64(res, signal);
    if (my !== reqId) return null;
    if (!b64) return null;
    const path = `${cacheDirectory}tts-${my}.mp3`;
    await writeAsStringAsync(path, b64, { encoding: EncodingType.Base64 });
    if (my !== reqId) return null;
    return path;
  } catch (err) {
    // Re-throw aborts so callers can distinguish user-cancel from
    // unrelated transport failure.
    if ((err as any)?.name === "AbortError") throw err;
    return null;
  }
}

async function fetchLegacyTtsToFile(
  my: number,
  text: string,
  token: string | null,
  signal: AbortSignal,
): Promise<string | null> {
  const res = await fetch(`${API_BASE_URL}/openai/tts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ text: text.slice(0, 4000) }),
    signal,
  });
  if (my !== reqId) return null;
  if (!res.ok) throw new Error(`tts ${res.status}`);
  const json = (await res.json()) as { audio?: string };
  if (my !== reqId) return null;
  const b64 = String(json.audio || "");
  if (!b64) throw new Error("empty audio");
  const path = `${cacheDirectory}tts-${my}.mp3`;
  await writeAsStringAsync(path, b64, { encoding: EncodingType.Base64 });
  if (my !== reqId) return null;
  return path;
}

export async function speak(id: string, text: string): Promise<void> {
  if (!text || !text.trim()) return;
  await stop();
  const my = ++reqId;
  activeId = id;
  state = "loading";
  notify();

  const abort = new AbortController();
  currentAbort = abort;

  let createdSound: Audio.Sound | null = null;
  try {
    const token = await getToken();

    let path: string | null = null;
    try {
      path = await fetchStreamingTtsToFile(my, text, token, abort.signal);
    } catch (err) {
      if ((err as any)?.name === "AbortError") return; // user stopped
      path = null;
    }
    if (my !== reqId) return;
    if (!path) {
      try {
        path = await fetchLegacyTtsToFile(my, text, token, abort.signal);
      } catch (err) {
        if ((err as any)?.name === "AbortError") return;
        throw err;
      }
    }
    if (my !== reqId || !path) return;

    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });
    } catch {}

    const { sound: s } = await Audio.Sound.createAsync({ uri: path }, { shouldPlay: true });
    createdSound = s;
    // The user may have pressed stop between awaits. If so, tear down
    // the freshly-created sound instead of leaking it.
    if (my !== reqId) {
      try { await s.unloadAsync(); } catch {}
      return;
    }
    sound = s;
    state = "playing";
    notify();

    s.setOnPlaybackStatusUpdate((status) => {
      if (!status.isLoaded) return;
      if (status.didJustFinish) {
        if (my === reqId) {
          activeId = null;
          state = "idle";
          sound = null;
          notify();
          s.unloadAsync().catch(() => {});
        }
      }
    });
  } catch {
    if (createdSound) {
      try { await createdSound.unloadAsync(); } catch {}
    }
    if (my === reqId) {
      activeId = null;
      state = "idle";
      notify();
    }
  } finally {
    if (currentAbort === abort) currentAbort = null;
  }
}

export function useSpeechState(id: string): SpeechState {
  const [, setTick] = useState(0);
  useEffect(() => {
    const cb = () => setTick((t) => t + 1);
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  }, []);
  return activeId === id ? state : "idle";
}

export function useActiveSpeechId(): string | null {
  const [, setTick] = useState(0);
  useEffect(() => {
    const cb = () => setTick((t) => t + 1);
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  }, []);
  return state !== "idle" ? activeId : null;
}

export function getActiveSpeechId(): string | null {
  return state !== "idle" ? activeId : null;
}
