import { classifyVoiceTranscript } from "./voiceInputGate.js";

export function isVoiceNoiseInput(text: string): { isNoise: boolean; reason: string } {
  const d = classifyVoiceTranscript(text);
  return { isNoise: d.action === "no_response", reason: d.reason };
}

export function capVoiceResponseLength(text: string, maxSentences = 5, maxChars = 800): string {
  const raw = String(text || "").trim();
  if (raw.length <= maxChars) return raw;
  const sentences = raw.split(/(?<=[.!?。！？])\s+/u).filter(Boolean);
  const capped = sentences.slice(0, maxSentences).join(" ").trim();
  if (capped && capped.length <= maxChars) return capped;
  return raw.slice(0, maxChars - 1).trimEnd() + "…";
}

export function shouldSpeakLongContent(text: string): boolean {
  return /seslendir|tek tek oku|uzun anlat|detaylı anlat/iu.test(text);
}

export function voiceCardOnlyLine(kind: string): string {
  return `${kind} ekrana geldi. Uzun listeyi okumuyorum; istediğin numarayı söyle.`;
}
