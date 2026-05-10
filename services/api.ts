import { Platform } from "react-native";

export const API_BASE_URL =
  process.env["EXPO_PUBLIC_API_URL"] ??
  (process.env["EXPO_PUBLIC_DOMAIN"]
    ? `https://${process.env["EXPO_PUBLIC_DOMAIN"]}/api`
    : "https://medical-library-hub.replit.app/api");
const BASE = API_BASE_URL;

export function proxyImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (Platform.OS === "web") {
    return `${BASE}/proxy/image?url=${encodeURIComponent(url)}`;
  }
  return url;
}

async function get<T>(path: string, params?: Record<string, string | number>): Promise<T> {
  const url = new URL(BASE + path);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  }
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

async function authedFetch(path: string, token: string, init: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined),
    Authorization: `Bearer ${token}`,
  };
  if (init.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
  return fetch(BASE + path, { ...init, headers });
}

export interface MessagingSettingsDto {
  configured: boolean;
  whoCanMessage: "everyone" | "contacts" | "nobody";
  showFirstName: boolean;
  showLastName: boolean;
  showSpecialty: boolean;
  showInstitution: boolean;
  nickAlias: string;
  showNickAlias: boolean;
  notifDM: boolean;
  notifGroup: boolean;
  notifShared: boolean;
}

export interface UserSearchResult {
  id: number;
  displayName: string;
  specialty: string | null;
  institution: string | null;
  whoCanMessage: "everyone" | "contacts" | "nobody";
}

export const messagingApi = {
  getSettings: async (token: string): Promise<MessagingSettingsDto> => {
    const r = await authedFetch("/me/messaging-settings", token);
    if (!r.ok) throw new Error(`settings ${r.status}`);
    return r.json();
  },
  updateSettings: async (token: string, s: MessagingSettingsDto): Promise<void> => {
    const r = await authedFetch("/me/messaging-settings", token, {
      method: "PUT",
      body: JSON.stringify(s),
    });
    if (!r.ok) throw new Error(`update ${r.status}`);
  },
  searchUsers: async (token: string, q: string): Promise<UserSearchResult[]> => {
    const r = await authedFetch(`/users/search?q=${encodeURIComponent(q)}`, token);
    if (!r.ok) throw new Error(`search ${r.status}`);
    const data = await r.json();
    return data.users ?? [];
  },
  getBlocked: async (token: string): Promise<{ id: number; displayName: string; specialty: string | null }[]> => {
    const r = await authedFetch("/me/blocked", token);
    if (!r.ok) throw new Error(`blocked ${r.status}`);
    const data = await r.json();
    return data.users ?? [];
  },
  block: async (token: string, userId: number): Promise<void> => {
    const r = await authedFetch("/me/blocked", token, { method: "POST", body: JSON.stringify({ userId }) });
    if (!r.ok) throw new Error(`block ${r.status}`);
  },
  unblock: async (token: string, userId: number): Promise<void> => {
    const r = await authedFetch(`/me/blocked/${userId}`, token, { method: "DELETE" });
    if (!r.ok) throw new Error(`unblock ${r.status}`);
  },
  canSend: async (token: string, recipientId: number, contactIds?: number[]): Promise<{ ok: boolean; reason?: string; message?: string }> => {
    const r = await authedFetch("/messages/can-send", token, {
      method: "POST",
      body: JSON.stringify({ recipientId, contactIds }),
    });
    return r.json();
  },
};

// Privacy preference for the shared "All" activity feed (home > All toggle).
// Mode controls how the user's name appears to other users; alias is required
// only when mode === 'alias'. Server validates length, character set and runs
// a profanity filter — surface the server's `error` string to the user.
export type ActivityNameMode = "initials" | "name" | "alias" | "hidden";
export interface ActivityPrivacyDto {
  mode: ActivityNameMode;
  alias: string;
}
export const activityPrivacyApi = {
  get: async (token: string): Promise<ActivityPrivacyDto> => {
    const r = await authedFetch("/me/activity-privacy", token);
    if (!r.ok) throw new Error(`activity-privacy ${r.status}`);
    return r.json();
  },
  update: async (token: string, dto: ActivityPrivacyDto): Promise<ActivityPrivacyDto> => {
    const r = await authedFetch("/me/activity-privacy", token, {
      method: "PUT",
      body: JSON.stringify(dto),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data?.error ?? `activity-privacy update ${r.status}`);
    return { mode: data.mode, alias: data.alias ?? "" };
  },
};

export interface DmConversation {
  id: string;
  otherUserId: number;
  displayName: string;
  specialty: string | null;
  lastMessageAt: string;
  lastMessagePreview: string;
  unreadCount: number;
}

export interface DmMessage {
  id: string;
  conversationId: string;
  senderId: number;
  body: string;
  contentType: string | null;
  contentRefId: string | null;
  contentTitle: string | null;
  createdAt: string;
  readAt: string | null;
  mine: boolean;
}

export const dmApi = {
  listConversations: async (token: string): Promise<DmConversation[]> => {
    const r = await authedFetch("/me/conversations", token);
    if (!r.ok) throw new Error(`conv ${r.status}`);
    const d = await r.json();
    return d.conversations ?? [];
  },
  listMessages: async (token: string, convId: string, before?: string, limit = 50): Promise<DmMessage[]> => {
    const qs = new URLSearchParams();
    if (before) qs.set("before", before);
    qs.set("limit", String(limit));
    const r = await authedFetch(`/conversations/${convId}/messages?${qs.toString()}`, token);
    if (!r.ok) throw new Error(`msgs ${r.status}`);
    const d = await r.json();
    return d.messages ?? [];
  },
  send: async (token: string, payload: {
    recipientId: number;
    body?: string;
    contentType?: string;
    contentRefId?: string;
    contentTitle?: string;
    contactIds?: number[];
  }): Promise<{ ok: boolean; conversationId: string; message: DmMessage; error?: string }> => {
    const r = await authedFetch("/messages", token, { method: "POST", body: JSON.stringify(payload) });
    const d = await r.json();
    if (!r.ok) return { ok: false, conversationId: "", message: null as any, error: d.error || `send ${r.status}` };
    return d;
  },
  markRead: async (token: string, convId: string): Promise<void> => {
    await authedFetch(`/conversations/${convId}/read`, token, { method: "POST" });
  },
  deleteConversation: async (token: string, convId: string): Promise<void> => {
    const r = await authedFetch(`/conversations/${convId}`, token, { method: "DELETE" });
    if (!r.ok) throw new Error(`del ${r.status}`);
  },
};

export interface GroupSummary {
  id: string;
  slug: string;
  name: string;
  description: string;
  memberCount: number;
  isMember: boolean;
  lastMessage: { id: string; senderId: number; body: string; title: string | null; createdAt: string } | null;
  unreadCount: number;
}

export interface GroupMessage {
  id: string;
  groupId: string;
  senderId: number;
  senderName: string;
  body: string;
  contentType: string | null;
  contentRefId: string | null;
  contentTitle: string | null;
  createdAt: string;
  mine: boolean;
}

export const groupsApi = {
  list: async (token: string): Promise<GroupSummary[]> => {
    const r = await authedFetch("/groups", token);
    if (!r.ok) throw new Error(`groups ${r.status}`);
    const d = await r.json();
    return d.groups ?? [];
  },
  join: async (token: string, gid: string): Promise<void> => {
    const r = await authedFetch(`/groups/${gid}/join`, token, { method: "POST" });
    if (!r.ok) throw new Error(`join ${r.status}`);
  },
  leave: async (token: string, gid: string): Promise<void> => {
    const r = await authedFetch(`/groups/${gid}/leave`, token, { method: "POST" });
    if (!r.ok) throw new Error(`leave ${r.status}`);
  },
  listMessages: async (token: string, gid: string, before?: string, limit = 50): Promise<GroupMessage[]> => {
    const qs = new URLSearchParams();
    if (before) qs.set("before", before);
    qs.set("limit", String(limit));
    const r = await authedFetch(`/groups/${gid}/messages?${qs.toString()}`, token);
    if (!r.ok) throw new Error(`gmsgs ${r.status}`);
    const d = await r.json();
    return d.messages ?? [];
  },
  send: async (token: string, gid: string, payload: {
    body?: string;
    contentType?: string;
    contentRefId?: string;
    contentTitle?: string;
  }): Promise<{ ok: boolean; message: GroupMessage; error?: string }> => {
    const r = await authedFetch(`/groups/${gid}/messages`, token, { method: "POST", body: JSON.stringify(payload) });
    const d = await r.json();
    if (!r.ok) return { ok: false, message: null as any, error: d.error || `send ${r.status}` };
    return d;
  },
  markRead: async (token: string, gid: string): Promise<void> => {
    await authedFetch(`/groups/${gid}/read`, token, { method: "POST" });
  },
};

export interface OpenedPayload {
  contentId: string | number;
  title?: string;
  subtitle?: string;
  detail?: string;
  referencePrimary?: string;
  referenceSecondary?: string;
  referenceTertiary?: string;
  sourceScreen?: string;
  platform?: string;
  appVersion?: string;
  appBuild?: string;
  bookId?: string | number;
}

async function fireOpened(path: string, token: string, payload: OpenedPayload) {
  try {
    await authedFetch(path, token, { method: "POST", body: JSON.stringify(payload) });
  } catch {
    // silent — analytics shouldn't break UX
  }
}

export interface OpenedHistoryItem {
  id: string;
  contentType: string;
  contentId: string;
  title: string;
  subtitle: string;
  timestamp: number;
}

export const openedApi = {
  article: (token: string, p: OpenedPayload) => fireOpened("/opened/article", token, p),
  chapter: (token: string, p: OpenedPayload) => fireOpened("/opened/chapter", token, p),
  video: (token: string, p: OpenedPayload) => fireOpened("/opened/video", token, p),
  videoset: (token: string, p: OpenedPayload) => fireOpened("/opened/videoset", token, p),
  videosetEntry: (token: string, p: OpenedPayload & { parentSetId?: string | number }) =>
    fireOpened("/opened/videoset-entry", token, p as OpenedPayload),
  history: async (token: string, limit = 100): Promise<OpenedHistoryItem[]> => {
    try {
      console.log("[history] calling, tokenLen=", token?.length, "preview=", token?.slice(0, 20));
      const r = await fetch(`${API_BASE_URL}/opened/history?limit=${limit}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const text = await r.text();
      console.log("[history] resp status=", r.status, "body=", text.slice(0, 200));
      if (!r.ok) return [];
      const j = JSON.parse(text);
      return Array.isArray(j?.items) ? j.items : [];
    } catch (e) {
      console.log("[history] error", e);
      return [];
    }
  },
};

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface ApiJournal {
  JournalID: string;
  StableKey: string;
  JournalName: string;
  ISSNPrint: string;
  ISSNElectronic: string;
  Subject: string;
  coverUrl?: string | null;
}

export interface ApiJournalIssue {
  JournalIssueID: string;
  JournalID: string;
  StableKey: string;
  IssueTitle: string;
  YearText: string;
  Volume: string;
  IssueNumber: string;
  SortDateUtc: string;
  imageUrl?: string | null;
}

export interface ApiJournalFull extends ApiJournal {
  issues: ApiJournalIssue[];
}

export interface ApiBook {
  BookID: string;
  StableKey: string;
  Title: string;
  Editors: string;
  Publisher: string;
  YearText: string;
  Subject: string;
  ISBNOnline: string;
  ISBNPrint: string;
  CoverKey: string;
  coverUrl?: string | null;
}

export interface ApiChapter {
  ChapterID: string;
  StableKey: string;
  Title: string;
  Editors: string;
  YearText: string;
  ISBN: string;
  PdfLink: string;
  SizeText: string;
  SortDateUtc: string;
  pdfUrl?: string | null;
}

export interface ApiBookFull extends ApiBook {
  chapters: ApiChapter[];
}

export interface ApiVideoSet {
  VideoSetID: string;
  StableKey: string;
  SetName: string;
  Editors: string;
  Subject: string;
  EntryCount: number;
  coverUrl?: string | null;
}

export interface ApiVideoEntry {
  VideoSetEntryID: string;
  VideoSetID: string;
  StableKey: string;
  Title: string;
  Author: string;
  Editor: string;
  RemoteLink: string;
  ImageLink: string;
  SortDateUtc: string;
  DurationSeconds?: number | null;
  imageUrl?: string | null;
  videoUrl?: string | null;
}

export interface ApiVideoSetFull extends ApiVideoSet {
  entries: ApiVideoEntry[];
}

export interface ApiHomeItem {
  id: string;
  title: string;
  subtitle: string;
  date: string;
  source?: string;
  type: string;
  coverUrl?: string | null;
  imageUrl?: string | null;
  videoUrl?: string | null;
  issueCoverUrl?: string | null;
  journalCoverUrl?: string | null;
  CoverKey?: string;
  ImageLink?: string;
}

export interface ApiHomeResponse {
  latestArticles: ApiHomeItem[];
  latestBooks: ApiHomeItem[];
  latestVideoSets: ApiHomeItem[];
  latestVideos: ApiHomeItem[];
}

export interface ApiArticleListItem {
  ArticleID: string;
  JournalIssueID: string;
  StableKey: string;
  Title: string;
  Author: string;
  DOI: string;
  PdfLink: string;
  SizeText: string;
  SortDateUtc: string;
  IssueTitle?: string;
  JournalName?: string;
  pdfUrl?: string | null;
}

export interface ApiChapterFull extends ApiChapter {
  BookID: string;
  BookTitle: string;
  Publisher: string;
  Subject: string;
  CoverKey?: string;
  bookCoverUrl?: string | null;
  pdfUrl?: string | null;
}

export interface ApiArticle extends ApiArticleListItem {
  IssueTitle: string;
  YearText: string;
  Volume: string;
  IssueNumber: string;
  JournalName: string;
  JournalID: string;
  pdfUrl?: string | null;
}

export interface ApiVideo {
  VideoID: string;
  StableKey: string;
  Title: string;
  Author: string;
  Editor: string;
  BookJournalDisplay: string;
  ISBN: string;
  RemoteLink: string;
  ImageLink: string;
  LikesText: string;
  SortDateUtc: string;
  Subject: string;
  BookID: string;
  BookTitle?: string;
  imageUrl?: string | null;
  videoUrl?: string | null;
}

export interface ApiBookVideoList {
  data: ApiVideo[];
}

export interface ApiSearchResult {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  date: string;
  matchScore?: number;
}

// `/search` returns the same paginated envelope as the rest of the API plus
// the parsed query text and the keywords that were actually searched against.
// Callers (e.g. the Search screen) use `keywords.length` when logging settles.
export interface ApiSearchResponse extends PaginatedResponse<ApiSearchResult> {
  query?: string;
  keywords?: string[];
}

export const api = {
  getJournals: (page = 1, limit = 20, q?: string) =>
    get<PaginatedResponse<ApiJournal>>("/journals", {
      page,
      limit,
      ...(q ? { q } : {}),
    }),

  getJournal: (id: string) => get<ApiJournalFull>(`/journals/${id}`),

  getJournalIssues: (id: string, page = 1, limit = 20) =>
    get<PaginatedResponse<ApiJournalIssue>>(`/journals/${id}/issues`, { page, limit }),

  getBooks: (page = 1, limit = 20, subject?: string, q?: string) =>
    get<PaginatedResponse<ApiBook>>("/books", {
      page,
      limit,
      ...(subject ? { subject } : {}),
      ...(q ? { q } : {}),
    }),

  getBook: (id: string) => get<ApiBookFull>(`/books/${id}`),

  getBookSubjects: () => get<{ data: { label: string; value: string }[] }>("/books/subjects"),

  getVideoSets: (page = 1, limit = 20, q?: string) =>
    get<PaginatedResponse<ApiVideoSet>>("/videosets", {
      page,
      limit,
      ...(q ? { q } : {}),
    }),

  getVideoSet: (id: string) => get<ApiVideoSetFull>(`/videosets/${id}`),

  getHome: () => get<ApiHomeResponse>("/home"),

  getIssueArticles: (issueId: string, page = 1, limit = 50) =>
    get<PaginatedResponse<ApiArticleListItem>>(`/issues/${issueId}/articles`, { page, limit }),

  getArticle: (id: string) => get<ApiArticle>(`/articles/${id}`),

  getChapter: (id: string) => get<ApiChapterFull>(`/chapters/${id}`),

  getVideo: (id: string) => get<ApiVideo>(`/videos/${id}`),

  getVideoSetEntry: (id: string) => get<ApiVideoEntry>(`/videoset-entries/${id}`),

  getBookVideos: (bookId: string) => get<ApiBookVideoList>(`/books/${bookId}/videos`),

  getAllVideos: (page = 1, limit = 20, q?: string, bookId?: string) =>
    get<PaginatedResponse<ApiVideo>>("/videos", {
      page, limit,
      ...(q ? { q } : {}),
      ...(bookId ? { bookId } : {}),
    }),

  getVideoBooks: () => get<{ data: { BookID: string; Title: string; videoCount: number; coverUrl: string | null }[] }>("/videos/books"),

  search: (q: string, type?: string, page = 1, limit = 20) =>
    get<ApiSearchResponse>("/search", {
      q,
      page,
      limit,
      ...(type ? { type } : {}),
    }),

  getPopularSearches: async (limit = 6, days = 30): Promise<string[]> => {
    const res = await get<{ data: { term: string; count: number }[] }>(
      "/search/popular",
      { limit, days }
    );
    return (res.data ?? []).map(r => r.term);
  },

  logSearch: (q: string, resultCount: number, keywordCount: number) =>
    post<{ logged: boolean }>("/search/log", { q, resultCount, keywordCount }),
};
