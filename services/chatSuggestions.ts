export interface SuggestionInput {
  memories?: Array<{ key?: string; value?: string }> | null;
  hasActiveFile?: boolean;
  activeFileName?: string | null;
  recentTitle?: string | null;
}

const FILE_SUGGESTIONS = [
  "Son yüklediğim PDF'i özetle",
  "Bu dosyada tablo var mı?",
  "Bu makaleden sunum hazırla",
  "PDF'in ana bulgularını çıkar",
];

const PLASTIC_FALLBACK = [
  "Rinoplasti kaynaklarını tara",
  "Deep plane facelift makalelerini bul",
  "Septoplasti algoritması çiz",
  "Skar revizyonu tekniklerini özetle",
];

interface TopicRule {
  match: RegExp;
  suggestions: [string, string, string, string];
}

const TOPIC_RULES: TopicRule[] = [
  {
    match: /(rinoplast|rhinoplast|burun estet)/i,
    suggestions: [
      "Rinoplasti kaynaklarını tara",
      "Revizyon rinoplasti makalelerini bul",
      "Preservation rhinoplasty kaynaklarını ara",
      "Rinoplasti komplikasyonlarını özetle",
    ],
  },
  {
    match: /(facelift|yüz germe|yuz germe|deep plane|smas)/i,
    suggestions: [
      "Deep plane facelift makalelerini bul",
      "Deep plane vs SMAS karşılaştır",
      "Facelift komplikasyonlarını tara",
      "Fasiyal sinir riski kaynaklarını bul",
    ],
  },
  {
    match: /(meme|breast|mastekt|diep|tram|flep|flap)/i,
    suggestions: [
      "Meme rekonstrüksiyonu flep kaynaklarını bul",
      "DIEP flap yayınlarını ara",
      "TRAM vs DIEP karşılaştır",
      "Flep komplikasyonlarını özetle",
    ],
  },
  {
    match: /(septoplast|septum)/i,
    suggestions: [
      "Septoplasti algoritması çiz",
      "Septoplasti kaynaklarını tara",
      "Septum perforasyonu yönetimini özetle",
      "Septoplasti komplikasyonlarını bul",
    ],
  },
  {
    match: /(blefarop|göz kapağ|goz kapag|eyelid)/i,
    suggestions: [
      "Blefaroplasti kaynaklarını tara",
      "Üst kapak vs alt kapak tekniklerini karşılaştır",
      "Blefaroplasti komplikasyonlarını özetle",
      "Festoon tedavisi makalelerini bul",
    ],
  },
  {
    match: /(skar|scar|keloid)/i,
    suggestions: [
      "Skar revizyonu tekniklerini özetle",
      "Keloid tedavi kaynaklarını tara",
      "Skar masajı kanıtlarını bul",
      "Z-plasti algoritması çiz",
    ],
  },
];

const NEGATIVE_PATTERNS = /(kardiyo|enfeksiyon|ortoped|nefro|gastro|hematol|onkol|pulmoner|kardiyak)/i;

function topicSuggestionsFor(text: string | null | undefined): string[] | null {
  if (!text) return null;
  for (const rule of TOPIC_RULES) {
    if (rule.match.test(text)) return [...rule.suggestions];
  }
  return null;
}

function interestText(memories: SuggestionInput["memories"]): string {
  if (!memories || memories.length === 0) return "";
  const parts: string[] = [];
  for (const m of memories) {
    const k = (m.key || "").toString();
    const v = (m.value || "").toString();
    if (/interest|ilgi|uzmanlık|uzmanlik|specialt|alan/i.test(k)) {
      parts.push(v);
    }
  }
  // Fall back to scanning every memory value if no explicit interest key.
  if (parts.length === 0) {
    for (const m of memories) parts.push((m.value || "").toString());
  }
  return parts.join(" ");
}

export function hasSavedInterests(memories: SuggestionInput["memories"]): boolean {
  if (!memories || memories.length === 0) return false;
  return memories.some((m) => /interest|ilgi|uzmanlık|uzmanlik|specialt|alan/i.test((m.key || "").toString()));
}

/**
 * Pure, deterministic suggestion picker for the empty-chat state.
 *
 * Priority:
 *  1. Active file → file-action suggestions.
 *  2. Saved interest memory matches a known topic → topic suggestions.
 *  3. Recent conversation title matches a known topic → topic suggestions.
 *  4. Plastic/esthetic surgery fallback (never generic cardiology/etc.).
 *
 * Always returns exactly 4 short, action-oriented strings.
 */
export function pickChatSuggestions(input: SuggestionInput): string[] {
  if (input.hasActiveFile) {
    return [...FILE_SUGGESTIONS];
  }

  const interest = interestText(input.memories);
  const fromInterest = topicSuggestionsFor(interest);
  if (fromInterest) return fromInterest;

  // Recent topic — guard against generic medical titles we don't want to
  // amplify (e.g. "Kardiyoloji sohbeti") unless the user has it as an
  // explicit interest.
  const title = input.recentTitle || "";
  if (title && !NEGATIVE_PATTERNS.test(title)) {
    const fromRecent = topicSuggestionsFor(title);
    if (fromRecent) return fromRecent;
  }

  return [...PLASTIC_FALLBACK];
}
