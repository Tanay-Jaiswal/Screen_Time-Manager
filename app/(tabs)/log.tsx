import React from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useScreenTime } from "@/lib/screenTimeContext";
import { formatMinutes } from "@/lib/fuzzyLogic";
import Colors from "@/constants/colors";

const CATEGORY_CONFIG = {
  productive: { label: "Productive", color: Colors.palette.green, icon: "book" },
  neutral: { label: "Neutral", color: Colors.palette.accent, icon: "globe" },
  distracting: { label: "Distracting", color: Colors.palette.red, icon: "game-controller" },
} as const;

export default function LogScreen() {
  const insets = useSafeAreaInsets();
  const {
    sessions,
    isSyncing,
    usageSyncSupported,
    usagePermissionGranted,
    syncFromDeviceUsage,
    requestUsagePermission,
    lastSyncedAt,
  } = useScreenTime();

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : 0;

  const todaySessions = sessions.slice(0, 15);

  const totalMinutes = todaySessions.reduce((sum, s) => sum + s.minutes, 0);
  const distractingMinutes = todaySessions
    .filter((s) => s.category === "distracting")
    .reduce((sum, s) => sum + s.minutes, 0);

  const handleSync = async () => {
    await syncFromDeviceUsage();
    Haptics.selectionAsync();
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: topInset + 20, paddingBottom: bottomInset + 100 },
        ]}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Device Usage</Text>
          <Text style={styles.headerSubtitle}>Automatically synced from Android system usage</Text>
        </View>

        {!usageSyncSupported && (
          <View style={styles.unsupportedCard}>
            <Ionicons name="warning" size={18} color={Colors.palette.yellow} />
            <Text style={styles.unsupportedText}>
              Automatic usage sync is available on Android builds. It is not available in this runtime.
            </Text>
          </View>
        )}

        {usageSyncSupported && !usagePermissionGranted && (
          <View style={styles.permissionCard}>
            <View style={styles.permissionHeader}>
              <Ionicons name="shield-checkmark" size={18} color={Colors.palette.yellow} />
              <Text style={styles.permissionTitle}>Usage Access Required</Text>
            </View>
            <Text style={styles.permissionText}>
              Enable Usage Access for WellScreen in Android Settings to read screen time automatically.
            </Text>
            <Pressable
              onPress={requestUsagePermission}
              style={({ pressed }) => [styles.permissionButton, pressed && styles.pressed]}
            >
              <Ionicons name="open" size={16} color="#fff" />
              <Text style={styles.permissionButtonText}>Open Usage Access Settings</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Today Summary</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryTile}>
              <Text style={styles.summaryValue}>{formatMinutes(totalMinutes)}</Text>
              <Text style={styles.summaryLabel}>Total</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryTile}>
              <Text style={[styles.summaryValue, { color: Colors.palette.red }]}>
                {formatMinutes(distractingMinutes)}
              </Text>
              <Text style={styles.summaryLabel}>Distracting</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryTile}>
              <Text style={styles.summaryValue}>{todaySessions.length}</Text>
              <Text style={styles.summaryLabel}>Apps</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Sync</Text>
          <Pressable
            onPress={handleSync}
            disabled={!usagePermissionGranted || isSyncing}
            style={({ pressed }) => [
              styles.syncButton,
              (!usagePermissionGranted || isSyncing) && styles.syncButtonDisabled,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name={isSyncing ? "sync" : "refresh"}
              size={18}
              color="#fff"
            />
            <Text style={styles.syncButtonText}>
              {isSyncing ? "Syncing..." : "Sync Now"}
            </Text>
          </Pressable>
          <Text style={styles.syncMeta}>
            {lastSyncedAt
              ? `Last sync: ${new Date(lastSyncedAt).toLocaleTimeString()}`
              : "No sync yet"}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Top Apps Today</Text>
          {todaySessions.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="time-outline" size={24} color={Colors.palette.textMuted} />
              <Text style={styles.emptyText}>
                {usagePermissionGranted
                  ? "No usage data available yet. Try syncing again in a minute."
                  : "Enable Usage Access first to load your app usage."}
              </Text>
            </View>
          ) : (
            <View style={styles.sessionList}>
              {todaySessions.map((s) => {
                const conf = CATEGORY_CONFIG[s.category];
                return (
                  <View key={s.id} style={styles.sessionItem}>
                    <View style={[styles.sessionCatDot, { backgroundColor: conf.color }]} />
                    <View style={styles.sessionInfo}>
                      <Text style={styles.sessionAppName}>{s.appName}</Text>
                      <Text style={styles.sessionMeta}>{conf.label}</Text>
                    </View>
                    <Text style={[styles.sessionDuration, { color: conf.color }]}>
                      {formatMinutes(s.minutes)}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>
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
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: Colors.palette.textPrimary,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.palette.textSecondary,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
  },
  unsupportedCard: {
    borderWidth: 1,
    borderColor: Colors.palette.yellow + "60",
    backgroundColor: Colors.palette.yellowDim,
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    marginBottom: 16,
  },
  unsupportedText: {
    flex: 1,
    color: Colors.palette.yellow,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 18,
  },
  permissionCard: {
    borderWidth: 1,
    borderColor: Colors.palette.navyBorder,
    backgroundColor: Colors.palette.navyCard,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    gap: 10,
  },
  permissionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  permissionTitle: {
    color: Colors.palette.textPrimary,
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  permissionText: {
    color: Colors.palette.textSecondary,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 18,
  },
  permissionButton: {
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.palette.accent,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  permissionButtonText: {
    color: "#fff",
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  section: {
    marginBottom: 22,
  },
  sectionLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.palette.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  summaryRow: {
    backgroundColor: Colors.palette.navyCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.palette.navyBorder,
    paddingVertical: 12,
    paddingHorizontal: 6,
    flexDirection: "row",
  },
  summaryTile: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryValue: {
    color: Colors.palette.textPrimary,
    fontFamily: "Inter_700Bold",
    fontSize: 18,
  },
  summaryLabel: {
    color: Colors.palette.textSecondary,
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    marginTop: 4,
  },
  summaryDivider: {
    width: 1,
    backgroundColor: Colors.palette.navyBorder,
  },
  syncButton: {
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.palette.accent,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  syncButtonDisabled: {
    opacity: 0.5,
  },
  syncButtonText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  syncMeta: {
    marginTop: 8,
    fontSize: 12,
    color: Colors.palette.textMuted,
    fontFamily: "Inter_400Regular",
  },
  sessionList: {
    borderWidth: 1,
    borderColor: Colors.palette.navyBorder,
    backgroundColor: Colors.palette.navyCard,
    borderRadius: 12,
    overflow: "hidden",
  },
  sessionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: Colors.palette.navyBorder,
  },
  sessionCatDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sessionInfo: {
    flex: 1,
  },
  sessionAppName: {
    color: Colors.palette.textPrimary,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
  sessionMeta: {
    color: Colors.palette.textMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginTop: 2,
  },
  sessionDuration: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  emptyCard: {
    borderWidth: 1,
    borderColor: Colors.palette.navyBorder,
    borderRadius: 12,
    backgroundColor: Colors.palette.navyCard,
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: "center",
    gap: 8,
  },
  emptyText: {
    textAlign: "center",
    color: Colors.palette.textSecondary,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.75,
  },
});
