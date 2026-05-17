import { Audio } from "expo-av";
import { cacheDirectory, writeAsStringAsync, EncodingType } from "expo-file-system/legacy";
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "./api";

export type SpeechState = "idle" | "loading" | "playing";

let activeId: string | null = null;
let state: SpeechState = "idle";
let sound: Audio.Sound | null = null;
let reqId = 0;
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
  await unloadCurrent();
  activeId = null;
  state = "idle";
  notify();
}

// Try the new server streaming endpoint first — playback starts before the
// full MP3 is generated. expo-av's Audio.Sound can stream a remote URL with
// custom headers on native, so we point it directly at /openai/tts/stream.
// On web (no header support on <audio>) and on any failure path we fall
// back to the legacy JSON base64 endpoint.
async function tryStreamingPlayback(my: number, text: string, token: string | null): Promise<Audio.Sound | null> {
  if (Platform.OS === "web") return null;
  try {
    // Probe the streaming endpoint with a HEAD-like start to surface 401/404
    // quickly. We can't do a true HEAD because the server only knows whether
    // to issue audio after POSTing the text. Instead, kick off the full POST
    // here from Audio.Sound itself by passing uri + headers.
    const uri = `${API_BASE_URL}/openai/tts/stream?t=${my}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    // expo-av only supports GET for remote URIs, so we cannot send the text
    // in a POST body that way. Instead: fire the POST ourselves, write the
    // streamed bytes to a temp file as they arrive, and start playback as
    // soon as we have a few KB. React Native's fetch doesn't expose a true
    // streaming reader on all platforms — keep this branch conservative by
    // only attempting if global ReadableStream + Response.body is available.
    const r: any = await fetch(`${API_BASE_URL}/openai/tts/stream`, {
      method: "POST",
      headers,
      body: JSON.stringify({ text: text.slice(0, 4000) }),
    });
    if (my !== reqId) return null;
    if (!r.ok) return null;
    const reader = r.body && typeof r.body.getReader === "function" ? r.body.getReader() : null;
    if (!reader) return null;

    const path = `${cacheDirectory}tts-${my}.mp3`;
    // Accumulate chunks; once we have enough for the decoder to start
    // (~32KB ≈ 2s of MP3 at 128kbps), kick off playback while we keep
    // writing the rest. expo-av will play what's available and gracefully
    // pick up appended bytes when the OS re-reads the file.
    let buf: Uint8Array[] = [];
    let total = 0;
    let started = false;
    let started_sound: Audio.Sound | null = null;
    const START_THRESHOLD = 24 * 1024;

    const flush = async () => {
      const merged = Buffer.concat(buf.map(u => Buffer.from(u)));
      buf = [];
      const b64 = merged.toString("base64");
      // Append: writeAsStringAsync overwrites, so we re-serialize the whole
      // running buffer each time. Cheap relative to TTS gen latency.
      await writeAsStringAsync(path, b64, { encoding: EncodingType.Base64 });
    };

    const allBytes: Uint8Array[] = [];

    while (true) {
      const { value, done } = await reader.read();
      if (my !== reqId) { try { await reader.cancel(); } catch {} return null; }
      if (done) break;
      if (value) {
        allBytes.push(value);
        total += value.byteLength;
        buf.push(value);
      }
      if (!started && total >= START_THRESHOLD) {
        const merged = Buffer.concat(allBytes.map(u => Buffer.from(u)));
        await writeAsStringAsync(path, merged.toString("base64"), { encoding: EncodingType.Base64 });
        if (my !== reqId) return null;
        try {
          await Audio.setAudioModeAsync({
            playsInSilentModeIOS: true,
            staysActiveInBackground: false,
            shouldDuckAndroid: true,
          });
        } catch {}
        const { sound: s } = await Audio.Sound.createAsync({ uri: path }, { shouldPlay: true });
        if (my !== reqId) { try { await s.unloadAsync(); } catch {} return null; }
        started_sound = s;
        started = true;
      }
    }
    // Final flush in case we never crossed the start threshold (very short text).
    if (allBytes.length > 0) {
      const merged = Buffer.concat(allBytes.map(u => Buffer.from(u)));
      await writeAsStringAsync(path, merged.toString("base64"), { encoding: EncodingType.Base64 });
    }
    if (!started) {
      if (my !== reqId) return null;
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });
      } catch {}
      const { sound: s } = await Audio.Sound.createAsync({ uri: path }, { shouldPlay: true });
      if (my !== reqId) { try { await s.unloadAsync(); } catch {} return null; }
      started_sound = s;
    }
    return started_sound;
  } catch {
    return null;
  }
}

async function legacyJsonPlayback(my: number, text: string, token: string | null): Promise<Audio.Sound | null> {
  const res = await fetch(`${API_BASE_URL}/openai/tts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ text: text.slice(0, 4000) }),
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

  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });
  } catch {}

  const { sound: s } = await Audio.Sound.createAsync({ uri: path }, { shouldPlay: true });
  if (my !== reqId) { try { await s.unloadAsync(); } catch {} return null; }
  return s;
}

export async function speak(id: string, text: string): Promise<void> {
  if (!text || !text.trim()) return;
  await stop();
  const my = ++reqId;
  activeId = id;
  state = "loading";
  notify();

  try {
    const token = await getToken();

    // Prefer streaming when available; fall back to legacy JSON base64 on
    // web, on probe failure, or when the runtime can't expose a stream
    // reader (older React Native fetch shims).
    let s: Audio.Sound | null = null;
    try {
      s = await tryStreamingPlayback(my, text, token);
    } catch {
      s = null;
    }
    if (my !== reqId) return;
    if (!s) {
      s = await legacyJsonPlayback(my, text, token);
    }
    if (my !== reqId || !s) {
      if (s) { try { await s.unloadAsync(); } catch {} }
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
    if (my === reqId) {
      activeId = null;
      state = "idle";
      notify();
    }
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
