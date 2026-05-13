import { fetch } from "expo/fetch";
import * as FileSystem from "expo-file-system/legacy";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "./api";

async function getToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem("medlib_auth_token");
  } catch {
    return null;
  }
}

export interface UserFileDto {
  fileId: string;
  name: string;
  mimeType: string;
  magicMime: string | null;
  extension: string | null;
  sizeBytes: number;
  sha256: string;
  status: string;
  chunkCount: number | null;
  uploadedAt: string;
  lastAccessedAt: string;
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

  // Use Expo's native upload task so we get real per-byte progress
  // events. `expo/fetch` and the global FormData do not surface
  // upload progress on React Native, so the chip would otherwise be
  // stuck on an indeterminate spinner for big PDFs.
  const task = FileSystem.createUploadTask(
    `${API_BASE_URL}/files/upload`,
    uri,
    {
      httpMethod: "POST",
      headers: { Authorization: `Bearer ${token}` },
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: "file",
      mimeType: mimeType || "application/octet-stream",
      parameters: { name },
    },
    (data) => {
      const sent = data.totalBytesSent ?? 0;
      const total = data.totalBytesExpectedToSend ?? 0;
      if (total > 0 && opts?.onProgress) {
        opts.onProgress(Math.min(1, sent / total));
      }
    },
  );

  const result = await task.uploadAsync();
  if (!result) throw new Error("Yükleme başarısız oldu.");
  if (result.status >= 400) {
    let msg = `Yükleme hatası (${result.status})`;
    try {
      const j = JSON.parse(result.body) as { error?: string };
      if (j?.error) msg = j.error;
    } catch {}
    throw new Error(msg);
  }
  // Mark 100% on success so the UI doesn't end at 99% if the OS
  // batches the final progress event with the response.
  opts?.onProgress?.(1);
  try {
    return JSON.parse(result.body) as UserFileDto;
  } catch {
    throw new Error("Sunucu yanıtı okunamadı.");
  }
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

export async function listUserFiles(): Promise<ListFilesResponse> {
  const token = await getToken();
  if (!token) throw new Error("Oturum bulunamadı.");
  const res = await fetch(`${API_BASE_URL}/files`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Dosyalar listelenemedi (${res.status})`);
  return (await res.json()) as ListFilesResponse;
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
