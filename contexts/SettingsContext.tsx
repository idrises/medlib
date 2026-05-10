import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { activityPrivacyApi, messagingApi, type ActivityNameMode } from "@/services/api";

export type ThemeMode = "light" | "dark" | "system";
export type { ActivityNameMode };
export type FontSize = "small" | "medium" | "large";
export type Language = "tr" | "en";
export type DownloadQuality = "high" | "medium" | "low";
export type WhoCanMessage = "everyone" | "contacts" | "nobody";
export type MuteDuration = "off" | "1h" | "8h" | "always";
export type BackgroundRelockDelay = "immediate" | "1m" | "5m" | "15m";

export const BACKGROUND_RELOCK_DELAY_MS: Record<BackgroundRelockDelay, number> = {
  immediate: 0,
  "1m": 60_000,
  "5m": 5 * 60_000,
  "15m": 15 * 60_000,
};

export interface Settings {
  theme: ThemeMode;
  fontSize: FontSize;
  language: Language;

  notifNewArticles: boolean;
  notifNewBooksVideos: boolean;
  notifMessagesGroup: boolean;
  notifMessagesPrivate: boolean;
  notifDeviceApproval: boolean;

  msgMuteAll: boolean;
  msgQuietHoursEnabled: boolean;
  msgQuietHoursStart: string;
  msgQuietHoursEnd: string;
  msgMentionOnly: boolean;
  msgGroupMute: Record<string, MuteDuration>;
  msgSound: "on" | "off" | "vibrate";
  msgPreview: boolean;
  msgReadReceipts: boolean;
  msgTypingIndicator: boolean;
  msgLastSeen: boolean;
  msgWhoCanMessage: WhoCanMessage;
  msgFontSize: FontSize;
  msgEnterToSend: boolean;
  msgAutoDownloadWifi: boolean;
  msgAutoDelete30d: boolean;
  msgBlockedUsers: string[];

  messagingConfigured: boolean;
  notifSharedContent: boolean;
  showFirstName: boolean;
  showLastName: boolean;
  showSpecialty: boolean;
  showInstitution: boolean;
  nickAlias: string;
  showNickAlias: boolean;

  // Privacy preference for the home > "All" activity feed.
  // Only `activityNameMode` and `activityAlias` flow to/from the server
  // (see activityPrivacyApi); they're kept on the same Settings object
  // so the existing AsyncStorage cache stays a single source of truth.
  activityNameMode: ActivityNameMode;
  activityAlias: string;

  downloadQuality: DownloadQuality;
  downloadWifiOnly: boolean;
  videoWifiOnly: boolean;

  keepLoggedIn: boolean;
  biometricUnlock: boolean;
  backgroundRelockDelay: BackgroundRelockDelay;
}

const DEFAULTS: Settings = {
  theme: "system",
  fontSize: "medium",
  language: "tr",

  notifNewArticles: true,
  notifNewBooksVideos: true,
  notifMessagesGroup: true,
  notifMessagesPrivate: true,
  notifDeviceApproval: true,

  msgMuteAll: false,
  msgQuietHoursEnabled: false,
  msgQuietHoursStart: "22:00",
  msgQuietHoursEnd: "08:00",
  msgMentionOnly: false,
  msgGroupMute: {},
  msgSound: "on",
  msgPreview: false,
  msgReadReceipts: true,
  msgTypingIndicator: true,
  msgLastSeen: true,
  msgWhoCanMessage: "everyone",
  msgFontSize: "medium",
  msgEnterToSend: true,
  msgAutoDownloadWifi: true,
  msgAutoDelete30d: false,
  msgBlockedUsers: [],

  messagingConfigured: false,
  notifSharedContent: true,
  showFirstName: true,
  showLastName: true,
  showSpecialty: true,
  showInstitution: true,
  nickAlias: "",
  showNickAlias: false,

  activityNameMode: "initials",
  activityAlias: "",

  downloadQuality: "medium",
  downloadWifiOnly: true,
  videoWifiOnly: false,

  keepLoggedIn: true,
  biometricUnlock: false,
  backgroundRelockDelay: "1m",
};

const STORAGE_KEY = "medlib_settings_v1";

interface SettingsContextValue {
  settings: Settings;
  ready: boolean;
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  resetSettings: () => void;
  blockUser: (userId: string) => void;
  unblockUser: (userId: string) => void;
  setGroupMute: (groupId: string, duration: MuteDuration) => void;
  syncMessagingFromServer: (token: string) => Promise<void>;
  pushMessagingToServer: (token: string) => Promise<void>;
  syncActivityPrivacyFromServer: (token: string) => Promise<void>;
  // Push the requested mode/alias to the server. On validation failure the
  // server-provided message is thrown so the UI can show it (Alert) and
  // revert the local state. On success the local settings are updated to
  // match the server's normalized response.
  pushActivityPrivacyToServer: (
    token: string,
    next: { mode: ActivityNameMode; alias: string },
  ) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const loaded = JSON.parse(raw);
          setSettings({ ...DEFAULTS, ...loaded });
        }
      } catch {}
      setReady(true);
    })();
  }, []);

  const persist = useCallback((next: Settings) => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const setSetting = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings(prev => {
      const next = { ...prev, [key]: value };
      persist(next);
      return next;
    });
  }, [persist]);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULTS);
    persist(DEFAULTS);
  }, [persist]);

  const blockUser = useCallback((userId: string) => {
    setSettings(prev => {
      if (prev.msgBlockedUsers.includes(userId)) return prev;
      const next = { ...prev, msgBlockedUsers: [...prev.msgBlockedUsers, userId] };
      persist(next);
      return next;
    });
  }, [persist]);

  const unblockUser = useCallback((userId: string) => {
    setSettings(prev => {
      const next = { ...prev, msgBlockedUsers: prev.msgBlockedUsers.filter(u => u !== userId) };
      persist(next);
      return next;
    });
  }, [persist]);

  const setGroupMute = useCallback((groupId: string, duration: MuteDuration) => {
    setSettings(prev => {
      const next = { ...prev, msgGroupMute: { ...prev.msgGroupMute, [groupId]: duration } };
      persist(next);
      return next;
    });
  }, [persist]);

  const settingsRef = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  const syncMessagingFromServer = useCallback(async (token: string) => {
    try {
      const dto = await messagingApi.getSettings(token);
      setSettings(prev => {
        const next: Settings = {
          ...prev,
          messagingConfigured: dto.configured,
          msgWhoCanMessage: dto.whoCanMessage,
          showFirstName: dto.showFirstName,
          showLastName: dto.showLastName,
          showSpecialty: dto.showSpecialty,
          showInstitution: dto.showInstitution,
          nickAlias: dto.nickAlias,
          showNickAlias: dto.showNickAlias,
          notifMessagesPrivate: dto.notifDM,
          notifMessagesGroup: dto.notifGroup,
          notifSharedContent: dto.notifShared,
        };
        persist(next);
        return next;
      });
    } catch (e) {
      console.warn("syncMessagingFromServer failed", e);
    }
  }, [persist]);

  const pushMessagingToServer = useCallback(async (token: string) => {
    const s = settingsRef.current;
    try {
      await messagingApi.updateSettings(token, {
        configured: s.messagingConfigured,
        whoCanMessage: s.msgWhoCanMessage,
        showFirstName: s.showFirstName,
        showLastName: s.showLastName,
        showSpecialty: s.showSpecialty,
        showInstitution: s.showInstitution,
        nickAlias: s.nickAlias,
        showNickAlias: s.showNickAlias,
        notifDM: s.notifMessagesPrivate,
        notifGroup: s.notifMessagesGroup,
        notifShared: s.notifSharedContent,
      });
    } catch (e) {
      console.warn("pushMessagingToServer failed", e);
    }
  }, []);

  const syncActivityPrivacyFromServer = useCallback(async (token: string) => {
    try {
      const dto = await activityPrivacyApi.get(token);
      setSettings(prev => {
        const next: Settings = {
          ...prev,
          activityNameMode: dto.mode,
          activityAlias: dto.alias ?? "",
        };
        persist(next);
        return next;
      });
    } catch (e) {
      console.warn("syncActivityPrivacyFromServer failed", e);
    }
  }, [persist]);

  const pushActivityPrivacyToServer = useCallback(async (
    token: string,
    next: { mode: ActivityNameMode; alias: string },
  ) => {
    // Note: we do NOT optimistically mutate local state here. The caller
    // updates local state after this resolves so that a server-side
    // validation error (e.g. profanity, invalid characters) leaves the UI
    // unchanged and the caller can show an Alert with the error message.
    const saved = await activityPrivacyApi.update(token, next);
    setSettings(prev => {
      const updated: Settings = {
        ...prev,
        activityNameMode: saved.mode,
        activityAlias: saved.alias ?? "",
      };
      persist(updated);
      return updated;
    });
  }, [persist]);

  const value = useMemo(
    () => ({
      settings, ready, setSetting, resetSettings,
      blockUser, unblockUser, setGroupMute,
      syncMessagingFromServer, pushMessagingToServer,
      syncActivityPrivacyFromServer, pushActivityPrivacyToServer,
    }),
    [
      settings, ready, setSetting, resetSettings,
      blockUser, unblockUser, setGroupMute,
      syncMessagingFromServer, pushMessagingToServer,
      syncActivityPrivacyFromServer, pushActivityPrivacyToServer,
    ]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}

export const FONT_SIZE_SCALE: Record<FontSize, number> = {
  small: 0.9,
  medium: 1.0,
  large: 1.15,
};
