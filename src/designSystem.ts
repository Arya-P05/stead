import { Platform } from 'react-native';

export const colors = {
  background: '#000000',
  foreground: '#ffffff',
  success: '#9fe6b4',
  warning: '#f2c675',
};

export const opacity = {
  primary: 0.88,
  secondary: 0.52,
  muted: 0.34,
  unavailable: 0.22,
};

export const spacing = {
  screenX: 26,
  sheetX: 26,
};

export const typography = {
  mono: Platform.select({ ios: 'SF Mono', default: 'monospace' }),
};
