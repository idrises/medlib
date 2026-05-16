export interface VerbDisciplineResult {
  text: string;
  flagged: boolean;
  matchedVerbs: string[];
}

const CLAIM_VERBS = [
  "buldum",
  "açtım",
  "okudum",
  "indirdim",
  "hazırladım",
  "ekrana getirdim",
  "kart oluşturdum",
  "kart hazırladım",
  "pdf içeriğine ulaştım",
  "sunum hazır",
  "görseli oluşturdum",
  "grafiği çıkardım",
];

const SAFE_PREFIX =
  "Netleştireyim: Bu turda bunu doğrulayan başarılı bir araç çıktısı olmadığı için önceki iddiayı kesin bilgi gibi almamalısın. ";

export function enforceVerbDiscipline(text: string, toolSuccessThisTurn: boolean): VerbDisciplineResult {
  const original = String(text || "");
  if (toolSuccessThisTurn) return { text: original, flagged: false, matchedVerbs: [] };

  const lower = original.toLocaleLowerCase("tr-TR");
  const matched = CLAIM_VERBS.filter((v) => lower.includes(v));
  if (matched.length === 0) return { text: original, flagged: false, matchedVerbs: [] };

  let safe = original;
  safe = safe.replace(/\b(PDF içeriğine ulaştım|Makalenin PDF içeriğini başarıyla aldım)\b/giu, "PDF içeriğini bu turda doğrulayamadım");
  safe = safe.replace(/\b(kart hazırladım|kart oluşturdum|ekrana getirdim)\b/giu, "kartın gerçekten oluştuğunu bu turda doğrulayamadım");
  safe = safe.replace(/\b(sunum hazır|hazırladım)\b/giu, "çıktının hazır olduğunu bu turda doğrulayamadım");
  safe = safe.replace(/\b(buldum|açtım|okudum|indirdim)\b/giu, "bu turda doğrulayamadım");

  if (!safe.startsWith(SAFE_PREFIX)) safe = SAFE_PREFIX + safe;
  return { text: safe, flagged: true, matchedVerbs: matched };
}
