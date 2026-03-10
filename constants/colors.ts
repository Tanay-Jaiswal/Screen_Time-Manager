const palette = {
  navy: "#0A0F1E",
  navyLight: "#111827",
  navyCard: "#141D2E",
  navyBorder: "#1E2D45",
  accent: "#4F8EF7",
  accentDim: "#2A4A80",
  green: "#34C784",
  greenDim: "#1A4A38",
  yellow: "#F5A623",
  yellowDim: "#4A3A10",
  red: "#FF4B5C",
  redDim: "#4A1520",
  textPrimary: "#FFFFFF",
  textSecondary: "#8899BB",
  textMuted: "#4A5A7A",
  white: "#FFFFFF",
};

export default {
  palette,
  light: {
    text: palette.textPrimary,
    background: palette.navy,
    tint: palette.accent,
    tabIconDefault: palette.textMuted,
    tabIconSelected: palette.accent,
  },
  dark: {
    text: palette.textPrimary,
    background: palette.navy,
    tint: palette.accent,
    tabIconDefault: palette.textMuted,
    tabIconSelected: palette.accent,
  },
};
