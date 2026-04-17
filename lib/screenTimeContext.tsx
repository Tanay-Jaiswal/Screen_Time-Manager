import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  ReactNode,
} from "react";
import { AppState, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import {
  AppCategory,
  RiskLevel,
  evaluateUsage,
  isLateNight,
  APP_CATEGORIES,
} from "@/lib/fuzzyLogic";

export interface AppSession {
  id: string;
  appName: string;
  category: AppCategory;
  minutes: number;
  timestamp: number;
  isLateNight: boolean;
}

export interface DailyStats {
  date: string;
  totalMinutes: number;
  productiveMinutes: number;
  neutralMinutes: number;
  distractingMinutes: number;
  sessionCount: number;
  lateNightMinutes: number;
  riskLevel: RiskLevel;
  score: number;
  riskDetails: string[];
}

export interface ParentSettings {
  email: string;
  phone: string;
  notificationsEnabled: boolean;
  parentAlertsEnabled: boolean;
}

export interface Notification {
  id: string;
  message: string;
  type: "warning" | "addictive" | "info";
  timestamp: number;
  read: boolean;
}

interface ScreenTimeContextType {
  sessions: AppSession[];
  todayStats: DailyStats;
  weekHistory: DailyStats[];
  notifications: Notification[];
  unreadCount: number;
  parentSettings: ParentSettings;
  usageSyncSupported: boolean;
  usagePermissionGranted: boolean;
  isSyncing: boolean;
  lastSyncedAt: number | null;
  addSession: (appName: string, category: AppCategory, minutes: number) => void;
  syncFromDeviceUsage: () => Promise<void>;
  requestUsagePermission: () => Promise<void>;
  refreshUsagePermission: () => Promise<void>;
  updateParentSettings: (settings: Partial<ParentSettings>) => void;
  markNotificationsRead: () => void;
  clearTodayData: () => void;
}

const defaultStats = (): DailyStats => ({
  date: new Date().toDateString(),
  totalMinutes: 0,
  productiveMinutes: 0,
  neutralMinutes: 0,
  distractingMinutes: 0,
  sessionCount: 0,
  lateNightMinutes: 0,
  riskLevel: "healthy",
  score: 0,
  riskDetails: [],
});

const ScreenTimeContext = createContext<ScreenTimeContextType | null>(null);

const STORAGE_KEYS = {
  sessions: "wellscreen_sessions",
  history: "wellscreen_history",
  notifications: "wellscreen_notifications",
  parentSettings: "wellscreen_parent_settings",
  lastRiskAlert: "wellscreen_last_risk_alert",
  lastParentEmailDate: "wellscreen_last_parent_email_date",
  lastSyncAt: "wellscreen_last_sync_at",
};

interface AndroidUsageModule {
  checkPermission: () => Promise<boolean>;
  openUsageAccessSettings: (packageName: string) => Promise<void>;
  queryUsageStats: (
    beginTime: number,
    endTime: number
  ) => Promise<
    Array<{
      packageName: string;
      totalTimeInForeground: number;
      totalTimeVisible?: number;
      totalTimeForegroundServiceUsed?: number;
      lastTimeUsed: number;
      firstTimeStamp?: number;
      lastTimeStamp?: number;
    }> | null
  >;
  queryAndAggregateUsageStats?: (
    beginTime: number,
    endTime: number
  ) => Promise<
    | Record<
        string,
        {
          packageName: string;
          totalTimeInForeground: number;
          totalTimeVisible?: number;
          totalTimeForegroundServiceUsed?: number;
          lastTimeUsed: number;
          firstTimeStamp?: number;
          lastTimeStamp?: number;
        }
      >
    | null
  >;
}

const PACKAGE_LABELS: Record<string, string> = {
  "com.instagram.android": "Instagram",
  "com.zhiliaoapp.musically": "TikTok",
  "com.google.android.youtube": "YouTube",
  "com.twitter.android": "Twitter",
  "com.snapchat.android": "Snapchat",
  "com.reddit.frontpage": "Reddit",
  "com.facebook.katana": "Facebook",
  "com.roblox.client": "Roblox",
  "com.netflix.mediaclient": "Netflix",
  "com.whatsapp": "WhatsApp",
  "com.discord": "Discord",
  "com.spotify.music": "Spotify",
  "com.google.android.apps.maps": "Google Maps",
  "com.android.chrome": "Chrome",
  "com.google.android.gm": "Gmail",
  "com.google.android.apps.docs": "Google Docs",
  "com.google.android.calendar": "Calendar",
  "com.microsoft.teams": "Microsoft Teams",
  "com.microsoft.office.outlook": "Outlook",
  "com.google.android.apps.meetings": "Google Meet",
  "com.sec.android.app.sbrowser": "Samsung Internet",
};

const PRODUCTIVE_KEYWORDS = [
  "docs",
  "calendar",
  "gmail",
  "mail",
  "classroom",
  "notion",
  "drive",
  "slack",
  "teams",
  "zoom",
  "meet",
  "outlook",
  "github",
  "education",
  "study",
  "khan",
  "duolingo",
];

const DISTRACTING_KEYWORDS = [
  "instagram",
  "tiktok",
  "youtube",
  "snapchat",
  "reddit",
  "facebook",
  "twitter",
  "x.",
  "game",
  "gaming",
  "netflix",
  "primevideo",
  "hotstar",
  "shorts",
  "reels",
  "roblox",
  "pubg",
  "fortnite",
];

function getAndroidUsageModule(): AndroidUsageModule | null {
  if (Platform.OS !== "android") return null;
  try {
    return require("react-native-usage-stats").default as AndroidUsageModule;
  } catch {
    return null;
  }
}

function isLateNightTimestamp(timestamp: number): boolean {
  const hour = new Date(timestamp).getHours();
  return hour >= 22 || hour < 5;
}

function packageToName(packageName: string): string {
  const mapped = PACKAGE_LABELS[packageName];
  if (mapped) return mapped;

  const chunks = packageName.split(".").filter(Boolean);
  if (chunks.length === 0) return packageName;
  const last = chunks[chunks.length - 1].replace(/[_-]/g, " ");
  return last
    .split(" ")
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join(" ");
}

function inferCategory(packageName: string, appName: string): AppCategory {
  if (APP_CATEGORIES[appName]) return APP_CATEGORIES[appName];

  const haystack = `${packageName.toLowerCase()} ${appName.toLowerCase()}`;

  if (DISTRACTING_KEYWORDS.some((k) => haystack.includes(k))) {
    return "distracting";
  }

  if (PRODUCTIVE_KEYWORDS.some((k) => haystack.includes(k))) {
    return "productive";
  }

  return "neutral";
}

function msToMinutes(ms: number): number {
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  // Avoid inflating totals by rounding each app up.
  return Math.floor(ms / 60000);
}

function isSystemOrLauncherPackage(packageName: string): boolean {
  const pkg = packageName.toLowerCase();

  // System UI / launchers / keyboards often report large foreground time but are not
  // counted as "app screen time" in Digital Wellbeing.
  const blockedPrefixes = [
    "com.android.systemui",
    "com.google.android.inputmethod",
    "com.samsung.android.honeyboard",
  ];
  if (blockedPrefixes.some((p) => pkg.startsWith(p))) return true;

  const blockedExact = new Set([
    "com.sec.android.app.launcher", // One UI Home
    "com.google.android.apps.nexuslauncher",
  ]);

  if (blockedExact.has(pkg)) return true;

  // Heuristic launcher match.
  if (pkg.includes("launcher") || pkg.endsWith(".launcher")) return true;

  return false;
}

function pickUsageMs(entry: {
  totalTimeInForeground: number;
  totalTimeVisible?: number;
}): number {
  // Digital Wellbeing-like behavior is closest to foreground time.
  // On Android Q+ some OEMs expose totalTimeVisible; keep foreground as primary.
  const ms = entry.totalTimeInForeground;
  return Number.isFinite(ms) ? ms : 0;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function ScreenTimeProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<AppSession[]>([]);
  const [weekHistory, setWeekHistory] = useState<DailyStats[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [usagePermissionGranted, setUsagePermissionGranted] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [parentSettings, setParentSettings] = useState<ParentSettings>({
    email: "",
    phone: "",
    notificationsEnabled: true,
    parentAlertsEnabled: false,
  });

  const usageModule = useMemo(() => getAndroidUsageModule(), []);
  const usageSyncSupported = Platform.OS === "android" && !!usageModule;
  const syncInFlightRef = useRef(false);

  const appPackageName =
    Constants.expoConfig?.android?.package ||
    Constants.expoConfig?.ios?.bundleIdentifier ||
    "com.wellscreen";

  const appendNotification = useCallback((notif: Notification) => {
    setNotifications((prev) => {
      const merged = [...prev, notif].slice(-20);
      AsyncStorage.setItem(STORAGE_KEYS.notifications, JSON.stringify(merged));
      return merged;
    });
  }, []);

  const refreshUsagePermission = useCallback(async () => {
    if (!usageModule || Platform.OS !== "android") {
      setUsagePermissionGranted(false);
      return;
    }

    try {
      const granted = await usageModule.checkPermission();
      setUsagePermissionGranted(!!granted);
    } catch {
      setUsagePermissionGranted(false);
    }
  }, [usageModule]);

  const loadData = useCallback(async () => {
    try {
      const [sessionsRaw, historyRaw, notifRaw, parentRaw] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.sessions),
        AsyncStorage.getItem(STORAGE_KEYS.history),
        AsyncStorage.getItem(STORAGE_KEYS.notifications),
        AsyncStorage.getItem(STORAGE_KEYS.parentSettings),
      ]);

      const today = new Date().toDateString();

      if (sessionsRaw) {
        const all: AppSession[] = JSON.parse(sessionsRaw);
        const todaySessions = all.filter(
          (s) => new Date(s.timestamp).toDateString() === today
        );
        setSessions(todaySessions);
      }

      if (historyRaw) {
        const history: DailyStats[] = JSON.parse(historyRaw);
        setWeekHistory(history.slice(-7));
      }

      if (notifRaw) {
        const notifs: Notification[] = JSON.parse(notifRaw);
        setNotifications(notifs.slice(-20));
      }

      if (parentRaw) {
        setParentSettings(JSON.parse(parentRaw));
      }

      const lastSyncRaw = await AsyncStorage.getItem(STORAGE_KEYS.lastSyncAt);
      if (lastSyncRaw) {
        const parsed = parseInt(lastSyncRaw, 10);
        if (!Number.isNaN(parsed)) {
          setLastSyncedAt(parsed);
        }
      }

      await refreshUsagePermission();
    } catch (e) {
      console.error("Error loading data:", e);
    }
  }, [refreshUsagePermission]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const computeStats = useCallback((todaySessions: AppSession[]): DailyStats => {
    const today = new Date().toDateString();
    let productive = 0, neutral = 0, distracting = 0, lateNight = 0;

    for (const s of todaySessions) {
      if (s.category === "productive") productive += s.minutes;
      else if (s.category === "neutral") neutral += s.minutes;
      else distracting += s.minutes;
      if (s.isLateNight) lateNight += s.minutes;
    }

    const total = productive + neutral + distracting;
    const { riskLevel, score, details } = evaluateUsage({
      totalMinutes: total,
      productiveMinutes: productive,
      neutralMinutes: neutral,
      distractingMinutes: distracting,
      sessionCount: todaySessions.length,
      lateNightMinutes: lateNight,
    });

    return {
      date: today,
      totalMinutes: total,
      productiveMinutes: productive,
      neutralMinutes: neutral,
      distractingMinutes: distracting,
      sessionCount: todaySessions.length,
      lateNightMinutes: lateNight,
      riskLevel,
      score,
      riskDetails: details,
    };
  }, []);

  const sendParentEmailReport = useCallback(
    async (stats: DailyStats) => {
      if (!parentSettings.parentAlertsEnabled) return;

      const targetEmail = parentSettings.email.trim();
      if (!targetEmail || !isValidEmail(targetEmail)) return;

      const today = new Date().toDateString();
      const lastSentDate = await AsyncStorage.getItem(STORAGE_KEYS.lastParentEmailDate);
      if (lastSentDate === today) return;

      const serviceId = process.env.EXPO_PUBLIC_EMAILJS_SERVICE_ID;
      const templateId = process.env.EXPO_PUBLIC_EMAILJS_TEMPLATE_ID;
      const publicKey = process.env.EXPO_PUBLIC_EMAILJS_PUBLIC_KEY;

      if (!serviceId || !templateId || !publicKey) {
        throw new Error(
          "EmailJS is not configured. Set EXPO_PUBLIC_EMAILJS_SERVICE_ID, EXPO_PUBLIC_EMAILJS_TEMPLATE_ID, EXPO_PUBLIC_EMAILJS_PUBLIC_KEY."
        );
      }

      const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          service_id: serviceId,
          template_id: templateId,
          // EmailJS has used both names across docs/SDK versions; send both for compatibility.
          user_id: publicKey,
          public_key: publicKey,
          template_params: {
            name: "WellScreen App",
            user_name: "Your Child",
            to_name: "Parent",
            email: targetEmail,
            to_email: targetEmail,
            risk_level: stats.riskLevel.toUpperCase(),
            total_time: `${stats.totalMinutes} minutes`,
            distracting_time: `${stats.distractingMinutes} minutes`,
          },
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Email send failed: ${response.status} ${body}`);
      }

      await AsyncStorage.setItem(STORAGE_KEYS.lastParentEmailDate, today);
      appendNotification({
        id: `${Date.now()}_parent_email`,
        message: `Parent alert sent to ${targetEmail}.`,
        type: "info",
        timestamp: Date.now(),
        read: false,
      });
    },
    [appendNotification, parentSettings.email, parentSettings.parentAlertsEnabled]
  );

  const maybeNotifyForRisk = useCallback(
    async (stats: DailyStats) => {
      if (!parentSettings.notificationsEnabled && !parentSettings.parentAlertsEnabled) {
        return;
      }

      if (stats.riskLevel === "healthy") return;

      const today = new Date().toDateString();
      const lastRiskRaw = await AsyncStorage.getItem(STORAGE_KEYS.lastRiskAlert);
      const lastRisk = lastRiskRaw ? JSON.parse(lastRiskRaw) as { date: string; level: RiskLevel } : null;

      if (lastRisk?.date === today && lastRisk.level === stats.riskLevel) {
        return;
      }

      if (parentSettings.notificationsEnabled) {
        const message =
          stats.riskLevel === "addictive"
            ? `Addictive usage detected: ${stats.totalMinutes}m total, ${stats.distractingMinutes}m distracting.`
            : `Warning level usage detected: ${stats.totalMinutes}m total today.`;

        appendNotification({
          id: `${Date.now()}_risk`,
          message,
          type: stats.riskLevel,
          timestamp: Date.now(),
          read: false,
        });
      }

      await AsyncStorage.setItem(
        STORAGE_KEYS.lastRiskAlert,
        JSON.stringify({ date: today, level: stats.riskLevel })
      );

      if (stats.riskLevel === "addictive") {
        try {
          await sendParentEmailReport(stats);
        } catch (error) {
          const reason =
            error instanceof Error
              ? error.message
              : typeof error === "string"
              ? error
              : "Unknown error";
          appendNotification({
            id: `${Date.now()}_email_error`,
            message: `Parent email failed to send: ${reason}`,
            type: "warning",
            timestamp: Date.now(),
            read: false,
          });
          console.error("Parent email error:", error);
        }
      }
    },
    [appendNotification, parentSettings.notificationsEnabled, parentSettings.parentAlertsEnabled, sendParentEmailReport]
  );

  const addSession = useCallback(
    async (appName: string, category: AppCategory, minutes: number) => {
      const session: AppSession = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        appName,
        category,
        minutes,
        timestamp: Date.now(),
        isLateNight: isLateNight(),
      };

      const updated = [...sessions, session];
      setSessions(updated);
      await AsyncStorage.setItem(STORAGE_KEYS.sessions, JSON.stringify(updated));

      const stats = computeStats(updated);
      await maybeNotifyForRisk(stats);
    },
    [computeStats, maybeNotifyForRisk, sessions]
  );

  const syncFromDeviceUsage = useCallback(async () => {
    if (Platform.OS !== "android" || !usageModule) return;
    if (!usagePermissionGranted || syncInFlightRef.current) return;

    syncInFlightRef.current = true;
    setIsSyncing(true);

    try {
      const now = Date.now();
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      // Prefer the range-accurate API when available.
      // (Some OEMs can return interval-bucketed results via queryUsageStats.)
      const rawAggregate = usageModule.queryAndAggregateUsageStats
        ? await usageModule.queryAndAggregateUsageStats(startOfDay.getTime(), now)
        : null;

      let rawList: Array<{
        packageName: string;
        totalTimeInForeground: number;
        totalTimeVisible?: number;
        totalTimeForegroundServiceUsed?: number;
        lastTimeUsed: number;
        firstTimeStamp?: number;
        lastTimeStamp?: number;
      }> = [];

      if (rawAggregate && typeof rawAggregate === "object") {
        rawList = Object.values(rawAggregate);
      } else {
        const rawUsage = await usageModule.queryUsageStats(
          startOfDay.getTime(),
          now
        );
        rawList = Array.isArray(rawUsage) ? rawUsage : [];
      }

      // Some OEMs / interval settings can return multiple rows per package.
      // Aggregate per package to avoid inflating totals.
      const byPackage = new Map<
        string,
        { packageName: string; usageMs: number; lastTimeUsed: number }
      >();

      for (const entry of rawList) {
        if (!entry?.packageName) continue;
        if (entry.packageName === appPackageName) continue;
        if (isSystemOrLauncherPackage(entry.packageName)) continue;

        const usageMs = pickUsageMs(entry);
        if (!Number.isFinite(usageMs) || usageMs <= 0) continue;

        const prev = byPackage.get(entry.packageName);
        if (!prev) {
          byPackage.set(entry.packageName, {
            packageName: entry.packageName,
            usageMs,
            lastTimeUsed: entry.lastTimeUsed || 0,
          });
        } else {
          prev.usageMs += usageMs;
          prev.lastTimeUsed = Math.max(prev.lastTimeUsed, entry.lastTimeUsed || 0);
        }
      }

      const nextSessions: AppSession[] = Array.from(byPackage.values())
        .map((agg) => {
          const minutes = msToMinutes(agg.usageMs);
          const appName = packageToName(agg.packageName);
          const category = inferCategory(agg.packageName, appName);

          return {
            id: `${agg.packageName}_${new Date().toDateString()}`,
            appName,
            category,
            minutes,
            timestamp: agg.lastTimeUsed || now,
            isLateNight:
              category === "distracting" &&
              !!agg.lastTimeUsed &&
              isLateNightTimestamp(agg.lastTimeUsed),
          };
        })
        .filter((s) => s.minutes > 0)
        .sort((a, b) => b.minutes - a.minutes);

      setSessions(nextSessions);
      await AsyncStorage.setItem(STORAGE_KEYS.sessions, JSON.stringify(nextSessions));

      setLastSyncedAt(now);
      await AsyncStorage.setItem(STORAGE_KEYS.lastSyncAt, String(now));

      const stats = computeStats(nextSessions);
      await maybeNotifyForRisk(stats);
    } catch (error) {
      console.error("Failed syncing device usage:", error);
    } finally {
      setIsSyncing(false);
      syncInFlightRef.current = false;
    }
  }, [
    appPackageName,
    computeStats,
    maybeNotifyForRisk,
    usageModule,
    usagePermissionGranted,
  ]);

  const requestUsagePermission = useCallback(async () => {
    if (Platform.OS !== "android" || !usageModule) return;
    try {
      await usageModule.openUsageAccessSettings(appPackageName);
    } catch (error) {
      console.error("Failed opening usage access settings:", error);
    }
  }, [appPackageName, usageModule]);

  useEffect(() => {
    if (!usageSyncSupported || !usagePermissionGranted) return;
    syncFromDeviceUsage();

    const timer = setInterval(() => {
      syncFromDeviceUsage();
    }, 60000);

    return () => clearInterval(timer);
  }, [syncFromDeviceUsage, usagePermissionGranted, usageSyncSupported]);

  useEffect(() => {
    if (!usageSyncSupported) return;

    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        refreshUsagePermission();
        syncFromDeviceUsage();
      }
    });

    return () => sub.remove();
  }, [refreshUsagePermission, syncFromDeviceUsage, usageSyncSupported]);

  const updateParentSettings = useCallback(
    async (settings: Partial<ParentSettings>) => {
      setParentSettings((prev) => {
        const updated = { ...prev, ...settings };
        AsyncStorage.setItem(
          STORAGE_KEYS.parentSettings,
          JSON.stringify(updated)
        );
        return updated;
      });
    },
    []
  );

  const markNotificationsRead = useCallback(async () => {
    setNotifications((prev) => {
      const updated = prev.map((n) => ({ ...n, read: true }));
      AsyncStorage.setItem(STORAGE_KEYS.notifications, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const clearTodayData = useCallback(async () => {
    const stats = computeStats(sessions);

    setWeekHistory((prev) => {
      const updated = [...prev.filter((h) => h.date !== stats.date), stats].slice(-7);
      AsyncStorage.setItem(STORAGE_KEYS.history, JSON.stringify(updated));
      return updated;
    });

    setSessions([]);
    await AsyncStorage.removeItem(STORAGE_KEYS.sessions);
  }, [sessions, computeStats]);

  const todayStats = computeStats(sessions);
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <ScreenTimeContext.Provider
      value={{
        sessions,
        todayStats,
        weekHistory,
        notifications,
        unreadCount,
        parentSettings,
        usageSyncSupported,
        usagePermissionGranted,
        isSyncing,
        lastSyncedAt,
        addSession,
        syncFromDeviceUsage,
        requestUsagePermission,
        refreshUsagePermission,
        updateParentSettings,
        markNotificationsRead,
        clearTodayData,
      }}
    >
      {children}
    </ScreenTimeContext.Provider>
  );
}

export function useScreenTime() {
  const ctx = useContext(ScreenTimeContext);
  if (!ctx) throw new Error("useScreenTime must be used inside ScreenTimeProvider");
  return ctx;
}
