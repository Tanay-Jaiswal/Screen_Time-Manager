import React, { useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useScreenTime } from "@/lib/screenTimeContext";
import { Notification } from "@/lib/screenTimeContext";
import Colors from "@/constants/colors";

const TYPE_CONFIG = {
  warning: {
    color: Colors.palette.yellow,
    dimColor: Colors.palette.yellowDim,
    icon: "warning",
  },
  addictive: {
    color: Colors.palette.red,
    dimColor: Colors.palette.redDim,
    icon: "alert-circle",
  },
  info: {
    color: Colors.palette.accent,
    dimColor: Colors.palette.accentDim,
    icon: "information-circle",
  },
};

function NotificationCard({ notif }: { notif: Notification }) {
  const conf = TYPE_CONFIG[notif.type];
  const time = new Date(notif.timestamp);
  const timeStr = time.toLocaleTimeString("en", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  const dateStr = time.toLocaleDateString("en", {
    month: "short",
    day: "numeric",
  });

  return (
    <View
      style={[
        styles.notifCard,
        !notif.read && { borderLeftColor: conf.color, borderLeftWidth: 3 },
      ]}
    >
      <View style={[styles.notifIcon, { backgroundColor: conf.dimColor }]}>
        <Ionicons name={conf.icon as any} size={18} color={conf.color} />
      </View>
      <View style={styles.notifContent}>
        <Text style={styles.notifMessage}>{notif.message}</Text>
        <Text style={styles.notifTime}>
          {dateStr} · {timeStr}
        </Text>
      </View>
      {!notif.read && <View style={[styles.unreadDot, { backgroundColor: conf.color }]} />}
    </View>
  );
}

export default function AlertsScreen() {
  const insets = useSafeAreaInsets();
  const { notifications, markNotificationsRead, unreadCount } = useScreenTime();

  const sorted = [...notifications].sort((a, b) => b.timestamp - a.timestamp);

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
            <Text style={styles.headerTitle}>Alerts</Text>
            {unreadCount > 0 && (
              <Text style={styles.headerSubtitle}>
                {unreadCount} unread notification{unreadCount !== 1 ? "s" : ""}
              </Text>
            )}
          </View>
          {unreadCount > 0 && (
            <Pressable
              onPress={markNotificationsRead}
              style={({ pressed }) => [styles.markReadBtn, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="checkmark-done" size={14} color={Colors.palette.accent} />
              <Text style={styles.markReadText}>Mark all read</Text>
            </Pressable>
          )}
        </View>

        {/* Fuzzy Logic Key */}
        <View style={styles.legendCard}>
          <Text style={styles.legendTitle}>How Risk is Evaluated</Text>
          <View style={styles.legendGrid}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: Colors.palette.green }]} />
              <View>
                <Text style={styles.legendLabel}>Healthy</Text>
                <Text style={styles.legendDesc}>Low usage, low distraction</Text>
              </View>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: Colors.palette.yellow }]} />
              <View>
                <Text style={styles.legendLabel}>Warning</Text>
                <Text style={styles.legendDesc}>Moderate usage or high frequency</Text>
              </View>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: Colors.palette.red }]} />
              <View>
                <Text style={styles.legendLabel}>Addictive</Text>
                <Text style={styles.legendDesc}>High usage + distracting apps</Text>
              </View>
            </View>
          </View>
          <View style={styles.legendRule}>
            <Ionicons name="moon" size={14} color={Colors.palette.yellow} />
            <Text style={styles.legendRuleText}>
              Late-night usage on social media escalates risk automatically
            </Text>
          </View>
        </View>

        {/* Notifications */}
        {sorted.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="notifications-off-outline" size={40} color={Colors.palette.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>No Alerts Yet</Text>
            <Text style={styles.emptyText}>
              You will receive alerts when your screen time becomes unhealthy or addictive.
            </Text>
          </View>
        ) : (
          <View>
            <Text style={styles.sectionTitle}>Notification History</Text>
            <View style={styles.notifList}>
              {sorted.map((n) => (
                <NotificationCard key={n.id} notif={n} />
              ))}
            </View>
          </View>
        )}
      </ScrollView>
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
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: Colors.palette.textPrimary,
  },
  headerSubtitle: {
    fontSize: 13,
    color: Colors.palette.textSecondary,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
  },
  markReadBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.palette.accentDim,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 4,
  },
  markReadText: {
    fontSize: 12,
    color: Colors.palette.accent,
    fontFamily: "Inter_500Medium",
  },
  legendCard: {
    backgroundColor: Colors.palette.navyCard,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  legendTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.palette.textPrimary,
    marginBottom: 12,
  },
  legendGrid: {
    gap: 10,
    marginBottom: 12,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.palette.textPrimary,
  },
  legendDesc: {
    fontSize: 12,
    color: Colors.palette.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  legendRule: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.palette.yellowDim,
    borderRadius: 10,
    padding: 10,
  },
  legendRuleText: {
    flex: 1,
    fontSize: 12,
    color: Colors.palette.yellow,
    fontFamily: "Inter_400Regular",
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.palette.textPrimary,
    marginBottom: 12,
  },
  notifList: {
    gap: 8,
  },
  notifCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: Colors.palette.navyCard,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.palette.navyBorder,
  },
  notifIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  notifContent: {
    flex: 1,
  },
  notifMessage: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.palette.textPrimary,
    lineHeight: 20,
  },
  notifTime: {
    fontSize: 12,
    color: Colors.palette.textMuted,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 4,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: Colors.palette.navyCard,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: Colors.palette.textPrimary,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.palette.textSecondary,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 280,
  },
});
