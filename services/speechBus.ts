import * as Speech from "expo-speech";
import { useEffect, useState } from "react";

let activeId: string | null = null;
const listeners = new Set<(id: string | null) => void>();

function notify() {
  for (const l of listeners) l(activeId);
}

export function speak(id: string, text: string): void {
  if (!text || !text.trim()) return;
  Speech.stop();
  activeId = id;
  notify();
  Speech.speak(text, {
    language: "tr-TR",
    pitch: 1.0,
    rate: 1.0,
    onDone: () => {
      if (activeId === id) {
        activeId = null;
        notify();
      }
    },
    onStopped: () => {
      if (activeId === id) {
        activeId = null;
        notify();
      }
    },
    onError: () => {
      if (activeId === id) {
        activeId = null;
        notify();
      }
    },
  });
}

export function stop(): void {
  Speech.stop();
  activeId = null;
  notify();
}

export function getActiveSpeechId(): string | null {
  return activeId;
}

export function useActiveSpeechId(): string | null {
  const [id, setId] = useState<string | null>(activeId);
  useEffect(() => {
    listeners.add(setId);
    return () => {
      listeners.delete(setId);
    };
  }, []);
  return id;
}
