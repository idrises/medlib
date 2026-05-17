import { Audio } from "expo-av";
import {
  cacheDirectory,
  writeAsStringAsync,
  EncodingType,
  getInfoAsync,
  makeDirectoryAsync,
} from "expo-file-system/legacy";
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "./api";
import {
  SPEECH_CACHE_MODEL,
  SPEECH_CACHE_VOICE,
  speechCacheKey,
} from "./speechCacheKey";

// Per-message audio cache. Tapping Seslendir on the same unchanged
// message twice should play instantly the second time. Key includes the
// message id, a content hash, voice, and model — so any edit, voice
// swap, or model upgrade invalidates the entry naturally without us
// having to track it.
const CACHE_DIR = `${cacheDirectory}tts-cache/`;
const CACHE_VOICE = SPEECH_CACHE_VOICE;
const CACHE_MODEL = SPEECH_CACHE_MODEL;

let cacheDirReady = false;
async function ensureCacheDir(): Promise<void> {
  if (cacheDirReady) return;
  try {
    const info = await getInfoAsync(CACHE_DIR);
    if (!info.exists) await makeDirectoryAsync(CACHE_DIR, { intermediates: true });
  } catch {}
  cacheDirReady = true;
}

function cachePathFor(messageId: string, text: string): string {
  return `${CACHE_DIR}${speechCacheKey(messageId, text, CACHE_VOICE, CACHE_MODEL)}.mp3`;
}

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
  destPath: string,
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
      body: JSON.stringify({ text: text.slice(0, 4000), voice: CACHE_VOICE }),
      signal,
    });
    if (my !== reqId) return null;
    if (!res.ok) return null;
    const b64 = await drainResponseToBase64(res, signal);
    if (my !== reqId) return null;
    if (!b64) return null;
    await writeAsStringAsync(destPath, b64, { encoding: EncodingType.Base64 });
    if (my !== reqId) return null;
    return destPath;
  } catch (err) {
    // Re-throw aborts so callers can distinguish user-cancel from
    // unrelated transport failure.
    if ((err as any)?.name === "AbortError") throw err;
    return null;
  }
}

// Mint a short-lived signed URL the OS audio player can hit directly via
// GET. AVPlayer (iOS) / MediaPlayer (Android) under expo-av only do GET
// and won't carry our Authorization header, so the backend mints an
// opaque token bound to {userId, text, voice} for ~2 minutes and we hand
// the player the resulting URL. The player then streams the MP3
// progressively — first audio frames play long before generation is
// complete on the server. Returns null on any non-fatal failure so the
// caller can fall back to the file-cache or legacy base64 path.
async function mintTtsStreamUrl(
  my: number,
  text: string,
  authToken: string | null,
  signal: AbortSignal,
): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/openai/tts/stream-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: JSON.stringify({ text: text.slice(0, 4000), voice: CACHE_VOICE }),
      signal,
    });
    if (my !== reqId) return null;
    if (!res.ok) return null;
    const j = (await res.json()) as { token?: string; path?: string };
    if (my !== reqId) return null;
    if (!j?.token) return null;
    const base = API_BASE_URL.replace(/\/$/, "");
    if (j.path && j.path.startsWith("/api/")) {
      const apiRoot = base.endsWith("/api") ? base.slice(0, -4) : base;
      return `${apiRoot}${j.path}`;
    }
    return `${base}/openai/tts/stream-get?t=${encodeURIComponent(j.token)}`;
  } catch (err) {
    if ((err as any)?.name === "AbortError") throw err;
    return null;
  }
}

async function fetchLegacyTtsToFile(
  my: number,
  text: string,
  destPath: string,
  token: string | null,
  signal: AbortSignal,
): Promise<string | null> {
  const res = await fetch(`${API_BASE_URL}/openai/tts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ text: text.slice(0, 4000), voice: CACHE_VOICE }),
    signal,
  });
  if (my !== reqId) return null;
  if (!res.ok) throw new Error(`tts ${res.status}`);
  const json = (await res.json()) as { audio?: string };
  if (my !== reqId) return null;
  const b64 = String(json.audio || "");
  if (!b64) throw new Error("empty audio");
  await writeAsStringAsync(destPath, b64, { encoding: EncodingType.Base64 });
  if (my !== reqId) return null;
  return destPath;
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
    await ensureCacheDir();
    const cachePath = cachePathFor(id, text);

    // Cache hit — replay is instant, skip the network entirely.
    let cachedPath: string | null = null;
    try {
      const info = await getInfoAsync(cachePath);
      if (info.exists && (info.size ?? 0) > 0) cachedPath = cachePath;
    } catch {}

    const authToken = await getToken();

    // Decide the playback source:
    //   1. Cache hit  → local file (instant).
    //   2. Cache miss → mint a signed URL and hand it to Audio.Sound, so
    //      AVPlayer / MediaPlayer streams progressively (first audio
    //      frames play before generation completes).
    //   3. URL mint failed → fall back to the existing file-cache write
    //      via the POST streaming endpoint.
    //   4. That failed too → legacy base64 JSON endpoint.
    // The sources are tried in order; only one is actually played.
    let playbackUri: string | null = null;
    let backgroundCacheNeeded = false;

    if (cachedPath) {
      playbackUri = cachedPath;
    } else {
      let url: string | null = null;
      try {
        url = await mintTtsStreamUrl(my, text, authToken, abort.signal);
      } catch (err) {
        if ((err as any)?.name === "AbortError") return;
        url = null;
      }
      if (my !== reqId) return;
      if (url) {
        playbackUri = url;
        backgroundCacheNeeded = true;
      } else {
        let path: string | null = null;
        try {
          path = await fetchStreamingTtsToFile(my, text, cachePath, authToken, abort.signal);
        } catch (err) {
          if ((err as any)?.name === "AbortError") return;
          path = null;
        }
        if (my !== reqId) return;
        if (!path) {
          try {
            path = await fetchLegacyTtsToFile(my, text, cachePath, authToken, abort.signal);
          } catch (err) {
            if ((err as any)?.name === "AbortError") return;
            throw err;
          }
        }
        if (my !== reqId || !path) return;
        playbackUri = path;
      }
    }
    if (my !== reqId || !playbackUri) return;

    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });
    } catch {}

    let s: Audio.Sound;
    try {
      const created = await Audio.Sound.createAsync(
        { uri: playbackUri },
        { shouldPlay: true, progressUpdateIntervalMillis: 500 },
      );
      s = created.sound;
    } catch (urlErr) {
      // Progressive URL playback failed (e.g. network glitch, expired
      // token, codec issue). Fall back to the file-cache write path so
      // the user still hears the message — just without the head-start.
      if (!backgroundCacheNeeded) throw urlErr;
      if (my !== reqId) return;
      let path: string | null = null;
      try {
        path = await fetchStreamingTtsToFile(my, text, cachePath, authToken, abort.signal);
      } catch (err) {
        if ((err as any)?.name === "AbortError") return;
        path = null;
      }
      if (my !== reqId) return;
      if (!path) {
        try {
          path = await fetchLegacyTtsToFile(my, text, cachePath, authToken, abort.signal);
        } catch (err) {
          if ((err as any)?.name === "AbortError") return;
          throw err;
        }
      }
      if (my !== reqId || !path) return;
      const created = await Audio.Sound.createAsync({ uri: path }, { shouldPlay: true });
      s = created.sound;
      backgroundCacheNeeded = false;
    }
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
          // After progressive URL playback ends, write the audio to
          // local cache in the background so the *next* tap on this
          // same message is instant. Runs detached — failure is silent.
          if (backgroundCacheNeeded) {
            (async () => {
              try {
                const bgAbort = new AbortController();
                await fetchStreamingTtsToFile(my, text, cachePath, authToken, bgAbort.signal)
                  .catch(() => fetchLegacyTtsToFile(my, text, cachePath, authToken, bgAbort.signal));
              } catch {}
            })();
          }
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
