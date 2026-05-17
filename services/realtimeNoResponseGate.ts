/**
 * Expo/React Native Realtime data-channel no-response gate.
 *
 * The backend session config sets:
 *   turn_detection.create_response = false
 * so the model NEVER auto-responds. The client decides per transcript.
 *
 * The classifier is session-stateful: once the user explicitly says
 * "ortam sesini dinleme" / "sadece beni dinle" / "müzikleri dinleme",
 * we flip `ambientNoiseMode=true` and require a stronger intent signal
 * for the rest of the session.
 */

export type RealtimeDC = { send(data: string): void };

export interface SessionGateState {
  ambientNoiseMode: boolean;
  lastAmbientInstructionAt?: number;
}

export function createSessionGateState(): SessionGateState {
  return { ambientNoiseMode: false };
}

export interface IntentResult {
  action: "respond" | "ignore";
  reason: string;
  confidence: "high" | "medium" | "low";
  cleanedTranscript: string;
  ambientInstruction?: boolean;
}

const MEDIA_NOISE_PATTERNS: RegExp[] = [
  /thank\s+you\s+for\s+watching/iu,
  /thanks\s+for\s+watching/iu,
  /please\s+(?:like\s+and\s+)?subscribe/iu,
  /subscribe\s+(?:to\s+)?(?:my|the|our)\s+channel/iu,
  /go\s+to\s+\S*beadaholique/iu,
  /\bbeadaholique\b/iu,
  /we[''’`]?ll\s+be\s+back/iu,
  /have\s+a\s+good\s+day/iu,
  /see\s+you\s+(?:next\s+time|again|tomorrow|later)/iu,
  /kanal(?:ıma|im(?:a)?)\s+abone/iu,
  /bir\s+sonraki\s+videoda/iu,
  /görüşmek\s+üzere\s*,?\s*hoşça\s*kal/iu,
  /altyaz[ıi]/iu,
  /mbc\s*뉴스/iu,
  /재택\s*플러스/iu,
  /지금까지/iu,
  /字幕|뉴스|拜拜|고맙습니다|알겠습니다|我們明天見|明天見/iu,
];

const SHORT_FAREWELL_PATTERNS: RegExp[] = [
  /^\s*(bye|bye\s*bye|goodbye|see\s*ya|see\s*you|yeah|true|thanks?|thank\s+you|ok|okay|wow|boom)\s*[.!?]*\s*$/iu,
];

const NON_USER_LANG_TOKENS = /[\u3040-\u309f\u30a0-\u30ff\u3400-\u9fff\uac00-\ud7af]/u;

const AMBIENT_INSTRUCTION_PATTERNS: RegExp[] = [
  /ortam\s+ses(?:i|ini)?.*dinleme/iu,
  /uzak(?:taki)?\s+sesleri\s+dinleme/iu,
  /m[üu]zi[kğ]i?.*dinleme/iu,
  /sadece\s+beni\s+dinle/iu,
  /yaln[ıi]z(?:ca)?\s+beni\s+dinle/iu,
  /arka(?:\s+plan(?:daki)?)?\s+sesleri\s+dinleme/iu,
];

const STOP_NOW_PATTERNS: RegExp[] = [
  /\bsus\b/iu,
  /\bbekle\b/iu,
  /\bdur\b/iu,
  /bunu\s+ben\s+söylemedim/iu,
  /sana\s+bir\s+şey\s+sormadım/iu,
];

const CLEAR_TASK_PATTERNS: RegExp[] = [
  /k[üu]t[üu]phane/iu,
  /\bara(?:r\s*m[ıi]s[ıi]n|\b)/iu,
  /listele/iu,
  /\boku\b/iu,
  /\baç\b/iu,
  /sunum|slayt|pptx|powerpoint/iu,
  /makale|pdf|video|dergi|kitap|bölüm/iu,
  /anlat|bilgi\s+ver|özetle|karşılaştır|göster/iu,
  /devam\s+et|tekrar\s+dene|tekrar\s+ara/iu,
  /yanl[ıi][şs]\s+(?:ar[ıi]yorsun|anlad[ıi]n)/iu,
  /video\s+dedim|kitap\s+dedim|makale\s+dedim/iu,
  /nas[ıi]l\s+arad[ıi][ğg][ıi]n[ıi]/iu,
];

const DIRECT_ADDRESS_PATTERNS: RegExp[] = [
  /beni\s+duyuyor\s+musun/iu,
  /duyuyor\s+musun/iu,
  /^\s*hey\b/iu,
  /\b(?:hayır|evet)\b.*\b(?:yanl[ıi][şs]|do[ğg]ru)\b/iu,
];

export function cleanTranscript(input: string): string {
  return String(input ?? "")
    .replace(/[\u0000-\u001f]/g, " ")
    .replace(/[♪♫🎵🎶]+/gu, "")
    .replace(/\s*\[(m[üu]zik|music|applause|alk[ıi]ş|laughter|sound|noise)\]\s*/gi, " ")
    .replace(/\s*\((m[üu]zik|music|applause|alk[ıi]ş|laughter|sound)\)\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function classifyTranscriptIntent(
  transcript: string,
  state: SessionGateState,
): IntentResult {
  const cleaned = cleanTranscript(transcript);
  if (!cleaned) {
    return { action: "ignore", reason: "empty", confidence: "high", cleanedTranscript: cleaned };
  }
  const letters = cleaned.replace(/[^\p{L}]/gu, "");
  if (letters.length < 2) {
    return { action: "ignore", reason: "no_letters", confidence: "high", cleanedTranscript: cleaned };
  }

  // 1) Explicit ambient/stop instructions — respond AND mutate state.
  if (AMBIENT_INSTRUCTION_PATTERNS.some((r) => r.test(cleaned))) {
    state.ambientNoiseMode = true;
    state.lastAmbientInstructionAt = Date.now();
    return {
      action: "respond",
      reason: "ambient_mode_enabled",
      confidence: "high",
      cleanedTranscript: cleaned,
      ambientInstruction: true,
    };
  }
  if (STOP_NOW_PATTERNS.some((r) => r.test(cleaned))) {
    return {
      action: "respond",
      reason: "user_stop_command",
      confidence: "high",
      cleanedTranscript: cleaned,
    };
  }

  // 2) Hard media/subtitle/news noise — ignore regardless of mode.
  if (MEDIA_NOISE_PATTERNS.some((r) => r.test(cleaned))) {
    return { action: "ignore", reason: "media_or_subtitle_phrase", confidence: "high", cleanedTranscript: cleaned };
  }
  if (SHORT_FAREWELL_PATTERNS.some((r) => r.test(cleaned))) {
    return { action: "ignore", reason: "short_farewell_or_filler", confidence: "high", cleanedTranscript: cleaned };
  }

  const hasTask = CLEAR_TASK_PATTERNS.some((r) => r.test(cleaned));
  const hasDirect = DIRECT_ADDRESS_PATTERNS.some((r) => r.test(cleaned));

  // 3) Non-user language fragments (CJK) without any TR intent — ignore.
  if (NON_USER_LANG_TOKENS.test(cleaned) && !hasTask && !hasDirect) {
    return { action: "ignore", reason: "foreign_language_subtitle_fragment", confidence: "high", cleanedTranscript: cleaned };
  }

  const words = cleaned.split(/\s+/).filter(Boolean);

  // 4) Very short utterances without explicit intent — ignore.
  if (words.length <= 2 && !hasTask && !hasDirect) {
    return { action: "ignore", reason: "too_short_without_intent", confidence: "medium", cleanedTranscript: cleaned };
  }

  // 5) Ambient mode — require stronger signal.
  if (state.ambientNoiseMode && !hasTask && !hasDirect) {
    return {
      action: "ignore",
      reason: "ambient_mode_no_intent_signal",
      confidence: "medium",
      cleanedTranscript: cleaned,
    };
  }

  if (hasTask || hasDirect) {
    return { action: "respond", reason: "clear_user_task", confidence: "high", cleanedTranscript: cleaned };
  }

  return { action: "respond", reason: "default_user_utterance", confidence: "low", cleanedTranscript: cleaned };
}

export function shouldCreateResponse(result: IntentResult): boolean {
  return result.action === "respond";
}

// --- Legacy stateless API (kept for backward compatibility) ---------------

export function shouldCreateRealtimeResponse(
  transcript: string,
): { ok: boolean; cleaned: string; reason: string; acknowledgeOnly?: boolean } {
  const state = createSessionGateState();
  const r = classifyTranscriptIntent(transcript, state);
  return {
    ok: r.action === "respond",
    cleaned: r.cleanedTranscript,
    reason: r.reason,
    acknowledgeOnly: r.ambientInstruction || r.reason === "user_stop_command",
  };
}

export function handleRealtimeEvent(event: unknown, dc: RealtimeDC, state?: SessionGateState) {
  const e = event as { type?: string; transcript?: string };
  if (e.type !== "conversation.item.input_audio_transcription.completed") return;
  const s = state ?? createSessionGateState();
  const r = classifyTranscriptIntent(e.transcript ?? "", s);
  if (r.action !== "respond") return;
  dc.send(JSON.stringify({ type: "response.create" }));
}
