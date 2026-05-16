/**
 * Expo/React Native Realtime data-channel no-response gate.
 * Backend session config must use:
 *   turn_detection.create_response = false
 *
 * Then this client code only sends `response.create` when STT transcript is
 * a real user task. Media subtitles/background noise are ignored.
 */

export type RealtimeDC = { send(data: string): void };

const MEDIA_NOISE_PATTERNS: RegExp[] = [
  /thank\s+you\s+for\s+watching/i,
  /thanks\s+for\s+watching/i,
  /kanal(?:ıma|ima)?\s+abone/i,
  /bir\s+sonraki\s+videoda/i,
  /we\'?ll\s+be\s+back/i,
  /have\s+a\s+good\s+day/i,
  /mbc\s*뉴스/i,
  /뉴스|재택|字幕|拜拜|고맙습니다|알겠습니다/i,
  /^\s*(bye|bye bye|yeah|true|ok|okay|thanks?|wow|boom)\s*[.!?]*\s*$/i,
];

const STOP_PATTERNS = [
  /ortam\s+ses(?:i|ini).*dinleme/i,
  /uzak(?:taki)?\s+sesleri\s+dinleme/i,
  /konuşma\b/i,
  /sus\b/i,
  /bekle\b/i,
  /bunu\s+ben\s+söylemedim/i,
  /sana\s+bir\s+şey\s+sormadım/i,
];

const TASK_PATTERNS = [
  /k[üu]t[üu]phane/i,
  /ara|listele|oku|aç|özetle|anlat/i,
  /makale|pdf|video|dergi|kitap/i,
  /sunum|slayt|pptx|powerpoint/i,
];

function clean(text: string) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

export function shouldCreateRealtimeResponse(transcript: string): { ok: boolean; cleaned: string; reason: string; acknowledgeOnly?: boolean } {
  const cleaned = clean(transcript);
  if (!cleaned) return { ok: false, cleaned, reason: "empty" };
  if (STOP_PATTERNS.some((r) => r.test(cleaned))) return { ok: false, cleaned, reason: "stop_or_background_command", acknowledgeOnly: true };
  if (MEDIA_NOISE_PATTERNS.some((r) => r.test(cleaned))) return { ok: false, cleaned, reason: "media_noise" };
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length <= 2 && !TASK_PATTERNS.some((r) => r.test(cleaned))) return { ok: false, cleaned, reason: "too_short" };
  return { ok: true, cleaned, reason: "clear_user_task" };
}

export function handleRealtimeEvent(event: unknown, dc: RealtimeDC) {
  const e = event as { type?: string; transcript?: string };
  if (e.type !== "conversation.item.input_audio_transcription.completed") return;
  const d = shouldCreateRealtimeResponse(e.transcript ?? "");
  if (!d.ok) {
    if (d.acknowledgeOnly) {
      // Optional: show local UI chip "Tamam" without asking model.
      console.log("Realtime no-response gate:", d.reason, d.cleaned);
    }
    return;
  }
  dc.send(JSON.stringify({ type: "response.create" }));
}
