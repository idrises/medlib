import sharp from "sharp";

export interface SlideSpec {
  title: string;
  subtitle?: string;
  bullets?: string[];
  takeHome?: string;
  imageBase64?: string;
  layout?: "title" | "two_column" | "content" | "image_right";
}

export interface Outline {
  title: string;
  subtitle?: string;
  slides: SlideSpec[];
  references?: string[];
}

export const SLIDE_W = 1600;
export const SLIDE_H = 900;

function esc(s: string): string {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrapText(text: string, maxChars: number): string[] {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = w;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function svgTextBlock(lines: string[], x: number, y: number, opts: { size: number; color?: string; weight?: number; lineGap?: number; maxLines?: number }) {
  const color = opts.color ?? "#111827";
  const lineGap = opts.lineGap ?? Math.round(opts.size * 1.35);
  const max = opts.maxLines ?? lines.length;
  return lines.slice(0, max).map((line, i) => {
    const suffix = i === max - 1 && lines.length > max ? "…" : "";
    return `<text x="${x}" y="${y + i * lineGap}" font-size="${opts.size}" font-weight="${opts.weight ?? 400}" fill="${color}" font-family="Inter, Arial, sans-serif">${esc(line + suffix)}</text>`;
  }).join("\n");
}

function bulletBlock(bullets: string[], x: number, y: number, maxWidthChars: number, size = 34, maxBullets = 6): string {
  let out = "";
  let cy = y;
  for (const b of bullets.slice(0, maxBullets)) {
    const lines = wrapText(b, maxWidthChars);
    out += `<circle cx="${x}" cy="${cy - 10}" r="7" fill="#2563eb"/>`;
    out += svgTextBlock(lines, x + 24, cy, { size, color: "#1f2937", lineGap: Math.round(size * 1.28), maxLines: 3 });
    cy += Math.max(1, Math.min(3, lines.length)) * Math.round(size * 1.28) + 22;
  }
  return out;
}

function placeholderNoseGraphic(x: number, y: number, w: number, h: number): string {
  return `
    <g transform="translate(${x},${y})">
      <rect x="0" y="0" width="${w}" height="${h}" rx="28" fill="#eff6ff" stroke="#bfdbfe" stroke-width="3"/>
      <path d="M ${w*0.55} ${h*0.15} C ${w*0.62} ${h*0.3}, ${w*0.68} ${h*0.42}, ${w*0.66} ${h*0.55} C ${w*0.65} ${h*0.66}, ${w*0.52} ${h*0.69}, ${w*0.44} ${h*0.63}" fill="none" stroke="#1d4ed8" stroke-width="10" stroke-linecap="round"/>
      <path d="M ${w*0.43} ${h*0.62} C ${w*0.36} ${h*0.72}, ${w*0.49} ${h*0.79}, ${w*0.60} ${h*0.72}" fill="none" stroke="#1d4ed8" stroke-width="8" stroke-linecap="round"/>
      <circle cx="${w*0.43}" cy="${h*0.73}" r="12" fill="#1e3a8a" opacity="0.75"/>
      <circle cx="${w*0.58}" cy="${h*0.74}" r="12" fill="#1e3a8a" opacity="0.75"/>
      <text x="${w*0.12}" y="${h*0.9}" font-size="28" fill="#2563eb" font-family="Inter, Arial, sans-serif">Rhinoplasty teaching visual</text>
    </g>`;
}

export function pickDeckTitle(outline: Outline, fallback: string): string {
  return outline.title || outline.slides?.[0]?.title || fallback || "Sunum";
}

export function slideToSvg(params: {
  slide: SlideSpec;
  slideNum: number;
  totalSlides: number;
  deckTitle: string;
  imageBase64?: string;
}): string {
  const { slide, slideNum, totalSlides, deckTitle, imageBase64 } = params;
  const titleLines = wrapText(slide.title, 42);
  const bullets = slide.bullets ?? [];
  const hasImage = Boolean(imageBase64 || slide.imageBase64);
  const img = imageBase64 || slide.imageBase64;

  let body = "";
  if (slide.layout === "title" || slideNum === 1) {
    body += svgTextBlock(titleLines, 110, 270, { size: 64, weight: 800, color: "#0f172a", lineGap: 78, maxLines: 3 });
    if (slide.subtitle) body += svgTextBlock(wrapText(slide.subtitle, 54), 112, 520, { size: 36, color: "#334155", lineGap: 48, maxLines: 3 });
    body += placeholderNoseGraphic(1050, 190, 380, 440);
  } else {
    body += svgTextBlock(titleLines, 86, 92, { size: 52, weight: 800, color: "#0f172a", lineGap: 60, maxLines: 2 });
    const yStart = titleLines.length > 1 ? 220 : 185;
    const textWidthChars = hasImage ? 43 : 72;
    body += bulletBlock(bullets, 110, yStart, textWidthChars, 34, 7);
    if (slide.takeHome) {
      body += `<rect x="86" y="742" width="${hasImage ? 850 : 1420}" height="86" rx="18" fill="#f8fafc" stroke="#cbd5e1"/>`;
      body += svgTextBlock(wrapText(`Ana mesaj: ${slide.takeHome}`, hasImage ? 65 : 100), 118, 793, { size: 28, color: "#0f172a", weight: 600, lineGap: 36, maxLines: 2 });
    }
    if (img) {
      body += `<image href="data:image/png;base64,${img.replace(/^data:image\/\w+;base64,/, "")}" x="1030" y="180" width="450" height="520" preserveAspectRatio="xMidYMid meet"/>`;
    } else if (slide.layout === "image_right" || hasImage) {
      body += placeholderNoseGraphic(1025, 180, 455, 520);
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
  <svg xmlns="http://www.w3.org/2000/svg" width="${SLIDE_W}" height="${SLIDE_H}" viewBox="0 0 ${SLIDE_W} ${SLIDE_H}">
    <rect width="${SLIDE_W}" height="${SLIDE_H}" fill="#ffffff"/>
    <rect x="0" y="0" width="${SLIDE_W}" height="14" fill="#2563eb"/>
    <circle cx="1450" cy="80" r="100" fill="#dbeafe" opacity="0.55"/>
    <circle cx="1510" cy="120" r="60" fill="#bfdbfe" opacity="0.45"/>
    ${body}
    <text x="86" y="870" font-size="22" fill="#64748b" font-family="Inter, Arial, sans-serif">${esc(deckTitle)}</text>
    <text x="1460" y="870" font-size="22" fill="#64748b" font-family="Inter, Arial, sans-serif">${slideNum}/${totalSlides}</text>
  </svg>`;
}

export async function renderSlideToPng(params: Parameters<typeof slideToSvg>[0]): Promise<Buffer> {
  const svg = slideToSvg(params);
  return sharp(Buffer.from(svg)).png().toBuffer();
}

export async function renderSlideToJpeg(params: Parameters<typeof slideToSvg>[0]): Promise<Buffer> {
  const svg = slideToSvg(params);
  return sharp(Buffer.from(svg)).jpeg({ quality: 92 }).toBuffer();
}

export async function renderSlideToDataUri(params: Parameters<typeof slideToSvg>[0]): Promise<string> {
  const png = await renderSlideToPng(params);
  return `data:image/png;base64,${png.toString("base64")}`;
}
