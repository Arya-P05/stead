import { Platform } from "react-native";

export const colors = {
  background: "#000000",
  foreground: "#ffffff",
  success: "#9fe6b4",
  warning: "#f2c675",
};

export const opacity = {
  title: 0.92,
  body: 0.78,
  enabled: 0.52,
  metadata: 0.36,
  disabled: 0.22,
  hint: 0.1,
  primary: 0.92,
  secondary: 0.52,
  muted: 0.36,
  unavailable: 0.22,
};

export const spacing = {
  screenX: 26,
  /** Top inset so primary screen titles (home / calendar / day) share one vertical rhythm. */
  screenTop: 54,
  sheetX: 26,
};

export const typography = {
  mono: Platform.select({ ios: "SF Mono", default: "monospace" }),
};

export const typeScale = {
  title: 20,
  body: 17,
  action: 16,
  metadata: 13,
  index: 12,
  countdown: 56,
};
