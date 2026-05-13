import { fetch } from "expo/fetch";
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
export async function uploadUserFile(
  uri: string,
  name: string,
  mimeType: string,
): Promise<UserFileDto> {
  const token = await getToken();
  if (!token) throw new Error("Oturum bulunamadı, tekrar giriş yapın.");

  const form = new FormData();
  // React Native's FormData accepts a `{ uri, name, type }` shape that
  // tells the runtime to stream the local file body — no base64 conversion
  // needed even for big PDFs.
  form.append("file", {
    uri,
    name,
    type: mimeType || "application/octet-stream",
  } as unknown as Blob);

  const res = await fetch(`${API_BASE_URL}/files/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form as unknown as BodyInit,
  });
  if (!res.ok) {
    let msg = `Yükleme hatası (${res.status})`;
    try {
      const j = (await res.json()) as { error?: string };
      if (j?.error) msg = j.error;
    } catch {}
    throw new Error(msg);
  }
  return (await res.json()) as UserFileDto;
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
