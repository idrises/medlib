import {
  SPEECH_CACHE_MODEL,
  SPEECH_CACHE_VOICE,
  hashContent,
  sanitiseForPath,
  speechCacheKey,
} from "../speechCacheKey";

describe("speechCacheKey", () => {
  test("defaults to marin / gpt-4o-mini-tts", () => {
    expect(SPEECH_CACHE_VOICE).toBe("marin");
    expect(SPEECH_CACHE_MODEL).toBe("gpt-4o-mini-tts");
  });

  test("same id + same text → identical key (cache hit)", () => {
    const a = speechCacheKey("m1", "Merhaba dünya");
    const b = speechCacheKey("m1", "Merhaba dünya");
    expect(a).toBe(b);
  });

  test("changing message text invalidates cache", () => {
    const a = speechCacheKey("m1", "Merhaba dünya");
    const b = speechCacheKey("m1", "Merhaba dünya.");
    expect(a).not.toBe(b);
  });

  test("changing voice invalidates cache", () => {
    const a = speechCacheKey("m1", "x", "marin", "gpt-4o-mini-tts");
    const b = speechCacheKey("m1", "x", "cedar", "gpt-4o-mini-tts");
    expect(a).not.toBe(b);
  });

  test("changing model invalidates cache", () => {
    const a = speechCacheKey("m1", "x", "marin", "gpt-4o-mini-tts");
    const b = speechCacheKey("m1", "x", "marin", "gpt-4o-tts-2");
    expect(a).not.toBe(b);
  });

  test("different messageIds with same text yield different keys", () => {
    expect(speechCacheKey("m1", "hi")).not.toBe(speechCacheKey("m2", "hi"));
  });

  test("sanitiseForPath strips unsafe chars and caps length", () => {
    expect(sanitiseForPath("../etc/passwd")).toBe("___etc_passwd");
    expect(sanitiseForPath("a".repeat(200)).length).toBe(64);
  });

  test("hashContent stable across calls", () => {
    expect(hashContent("abc")).toBe(hashContent("abc"));
    expect(hashContent("abc")).not.toBe(hashContent("abd"));
  });
});
