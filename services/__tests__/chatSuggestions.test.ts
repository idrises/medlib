import { hasSavedInterests, pickChatSuggestions } from "../chatSuggestions";

describe("pickChatSuggestions", () => {
  it("returns plastic surgery fallback when no interests/file/recent", () => {
    const out = pickChatSuggestions({});
    expect(out).toHaveLength(4);
    expect(out).toEqual(
      expect.arrayContaining([
        "Rinoplasti kaynaklarını tara",
        "Deep plane facelift makalelerini bul",
      ])
    );
    // No generic cardiology/infection defaults.
    expect(out.join(" ")).not.toMatch(/Kardiyo|enfeksiyon/i);
  });

  it("personalizes for rhinoplasty interest", () => {
    const out = pickChatSuggestions({
      memories: [{ key: "interest", value: "Rinoplasti ve revizyon rinoplasti" }],
    });
    expect(out).toHaveLength(4);
    expect(out[0]).toBe("Rinoplasti kaynaklarını tara");
    expect(out).toContain("Revizyon rinoplasti makalelerini bul");
  });

  it("personalizes for facelift / deep plane interest", () => {
    const out = pickChatSuggestions({
      memories: [{ key: "ilgi_alani", value: "yüz germe deep plane" }],
    });
    expect(out).toContain("Deep plane facelift makalelerini bul");
    expect(out).toContain("Deep plane vs SMAS karşılaştır");
  });

  it("personalizes for breast reconstruction interest", () => {
    const out = pickChatSuggestions({
      memories: [{ key: "uzmanlık", value: "meme rekonstrüksiyonu" }],
    });
    expect(out).toContain("DIEP flap yayınlarını ara");
    expect(out).toContain("TRAM vs DIEP karşılaştır");
  });

  it("prefers file actions when an active file is present", () => {
    const out = pickChatSuggestions({
      hasActiveFile: true,
      memories: [{ key: "interest", value: "rinoplasti" }],
    });
    expect(out).toEqual([
      "Son yüklediğim PDF'i özetle",
      "Bu dosyada tablo var mı?",
      "Bu makaleden sunum hazırla",
      "PDF'in ana bulgularını çıkar",
    ]);
  });

  it("uses recent conversation title topic when no interest saved", () => {
    const out = pickChatSuggestions({
      recentTitle: "Septoplasti planlama",
    });
    expect(out[0]).toBe("Septoplasti algoritması çiz");
  });

  it("ignores generic cardiology titles to avoid amplifying off-topic defaults", () => {
    const out = pickChatSuggestions({
      recentTitle: "Kardiyoloji vaka tartışması",
    });
    expect(out).toEqual([
      "Rinoplasti kaynaklarını tara",
      "Deep plane facelift makalelerini bul",
      "Septoplasti algoritması çiz",
      "Skar revizyonu tekniklerini özetle",
    ]);
  });

  it("always returns exactly 4 one-line suggestions", () => {
    const cases = [
      pickChatSuggestions({}),
      pickChatSuggestions({ hasActiveFile: true }),
      pickChatSuggestions({ memories: [{ key: "interest", value: "rinoplasti" }] }),
      pickChatSuggestions({ recentTitle: "Skar revizyonu" }),
    ];
    for (const out of cases) {
      expect(out).toHaveLength(4);
      for (const s of out) {
        expect(s.length).toBeGreaterThan(0);
        expect(s.length).toBeLessThan(60);
        expect(s).not.toMatch(/\n/);
      }
    }
  });
});

describe("hasSavedInterests", () => {
  it("detects interest-shaped memory keys", () => {
    expect(hasSavedInterests([{ key: "interest", value: "x" }])).toBe(true);
    expect(hasSavedInterests([{ key: "ilgi_alani", value: "x" }])).toBe(true);
    expect(hasSavedInterests([{ key: "uzmanlık", value: "x" }])).toBe(true);
  });

  it("returns false for empty or unrelated memories", () => {
    expect(hasSavedInterests([])).toBe(false);
    expect(hasSavedInterests(null)).toBe(false);
    expect(hasSavedInterests([{ key: "name", value: "Ali" }])).toBe(false);
  });
});
