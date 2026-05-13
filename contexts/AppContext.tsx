import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { API_BASE_URL, dmApi, DmConversation, DmMessage, groupsApi, GroupSummary, GroupMessage } from "@/services/api";

export type ContentType = "article" | "chapter" | "video" | "videoset_video" | "book" | "journal" | "videoset";

export interface ActivityItem {
  id: string;
  contentType: ContentType;
  contentId: string;
  title: string;
  subtitle?: string;
  timestamp: number;
  thumbnailType?: string;
}

export interface VideoProgress {
  videoId: string;
  progress: number;
  duration: number;
  completed: boolean;
  timestamp: number;
}

export interface LikedItem {
  id: string;
  contentType: ContentType;
  contentId: string;
  title: string;
  subtitle?: string;
  timestamp: number;
}

export interface BookmarkedItem {
  id: string;
  contentType: ContentType;
  contentId: string;
  title: string;
  subtitle?: string;
  timestamp: number;
}

export interface Download {
  id: string;
  contentType: ContentType;
  contentId: string;
  title: string;
  subtitle?: string;
  progress: number;
  status: "downloading" | "paused" | "completed";
  timestamp: number;
}

export interface DownloadedVideo {
  videoId: string;
  kind?: "book" | "entry";
  title: string;
  localUri: string;
  size: number;
  timestamp: number;
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  text?: string;
  sharedContent?: {
    contentType: ContentType;
    contentId: string;
    title: string;
    subtitle?: string;
    pdfUrl?: string;
  };
  timestamp: number;
  conversationId: string;
}

export interface Conversation {
  id: string;
  type: "private" | "public";
  groupName?: string;
  description?: string;
  participants: string[];
  participantNames: string[];
  lastMessage?: Message;
  unreadCount: number;
  timestamp: number;
}

const CURRENT_USER_ID = "user_me";
const CURRENT_USER_NAME = "Dr. Ahmet Yılmaz";

interface AppContextType {
  currentUserId: string;
  currentUserName: string;

  activities: ActivityItem[];
  activitiesTotal: number;
  addActivity: (item: Omit<ActivityItem, "id" | "timestamp">) => void;

  videoProgresses: Record<string, VideoProgress>;
  updateVideoProgress: (videoId: string, progress: number, duration: number) => void;
  getVideoProgress: (videoId: string) => VideoProgress | undefined;

  likedItems: LikedItem[];
  toggleLike: (item: Omit<LikedItem, "id" | "timestamp">) => void;
  isLiked: (contentType: ContentType, contentId: string) => boolean;

  bookmarkedItems: BookmarkedItem[];
  toggleBookmark: (item: Omit<BookmarkedItem, "id" | "timestamp">) => void;
  isBookmarked: (contentType: ContentType, contentId: string) => boolean;

  downloads: Download[];
  pauseDownload: (contentId: string) => void;
  resumeDownload: (contentId: string) => void;
  deleteDownload: (contentId: string) => void;
  getDownload: (contentId: string) => Download | undefined;
  isDownloadComplete: (contentId: string) => boolean;

  downloadedVideos: DownloadedVideo[];
  addDownload: (video: DownloadedVideo) => void;
  removeDownload: (videoId: string) => void;
  isDownloaded: (videoId: string) => boolean;

  conversations: Conversation[];
  loadDmConversations: () => Promise<void>;
  loadDmMessages: (conversationId: string) => Promise<void>;
  sendDm: (conversationId: string, body: string, sharedContent?: Message["sharedContent"]) => Promise<{ ok: boolean; error?: string }>;
  startDmAndSend: (recipientId: number, body: string) => Promise<{ ok: boolean; conversationId?: string; error?: string }>;
  markDmRead: (conversationId: string) => Promise<void>;
  groups: GroupSummary[];
  loadGroups: () => Promise<void>;
  joinGroup: (groupId: string) => Promise<void>;
  leaveGroup: (groupId: string) => Promise<void>;
  loadGroupMessages: (conversationId: string) => Promise<void>;
  sendGroupMessage: (conversationId: string, body: string, sharedContent?: Message["sharedContent"]) => Promise<{ ok: boolean; error?: string }>;
  markGroupRead: (conversationId: string) => Promise<void>;
  messages: Record<string, Message[]>;
  sendMessage: (conversationId: string, text: string, sharedContent?: Message["sharedContent"]) => void;
  createConversation: (participantId: string, participantName: string) => string;
  createGroup: (groupName: string, participantIds: string[], participantNames: string[]) => string;
  markConversationRead: (conversationId: string) => void;
  deleteConversation: (conversationId: string) => void;
  deleteMessage: (conversationId: string, messageId: string) => void;
  getTotalUnread: () => number;
}

const AppContext = createContext<AppContextType | null>(null);

const STORAGE_KEYS = {
  ACTIVITIES: "@medlib/activities",
  VIDEO_PROGRESSES: "@medlib/video_progresses",
  LIKED_ITEMS: "@medlib/liked_items",
  BOOKMARKED_ITEMS: "@medlib/bookmarked_items",
  DOWNLOADS: "@medlib/downloads_v2",
  DOWNLOADED_VIDEOS: "@medlib/downloaded_videos",
  PRIVATE_CONVERSATIONS: "@medlib/private_conversations",
  MESSAGES: "@medlib/messages",
  GROUP_UNREAD: "@medlib/group_unread",
};

function genId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

const ALL_DOCTORS = ["user_2", "user_3", "user_4", "user_5", "user_6", "user_7"];
const ALL_DOCTOR_NAMES = ["Dr. Zeynep Kaya", "Prof. Murat Demir", "Dr. Elif Şahin", "Dr. Can Öztürk", "Prof. Ali Yıldız", "Dr. Selin Arslan"];

const PUBLIC_CHANNELS: Omit<Conversation, "unreadCount" | "lastMessage"> [] = [
  {
    id: "channel_1",
    type: "public",
    groupName: "Rhinoplasty",
    description: "Primary & revision nasal surgery",
    participants: [CURRENT_USER_ID, ...ALL_DOCTORS],
    participantNames: [CURRENT_USER_NAME, ...ALL_DOCTOR_NAMES],
    timestamp: Date.now() - 1800000,
  },
  {
    id: "channel_2",
    type: "public",
    groupName: "Breast Surgery",
    description: "Augmentation, lift, reduction, revisions",
    participants: [CURRENT_USER_ID, ...ALL_DOCTORS],
    participantNames: [CURRENT_USER_NAME, ...ALL_DOCTOR_NAMES],
    timestamp: Date.now() - 86400000,
  },
  {
    id: "channel_3",
    type: "public",
    groupName: "Facelift & Facial Surgery",
    description: "Deep plane facelift, neck lift, midface & temporal lift",
    participants: [CURRENT_USER_ID, ...ALL_DOCTORS],
    participantNames: [CURRENT_USER_NAME, ...ALL_DOCTOR_NAMES],
    timestamp: Date.now() - 172800000,
  },
  {
    id: "channel_4",
    type: "public",
    groupName: "Periorbital Surgery",
    description: "Upper/lower blepharoplasty, brow lift",
    participants: [CURRENT_USER_ID, ...ALL_DOCTORS],
    participantNames: [CURRENT_USER_NAME, ...ALL_DOCTOR_NAMES],
    timestamp: Date.now() - 259200000,
  },
  {
    id: "channel_5",
    type: "public",
    groupName: "Perioral & Chin Surgery",
    description: "Lip lift, chin & jawline procedures",
    participants: [CURRENT_USER_ID, ...ALL_DOCTORS],
    participantNames: [CURRENT_USER_NAME, ...ALL_DOCTOR_NAMES],
    timestamp: Date.now() - 345600000,
  },
  {
    id: "channel_6",
    type: "public",
    groupName: "Body Contouring",
    description: "Liposuction, abdominoplasty, BBL",
    participants: [CURRENT_USER_ID, ...ALL_DOCTORS],
    participantNames: [CURRENT_USER_NAME, ...ALL_DOCTOR_NAMES],
    timestamp: Date.now() - 432000000,
  },
  {
    id: "channel_7",
    type: "public",
    groupName: "Arm & Thigh Surgery",
    description: "Arm lift, thigh lift",
    participants: [CURRENT_USER_ID, ...ALL_DOCTORS],
    participantNames: [CURRENT_USER_NAME, ...ALL_DOCTOR_NAMES],
    timestamp: Date.now() - 518400000,
  },
  {
    id: "channel_8",
    type: "public",
    groupName: "Male Aesthetic Surgery",
    description: "Gynecomastia, male face & body procedures",
    participants: [CURRENT_USER_ID, ...ALL_DOCTORS],
    participantNames: [CURRENT_USER_NAME, ...ALL_DOCTOR_NAMES],
    timestamp: Date.now() - 604800000,
  },
  {
    id: "channel_9",
    type: "public",
    groupName: "Revision Surgery",
    description: "Secondary & corrective procedures (all areas)",
    participants: [CURRENT_USER_ID, ...ALL_DOCTORS],
    participantNames: [CURRENT_USER_NAME, ...ALL_DOCTOR_NAMES],
    timestamp: Date.now() - 691200000,
  },
];

const SAMPLE_CHANNEL_MESSAGES: Record<string, Message[]> = {};

const SAMPLE_PRIVATE_CONVERSATIONS: Conversation[] = [];

const LEGACY_SEED_CONV_IDS = new Set(["conv_1", "conv_2"]);

const SAMPLE_PRIVATE_MESSAGES: Record<string, Message[]> = {};

const _UNUSED_LEGACY_SAMPLE: Record<string, Message[]> = {
  conv_1: [
    {
      id: "msg_1",
      senderId: "user_2",
      senderName: "Dr. Zeynep Kaya",
      text: "Bu makaleyi gördün mü? Çok ilginç bulgular var.",
      timestamp: Date.now() - 7200000,
      conversationId: "conv_1",
      sharedContent: {
        contentType: "article",
        contentId: "art_1",
        title: "Rhinoplasty Outcomes in 500 Patients",
        subtitle: "Plastic & Reconstructive Surgery, Vol. 12",
      },
    },
    {
      id: "msg_2",
      senderId: "user_2",
      senderName: "Dr. Zeynep Kaya",
      text: "Özellikle revision rhinoplasty bölümü çok faydalı.",
      timestamp: Date.now() - 3600000,
      conversationId: "conv_1",
    },
  ],
  conv_2: [
    {
      id: "msg_3",
      senderId: "user_3",
      senderName: "Prof. Murat Demir",
      text: "Rhinoplasty kurs videolarını izledin mi?",
      timestamp: Date.now() - 90000000,
      conversationId: "conv_2",
    },
    {
      id: "msg_4",
      senderId: CURRENT_USER_ID,
      senderName: CURRENT_USER_NAME,
      text: "Evet, harika içerik!",
      timestamp: Date.now() - 86400000,
      conversationId: "conv_2",
    },
  ],
};

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [activitiesTotal, setActivitiesTotal] = useState<number>(0);
  const [videoProgresses, setVideoProgresses] = useState<Record<string, VideoProgress>>({});
  const [likedItems, setLikedItems] = useState<LikedItem[]>([]);
  const [bookmarkedItems, setBookmarkedItems] = useState<BookmarkedItem[]>([]);
  const [downloads, setDownloads] = useState<Download[]>([]);
  const [downloadedVideos, setDownloadedVideos] = useState<DownloadedVideo[]>([]);
  const [privateConversations, setPrivateConversations] = useState<Conversation[]>(SAMPLE_PRIVATE_CONVERSATIONS);
  const [channelUnread, setChannelUnread] = useState<Record<string, number>>({});
  const [channelLastMessages, setChannelLastMessages] = useState<Record<string, Message>>(() => {
    const last: Record<string, Message> = {};
    for (const [id, msgs] of Object.entries(SAMPLE_CHANNEL_MESSAGES)) {
      if (msgs.length > 0) last[id] = msgs[msgs.length - 1];
    }
    return last;
  });
  const [messages, setMessages] = useState<Record<string, Message[]>>({
    ...SAMPLE_CHANNEL_MESSAGES,
    ...SAMPLE_PRIVATE_MESSAGES,
  });

  const downloadIntervals = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  const { token } = useAuth();
  const { syncMessagingFromServer, syncActivityPrivacyFromServer } = useSettings();
  useEffect(() => {
    if (token) {
      syncMessagingFromServer(token);
      syncActivityPrivacyFromServer(token);
    }
  }, [token, syncMessagingFromServer, syncActivityPrivacyFromServer]);

  useEffect(() => {
    return () => {
      downloadIntervals.current.forEach(clearInterval);
    };
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const [acts, vp, likes, bookmarks, dls, dlVideos, privConvs, msgs, grpUnread] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.ACTIVITIES),
          AsyncStorage.getItem(STORAGE_KEYS.VIDEO_PROGRESSES),
          AsyncStorage.getItem(STORAGE_KEYS.LIKED_ITEMS),
          AsyncStorage.getItem(STORAGE_KEYS.BOOKMARKED_ITEMS),
          AsyncStorage.getItem(STORAGE_KEYS.DOWNLOADS),
          AsyncStorage.getItem(STORAGE_KEYS.DOWNLOADED_VIDEOS),
          AsyncStorage.getItem(STORAGE_KEYS.PRIVATE_CONVERSATIONS),
          AsyncStorage.getItem(STORAGE_KEYS.MESSAGES),
          AsyncStorage.getItem(STORAGE_KEYS.GROUP_UNREAD),
        ]);
        if (acts) setActivities(JSON.parse(acts));
        if (vp) setVideoProgresses(JSON.parse(vp));
        if (likes) setLikedItems(JSON.parse(likes));
        if (bookmarks) setBookmarkedItems(JSON.parse(bookmarks));
        if (dlVideos) setDownloadedVideos(JSON.parse(dlVideos));
        if (dls) {
          const parsed: Download[] = JSON.parse(dls);
          const fixed = parsed.map(d => d.status === "downloading" ? { ...d, status: "paused" as const } : d);
          setDownloads(fixed);
        }
        if (privConvs) {
          const parsed: Conversation[] = JSON.parse(privConvs);
          const cleaned = parsed.filter(c => !LEGACY_SEED_CONV_IDS.has(c.id));
          setPrivateConversations(cleaned);
          if (cleaned.length !== parsed.length) {
            AsyncStorage.setItem(STORAGE_KEYS.PRIVATE_CONVERSATIONS, JSON.stringify(cleaned)).catch(() => {});
          }
        }
        if (msgs) {
          const stored = JSON.parse(msgs) as Record<string, Message[]>;
          for (const k of Object.keys(stored)) {
            if (LEGACY_SEED_CONV_IDS.has(k)) delete stored[k];
          }
          setMessages(prev => ({
            ...SAMPLE_CHANNEL_MESSAGES,
            ...stored,
            ...Object.fromEntries(
              Object.entries(stored).filter(([k]) => k.startsWith("channel_")).map(([k, v]) => [k, [...SAMPLE_CHANNEL_MESSAGES[k] || [], ...v.filter(m => !SAMPLE_CHANNEL_MESSAGES[k]?.find(s => s.id === m.id))]])
            ),
          }));
          const lastMsgs: Record<string, Message> = {};
          for (const [id] of Object.entries(SAMPLE_CHANNEL_MESSAGES)) {
            const allMsgs = [...(SAMPLE_CHANNEL_MESSAGES[id] || []), ...(stored[id] || []).filter(m => !SAMPLE_CHANNEL_MESSAGES[id]?.find(s => s.id === m.id))];
            if (allMsgs.length > 0) lastMsgs[id] = allMsgs[allMsgs.length - 1];
          }
          setChannelLastMessages(lastMsgs);
        }
        if (grpUnread) setChannelUnread(prev => ({ ...prev, ...JSON.parse(grpUnread) }));
      } catch {}
    };
    load();
  }, []);

  const persist = useCallback(async (key: string, value: unknown) => {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }, []);

  const [dmConvs, setDmConvs] = useState<DmConversation[]>([]);
  const [groups, setGroups] = useState<GroupSummary[]>([]);

  const dmAsConversations: Conversation[] = dmConvs.map(c => ({
    id: `dm_${c.id}`,
    type: "private" as const,
    participants: [CURRENT_USER_ID, `u_${c.otherUserId}`],
    participantNames: [CURRENT_USER_NAME, c.displayName],
    unreadCount: c.unreadCount,
    timestamp: new Date(c.lastMessageAt).getTime() || Date.now(),
    lastMessage: c.lastMessagePreview ? {
      id: `preview_${c.id}`,
      conversationId: `dm_${c.id}`,
      senderId: "",
      senderName: "",
      text: c.lastMessagePreview,
      timestamp: new Date(c.lastMessageAt).getTime() || Date.now(),
    } as Message : undefined,
  }));

  const groupsAsConversations: Conversation[] = groups.map(g => ({
    id: `group_${g.id}`,
    type: "public" as const,
    groupName: g.name,
    description: g.description,
    participants: [],
    participantNames: [],
    unreadCount: g.unreadCount,
    timestamp: g.lastMessage ? (new Date(g.lastMessage.createdAt).getTime() || Date.now()) : 0,
    lastMessage: g.lastMessage ? {
      id: `gpreview_${g.id}`,
      conversationId: `group_${g.id}`,
      senderId: g.lastMessage.senderId === 0 ? "" : `u_${g.lastMessage.senderId}`,
      senderName: "",
      text: g.lastMessage.body || (g.lastMessage.title ? `📎 ${g.lastMessage.title}` : ""),
      timestamp: new Date(g.lastMessage.createdAt).getTime() || Date.now(),
    } as Message : undefined,
  }));

  const conversations: Conversation[] = [
    ...groupsAsConversations,
    ...dmAsConversations,
    ...privateConversations,
  ];

  const addActivity = useCallback((item: Omit<ActivityItem, "id" | "timestamp">) => {
    setActivities(prev => {
      const newItem: ActivityItem = { ...item, id: genId(), timestamp: Date.now() };
      const filtered = prev.filter(a => !(a.contentType === item.contentType && a.contentId === item.contentId));
      const updated = [newItem, ...filtered].slice(0, 250);
      persist(STORAGE_KEYS.ACTIVITIES, updated);
      return updated;
    });
  }, [persist]);

  const updateVideoProgress = useCallback((videoId: string, progress: number, duration: number) => {
    setVideoProgresses(prev => {
      const updated = {
        ...prev,
        [videoId]: { videoId, progress, duration, completed: duration > 0 && progress >= duration * 0.9, timestamp: Date.now() },
      };
      persist(STORAGE_KEYS.VIDEO_PROGRESSES, updated);
      return updated;
    });
  }, [persist]);

  const getVideoProgress = useCallback((videoId: string) => videoProgresses[videoId], [videoProgresses]);

  const toggleLike = useCallback((item: Omit<LikedItem, "id" | "timestamp">) => {
    setLikedItems(prev => {
      const exists = prev.find(l => l.contentType === item.contentType && l.contentId === item.contentId);
      const updated = exists
        ? prev.filter(l => !(l.contentType === item.contentType && l.contentId === item.contentId))
        : [{ ...item, id: genId(), timestamp: Date.now() }, ...prev];
      persist(STORAGE_KEYS.LIKED_ITEMS, updated);
      return updated;
    });
  }, [persist]);

  const isLiked = useCallback((contentType: ContentType, contentId: string) =>
    likedItems.some(l => l.contentType === contentType && l.contentId === contentId), [likedItems]);

  const tickDownload = useCallback((contentId: string) => {
    if (downloadIntervals.current.has(contentId)) return;
    const interval = setInterval(() => {
      setDownloads(prev => {
        const dl = prev.find(d => d.contentId === contentId);
        if (!dl || dl.status !== "downloading") {
          clearInterval(interval);
          downloadIntervals.current.delete(contentId);
          return prev;
        }
        const inc = Math.random() * 2.5 + 1.5;
        const newProgress = Math.min(100, dl.progress + inc);
        const newStatus: Download["status"] = newProgress >= 100 ? "completed" : "downloading";
        if (newStatus === "completed") {
          clearInterval(interval);
          downloadIntervals.current.delete(contentId);
        }
        const updated = prev.map(d => d.contentId === contentId ? { ...d, progress: newProgress, status: newStatus } : d);
        persist(STORAGE_KEYS.DOWNLOADS, updated);
        return updated;
      });
    }, 300);
    downloadIntervals.current.set(contentId, interval);
  }, [persist]);

  const toggleBookmark = useCallback((item: Omit<BookmarkedItem, "id" | "timestamp">) => {
    const alreadyBookmarked = bookmarkedItems.some(b => b.contentType === item.contentType && b.contentId === item.contentId);

    if (alreadyBookmarked) {
      setBookmarkedItems(prev => {
        const updated = prev.filter(b => !(b.contentType === item.contentType && b.contentId === item.contentId));
        persist(STORAGE_KEYS.BOOKMARKED_ITEMS, updated);
        return updated;
      });
      const interval = downloadIntervals.current.get(item.contentId);
      if (interval) {
        clearInterval(interval);
        downloadIntervals.current.delete(item.contentId);
      }
      setDownloads(prev => {
        const updated = prev.filter(d => d.contentId !== item.contentId);
        persist(STORAGE_KEYS.DOWNLOADS, updated);
        return updated;
      });
    } else {
      setBookmarkedItems(prev => {
        const updated = [{ ...item, id: genId(), timestamp: Date.now() }, ...prev];
        persist(STORAGE_KEYS.BOOKMARKED_ITEMS, updated);
        return updated;
      });
      const newDl: Download = {
        id: genId(),
        contentType: item.contentType,
        contentId: item.contentId,
        title: item.title,
        subtitle: item.subtitle,
        progress: 0,
        status: "downloading",
        timestamp: Date.now(),
      };
      setDownloads(prev => {
        if (prev.find(d => d.contentId === item.contentId)) return prev;
        const updated = [newDl, ...prev];
        persist(STORAGE_KEYS.DOWNLOADS, updated);
        return updated;
      });
      tickDownload(item.contentId);
    }
  }, [bookmarkedItems, persist, tickDownload]);

  const isBookmarked = useCallback((contentType: ContentType, contentId: string) =>
    bookmarkedItems.some(b => b.contentType === contentType && b.contentId === contentId), [bookmarkedItems]);

  const pauseDownload = useCallback((contentId: string) => {
    const interval = downloadIntervals.current.get(contentId);
    if (interval) {
      clearInterval(interval);
      downloadIntervals.current.delete(contentId);
    }
    setDownloads(prev => {
      const updated = prev.map(d => d.contentId === contentId && d.status === "downloading" ? { ...d, status: "paused" as const } : d);
      persist(STORAGE_KEYS.DOWNLOADS, updated);
      return updated;
    });
  }, [persist]);

  const resumeDownload = useCallback((contentId: string) => {
    setDownloads(prev => {
      const dl = prev.find(d => d.contentId === contentId);
      if (!dl || dl.status !== "paused") return prev;
      const updated = prev.map(d => d.contentId === contentId ? { ...d, status: "downloading" as const } : d);
      persist(STORAGE_KEYS.DOWNLOADS, updated);
      return updated;
    });
    tickDownload(contentId);
  }, [persist, tickDownload]);

  const deleteDownload = useCallback((contentId: string) => {
    const interval = downloadIntervals.current.get(contentId);
    if (interval) {
      clearInterval(interval);
      downloadIntervals.current.delete(contentId);
    }
    setDownloads(prev => {
      const updated = prev.filter(d => d.contentId !== contentId);
      persist(STORAGE_KEYS.DOWNLOADS, updated);
      return updated;
    });
    setBookmarkedItems(prev => {
      const updated = prev.filter(b => b.contentId !== contentId);
      persist(STORAGE_KEYS.BOOKMARKED_ITEMS, updated);
      return updated;
    });
  }, [persist]);

  const getDownload = useCallback((contentId: string) =>
    downloads.find(d => d.contentId === contentId), [downloads]);

  const isDownloadComplete = useCallback((contentId: string) => {
    const dl = downloads.find(d => d.contentId === contentId);
    return dl ? dl.status === "completed" : true;
  }, [downloads]);

  const addDownload = useCallback((video: DownloadedVideo) => {
    setDownloadedVideos(prev => {
      const updated = [video, ...prev.filter(d => d.videoId !== video.videoId)];
      persist(STORAGE_KEYS.DOWNLOADED_VIDEOS, updated);
      return updated;
    });
  }, [persist]);

  const removeDownload = useCallback((videoId: string) => {
    setDownloadedVideos(prev => {
      const updated = prev.filter(d => d.videoId !== videoId);
      persist(STORAGE_KEYS.DOWNLOADED_VIDEOS, updated);
      return updated;
    });
  }, [persist]);

  const isDownloaded = useCallback((videoId: string) =>
    downloadedVideos.some(d => d.videoId === videoId), [downloadedVideos]);

  const sendMessage = useCallback((conversationId: string, text: string, sharedContent?: Message["sharedContent"]) => {
    // Legacy local-only fallback (used only by hardcoded sample private convs); group/dm have own methods
    const newMsg: Message = {
      id: genId(),
      senderId: CURRENT_USER_ID,
      senderName: CURRENT_USER_NAME,
      text,
      sharedContent,
      timestamp: Date.now(),
      conversationId,
    };
    setMessages(prev => {
      const updated = { ...prev, [conversationId]: [...(prev[conversationId] || []), newMsg] };
      persist(STORAGE_KEYS.MESSAGES, updated);
      return updated;
    });
    setPrivateConversations(prev => {
      const updated = prev.map(c => c.id === conversationId ? { ...c, lastMessage: newMsg, timestamp: Date.now() } : c);
      persist(STORAGE_KEYS.PRIVATE_CONVERSATIONS, updated);
      return updated;
    });
  }, [persist]);

  const createConversation = useCallback((participantId: string, participantName: string): string => {
    const existing = privateConversations.find(c => c.participants.includes(participantId));
    if (existing) return existing.id;
    const newConv: Conversation = {
      id: genId(),
      type: "private",
      participants: [CURRENT_USER_ID, participantId],
      participantNames: [CURRENT_USER_NAME, participantName],
      unreadCount: 0,
      timestamp: Date.now(),
    };
    setPrivateConversations(prev => {
      const updated = [newConv, ...prev];
      persist(STORAGE_KEYS.PRIVATE_CONVERSATIONS, updated);
      return updated;
    });
    return newConv.id;
  }, [privateConversations, persist]);

  const createGroup = useCallback((groupName: string, participantIds: string[], participantNames: string[]): string => {
    const id = genId();
    return id;
  }, []);

  const markConversationRead = useCallback((conversationId: string) => {
    setPrivateConversations(prev => {
      const updated = prev.map(c => c.id === conversationId ? { ...c, unreadCount: 0 } : c);
      persist(STORAGE_KEYS.PRIVATE_CONVERSATIONS, updated);
      return updated;
    });
  }, [persist]);

  // ===== Real DM =====
  const loadDmConversations = useCallback(async () => {
    if (!token) return;
    try {
      const list = await dmApi.listConversations(token);
      setDmConvs(list);
    } catch (e) {
      console.warn("loadDmConversations failed", e);
    }
  }, [token]);

  const deleteConversation = useCallback((conversationId: string) => {
    if (conversationId.startsWith("group_")) return;
    if (conversationId.startsWith("dm_")) {
      const serverId = conversationId.slice(3);
      setDmConvs(prev => prev.filter(c => String(c.id) !== serverId));
      setMessages(prev => {
        const updated = { ...prev };
        delete updated[conversationId];
        persist(STORAGE_KEYS.MESSAGES, updated);
        return updated;
      });
      if (token) {
        dmApi.deleteConversation(token, serverId).catch(e => {
          console.warn("deleteConversation failed", e);
          loadDmConversations();
        });
      }
      return;
    }
    setPrivateConversations(prev => {
      const updated = prev.filter(c => c.id !== conversationId);
      persist(STORAGE_KEYS.PRIVATE_CONVERSATIONS, updated);
      return updated;
    });
    setMessages(prev => {
      const updated = { ...prev };
      delete updated[conversationId];
      persist(STORAGE_KEYS.MESSAGES, updated);
      return updated;
    });
  }, [persist, token, loadDmConversations]);

  const deleteMessage = useCallback((conversationId: string, messageId: string) => {
    setMessages(prev => {
      const list = prev[conversationId] || [];
      const updatedList = list.filter(m => m.id !== messageId);
      const updated = { ...prev, [conversationId]: updatedList };
      persist(STORAGE_KEYS.MESSAGES, updated);
      const newLast = updatedList[updatedList.length - 1];
      if (!conversationId.startsWith("group_") && !conversationId.startsWith("dm_")) {
        setPrivateConversations(prevConvs => {
          const updatedConvs = prevConvs.map(c =>
            c.id === conversationId ? { ...c, lastMessage: newLast } : c
          );
          persist(STORAGE_KEYS.PRIVATE_CONVERSATIONS, updatedConvs);
          return updatedConvs;
        });
      }
      return updated;
    });
  }, [persist]);

  const getTotalUnread = useCallback(() =>
    conversations.reduce((sum, c) => sum + c.unreadCount, 0), [conversations]);

  const dmMsgToLocal = (m: DmMessage, convKey: string): Message => ({
    id: `dm_msg_${m.id}`,
    conversationId: convKey,
    senderId: m.mine ? CURRENT_USER_ID : `u_${m.senderId}`,
    senderName: m.mine ? CURRENT_USER_NAME : "",
    text: m.body,
    timestamp: new Date(m.createdAt).getTime() || Date.now(),
    sharedContent: m.contentRefId && m.contentType ? {
      contentType: m.contentType as any,
      contentId: m.contentRefId,
      title: m.contentTitle ?? "",
    } : undefined,
  });

  const loadDmMessages = useCallback(async (conversationId: string) => {
    if (!token || !conversationId.startsWith("dm_")) return;
    const serverId = conversationId.slice(3);
    try {
      const list = await dmApi.listMessages(token, serverId);
      setMessages(prev => ({ ...prev, [conversationId]: list.map(m => dmMsgToLocal(m, conversationId)) }));
    } catch (e) {
      console.warn("loadDmMessages failed", e);
    }
  }, [token]);

  const sendDm = useCallback(async (conversationId: string, body: string, sharedContent?: Message["sharedContent"]) => {
    if (!token || !conversationId.startsWith("dm_")) return { ok: false, error: "Geçersiz konuşma" };
    const conv = dmConvs.find(c => `dm_${c.id}` === conversationId);
    if (!conv) return { ok: false, error: "Konuşma bulunamadı" };
    const res = await dmApi.send(token, {
      recipientId: conv.otherUserId,
      body,
      contentType: sharedContent?.contentType,
      contentRefId: sharedContent?.contentId,
      contentTitle: sharedContent?.title,
    });
    if (!res.ok) return { ok: false, error: res.error };
    const local = dmMsgToLocal(res.message, conversationId);
    setMessages(prev => ({ ...prev, [conversationId]: [...(prev[conversationId] ?? []), local] }));
    setDmConvs(prev => prev.map(c => c.id === conv.id ? {
      ...c,
      lastMessageAt: res.message.createdAt,
      lastMessagePreview: body || (sharedContent?.title ? `📎 ${sharedContent.title}` : "📎"),
    } : c));
    return { ok: true };
  }, [token, dmConvs]);

  const startDmAndSend = useCallback(async (recipientId: number, body: string) => {
    if (!token) return { ok: false, error: "Yetkisiz" };
    const res = await dmApi.send(token, { recipientId, body });
    if (!res.ok) return { ok: false, error: res.error };
    await loadDmConversations();
    return { ok: true, conversationId: `dm_${res.conversationId}` };
  }, [token, loadDmConversations]);

  const markDmRead = useCallback(async (conversationId: string) => {
    if (!token || !conversationId.startsWith("dm_")) return;
    const serverId = conversationId.slice(3);
    try {
      await dmApi.markRead(token, serverId);
      setDmConvs(prev => prev.map(c => String(c.id) === serverId ? { ...c, unreadCount: 0 } : c));
    } catch (e) {
      console.warn("markDmRead failed", e);
    }
  }, [token]);

  // Auto-load DMs on login + poll every 20s
  useEffect(() => {
    if (!token) { setDmConvs([]); return; }
    loadDmConversations();
    const iv = setInterval(loadDmConversations, 20000);
    return () => clearInterval(iv);
  }, [token, loadDmConversations]);

  // ===== Groups =====
  const loadGroups = useCallback(async () => {
    if (!token) return;
    try {
      const list = await groupsApi.list(token);
      setGroups(list);
    } catch (e) {
      console.warn("loadGroups failed", e);
    }
  }, [token]);

  const joinGroup = useCallback(async (groupId: string) => {
    if (!token) return;
    try {
      await groupsApi.join(token, groupId);
      await loadGroups();
    } catch (e) {
      console.warn("joinGroup failed", e);
    }
  }, [token, loadGroups]);

  const leaveGroup = useCallback(async (groupId: string) => {
    if (!token) return;
    try {
      await groupsApi.leave(token, groupId);
      await loadGroups();
    } catch (e) {
      console.warn("leaveGroup failed", e);
    }
  }, [token, loadGroups]);

  const grpMsgToLocal = (m: GroupMessage, convKey: string): Message => ({
    id: `gmsg_${m.id}`,
    conversationId: convKey,
    senderId: m.mine ? CURRENT_USER_ID : `u_${m.senderId}`,
    senderName: m.mine ? CURRENT_USER_NAME : (m.senderName || ""),
    text: m.body,
    timestamp: new Date(m.createdAt).getTime() || Date.now(),
    sharedContent: m.contentRefId && m.contentType ? {
      contentType: m.contentType as any,
      contentId: m.contentRefId,
      title: m.contentTitle ?? "",
    } : undefined,
  });

  const loadGroupMessages = useCallback(async (conversationId: string) => {
    if (!token || !conversationId.startsWith("group_")) return;
    const gid = conversationId.slice(6);
    try {
      const list = await groupsApi.listMessages(token, gid);
      setMessages(prev => ({ ...prev, [conversationId]: list.map(m => grpMsgToLocal(m, conversationId)) }));
    } catch (e) {
      console.warn("loadGroupMessages failed", e);
    }
  }, [token]);

  const sendGroupMessage = useCallback(async (conversationId: string, body: string, sharedContent?: Message["sharedContent"]) => {
    if (!token || !conversationId.startsWith("group_")) return { ok: false, error: "Geçersiz grup" };
    const gid = conversationId.slice(6);
    const res = await groupsApi.send(token, gid, {
      body,
      contentType: sharedContent?.contentType,
      contentRefId: sharedContent?.contentId,
      contentTitle: sharedContent?.title,
    });
    if (!res.ok) return { ok: false, error: res.error };
    const local = grpMsgToLocal(res.message, conversationId);
    setMessages(prev => ({ ...prev, [conversationId]: [...(prev[conversationId] ?? []), local] }));
    setGroups(prev => prev.map(g => g.id === gid ? {
      ...g,
      lastMessage: {
        id: res.message.id,
        senderId: res.message.senderId,
        body: res.message.body,
        title: res.message.contentTitle,
        createdAt: res.message.createdAt,
      },
    } : g));
    return { ok: true };
  }, [token]);

  const markGroupRead = useCallback(async (conversationId: string) => {
    if (!token || !conversationId.startsWith("group_")) return;
    const gid = conversationId.slice(6);
    try {
      await groupsApi.markRead(token, gid);
      setGroups(prev => prev.map(g => g.id === gid ? { ...g, unreadCount: 0 } : g));
    } catch (e) {
      console.warn("markGroupRead failed", e);
    }
  }, [token]);

  // Auto-load groups on login + poll every 20s
  useEffect(() => {
    if (!token) { setGroups([]); return; }
    loadGroups();
    const iv = setInterval(loadGroups, 20000);
    return () => clearInterval(iv);
  }, [token, loadGroups]);

  // Load viewed history from DB via /me/activity (same source as Kullanım tab)
  // Refreshes on login, every 30s while app is open, and on app foreground
  // — so views from other devices/versions show up automatically.
  const refreshActivitiesFromServer = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch(`${API_BASE_URL}/me/activity`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) return;
      const d = await r.json();
      if (typeof d?.totalCount === "number") setActivitiesTotal(d.totalCount);
      const recent = Array.isArray(d?.recent) ? d.recent : [];
      if (recent.length === 0) return;
      const fromServer: ActivityItem[] = recent
        .filter((it: any) => it.contentId)
        .map((it: any, idx: number) => ({
          id: `${it.type}-${it.contentId}-${idx}`,
          contentType: it.type as ContentType,
          contentId: String(it.contentId),
          title: it.title || "(başlıksız)",
          subtitle: it.subtitle || undefined,
          timestamp: new Date(it.date).getTime(),
        }));
      // MERGE with local activities — don't wipe items the server doesn't return.
      // The server's /me/activity caps at 200 deduped rows and may also miss
      // very recent opens (raw → V2 view lag, classification gaps), so any local
      // activity not present in the server response must be preserved.
      // For items present in both, keep the most recent timestamp so a fresh
      // local re-open isn't rolled back to an older server value.
      setActivities(prev => {
        const localByKey = new Map(prev.map(p => [`${p.contentType}|${p.contentId}`, p]));
        const reconciled = fromServer.map(s => {
          const key = `${s.contentType}|${s.contentId}`;
          const local = localByKey.get(key);
          if (local && local.timestamp > s.timestamp) {
            return { ...s, timestamp: local.timestamp };
          }
          return s;
        });
        const serverKeys = new Set(fromServer.map(s => `${s.contentType}|${s.contentId}`));
        const localOnly = prev.filter(p => !serverKeys.has(`${p.contentType}|${p.contentId}`));
        const merged = [...reconciled, ...localOnly]
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, 250);
        persist(STORAGE_KEYS.ACTIVITIES, merged);
        return merged;
      });
    } catch {}
  }, [token, persist]);

  useEffect(() => {
    if (!token) return;
    refreshActivitiesFromServer();
    const iv = setInterval(refreshActivitiesFromServer, 30000);
    let sub: { remove: () => void } | undefined;
    try {
      const RN = require("react-native");
      sub = RN.AppState.addEventListener("change", (s: string) => {
        if (s === "active") refreshActivitiesFromServer();
      });
    } catch {}
    return () => {
      clearInterval(iv);
      if (sub) sub.remove();
    };
  }, [token, refreshActivitiesFromServer]);

  return (
    <AppContext.Provider value={{
      currentUserId: CURRENT_USER_ID,
      currentUserName: CURRENT_USER_NAME,
      activities, activitiesTotal, addActivity,
      videoProgresses, updateVideoProgress, getVideoProgress,
      likedItems, toggleLike, isLiked,
      bookmarkedItems, toggleBookmark, isBookmarked,
      downloads, pauseDownload, resumeDownload, deleteDownload, getDownload, isDownloadComplete,
      downloadedVideos, addDownload, removeDownload, isDownloaded,
      conversations, messages, sendMessage, createConversation, createGroup,
      markConversationRead, deleteConversation, deleteMessage, getTotalUnread,
      loadDmConversations, loadDmMessages, sendDm, startDmAndSend, markDmRead,
      groups, loadGroups, joinGroup, leaveGroup, loadGroupMessages, sendGroupMessage, markGroupRead,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
