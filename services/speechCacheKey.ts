export const SPEECH_CACHE_VOICE = "marin";
export const SPEECH_CACHE_MODEL = "gpt-4o-mini-tts";

export function hashContent(text: string): string {
  let h = 5381 >>> 0;
  for (let i = 0; i < text.length; i++) {
    h = (((h << 5) + h) ^ text.charCodeAt(i)) >>> 0;
  }
  return h.toString(36);
}

export function sanitiseForPath(s: string): string {
  return s.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 64);
}

export function speechCacheKey(
  messageId: string,
  text: string,
  voice: string = SPEECH_CACHE_VOICE,
  model: string = SPEECH_CACHE_MODEL,
): string {
  return `${sanitiseForPath(messageId)}-${hashContent(text)}-${voice}-${model}`;
}
