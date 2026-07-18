export const colors = {
  background: "#F4F6F8",
  black: "#111827",
  border: "#D7DDE5",
  critical: "#B42318",
  criticalSoft: "#FEE4E2",
  disabled: "#AAB2BE",
  info: "#1769AA",
  infoSoft: "#E8F2FB",
  ink: "#17243A",
  muted: "#5F6B7A",
  offline: "#8A4B08",
  offlineSoft: "#FFF1D6",
  primary: "#0B6B4F",
  primaryPressed: "#07533D",
  primarySoft: "#DCF5EA",
  surface: "#FFFFFF",
  warning: "#9A6700",
  warningSoft: "#FFF4CC",
  white: "#FFFFFF"
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32
} as const;

export const radii = {
  sm: 4,
  md: 8,
  pill: 999
} as const;

export const typography = {
  body: 16,
  caption: 13,
  heading: 24,
  label: 15,
  title: 20
} as const;

export const control = {
  minHeight: 56,
  iconButton: 48
} as const;
