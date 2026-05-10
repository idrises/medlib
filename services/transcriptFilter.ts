const HALLUCINATION_PATTERNS: RegExp[] = [
  /^[\s\p{P}\p{S}]*$/u,
  /^[♪♫🎵🎶]+/u,
  /\b(altyaz[ıi])\b/i,
  /\bsubtitle/i,
  /\bsubs?\s+by\b/i,
  /^\s*\[(m[üu]zik|music|applause|alk[ıi]ş|laughter|g[üu]l[üu]şme|ses|sound|noise)\]\s*$/i,
  /^\s*\((m[üu]zik|music|applause|alk[ıi]ş|laughter|sound)\)\s*$/i,
  /te[şs]ekk[üu]rler\s+izledi[ğg]iniz\s+i[çc]in/i,
  /bir\s+sonraki\s+videoda/i,
  /kanal[ıi]ma\s+abone\s+ol/i,
  /thanks?\s+for\s+watching/i,
  /^\s*you\s*$/i,
  /^\s*thanks?\s*$/i,
];

export function isHallucinatedTranscript(input: string): boolean {
  const t = (input ?? "").trim();
  if (!t) return true;
  if (t.length < 2) return true;
  const letters = t.replace(/[^\p{L}]/gu, "");
  if (letters.length < 2) return true;
  for (const re of HALLUCINATION_PATTERNS) {
    if (re.test(t)) return true;
  }
  return false;
}

export function cleanTranscript(input: string): string {
  return (input ?? "")
    .replace(/[♪♫🎵🎶]+/gu, "")
    .replace(/\s*\[(m[üu]zik|music|applause|alk[ıi]ş|laughter|sound|noise)\]\s*/gi, " ")
    .replace(/\s*\((m[üu]zik|music|applause|alk[ıi]ş|laughter|sound)\)\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}
