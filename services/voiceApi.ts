import { Audio } from "expo-av";
import {
  cacheDirectory,
  readAsStringAsync,
  writeAsStringAsync,
  deleteAsync,
  EncodingType,
} from "expo-file-system/legacy";
import { fetch } from "expo/fetch";
import { API_BASE_URL } from "./api";
import { cleanTranscript, isHallucinatedTranscript } from "./transcriptFilter";
import AsyncStorage from "@react-native-async-storage/async-storage";

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

export type VoiceStreamEvent =
  | { type: "user_transcript"; data: string }
  | { type: "transcript"; data: string }
  | { type: "audio"; data: string }
  | { type: "tool_call"; name: string }
  | { type: "tool_result"; name: string }
  | { type: "error"; error: string }
  | { done: true };

let currentRecording: Audio.Recording | null = null;
let currentSound: Audio.Sound | null = null;
const SILENCE_THRESHOLD_MS = 2200;
const METERING_INTERVAL_MS = 250;
const SILENCE_DB = -48;
const MIN_SPEECH_MS = 700;

export async function startRecording(): Promise<void> {
  const { status } = await Audio.requestPermissionsAsync();
  if (status !== "granted") {
    throw new Error("Mikrofon izni verilmedi");
  }

  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
  });

  const { recording } = await Audio.Recording.createAsync({
    ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
    isMeteringEnabled: true,
  });
  currentRecording = recording;
}

export function onSilenceDetected(
  onSilence: () => void
): () => void {
  const startedAt = Date.now();
  let lastSpeechAt = Date.now();
  let hasSpeech = false;
  let cleared = false;

  const interval = setInterval(async () => {
    if (!currentRecording || cleared) return;
    try {
      const status = await currentRecording.getStatusAsync();
      if (!status.isRecording) return;
      const db = status.metering ?? -160;
      if (db > SILENCE_DB) {
        lastSpeechAt = Date.now();
        if (Date.now() - startedAt > MIN_SPEECH_MS) hasSpeech = true;
      } else if (
        hasSpeech &&
        Date.now() - lastSpeechAt > SILENCE_THRESHOLD_MS
      ) {
        cleared = true;
        clearInterval(interval);
        onSilence();
      }
    } catch {
      cleared = true;
      clearInterval(interval);
    }
  }, METERING_INTERVAL_MS);

  return () => {
    cleared = true;
    clearInterval(interval);
  };
}

export async function stopRecording(): Promise<string | null> {
  if (!currentRecording) return null;

  await currentRecording.stopAndUnloadAsync();
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
  });

  const uri = currentRecording.getURI();
  currentRecording = null;

  if (!uri) return null;

  const base64 = await readAsStringAsync(uri, {
    encoding: EncodingType.Base64,
  });

  return base64;
}

export function cancelRecording(): void {
  if (currentRecording) {
    currentRecording.stopAndUnloadAsync().catch(() => {});
    currentRecording = null;
  }
}

export function stopCurrentPlayback(): void {
  if (currentSound) {
    currentSound.stopAsync().catch(() => {});
    currentSound.unloadAsync().catch(() => {});
    currentSound = null;
  }
}

export async function sendVoiceMessage(
  conversationId: number,
  audioBase64: string,
  onUserTranscript: (text: string) => void,
  onTranscript: (chunk: string) => void,
  onToolCall: (name: string, phase: "start" | "done") => void,
  onAudio: (base64Mp3: string) => void,
  onDone: () => void,
  onError: (err: string) => void,
  onMessageId?: (role: "user" | "assistant", id: number) => void
): Promise<() => void> {
  const abortController = new AbortController();

  (async () => {
    try {
      const headers = await authHeaders();
      const response = await fetch(
        `${API_BASE_URL}/openai/conversations/${conversationId}/voice-messages`,
        {
          method: "POST",
          headers: {
            ...headers,
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          },
          body: JSON.stringify({ audio: audioBase64 }),
          signal: abortController.signal,
        }
      );

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        try {
          const parsed = JSON.parse(text);
          onError(parsed.error || `Hata: ${response.status}`);
        } catch {
          onError(`Hata: ${response.status}`);
        }
        return;
      }

      if (!response.body) {
        onError("Yanıt alınamadı");
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        if (abortController.signal.aborted) break;
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
            const parsed = JSON.parse(data);
            if (parsed.type === "user_transcript") {
              const cleaned = cleanTranscript(String(parsed.data ?? ""));
              if (cleaned && !isHallucinatedTranscript(cleaned)) {
                onUserTranscript(cleaned);
              }
            } else if (parsed.type === "transcript") {
              onTranscript(parsed.data);
            } else if (parsed.type === "audio") {
              onAudio(parsed.data);
            } else if (parsed.type === "tool_call" && parsed.name) {
              onToolCall(parsed.name, "start");
            } else if (parsed.type === "tool_result" && parsed.name) {
              onToolCall(parsed.name, "done");
            } else if (parsed.type === "user_message_id" && typeof parsed.id === "number") {
              onMessageId?.("user", parsed.id);
            } else if (parsed.type === "assistant_message_id" && typeof parsed.id === "number") {
              onMessageId?.("assistant", parsed.id);
            } else if (parsed.done) {
              onDone();
            } else if (parsed.error) {
              onError(parsed.error);
            }
          } catch {}
        }
      }
      onDone();
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        onError(String(err));
      }
    }
  })();

  return () => abortController.abort();
}

export async function playAudioBase64(base64Mp3: string): Promise<void> {
  stopCurrentPlayback();

  const fileUri = (cacheDirectory ?? "") + `voice-response-${Date.now()}.mp3`;
  await writeAsStringAsync(fileUri, base64Mp3, {
    encoding: EncodingType.Base64,
  });

  const { sound } = await Audio.Sound.createAsync({ uri: fileUri });
  currentSound = sound;

  return new Promise<void>((resolve) => {
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        if (currentSound === sound) currentSound = null;
        sound.unloadAsync().catch(() => {});
        deleteAsync(fileUri, { idempotent: true }).catch(() => {});
        resolve();
      }
    });
    sound.playAsync();
  });
}
