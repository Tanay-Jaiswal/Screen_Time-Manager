import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import emailjs from "@emailjs/browser";
import {
  AppCategory,
  RiskLevel,
  evaluateUsage,
  isLateNight,
  PREDEFINED_APPS,
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
  addSession: (appName: string, category: AppCategory, minutes: number) => void;
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
};

export function ScreenTimeProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<AppSession[]>([]);
  const [weekHistory, setWeekHistory] = useState<DailyStats[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [parentSettings, setParentSettings] = useState<ParentSettings>({
    email: "",
    phone: "",
    notificationsEnabled: true,
    parentAlertsEnabled: false,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
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
    } catch (e) {
      console.error("Error loading data:", e);
    }
  };

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

  const addSession = useCallback(
    async (appName: string, category: AppCategory, minutes: number) => {
      const session: AppSession = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 6),
        appName,
        category,
        minutes,
        timestamp: Date.now(),
        isLateNight: isLateNight(),
      };

      setSessions((prev) => {
        const updated = [...prev, session];

        const stats = computeStats(updated);
        const newNotifs: Notification[] = [];

        if (stats.riskLevel === "warning" || stats.riskLevel === "addictive") {
          const msg =
            stats.riskLevel === "addictive"
              ? `You've spent ${stats.totalMinutes}m on screen today. Usage classified as addictive.`
              : `You're at ${stats.totalMinutes}m of screen time. Consider taking a break.`;

          newNotifs.push({
            id: Date.now().toString(),
            message: msg,
            type: stats.riskLevel,
            timestamp: Date.now(),
            read: false,
          });
        }

        if (session.isLateNight && category === "distracting") {
          newNotifs.push({
            id: (Date.now() + 1).toString(),
            message: "Late-night screen usage detected. Consider resting.",
            type: "warning",
            timestamp: Date.now(),
            read: false,
          });
        }

        if (newNotifs.length > 0) {
  setNotifications((prevN) => {
    const merged = [...prevN, ...newNotifs].slice(-20);
    AsyncStorage.setItem(STORAGE_KEYS.notifications, JSON.stringify(merged));
    return merged;
  });

  // Send parent email if usage is addictive
  // Send parent email if usage is addictive
console.log("Risk level:", stats.riskLevel);
console.log("Parent alerts enabled:", parentSettings.parentAlertsEnabled);
console.log("Parent email:", parentSettings.email);
if (stats.riskLevel === "addictive" && parentSettings.parentAlertsEnabled && parentSettings.email) {
    emailjs.send(
  "service_jbfawvz",
  "template_vn448tr",
  {
    name: "WellScreen App",
    user_name: "Your Child",
    to_name: "Parent",
    email: parentSettings.email,
    risk_level: "ADDICTIVE 🔴",
    total_time: `${stats.totalMinutes} minutes`,
    distracting_time: `${stats.distractingMinutes} minutes`,
    to_email: parentSettings.email,
  },
  "pY3CotdFWhTP2ZLTC"
).then(() => {
  console.log("Email sent successfully!");
}).catch((err) => {
  console.error("Email error:", err);
});
  }
}

        AsyncStorage.setItem(STORAGE_KEYS.sessions, JSON.stringify(updated));
        return updated;
      });
    },
    [computeStats]
  );

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
        addSession,
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
