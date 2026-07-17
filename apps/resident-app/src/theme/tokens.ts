export const colors = {
  background: '#F4F7F5',
  surface: '#FFFFFF',
  surfaceMuted: '#E9EFEC',
  primary: '#17443A',
  primaryPressed: '#0F3029',
  primarySoft: '#DCEBE5',
  ink: '#1E2926',
  inkMuted: '#5C6B66',
  border: '#CBD5D1',
  info: '#266D91',
  infoSoft: '#E1EFF6',
  warning: '#9B6418',
  warningSoft: '#FFF1D6',
  danger: '#B83A3A',
  dangerPressed: '#8E2929',
  dangerSoft: '#FCE5E5',
  success: '#237A50',
  successSoft: '#DDF2E7',
  accent: '#D49A2B',
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(15, 26, 22, 0.55)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 4,
  md: 8,
  round: 999,
} as const;

export const typography = {
  caption: 12,
  body: 15,
  bodyLarge: 17,
  title: 22,
  pageTitle: 28,
} as const;
