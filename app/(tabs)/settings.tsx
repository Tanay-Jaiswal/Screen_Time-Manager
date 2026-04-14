import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Platform,
  TextInput,
  Switch,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useScreenTime } from "@/lib/screenTimeContext";
import { formatMinutes } from "@/lib/fuzzyLogic";
import Colors from "@/constants/colors";

function SettingRow({
  label,
  description,
  icon,
  iconColor,
  right,
}: {
  label: string;
  description?: string;
  icon: string;
  iconColor: string;
  right: React.ReactNode;
}) {
  return (
    <View style={styles.settingRow}>
      <View style={[styles.settingIcon, { backgroundColor: iconColor + "20" }]}>
        <Ionicons name={icon as any} size={18} color={iconColor} />
      </View>
      <View style={styles.settingInfo}>
        <Text style={styles.settingLabel}>{label}</Text>
        {description && <Text style={styles.settingDesc}>{description}</Text>}
      </View>
      {right}
    </View>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const {
    parentSettings,
    updateParentSettings,
    todayStats,
    weekHistory,
    clearTodayData,
  } = useScreenTime();

  const [email, setEmail] = useState(parentSettings.email);
  const [phone, setPhone] = useState(parentSettings.phone);
  const [emailEditing, setEmailEditing] = useState(false);
  const [phoneEditing, setPhoneEditing] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSaveContact = () => {
    updateParentSettings({ email, phone });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClearData = () => {
    if (Platform.OS === "web") {
      const confirmed = window.confirm(
        "This will archive today's data and reset your sessions. Continue?"
      );
      if (confirmed) {
        clearTodayData();
      }
    } else {
      Alert.alert(
        "Reset Today's Data",
        "This will archive today's data to history and reset your session counter. Continue?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Reset",
            style: "destructive",
            onPress: () => {
              clearTodayData();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            },
          },
        ]
      );
    }
  };

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : 0;

  const allDays = [...weekHistory, { ...todayStats, date: new Date().toDateString() }];
  const avgMinutes =
    allDays.length > 0
      ? Math.round(allDays.reduce((s, d) => s + d.totalMinutes, 0) / allDays.length)
      : 0;

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
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Settings</Text>
          <Text style={styles.headerSubtitle}>Configure WellScreen</Text>
        </View>

        {/* Summary Card */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Weekly Summary</Text>
          <View style={styles.summaryStats}>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryStatValue}>
                {formatMinutes(avgMinutes)}
              </Text>
              <Text style={styles.summaryStatLabel}>Avg / day</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryStat}>
              <Text style={styles.summaryStatValue}>{allDays.length}</Text>
              <Text style={styles.summaryStatLabel}>Days tracked</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryStat}>
              <Text
                style={[
                  styles.summaryStatValue,
                  {
                    color:
                      todayStats.riskLevel === "healthy"
                        ? Colors.palette.green
                        : todayStats.riskLevel === "warning"
                        ? Colors.palette.yellow
                        : Colors.palette.red,
                  },
                ]}
              >
                {todayStats.riskLevel === "healthy"
                  ? "Healthy"
                  : todayStats.riskLevel === "warning"
                  ? "Warning"
                  : "Addictive"}
              </Text>
              <Text style={styles.summaryStatLabel}>Today</Text>
            </View>
          </View>
          {todayStats.riskLevel !== "healthy" && (
            <View style={styles.parentReportPreview}>
              <Ionicons name="mail" size={14} color={Colors.palette.accent} />
              <Text style={styles.parentReportText}>
                Parent Report Preview: {formatMinutes(todayStats.totalMinutes)} total ·{" "}
                {formatMinutes(todayStats.distractingMinutes)} distracting · Risk:{" "}
                {todayStats.riskLevel}
              </Text>
            </View>
          )}
        </View>

        {/* Notifications */}
        <SectionHeader title="Notifications" />
        <View style={styles.card}>
          <SettingRow
            label="In-App Alerts"
            description="Get notified when usage is unhealthy"
            icon="notifications"
            iconColor={Colors.palette.accent}
            right={
              <Switch
                value={parentSettings.notificationsEnabled}
                onValueChange={(v) => {
                  updateParentSettings({ notificationsEnabled: v });
                  Haptics.selectionAsync();
                }}
                trackColor={{
                  false: Colors.palette.navyBorder,
                  true: Colors.palette.accent,
                }}
                thumbColor="#fff"
              />
            }
          />
        </View>

        {/* Parent Alert System */}
        <SectionHeader title="Parent Alert System" />
        <View style={styles.card}>
          <SettingRow
            label="Parent Alerts"
            description="Send daily report when usage is addictive"
            icon="people"
            iconColor={Colors.palette.yellow}
            right={
              <Switch
                value={parentSettings.parentAlertsEnabled}
                onValueChange={(v) => {
                  updateParentSettings({ parentAlertsEnabled: v });
                  Haptics.selectionAsync();
                }}
                trackColor={{
                  false: Colors.palette.navyBorder,
                  true: Colors.palette.yellow,
                }}
                thumbColor="#fff"
              />
            }
          />

          {parentSettings.parentAlertsEnabled && (
            <View style={styles.contactFields}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Parent Email</Text>
                <View style={styles.inputRow}>
                  <Ionicons
                    name="mail"
                    size={16}
                    color={
                      emailEditing ? Colors.palette.accent : Colors.palette.textMuted
                    }
                  />
                  <TextInput
                    style={styles.textInput}
                    value={email}
                    onChangeText={setEmail}
                    onFocus={() => setEmailEditing(true)}
                    onBlur={() => setEmailEditing(false)}
                    placeholder="parent@example.com"
                    placeholderTextColor={Colors.palette.textMuted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Parent Phone</Text>
                <View style={styles.inputRow}>
                  <Ionicons
                    name="call"
                    size={16}
                    color={
                      phoneEditing ? Colors.palette.accent : Colors.palette.textMuted
                    }
                  />
                  <TextInput
                    style={styles.textInput}
                    value={phone}
                    onChangeText={setPhone}
                    onFocus={() => setPhoneEditing(true)}
                    onBlur={() => setPhoneEditing(false)}
                    placeholder="+1 (555) 000-0000"
                    placeholderTextColor={Colors.palette.textMuted}
                    keyboardType="phone-pad"
                  />
                </View>
              </View>

              <Pressable
                onPress={handleSaveContact}
                style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.7 }]}
              >
                {saved ? (
                  <>
                    <Ionicons name="checkmark-circle" size={16} color="#fff" />
                    <Text style={styles.saveBtnText}>Saved!</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="save" size={16} color="#fff" />
                    <Text style={styles.saveBtnText}>Save Contact</Text>
                  </>
                )}
              </Pressable>

              {(parentSettings.email || parentSettings.phone) && (
                <View style={styles.savedContact}>
                  <Ionicons name="person-circle" size={16} color={Colors.palette.green} />
                  <Text style={styles.savedContactText}>
                    Contact saved:{" "}
                    {parentSettings.email || parentSettings.phone}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Data Management */}
        <SectionHeader title="Data" />
        <View style={styles.card}>
          <SettingRow
            label="Usage Permission"
            description="Required to access screen time data"
            icon="shield-checkmark"
            iconColor={Colors.palette.green}
            right={
              <View style={styles.permBadge}>
                <Text style={styles.permBadgeText}>Active</Text>
              </View>
            }
          />
          <View style={styles.rowDivider} />
          <Pressable onPress={handleClearData} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
            <SettingRow
              label="Reset Today"
              description="Archive today's data and reset sessions"
              icon="refresh-circle"
              iconColor={Colors.palette.red}
              right={
                <Ionicons name="chevron-forward" size={16} color={Colors.palette.textMuted} />
              }
            />
          </Pressable>
        </View>

        {/* About */}
        <SectionHeader title="About" />
        <View style={styles.card}>
          <SettingRow
            label="WellScreen"
            description="Intelligent Screen Time Controller"
            icon="phone-portrait"
            iconColor={Colors.palette.accent}
            right={
              <Text style={styles.versionText}>v1.0</Text>
            }
          />
          <View style={styles.rowDivider} />
          <SettingRow
            label="Fuzzy Logic Engine"
            description="Rules-based wellness evaluation"
            icon="analytics"
            iconColor={Colors.palette.yellow}
            right={
              <Ionicons name="checkmark-circle" size={18} color={Colors.palette.green} />
            }
          />
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
    marginBottom: 20,
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
  summaryCard: {
    backgroundColor: Colors.palette.navyCard,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.palette.navyBorder,
  },
  summaryTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.palette.textPrimary,
    marginBottom: 14,
  },
  summaryStats: {
    flexDirection: "row",
    alignItems: "center",
  },
  summaryStat: {
    flex: 1,
    alignItems: "center",
  },
  summaryStatValue: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: Colors.palette.textPrimary,
  },
  summaryStatLabel: {
    fontSize: 11,
    color: Colors.palette.textSecondary,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
  },
  summaryDivider: {
    width: 1,
    height: 36,
    backgroundColor: Colors.palette.navyBorder,
  },
  parentReportPreview: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 12,
    backgroundColor: Colors.palette.accentDim,
    borderRadius: 10,
    padding: 10,
  },
  parentReportText: {
    flex: 1,
    fontSize: 12,
    color: Colors.palette.accent,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  sectionHeader: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.palette.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: Colors.palette.navyCard,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.palette.navyBorder,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.palette.textPrimary,
  },
  settingDesc: {
    fontSize: 12,
    color: Colors.palette.textMuted,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  rowDivider: {
    height: 1,
    backgroundColor: Colors.palette.navyBorder,
    marginLeft: 62,
  },
  contactFields: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.palette.navyBorder,
    marginTop: 0,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.palette.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.palette.navy,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.palette.navyBorder,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.palette.textPrimary,
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Colors.palette.accent,
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 4,
  },
  saveBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  savedContact: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  savedContactText: {
    fontSize: 12,
    color: Colors.palette.green,
    fontFamily: "Inter_400Regular",
  },
  permBadge: {
    backgroundColor: Colors.palette.greenDim,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  permBadgeText: {
    fontSize: 12,
    color: Colors.palette.green,
    fontFamily: "Inter_500Medium",
  },
  versionText: {
    fontSize: 13,
    color: Colors.palette.textMuted,
    fontFamily: "Inter_400Regular",
  },
});
