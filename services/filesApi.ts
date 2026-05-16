import { fetch } from "expo/fetch";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "./api";

async function getToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem("medlib_auth_token");
  } catch {
    return null;
  }
}

/**
 * Discriminated-union "kind" the server returns for each file (Task #145).
 * - 'Uploaded'   : kuyrukta, henüz çıkarılmadı
 * - 'Extracting' : metin/sayfa çıkarımı sürüyor (DB Status='processing')
 * - 'Extracted'  : metin var, embedding bekliyor
 * - 'Embedding'  : Qdrant'a vektörleniyor
 * - 'Ready'      : arama/sohbet için hazır
 * - 'Failed'     : hata — `lastFailureReason` ile sınıflandırılmış
 * - 'Cancelled'  : kullanıcı veya sistem iptal etti
 * - null         : terminal/tombstone bir satır (deleted/expired)
 */
export type FileStateKind =
  | "Uploaded"
  | "Extracting"
  | "Extracted"
  | "Embedding"
  | "Ready"
  | "Failed"
  | "Cancelled";

export type FileFailureReason =
  | "extract_error"
  | "embed_rate_limit"
  | "embed_quota"
  | "embed_unknown"
  | "storage_missing"
  | "stale"
  | "timeout"
  | "unknown";

/**
 * Task #153 — per-capability sub-status enum. NULL/undefined means
 * "legacy/unknown" — the mobile chip then falls back to the row's
 * Status + ChunkCount + PageCount signals.
 */
export type FileSubStatus =
  | "pending"
  | "ok"
  | "partial"
  | "failed"
  | "not_supported"
  | "not_needed";

export interface FileSubStatuses {
  text: FileSubStatus | null;
  render: FileSubStatus | null;
  ocr: FileSubStatus | null;
  table: FileSubStatus | null;
  figure: FileSubStatus | null;
}

export interface FileCapabilityFlags {
  canSearchText: boolean;
  canRenderPages: boolean;
  canUseVision: boolean;
  canAnswer: boolean;
}

export interface UserFileDto {
  fileId: string;
  name: string;
  mimeType: string;
  magicMime: string | null;
  extension: string | null;
  sizeBytes: number;
  sha256: string;
  /** Eski string status (legacy) — yeni kod yerine `stateKind` kullanmalı. */
  status: string;
  /** Task #145 — state machine kind, veya legacy/tombstone için null. */
  stateKind?: FileStateKind | null;
  /** Task #145 — Failed durumdaki sub-classification. */
  lastFailureReason?: FileFailureReason | string | null;
  /** Task #145 — son hata metni (truncated, server tarafında saklanır). */
  errorMessage?: string | null;
  /** Task #145 — /retry kaç kez tetiklendi. */
  retryCount?: number;
  /** Task #145 — son durum değişimi (ISO). */
  statusChangedAt?: string | null;
  /** Task #145 — server bu satır için /retry butonunu açık ediyor mu. */
  canRetry?: boolean;
  chunkCount: number | null;
  /** Sayfa sayısı — PDF/DOCX/PPTX gibi sayfalı dosyalarda dolar; ingestion bitince ayarlanır. */
  pageCount: number | null;
  uploadedAt: string;
  lastAccessedAt: string;
  /** Task #153 — per-capability sub-statuses (5 eksen). Eski sunucularda gelmez. */
  subStatuses?: FileSubStatuses;
  /** Task #153 — server'da türetilmiş yetenek flag'leri. Eski sunucularda gelmez. */
  flags?: FileCapabilityFlags;
  deduped?: boolean;
}

export interface ListFilesResponse {
  files: UserFileDto[];
  quota: { used: number; total: number };
}

/**
 * Upload a single file to the agent file system. Accepts a local URI
 * (Expo asset URI from DocumentPicker / ImagePicker), the file name,
 * and the declared MIME type. Returns the server-side metadata,
 * including the deterministic per-user dedupe flag.
 */
export interface UploadOptions {
  /** Called with a 0..1 fraction as the multipart body is sent. */
  onProgress?: (fraction: number) => void;
}

export async function uploadUserFile(
  uri: string,
  name: string,
  mimeType: string,
  opts?: UploadOptions,
): Promise<UserFileDto> {
  const token = await getToken();
  if (!token) throw new Error("Oturum bulunamadı, tekrar giriş yapın.");

  // We use plain XMLHttpRequest with FormData here instead of
  // expo-file-system's createUploadTask. The legacy upload task
  // started throwing "Unsupported FormDataPart implementation" on
  // some iOS builds with newer Expo SDKs (notably for PDFs), and the
  // XHR path is the canonical React Native upload pattern: it
  // supports per-byte upload progress on both iOS and Android, and
  // works on web by appending a Blob fetched from the picker URI.
  const url = `${API_BASE_URL}/files/upload`;
  const fd = new FormData();
  fd.append("name", name);
  if (Platform.OS === "web") {
    // Web: turn the picker URI into a Blob so the browser FormData
    // can serialize it. Using a string URI here would just send the
    // URL text as the file part.
    const blob = await (await globalThis.fetch(uri)).blob();
    fd.append("file", blob, name);
  } else {
    // Native (iOS/Android): React Native's FormData accepts the
    // { uri, name, type } object shape directly and streams the
    // file from disk without copying it into JS memory.
    fd.append(
      "file",
      { uri, name, type: mimeType || "application/octet-stream" } as never,
    );
  }

  return await new Promise<UserFileDto>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    if (xhr.upload && opts?.onProgress) {
      xhr.upload.onprogress = (e: ProgressEvent) => {
        if (e.lengthComputable && e.total > 0) {
          opts.onProgress?.(Math.min(1, e.loaded / e.total));
        }
      };
    }
    xhr.onload = () => {
      if (xhr.status >= 400) {
        let msg = `Yükleme hatası (${xhr.status})`;
        try {
          const j = JSON.parse(xhr.responseText) as { error?: string };
          if (j?.error) msg = j.error;
        } catch {}
        reject(new Error(msg));
        return;
      }
      // Snap to 100% on success so the UI doesn't freeze at 99% if
      // the OS coalesces the final progress event with the response.
      opts?.onProgress?.(1);
      try {
        resolve(JSON.parse(xhr.responseText) as UserFileDto);
      } catch {
        reject(new Error("Sunucu yanıtı okunamadı."));
      }
    };
    xhr.onerror = () => reject(new Error("Yükleme başarısız oldu."));
    xhr.ontimeout = () => reject(new Error("Yükleme zaman aşımına uğradı."));
    xhr.send(fd);
  });
}

/**
 * Fetch a single file's metadata. Used by the detail screen and any
 * citation/chip render path that needs more than just the (fileId,
 * fileName) tuple already embedded in the rich_block.
 */
export async function getUserFile(fileId: string): Promise<UserFileDto> {
  const token = await getToken();
  if (!token) throw new Error("Oturum bulunamadı.");
  const res = await fetch(`${API_BASE_URL}/files/${encodeURIComponent(fileId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    if (res.status === 404) throw new Error("Dosya bulunamadı.");
    throw new Error(`Dosya alınamadı (${res.status})`);
  }
  return (await res.json()) as UserFileDto;
}

export interface FilePagePreview {
  fileId: string;
  fileName: string;
  pageNum: number;
  imageDataUrl: string;
  pageText: string;
}

/**
 * Fetch a single rendered page (PNG data URL + text excerpt) for the
 * citation preview modal. Mirrors the server-side agent tool but is
 * exposed over HTTP so the mobile UI can display the cited page.
 */
export async function getFilePage(
  fileId: string,
  pageNum: number,
): Promise<FilePagePreview> {
  const token = await getToken();
  if (!token) throw new Error("Oturum bulunamadı.");
  const res = await fetch(
    `${API_BASE_URL}/files/${encodeURIComponent(fileId)}/page/${pageNum}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) {
    let msg = `Sayfa alınamadı (${res.status})`;
    try {
      const j = (await res.json()) as { error?: string };
      if (j?.error) msg = j.error;
    } catch {}
    throw new Error(msg);
  }
  return (await res.json()) as FilePagePreview;
}

/** Maximum file size enforced client-side before kicking off an upload. */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export interface FilePagesResponse {
  fileId: string;
  pageCount: number;
  pages: { pageNum: number }[];
}

/** List the pages available for a file (currently just count + numbers). */
export async function listFilePages(fileId: string): Promise<FilePagesResponse> {
  const token = await getToken();
  if (!token) throw new Error("Oturum bulunamadı.");
  const res = await fetch(
    `${API_BASE_URL}/files/${encodeURIComponent(fileId)}/pages`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) {
    if (res.status === 404) return { fileId, pageCount: 0, pages: [] };
    throw new Error(`Sayfalar alınamadı (${res.status})`);
  }
  return (await res.json()) as FilePagesResponse;
}

/**
 * Task #161 — ZIP child inventory. Returns per-entry metadata plus
 * aggregate counts so the file detail screen can render a child
 * grid for .zip uploads. Throws on transport / 401 errors; returns
 * `null` on 404 (file isn't a ZIP / has no inventory yet) so the UI
 * can hide the section without an error banner.
 */
export type ZipSkipReason =
  | "unsafe_path"
  | "entry_too_large"
  | "encrypted"
  | "compression_ratio"
  | "total_uncompressed_cap"
  | "entry_count_cap"
  | "open_failed"
  | "stream_error"
  | "nested_zip";

export interface ZipInventoryEntry {
  childIdx: number;
  childFileId: string | null;
  originalPath: string;
  detectedMime: string | null;
  sizeBytes: number;
  compressedBytes: number;
  skippedReason: ZipSkipReason | null;
  skippedLabel: string | null;
  extractedChars: number;
}

export interface ZipInventoryResponse {
  fileId: string;
  fileName: string;
  total: number;
  processed: number;
  skipped: number;
  totalUncompressedBytes: number;
  byMime: Array<{ mime: string; count: number }>;
  bySkipReason: Array<{ reason: ZipSkipReason; label: string; count: number }>;
  entries: ZipInventoryEntry[];
}

export async function getZipInventory(
  fileId: string,
): Promise<ZipInventoryResponse | null> {
  const token = await getToken();
  if (!token) throw new Error("Oturum bulunamadı.");
  const res = await fetch(
    `${API_BASE_URL}/files/${encodeURIComponent(fileId)}/zip-inventory`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`ZIP içeriği alınamadı (${res.status})`);
  return (await res.json()) as ZipInventoryResponse;
}

export async function listUserFiles(): Promise<ListFilesResponse> {
  const token = await getToken();
  if (!token) throw new Error("Oturum bulunamadı.");
  const res = await fetch(`${API_BASE_URL}/files`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Dosyalar listelenemedi (${res.status})`);
  return (await res.json()) as ListFilesResponse;
}

/**
 * Task #145 — `Failed` durumundaki bir dosyayı tekrar dener. Server,
 * `lastFailureReason`'a göre doğru noktadan devam eder (embed_* hataları
 * Extracted'tan, diğerleri Uploaded'dan). 429 = retry sınırı (5) aşıldı.
 */
export async function retryUserFile(fileId: string): Promise<UserFileDto> {
  const token = await getToken();
  if (!token) throw new Error("Oturum bulunamadı.");
  const res = await fetch(
    `${API_BASE_URL}/files/${encodeURIComponent(fileId)}/retry`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (!res.ok) {
    let msg = `Tekrar denenemedi (${res.status})`;
    try {
      const j = (await res.json()) as { error?: string };
      if (j?.error) msg = j.error;
    } catch {}
    throw new Error(msg);
  }
  return (await res.json()) as UserFileDto;
}

export async function deleteUserFile(fileId: string): Promise<void> {
  const token = await getToken();
  if (!token) throw new Error("Oturum bulunamadı.");
  const res = await fetch(`${API_BASE_URL}/files/${fileId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`Dosya silinemedi (${res.status})`);
  }
}
