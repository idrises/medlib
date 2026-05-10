import React from "react";
import { StyleSheet, Text, View, type TextStyle } from "react-native";

import { useColors } from "@/hooks/useColors";

interface Props {
  text: string;
  baseColor?: string;
  baseSize?: number;
}

interface TableBlock { kind: "table"; header: string[]; rows: string[][] }
interface ParaBlock { kind: "para"; text: string }
interface HeadingBlock { kind: "heading"; level: 1 | 2 | 3; text: string }
interface BulletBlock { kind: "bullet"; text: string }
interface NumberedBlock { kind: "numbered"; index: string; text: string }
interface BlankBlock { kind: "blank" }
interface RuleBlock { kind: "rule" }

type Block = TableBlock | ParaBlock | HeadingBlock | BulletBlock | NumberedBlock | BlankBlock | RuleBlock;

function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((c) => c.trim());
}

function isTableSeparator(line: string): boolean {
  const cells = splitTableRow(line);
  if (cells.length < 2) return false;
  return cells.every((c) => /^:?-{2,}:?$/.test(c.trim()));
}

function parseBlocks(input: string): Block[] {
  const lines = input.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === "") {
      blocks.push({ kind: "blank" });
      i++;
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push({ kind: "rule" });
      i++;
      continue;
    }

    // Table: pipe-row + separator on next line
    if (
      trimmed.startsWith("|") &&
      i + 1 < lines.length &&
      isTableSeparator(lines[i + 1])
    ) {
      const header = splitTableRow(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rows.push(splitTableRow(lines[i]));
        i++;
      }
      blocks.push({ kind: "table", header, rows });
      continue;
    }

    const headingMatch = /^(#{1,3})\s+(.*)$/.exec(trimmed);
    if (headingMatch) {
      blocks.push({ kind: "heading", level: headingMatch[1].length as 1 | 2 | 3, text: headingMatch[2] });
      i++;
      continue;
    }

    const bulletMatch = /^[-*+]\s+(.*)$/.exec(trimmed);
    if (bulletMatch) {
      blocks.push({ kind: "bullet", text: bulletMatch[1] });
      i++;
      continue;
    }

    const numberedMatch = /^(\d+)\.\s+(.*)$/.exec(trimmed);
    if (numberedMatch) {
      blocks.push({ kind: "numbered", index: numberedMatch[1], text: numberedMatch[2] });
      i++;
      continue;
    }

    blocks.push({ kind: "para", text: trimmed });
    i++;
  }
  return blocks;
}

interface InlineToken { text: string; bold?: boolean; italic?: boolean; code?: boolean }

function parseInline(input: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let buf = "";
  let bold = false;
  let italic = false;
  let i = 0;
  const flush = () => {
    if (buf) {
      tokens.push({ text: buf, bold, italic });
      buf = "";
    }
  };
  while (i < input.length) {
    const ch = input[i];
    const next = input[i + 1];
    if (ch === "`") {
      flush();
      const end = input.indexOf("`", i + 1);
      if (end === -1) { buf += ch; i++; continue; }
      tokens.push({ text: input.slice(i + 1, end), code: true });
      i = end + 1;
      continue;
    }
    if (ch === "*" && next === "*") {
      flush();
      bold = !bold;
      i += 2;
      continue;
    }
    if (ch === "*" && next !== "*") {
      flush();
      italic = !italic;
      i += 1;
      continue;
    }
    if (ch === "_" && next === "_") {
      flush();
      bold = !bold;
      i += 2;
      continue;
    }
    buf += ch;
    i++;
  }
  flush();
  return tokens;
}

function InlineText({ text, color, size, weight }: { text: string; color: string; size: number; weight?: TextStyle["fontWeight"] }) {
  const tokens = parseInline(text);
  return (
    <Text style={{ color, fontSize: size, lineHeight: Math.round(size * 1.45), fontFamily: weight === "700" ? "Inter_600SemiBold" : "Inter_400Regular" }}>
      {tokens.map((t, idx) => {
        const fontFamily = t.code
          ? "Menlo"
          : t.bold || weight === "700"
          ? "Inter_600SemiBold"
          : t.italic
          ? "Inter_400Regular"
          : "Inter_400Regular";
        return (
          <Text
            key={idx}
            style={{
              fontFamily,
              fontStyle: t.italic ? "italic" : "normal",
              backgroundColor: t.code ? "rgba(127,127,127,0.15)" : undefined,
            }}
          >
            {t.text}
          </Text>
        );
      })}
    </Text>
  );
}

export default function MarkdownText({ text, baseColor, baseSize = 14 }: Props) {
  const colors = useColors();
  const color = baseColor ?? colors.foreground;
  if (!text) return null;
  const blocks = parseBlocks(text);

  return (
    <View>
      {blocks.map((b, idx) => {
        if (b.kind === "blank") return <View key={idx} style={{ height: 6 }} />;
        if (b.kind === "rule")
          return <View key={idx} style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: 8 }} />;
        if (b.kind === "heading") {
          const sizes = { 1: baseSize + 6, 2: baseSize + 4, 3: baseSize + 2 } as const;
          return (
            <View key={idx} style={{ marginTop: idx === 0 ? 0 : 8, marginBottom: 4 }}>
              <InlineText text={b.text} color={color} size={sizes[b.level]} weight="700" />
            </View>
          );
        }
        if (b.kind === "bullet") {
          return (
            <View key={idx} style={styles.listRow}>
              <Text style={{ color, fontSize: baseSize, lineHeight: Math.round(baseSize * 1.45) }}>{"• "}</Text>
              <View style={{ flex: 1 }}>
                <InlineText text={b.text} color={color} size={baseSize} />
              </View>
            </View>
          );
        }
        if (b.kind === "numbered") {
          return (
            <View key={idx} style={styles.listRow}>
              <Text style={{ color, fontSize: baseSize, lineHeight: Math.round(baseSize * 1.45), minWidth: 20 }}>{`${b.index}. `}</Text>
              <View style={{ flex: 1 }}>
                <InlineText text={b.text} color={color} size={baseSize} />
              </View>
            </View>
          );
        }
        if (b.kind === "table") {
          return <MarkdownTable key={idx} block={b} color={color} baseSize={baseSize} />;
        }
        return (
          <View key={idx} style={{ marginTop: idx === 0 ? 0 : 2 }}>
            <InlineText text={b.text} color={color} size={baseSize} />
          </View>
        );
      })}
    </View>
  );
}

function MarkdownTable({ block, color, baseSize }: { block: TableBlock; color: string; baseSize: number }) {
  const colors = useColors();
  const cols = Math.max(block.header.length, ...block.rows.map((r) => r.length));
  const colWidths = new Array(cols).fill(1);
  return (
    <View style={[styles.tableWrap, { borderColor: colors.border, marginVertical: 8 }]}>
      <View style={[styles.tableRow, { backgroundColor: colors.secondary, borderBottomColor: colors.border }]}>
        {Array.from({ length: cols }).map((_, ci) => (
          <View key={ci} style={[styles.tableCell, { flex: colWidths[ci], borderRightColor: colors.border, borderRightWidth: ci < cols - 1 ? StyleSheet.hairlineWidth : 0 }]}>
            <InlineText text={block.header[ci] ?? ""} color={color} size={baseSize - 1} weight="700" />
          </View>
        ))}
      </View>
      {block.rows.map((row, ri) => (
        <View
          key={ri}
          style={[
            styles.tableRow,
            { borderBottomColor: colors.border, borderBottomWidth: ri < block.rows.length - 1 ? StyleSheet.hairlineWidth : 0 },
          ]}
        >
          {Array.from({ length: cols }).map((_, ci) => (
            <View key={ci} style={[styles.tableCell, { flex: colWidths[ci], borderRightColor: colors.border, borderRightWidth: ci < cols - 1 ? StyleSheet.hairlineWidth : 0 }]}>
              <InlineText text={row[ci] ?? ""} color={color} size={baseSize - 1} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  listRow: { flexDirection: "row", alignItems: "flex-start", marginTop: 2 },
  tableWrap: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, overflow: "hidden" },
  tableRow: { flexDirection: "row", alignItems: "stretch" },
  tableCell: { paddingHorizontal: 8, paddingVertical: 6, justifyContent: "center" },
});
