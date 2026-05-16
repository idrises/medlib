export interface JournalIssueIntent {
  isJournalIssueIntent: boolean;
  journalName?: string;
  volume?: string;
  issue?: string;
  year?: string;
  reason?: string;
}

const VOL_RE = /\b(?:vol(?:ume)?|cilt)\s*\.?\s*(\d{1,4})\b/iu;
const ISSUE_RE = /\b(?:issue|sayı|sayi|no|number|num)\s*\.?\s*(\d{1,4})\b/iu;
const YEAR_RE = /\b(19\d{2}|20\d{2})\b/u;

export function detectJournalIssueIntent(text: string): JournalIssueIntent {
  const q = String(text || "").trim();
  const vol = q.match(VOL_RE)?.[1];
  const issue = q.match(ISSUE_RE)?.[1];
  const year = q.match(YEAR_RE)?.[1];
  if (!vol || !issue) return { isJournalIssueIntent: false };

  const journalCandidate = q
    .replace(VOL_RE, " ")
    .replace(ISSUE_RE, " ")
    .replace(YEAR_RE, " ")
    .replace(/\b(?:makaleleri|makale|listele|oku|özetle|içindeki|sayısındaki|sayisi|sayısı|ekim|ocak|nisan|temmuz|october|january|april|july)\b/giu, " ")
    .replace(/[,:;()\[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    isJournalIssueIntent: true,
    journalName: journalCandidate || undefined,
    volume: vol,
    issue,
    year,
    reason: "Dergi adı + volume/cilt + issue/sayı paterni yakalandı; search_library değil list_journals→get_journal→get_issue kullanılmalı.",
  };
}

export function assertNotJournalIssueSearch(query: string): string | null {
  const intent = detectJournalIssueIntent(query);
  if (!intent.isJournalIssueIntent) return null;
  return JSON.stringify({
    error: "Yanlış araç. Dergi adı + Volume/Issue sorgusunda search_library kullanma.",
    wrong_tool: "search_library",
    correct_chain: ["list_journals()", "get_journal({id})", "get_issue({id})"],
    detected: intent,
  });
}
