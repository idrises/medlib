export type VoiceInputDecision =
  | { action: "respond"; cleaned: string; reason: "clear_user_task" }
  | { action: "listen_only"; cleaned: string; reason: "user_said_wait_or_stop" }
  | { action: "no_response"; cleaned: string; reason: string };

const MEDIA_NOISE_PATTERNS: RegExp[] = [
  /thank\s+you\s+for\s+watching/iu,
  /thanks\s+for\s+watching/iu,
  /subscribe\s+to\s+my\s+channel/iu,
  /kanal(?:ıma|im(?:a)?)\s+abone/iu,
  /bir\s+sonraki\s+videoda/iu,
  /görüşmek\s+üzere\s*,?\s*hoşça\s*kal/iu,
  /we\'?ll\s+be\s+back/iu,
  /have\s+a\s+good\s+day/iu,
  /mbc\s*뉴스/iu,
  /재택\s*플러스/iu,
  /altyaz[ıi]/iu,
  /字幕|뉴스|拜拜|고맙습니다|알겠습니다/iu,
  /^\s*(bye|bye\s*bye|good|yeah|true|thanks?|ok|okay|wow|boom)\s*[.!?]*\s*$/iu,
];

const STOP_LISTEN_PATTERNS: RegExp[] = [
  /ortam\s+ses(?:i|ini).*dinleme/iu,
  /uzak(?:taki)?\s+sesleri\s+dinleme/iu,
  /m[üu]zi[kğ]i?.*dinleme/iu,
  /konuşma\b/iu,
  /sus\b/iu,
  /bekle\b/iu,
  /bunu\s+ben\s+söylemedim/iu,
  /sana\s+bir\s+şey\s+sormadım/iu,
];

const CLEAR_TASK_PATTERNS: RegExp[] = [
  /k[üu]t[üu]phane/iu,
  /ara(?:r\s*m[ıi]s[ıi]n|\b)/iu,
  /listele/iu,
  /oku/iu,
  /aç/iu,
  /sunum/iu,
  /slayt/iu,
  /pptx|powerpoint/iu,
  /makale|pdf|video|dergi|kitap/iu,
  /anlat|bilgi\s+ver|özetle|karşılaştır/iu,
];

export function cleanTranscript(text: string): string {
  return String(text || "")
    .replace(/[\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function classifyVoiceTranscript(transcript: string): VoiceInputDecision {
  const cleaned = cleanTranscript(transcript);
  if (!cleaned) return { action: "no_response", cleaned, reason: "empty" };

  if (STOP_LISTEN_PATTERNS.some((r) => r.test(cleaned))) {
    return { action: "listen_only", cleaned, reason: "user_said_wait_or_stop" };
  }

  if (MEDIA_NOISE_PATTERNS.some((r) => r.test(cleaned))) {
    return { action: "no_response", cleaned, reason: "media_or_background_phrase" };
  }

  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length <= 2 && !CLEAR_TASK_PATTERNS.some((r) => r.test(cleaned))) {
    return { action: "no_response", cleaned, reason: "too_short_without_intent" };
  }

  if (CLEAR_TASK_PATTERNS.some((r) => r.test(cleaned))) {
    return { action: "respond", cleaned, reason: "clear_user_task" };
  }

  // Turkish user usually speaks Turkish; a long English/Korean subtitle-like
  // sentence without MedLib intent is probably media/background.
  const nonTurkishHint = /\b(?:cycling|street|chapter|competition|beadaholique|homie)\b|뉴스|字幕|拜拜/iu.test(cleaned);
  if (nonTurkishHint) return { action: "no_response", cleaned, reason: "non_user_media_like" };

  return { action: "respond", cleaned, reason: "clear_user_task" };
}

export function isHallucinatedTranscript(transcript: string): boolean {
  return classifyVoiceTranscript(transcript).action === "no_response";
}
