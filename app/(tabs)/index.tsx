import React, { useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Platform,
  Pressable,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useScreenTime } from "@/lib/screenTimeContext";
import { formatMinutes, RiskLevel } from "@/lib/fuzzyLogic";
import Colors from "@/constants/colors";
import Toast from "@/components/Toast";

const { width } = Dimensions.get("window");

const RISK_CONFIG: Record<
  RiskLevel,
  { label: string; color: string; dimColor: string; icon: string; gradient: [string, string] }
> = {
  healthy: {
    label: "Healthy",
    color: Colors.palette.green,
    dimColor: Colors.palette.greenDim,
    icon: "checkmark-circle",
    gradient: ["#1A4A38", "#0F2D22"],
  },
  warning: {
    label: "Warning",
    color: Colors.palette.yellow,
    dimColor: Colors.palette.yellowDim,
    icon: "warning",
    gradient: ["#4A3A10", "#2D2208"],
  },
  addictive: {
    label: "Addictive",
    color: Colors.palette.red,
    dimColor: Colors.palette.redDim,
    icon: "alert-circle",
    gradient: ["#4A1520", "#2D0C14"],
  },
};

function RiskGauge({ score, level }: { score: number; level: RiskLevel }) {
  const config = RISK_CONFIG[level];
  const segments = 20;
  const filled = Math.round((score / 100) * segments);

  return (
    <View style={styles.gaugeContainer}>
      <View style={styles.gaugeBars}>
        {Array.from({ length: segments }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.gaugeBar,
              {
                backgroundColor:
                  i < filled ? config.color : Colors.palette.navyBorder,
                opacity: i < filled ? 1 - (segments - i - 1) * 0.03 : 0.3,
              },
            ]}
          />
        ))}
      </View>
      <Text style={[styles.gaugeScore, { color: config.color }]}>{score}</Text>
      <Text style={styles.gaugeLabel}>Risk Score</Text>
    </View>
  );
}

function StatCard({
  label,
  value,
  color,
  icon,
  sublabel,
}: {
  label: string;
  value: string;
  color: string;
  icon: string;
  sublabel?: string;
}) {
  return (
    <View style={[styles.statCard, { borderColor: color + "30" }]}>
      <View style={[styles.statIcon, { backgroundColor: color + "20" }]}>
        <Ionicons name={icon as any} size={18} color={color} />
      </View>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {sublabel && <Text style={styles.statSublabel}>{sublabel}</Text>}
    </View>
  );
}

function WeekBar({
  stats,
  maxMinutes,
  isToday,
}: {
  stats: { date: string; totalMinutes: number; riskLevel: RiskLevel };
  maxMinutes: number;
  isToday?: boolean;
}) {
  const config = RISK_CONFIG[stats.riskLevel];
  const pct = maxMinutes > 0 ? stats.totalMinutes / maxMinutes : 0;
  const dayName = new Date(stats.date).toLocaleDateString("en", { weekday: "short" });

  return (
    <View style={styles.weekBar}>
      <View style={styles.weekBarTrack}>
        <View
          style={[
            styles.weekBarFill,
            {
              height: `${Math.max(pct * 100, 4)}%` as any,
              backgroundColor: config.color,
              opacity: isToday ? 1 : 0.5,
            },
          ]}
        />
      </View>
      <Text style={[styles.weekBarDay, isToday && { color: Colors.palette.accent }]}>
        {dayName}
      </Text>
    </View>
  );
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { todayStats, weekHistory, sessions } = useScreenTime();

  const riskConfig = RISK_CONFIG[todayStats.riskLevel];
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"warning" | "addictive" | "info">("info");
  useEffect(() => {
  if (todayStats.riskLevel === "warning" || todayStats.riskLevel === "addictive") {
    setToastMessage(
      todayStats.riskLevel === "addictive"
        ? "🔴 Addictive usage detected! Take a break."
        : "⚠️ Warning! Your screen time is getting high."
    );
    setToastType(todayStats.riskLevel);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 4500);
  }
  }, [todayStats.riskLevel, todayStats.totalMinutes]);

  const allHistory = useMemo(() => {
    const todayEntry = { ...todayStats, date: new Date().toDateString() };
    const past = weekHistory.filter((h) => h.date !== todayEntry.date);
    return [...past, todayEntry];
  }, [weekHistory, todayStats]);

  const maxMinutes = useMemo(
    () => Math.max(...allHistory.map((h) => h.totalMinutes), 60),
    [allHistory]
  );

  const topApps = useMemo(() => {
    const map: Record<string, { minutes: number; category: string }> = {};
    for (const s of sessions) {
      if (!map[s.appName]) map[s.appName] = { minutes: 0, category: s.category };
      map[s.appName].minutes += s.minutes;
    }
    return Object.entries(map)
      .sort((a, b) => b[1].minutes - a[1].minutes)
      .slice(0, 5);
  }, [sessions]);

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : 0;

  return (
    <View style={styles.container}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: topInset + 20, paddingBottom: bottomInset + 100 },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerGreeting}>Good{" "}
              {new Date().getHours() < 12 ? "morning" :
               new Date().getHours() < 17 ? "afternoon" : "evening"}
            </Text>
            <Text style={styles.headerTitle}>Your Screen Time</Text>
          </View>
          <View style={[styles.riskBadge, { backgroundColor: riskConfig.dimColor }]}>
            <Ionicons name={riskConfig.icon as any} size={14} color={riskConfig.color} />
            <Text style={[styles.riskBadgeText, { color: riskConfig.color }]}>
              {riskConfig.label}
            </Text>
          </View>
        </View>

        {/* Hero Card */}
        <LinearGradient
          colors={riskConfig.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroLeft}>
            <Text style={styles.heroTime}>
              {formatMinutes(todayStats.totalMinutes)}
            </Text>
            <Text style={styles.heroSubtext}>total screen time today</Text>
            {todayStats.riskDetails.length > 0 && (
              <View style={styles.heroDetail}>
                <Ionicons
                  name="information-circle"
                  size={13}
                  color="rgba(255,255,255,0.6)"
                />
                <Text style={styles.heroDetailText}>
                  {todayStats.riskDetails[0]}
                </Text>
              </View>
            )}
          </View>
          <RiskGauge score={todayStats.score} level={todayStats.riskLevel} />
        </LinearGradient>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <StatCard
            label="Productive"
            value={formatMinutes(todayStats.productiveMinutes)}
            color={Colors.palette.green}
            icon="book"
          />
          <StatCard
            label="Neutral"
            value={formatMinutes(todayStats.neutralMinutes)}
            color={Colors.palette.accent}
            icon="globe"
          />
          <StatCard
            label="Distracting"
            value={formatMinutes(todayStats.distractingMinutes)}
            color={Colors.palette.red}
            icon="game-controller"
          />
        </View>

        {/* Sessions Count */}
        <View style={styles.sessionRow}>
          <Ionicons name="phone-portrait" size={16} color={Colors.palette.textSecondary} />
          <Text style={styles.sessionText}>
            {todayStats.sessionCount} sessions logged today
          </Text>
          {todayStats.lateNightMinutes > 0 && (
            <View style={styles.lateNightBadge}>
              <Ionicons name="moon" size={12} color={Colors.palette.yellow} />
              <Text style={styles.lateNightText}>
                {formatMinutes(todayStats.lateNightMinutes)} late night
              </Text>
            </View>
          )}
        </View>

        {/* Weekly Overview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>7-Day Overview</Text>
          <View style={styles.weekChart}>
            {allHistory.length === 0 ? (
              <View style={styles.emptyWeek}>
                <Ionicons name="bar-chart-outline" size={32} color={Colors.palette.textMuted} />
                <Text style={styles.emptyWeekText}>No history yet</Text>
              </View>
            ) : (
              allHistory.map((h, i) => (
                <WeekBar
                  key={h.date}
                  stats={h}
                  maxMinutes={maxMinutes}
                  isToday={h.date === new Date().toDateString()}
                />
              ))
            )}
          </View>
        </View>

        {/* Top Apps */}
        {topApps.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Top Apps Today</Text>
            <View style={styles.appList}>
              {topApps.map(([name, data]) => {
                const pct =
                  todayStats.totalMinutes > 0
                    ? data.minutes / todayStats.totalMinutes
                    : 0;
                const color =
                  data.category === "productive"
                    ? Colors.palette.green
                    : data.category === "distracting"
                    ? Colors.palette.red
                    : Colors.palette.accent;
                return (
                  <View key={name} style={styles.appRow}>
                    <View style={[styles.appDot, { backgroundColor: color }]} />
                    <Text style={styles.appName} numberOfLines={1}>{name}</Text>
                    <View style={styles.appBarContainer}>
                      <View
                        style={[
                          styles.appBar,
                          { width: `${Math.max(pct * 100, 2)}%` as any, backgroundColor: color },
                        ]}
                      />
                    </View>
                    <Text style={[styles.appTime, { color }]}>
                      {formatMinutes(data.minutes)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>
      <Toast
        message={toastMessage}
        type={toastType}
        visible={toastVisible}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.palette.navy,
  },
  scroll: {
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  headerGreeting: {
    fontSize: 13,
    color: Colors.palette.textSecondary,
    fontFamily: "Inter_400Regular",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  headerTitle: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: Colors.palette.textPrimary,
    marginTop: 2,
  },
  riskBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  riskBadgeText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  heroCard: {
    borderRadius: 20,
    padding: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    overflow: "hidden",
  },
  heroLeft: {
    flex: 1,
  },
  heroTime: {
    fontSize: 48,
    fontFamily: "Inter_700Bold",
    color: Colors.palette.textPrimary,
    lineHeight: 56,
  },
  heroSubtext: {
    fontSize: 13,
    color: "rgba(255,255,255,0.6)",
    fontFamily: "Inter_400Regular",
    marginTop: 4,
  },
  heroDetail: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 10,
  },
  heroDetailText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.5)",
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  gaugeContainer: {
    alignItems: "center",
    width: 80,
  },
  gaugeBars: {
    flexDirection: "row",
    gap: 2,
    alignItems: "flex-end",
    height: 50,
    marginBottom: 8,
  },
  gaugeBar: {
    width: 3,
    height: "100%",
    borderRadius: 2,
  },
  gaugeScore: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
  },
  gaugeLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.5)",
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.palette.navyCard,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
  },
  statIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  statValue: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
  },
  statLabel: {
    fontSize: 11,
    color: Colors.palette.textSecondary,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
    textAlign: "center",
  },
  statSublabel: {
    fontSize: 10,
    color: Colors.palette.textMuted,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  sessionText: {
    fontSize: 13,
    color: Colors.palette.textSecondary,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  lateNightBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.palette.yellowDim,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  lateNightText: {
    fontSize: 11,
    color: Colors.palette.yellow,
    fontFamily: "Inter_500Medium",
  },
  section: {
    marginBottom: 22,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.palette.textPrimary,
    marginBottom: 14,
  },
  weekChart: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    backgroundColor: Colors.palette.navyCard,
    borderRadius: 16,
    padding: 16,
    height: 120,
  },
  weekBar: {
    flex: 1,
    alignItems: "center",
    height: "100%",
    justifyContent: "flex-end",
  },
  weekBarTrack: {
    flex: 1,
    width: "60%",
    borderRadius: 4,
    backgroundColor: Colors.palette.navyBorder,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  weekBarFill: {
    width: "100%",
    borderRadius: 4,
  },
  weekBarDay: {
    fontSize: 11,
    color: Colors.palette.textSecondary,
    fontFamily: "Inter_400Regular",
    marginTop: 6,
  },
  emptyWeek: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyWeekText: {
    fontSize: 13,
    color: Colors.palette.textMuted,
    fontFamily: "Inter_400Regular",
  },
  appList: {
    backgroundColor: Colors.palette.navyCard,
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  appRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  appDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  appName: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.palette.textPrimary,
    width: 80,
  },
  appBarContainer: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.palette.navyBorder,
    borderRadius: 3,
    overflow: "hidden",
  },
  appBar: {
    height: "100%",
    borderRadius: 3,
  },
  appTime: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    width: 42,
    textAlign: "right",
  },
});
