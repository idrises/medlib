import {
  classifyTranscriptIntent,
  createSessionGateState,
  shouldCreateResponse,
  cleanTranscript,
} from "../realtimeNoResponseGate";

describe("realtimeNoResponseGate.classifyTranscriptIntent — must IGNORE", () => {
  const cases: Array<[string, string]> = [
    ["Thank you.", "short_farewell"],
    ["Thank you for watching.", "media"],
    ["Bye.", "short_farewell"],
    ["Goodbye.", "short_farewell"],
    ["See you next time!", "media"],
    ["MBC 뉴스 이덕영입니다.", "media"],
    ["지금까지 재택 플러스였습니다.", "media"],
    ["Go to Beadaholique.com for all of your beading supply needs.", "media"],
    ["We'll be back in a minute.", "media"],
    ["We’ll be back in a minute.", "media"],
    ["Yeah.", "short_farewell"],
    ["我們明天見", "foreign_or_media"],
    ["字幕", "foreign_or_media"],
    ["拜拜", "foreign_or_media"],
    ["고맙습니다", "foreign_or_media"],
    ["Please subscribe to my channel.", "media"],
  ];
  for (const [text, label] of cases) {
    test(`${label}: "${text}"`, () => {
      const state = createSessionGateState();
      const r = classifyTranscriptIntent(text, state);
      expect(r.action).toBe("ignore");
      expect(shouldCreateResponse(r)).toBe(false);
    });
  }
});

describe("realtimeNoResponseGate.classifyTranscriptIntent — must RESPOND", () => {
  const cases: string[] = [
    "Beni duyuyor musun?",
    "Derin plan yüz germe ile ilgili kütüphanede ne var?",
    "Burun estetiğiyle ilgili videoları göster.",
    "Ortam sesini dinleme.",
    "Bana nasıl aradığını yaz.",
    "Devam et.",
    "Tekrar dene.",
    "PDF'i aç.",
    "Video dedim, kitap değil.",
    "Hayır, yanlış arıyorsun.",
    "Şu makaleyi oku.",
  ];
  for (const text of cases) {
    test(`responds: "${text}"`, () => {
      const state = createSessionGateState();
      const r = classifyTranscriptIntent(text, state);
      expect(r.action).toBe("respond");
      expect(shouldCreateResponse(r)).toBe(true);
    });
  }
});

describe("realtimeNoResponseGate — ambient mode", () => {
  test("'ortam sesini dinleme' enables ambient mode and is itself a respond", () => {
    const state = createSessionGateState();
    const r = classifyTranscriptIntent("Ortam sesini dinleme lütfen.", state);
    expect(r.action).toBe("respond");
    expect(r.ambientInstruction).toBe(true);
    expect(state.ambientNoiseMode).toBe(true);
  });

  test("'sadece beni dinle' also enables ambient mode", () => {
    const state = createSessionGateState();
    const r = classifyTranscriptIntent("Sadece beni dinle.", state);
    expect(r.action).toBe("respond");
    expect(state.ambientNoiseMode).toBe(true);
  });

  test("after ambient mode, short subtitle/news/farewell fragments stay ignored", () => {
    const state = createSessionGateState();
    classifyTranscriptIntent("Ortam sesini dinleme.", state);
    expect(state.ambientNoiseMode).toBe(true);
    for (const text of ["Thank you.", "Bye.", "MBC 뉴스 이덕영입니다.", "Yeah.", "我們明天見"]) {
      const r = classifyTranscriptIntent(text, state);
      expect(r.action).toBe("ignore");
    }
  });

  test("after ambient mode, a direct medical command still passes", () => {
    const state = createSessionGateState();
    classifyTranscriptIntent("Ortam sesini dinleme.", state);
    const r = classifyTranscriptIntent(
      "Derin plan yüz germe ile ilgili kütüphanede ne var?",
      state,
    );
    expect(r.action).toBe("respond");
    expect(r.reason).toBe("clear_user_task");
  });

  test("after ambient mode, an unrelated chatty sentence with no intent is ignored", () => {
    const state = createSessionGateState();
    classifyTranscriptIntent("Ortam sesini dinleme.", state);
    // Long enough to clear the short-fragment check, but no task/direct cue.
    const r = classifyTranscriptIntent(
      "Bugün hava güzel, denize gitmek istiyorum.",
      state,
    );
    expect(r.action).toBe("ignore");
    expect(r.reason).toBe("ambient_mode_no_intent_signal");
  });
});

describe("realtimeNoResponseGate — cleanTranscript", () => {
  test("strips music brackets and collapses whitespace", () => {
    expect(cleanTranscript("  [Müzik]   Merhaba    ♪  ")).toBe("Merhaba");
  });
  test("empty / null safe", () => {
    expect(cleanTranscript("")).toBe("");
    // @ts-expect-error null tolerated
    expect(cleanTranscript(null)).toBe("");
  });
});

describe("realtimeNoResponseGate — persistence contract", () => {
  // The ai-realtime.tsx wiring calls shouldCreateResponse(decision) *before*
  // appending to UI state and persisting. These tests document the contract:
  // when action==='ignore', the caller must skip both response.create AND
  // persistMsg. We assert the boolean shape the caller depends on.
  test("ignored ambient transcript ⇒ shouldCreateResponse===false", () => {
    const state = createSessionGateState();
    const r = classifyTranscriptIntent("Thank you for watching.", state);
    expect(shouldCreateResponse(r)).toBe(false);
  });
  test("clear user task ⇒ shouldCreateResponse===true", () => {
    const state = createSessionGateState();
    const r = classifyTranscriptIntent("Burun estetiğiyle ilgili videoları göster.", state);
    expect(shouldCreateResponse(r)).toBe(true);
  });
});
