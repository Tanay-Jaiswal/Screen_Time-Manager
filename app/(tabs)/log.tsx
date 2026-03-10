import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Platform,
  TextInput,
  FlatList,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useScreenTime } from "@/lib/screenTimeContext";
import {
  AppCategory,
  APP_CATEGORIES,
  PREDEFINED_APPS,
  formatMinutes,
} from "@/lib/fuzzyLogic";
import Colors from "@/constants/colors";

const CATEGORY_CONFIG: Record<AppCategory, { label: string; color: string; icon: string }> = {
  productive: { label: "Productive", color: Colors.palette.green, icon: "book" },
  neutral: { label: "Neutral", color: Colors.palette.accent, icon: "globe" },
  distracting: { label: "Distracting", color: Colors.palette.red, icon: "game-controller" },
};

const DURATION_PRESETS = [5, 10, 15, 20, 30, 45, 60, 90, 120];

export default function LogScreen() {
  const insets = useSafeAreaInsets();
  const { addSession, sessions } = useScreenTime();

  const [selectedApp, setSelectedApp] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<AppCategory>("neutral");
  const [selectedMinutes, setSelectedMinutes] = useState<number>(15);
  const [customAppName, setCustomAppName] = useState<string>("");
  const [showAppPicker, setShowAppPicker] = useState(false);
  const [appSearch, setAppSearch] = useState("");
  const [loggedFeedback, setLoggedFeedback] = useState(false);

  const filteredApps = PREDEFINED_APPS.filter((a) =>
    a.toLowerCase().includes(appSearch.toLowerCase())
  );

  const handleSelectApp = (appName: string) => {
    setSelectedApp(appName);
    setCustomAppName(appName);
    setSelectedCategory(APP_CATEGORIES[appName] || "neutral");
    setShowAppPicker(false);
    setAppSearch("");
    Haptics.selectionAsync();
  };

  const handleLog = () => {
    const appName = customAppName.trim() || "Unknown App";
    if (!appName) return;
    addSession(appName, selectedCategory, selectedMinutes);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setLoggedFeedback(true);
    setTimeout(() => {
      setLoggedFeedback(false);
      setCustomAppName("");
      setSelectedApp("");
      setSelectedMinutes(15);
    }, 1500);
  };

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : 0;

  const todaySessions = sessions
    .slice()
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 10);

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
          <Text style={styles.headerTitle}>Log Usage</Text>
          <Text style={styles.headerSubtitle}>Track your app usage manually</Text>
        </View>

        {/* App Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>App Name</Text>
          <Pressable
            onPress={() => setShowAppPicker(true)}
            style={({ pressed }) => [styles.appSelector, pressed && styles.pressed]}
          >
            <Ionicons
              name="apps"
              size={18}
              color={
                customAppName ? Colors.palette.accent : Colors.palette.textMuted
              }
            />
            <Text
              style={[
                styles.appSelectorText,
                customAppName && styles.appSelectorTextFilled,
              ]}
            >
              {customAppName || "Select an app…"}
            </Text>
            <Ionicons name="chevron-down" size={16} color={Colors.palette.textMuted} />
          </Pressable>

          {/* Custom input if user typed something not in list */}
          <TextInput
            style={styles.customInput}
            value={customAppName}
            onChangeText={(text) => {
              setCustomAppName(text);
              setSelectedApp("");
              if (!APP_CATEGORIES[text]) setSelectedCategory("neutral");
            }}
            placeholder="Or type app name…"
            placeholderTextColor={Colors.palette.textMuted}
          />
        </View>

        {/* Category */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Category</Text>
          <View style={styles.categoryRow}>
            {(Object.keys(CATEGORY_CONFIG) as AppCategory[]).map((cat) => {
              const conf = CATEGORY_CONFIG[cat];
              const isSelected = selectedCategory === cat;
              return (
                <Pressable
                  key={cat}
                  onPress={() => {
                    setSelectedCategory(cat);
                    Haptics.selectionAsync();
                  }}
                  style={({ pressed }) => [
                    styles.categoryPill,
                    isSelected && {
                      backgroundColor: conf.color + "25",
                      borderColor: conf.color,
                    },
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons
                    name={conf.icon as any}
                    size={14}
                    color={isSelected ? conf.color : Colors.palette.textMuted}
                  />
                  <Text
                    style={[
                      styles.categoryPillText,
                      isSelected && { color: conf.color },
                    ]}
                  >
                    {conf.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Duration */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Duration</Text>
          <View style={styles.durationGrid}>
            {DURATION_PRESETS.map((min) => (
              <Pressable
                key={min}
                onPress={() => {
                  setSelectedMinutes(min);
                  Haptics.selectionAsync();
                }}
                style={({ pressed }) => [
                  styles.durationPill,
                  selectedMinutes === min && styles.durationPillSelected,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.durationPillText,
                    selectedMinutes === min && styles.durationPillTextSelected,
                  ]}
                >
                  {formatMinutes(min)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Summary Preview */}
        {customAppName.trim().length > 0 && (
          <View style={styles.summaryCard}>
            <View
              style={[
                styles.summaryDot,
                { backgroundColor: CATEGORY_CONFIG[selectedCategory].color },
              ]}
            />
            <Text style={styles.summaryText}>
              Logging{" "}
              <Text style={styles.summaryHighlight}>
                {formatMinutes(selectedMinutes)}
              </Text>{" "}
              on{" "}
              <Text style={styles.summaryHighlight}>{customAppName}</Text>
            </Text>
          </View>
        )}

        {/* Log Button */}
        <Pressable
          onPress={handleLog}
          disabled={!customAppName.trim() || loggedFeedback}
          style={({ pressed }) => [
            styles.logButton,
            (!customAppName.trim() || loggedFeedback) && styles.logButtonDisabled,
            pressed && styles.pressed,
          ]}
        >
          {loggedFeedback ? (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.logButtonText}>Logged!</Text>
            </>
          ) : (
            <>
              <Ionicons name="add-circle" size={20} color="#fff" />
              <Text style={styles.logButtonText}>Log Session</Text>
            </>
          )}
        </Pressable>

        {/* Recent Sessions */}
        {todaySessions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Today's Sessions</Text>
            <View style={styles.sessionList}>
              {todaySessions.map((s) => {
                const catConf = CATEGORY_CONFIG[s.category];
                return (
                  <View key={s.id} style={styles.sessionItem}>
                    <View
                      style={[
                        styles.sessionCatDot,
                        { backgroundColor: catConf.color },
                      ]}
                    />
                    <View style={styles.sessionInfo}>
                      <Text style={styles.sessionAppName}>{s.appName}</Text>
                      <Text style={styles.sessionMeta}>
                        {catConf.label}
                        {s.isLateNight ? " · Late night" : ""}
                      </Text>
                    </View>
                    <Text style={[styles.sessionDuration, { color: catConf.color }]}>
                      {formatMinutes(s.minutes)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>

      {/* App Picker Modal */}
      <Modal
        visible={showAppPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAppPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Choose an App</Text>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={16} color={Colors.palette.textMuted} />
              <TextInput
                style={styles.searchInput}
                value={appSearch}
                onChangeText={setAppSearch}
                placeholder="Search apps…"
                placeholderTextColor={Colors.palette.textMuted}
                autoFocus
              />
            </View>
            <FlatList
              data={filteredApps}
              keyExtractor={(item) => item}
              style={styles.modalList}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const cat = APP_CATEGORIES[item];
                const catConf = CATEGORY_CONFIG[cat];
                return (
                  <Pressable
                    onPress={() => handleSelectApp(item)}
                    style={({ pressed }) => [
                      styles.modalItem,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View
                      style={[
                        styles.modalItemIcon,
                        { backgroundColor: catConf.color + "20" },
                      ]}
                    >
                      <Ionicons
                        name={catConf.icon as any}
                        size={16}
                        color={catConf.color}
                      />
                    </View>
                    <View style={styles.modalItemInfo}>
                      <Text style={styles.modalItemName}>{item}</Text>
                      <Text style={[styles.modalItemCat, { color: catConf.color }]}>
                        {catConf.label}
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={14}
                      color={Colors.palette.textMuted}
                    />
                  </Pressable>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptySearch}>
                  <Text style={styles.emptySearchText}>No apps found</Text>
                </View>
              }
            />
            <Pressable
              onPress={() => setShowAppPicker(false)}
              style={styles.modalClose}
            >
              <Text style={styles.modalCloseText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  appSelector: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.palette.navyCard,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.palette.navyBorder,
    marginBottom: 8,
  },
  appSelectorText: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.palette.textMuted,
  },
  appSelectorTextFilled: {
    color: Colors.palette.textPrimary,
  },
  customInput: {
    backgroundColor: Colors.palette.navyCard,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.palette.navyBorder,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.palette.textPrimary,
  },
  categoryRow: {
    flexDirection: "row",
    gap: 8,
  },
  categoryPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.palette.navyCard,
    borderWidth: 1,
    borderColor: Colors.palette.navyBorder,
  },
  categoryPillText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.palette.textMuted,
  },
  durationGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  durationPill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.palette.navyCard,
    borderWidth: 1,
    borderColor: Colors.palette.navyBorder,
  },
  durationPillSelected: {
    backgroundColor: Colors.palette.accentDim,
    borderColor: Colors.palette.accent,
  },
  durationPillText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.palette.textSecondary,
  },
  durationPillTextSelected: {
    color: Colors.palette.accent,
  },
  summaryCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.palette.navyCard,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  summaryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  summaryText: {
    fontSize: 14,
    color: Colors.palette.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  summaryHighlight: {
    color: Colors.palette.textPrimary,
    fontFamily: "Inter_600SemiBold",
  },
  logButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.palette.accent,
    borderRadius: 14,
    paddingVertical: 16,
    marginBottom: 28,
  },
  logButtonDisabled: {
    opacity: 0.4,
  },
  logButtonText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  sessionList: {
    backgroundColor: Colors.palette.navyCard,
    borderRadius: 14,
    overflow: "hidden",
  },
  sessionItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.palette.navyBorder,
    gap: 12,
  },
  sessionCatDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  sessionInfo: {
    flex: 1,
  },
  sessionAppName: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.palette.textPrimary,
  },
  sessionMeta: {
    fontSize: 12,
    color: Colors.palette.textMuted,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  sessionDuration: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  pressed: {
    opacity: 0.7,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: Colors.palette.navyLight,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.palette.navyBorder,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.palette.textPrimary,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 20,
    backgroundColor: Colors.palette.navyCard,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.palette.textPrimary,
  },
  modalList: {
    maxHeight: 340,
  },
  modalItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  modalItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  modalItemInfo: {
    flex: 1,
  },
  modalItemName: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: Colors.palette.textPrimary,
  },
  modalItemCat: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  emptySearch: {
    alignItems: "center",
    padding: 20,
  },
  emptySearchText: {
    fontSize: 14,
    color: Colors.palette.textMuted,
    fontFamily: "Inter_400Regular",
  },
  modalClose: {
    marginHorizontal: 20,
    marginTop: 8,
    padding: 14,
    backgroundColor: Colors.palette.navyCard,
    borderRadius: 12,
    alignItems: "center",
  },
  modalCloseText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.palette.textSecondary,
  },
});
