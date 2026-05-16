export type QueryVariantMode = "original" | "translation" | "exact_phrase" | "and_terms" | "synonym" | "related";

export interface QueryVariant {
  query: string;
  mode: QueryVariantMode;
  weight: number;
}

export interface MedicalQueryExpansion {
  original: string;
  variants: QueryVariant[];
  allVariants: string[];
  debug: string;
}

const DICTIONARY: Array<{ triggers: RegExp[]; variants: QueryVariant[] }> = [
  {
    triggers: [/burun\s*esteti[ğg]i/i, /rinoplasti/i, /rino\s*plasti/i, /rhinoplas/i],
    variants: [
      { query: "rhinoplasty", mode: "translation", weight: 1.0 },
      { query: "septorhinoplasty", mode: "synonym", weight: 0.9 },
      { query: "revision rhinoplasty", mode: "related", weight: 0.85 },
      { query: "functional rhinoplasty", mode: "related", weight: 0.8 },
      { query: "preservation rhinoplasty", mode: "related", weight: 0.75 },
      { query: "nasal tip rhinoplasty", mode: "related", weight: 0.7 },
      { query: "nasal valve rhinoplasty", mode: "related", weight: 0.7 },
    ],
  },
  {
    triggers: [/derin\s*plan\s*y[üu]z\s*germe/i, /deep\s*plane\s*face\s*lift/i, /deep\s*plane\s*facelift/i, /y[üu]z\s*germe/i],
    variants: [
      { query: "deep plane facelift", mode: "translation", weight: 1.0 },
      { query: "\"deep plane facelift\"", mode: "exact_phrase", weight: 1.0 },
      { query: "deep AND plane AND facelift", mode: "and_terms", weight: 0.98 },
      { query: "deep plane rhytidectomy", mode: "synonym", weight: 0.9 },
      { query: "\"deep plane rhytidectomy\"", mode: "exact_phrase", weight: 0.9 },
      { query: "extended deep plane facelift", mode: "synonym", weight: 0.85 },
      { query: "SMAS retaining ligaments facelift", mode: "related", weight: 0.75 },
      { query: "facelift retaining ligaments", mode: "related", weight: 0.7 },
    ],
  },
  {
    triggers: [/skar\s*revizyon/i, /scar\s*revision/i, /yara\s*izi/i],
    variants: [
      { query: "scar revision", mode: "translation", weight: 1.0 },
      { query: "Z-plasty W-plasty geometric broken line closure", mode: "related", weight: 0.9 },
      { query: "hypertrophic scar keloid revision", mode: "related", weight: 0.8 },
    ],
  },
  {
    triggers: [/septoplasti/i, /septoplasty/i, /septal\s*deviation/i],
    variants: [
      { query: "septoplasty", mode: "translation", weight: 1.0 },
      { query: "septal deviation", mode: "related", weight: 0.85 },
      { query: "nasal airway obstruction septoplasty", mode: "related", weight: 0.8 },
      { query: "septoplasty complications", mode: "related", weight: 0.75 },
    ],
  },
];

function normalizeQuery(q: string): string {
  return q
    .replace(/[“”]/g, "\"")
    .replace(/[’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupe<T>(items: T[], key: (x: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const k = key(item).toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

function phraseVariants(q: string): QueryVariant[] {
  const clean = normalizeQuery(q);
  const tokenish = clean.replace(/["']/g, "").split(/\s+/).filter(Boolean);
  if (tokenish.length < 2 || tokenish.length > 6) return [];
  const hasNonAscii = /[ğüşöçıİĞÜŞÖÇ]/i.test(clean);
  if (hasNonAscii) return [];
  return [
    { query: `\"${tokenish.join(" ")}\"`, mode: "exact_phrase", weight: 0.85 },
    { query: tokenish.join(" AND "), mode: "and_terms", weight: 0.82 },
  ];
}

export function expandMedicalQuery(input: string, maxVariants = 8): MedicalQueryExpansion {
  const original = normalizeQuery(input);
  const variants: QueryVariant[] = [];
  variants.push({ query: original, mode: "original", weight: 0.6 });

  for (const entry of DICTIONARY) {
    if (entry.triggers.some((r) => r.test(original))) {
      variants.push(...entry.variants);
    }
  }
  variants.push(...phraseVariants(original));

  const unique = dedupe(variants, (v) => v.query)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, Math.max(1, maxVariants));

  const allVariants = unique.map((v) => v.query);
  return {
    original,
    variants: unique,
    allVariants,
    debug: `Şu terimlerle aradım: ${allVariants.join(", ")}.`,
  };
}
