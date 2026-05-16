export type SourceScope =
  | "catalog_metadata"
  | "kb_index"
  | "ftp_pdf"
  | "user_files"
  | "thread_memory"
  | "external_pubmed"
  | "external_web"
  | "generated"
  | "error";

export type ToolConfidence = "high" | "medium" | "low";

export interface ToolResultMeta {
  source_scope: SourceScope;
  result_type: string;
  count_total?: number | null;
  count_returned?: number | null;
  is_limited?: boolean;
  limit?: number | null;
  offset?: number | null;
  can_read_full_text?: boolean;
  pdf_extraction_status?: "ok" | "partial" | "failed" | "not_indexed" | null;
  confidence?: ToolConfidence;
  expanded_queries?: string[];
  note?: string;
}

export interface ToolEnvelope<T extends Record<string, unknown> = Record<string, unknown>> {
  _meta: Required<Pick<ToolResultMeta, "source_scope" | "result_type" | "is_limited" | "can_read_full_text" | "confidence">> & Omit<ToolResultMeta, "source_scope" | "result_type" | "is_limited" | "can_read_full_text" | "confidence">;
  [key: string]: unknown;
}

function normalizeMeta(meta: ToolResultMeta): ToolEnvelope["_meta"] {
  return {
    source_scope: meta.source_scope,
    result_type: meta.result_type,
    count_total: meta.count_total ?? null,
    count_returned: meta.count_returned ?? null,
    is_limited: meta.is_limited ?? false,
    limit: meta.limit ?? null,
    offset: meta.offset ?? null,
    can_read_full_text: meta.can_read_full_text ?? false,
    pdf_extraction_status: meta.pdf_extraction_status ?? null,
    confidence: meta.confidence ?? "medium",
    expanded_queries: meta.expanded_queries ?? undefined,
    note: meta.note ?? undefined,
  };
}

export function wrapToolResult<T extends Record<string, unknown>>(meta: ToolResultMeta, payload: T): string {
  return JSON.stringify({ ...payload, _meta: normalizeMeta(meta) });
}

export function wrapToolError(tool: string, message: string, extra: Record<string, unknown> = {}): string {
  return JSON.stringify({
    error: message,
    tool,
    ...extra,
    _meta: normalizeMeta({
      source_scope: "error",
      result_type: "tool_error",
      count_total: 0,
      count_returned: 0,
      is_limited: false,
      can_read_full_text: false,
      confidence: "low",
      note: message,
    }),
  });
}

export function parseToolEnvelope(raw: string): ToolEnvelope | null {
  try {
    const parsed = JSON.parse(raw) as ToolEnvelope;
    if (!parsed || typeof parsed !== "object" || !parsed._meta) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function toolCallSucceeded(raw: string): boolean {
  const parsed = parseToolEnvelope(raw);
  if (!parsed) return !/"error"\s*:/.test(raw);
  if (parsed._meta.source_scope === "error") return false;
  if ("error" in parsed && parsed.error) return false;
  return true;
}
