const TRAILING_MENU_PATTERNS: RegExp[] = [
  /\n+\s*(?:İstersen|Dilersen|İsterseniz|Dilerseniz)\b[\s\S]{0,700}$/iu,
  /\n+\s*(?:Bir sonraki adımda|Sonraki adımda)\b[\s\S]{0,700}$/iu,
  /\n+\s*(?:Hangisini istersin|Hangisini istersiniz|Nasıl devam edelim)\??\s*$/iu,
  /\n+\s*(?:Seçenekler|Şunlardan birini seç)\s*[:：][\s\S]{0,700}$/iu,
];

export function stripTrailingMenu(text: string): string {
  let out = String(text || "").trimEnd();
  for (let i = 0; i < 3; i++) {
    const before = out;
    for (const pattern of TRAILING_MENU_PATTERNS) out = out.replace(pattern, "").trimEnd();
    if (out === before) break;
  }
  return out;
}

export function suppressDuplicateSentences(text: string): string {
  const sentences = String(text || "").split(/(?<=[.!?。！？])\s+/u);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of sentences) {
    const key = s.toLowerCase().replace(/\s+/g, " ").replace(/[.!?。！？]+$/u, "").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out.join(" ").trim();
}
