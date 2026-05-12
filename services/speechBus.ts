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

export async function speak(id: string, text: string): Promise<void> {
  if (!text || !text.trim()) return;
  await stop();
  const my = ++reqId;
  activeId = id;
  state = "loading";
  notify();

  try {
    const token = await getToken();
    const res = await fetch(`${API_BASE_URL}/openai/tts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ text: text.slice(0, 4000) }),
    });
    if (my !== reqId) return;
    if (!res.ok) throw new Error(`tts ${res.status}`);
    const json = (await res.json()) as { audio?: string };
    if (my !== reqId) return;
    const b64 = String(json.audio || "");
    if (!b64) throw new Error("empty audio");

    const path = `${cacheDirectory}tts-${my}.mp3`;
    await writeAsStringAsync(path, b64, { encoding: EncodingType.Base64 });
    if (my !== reqId) return;

    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });
    } catch {}

    const { sound: s } = await Audio.Sound.createAsync({ uri: path }, { shouldPlay: true });
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
