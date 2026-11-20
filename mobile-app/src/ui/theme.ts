export interface ThemeColors {
  primary: string;
  primaryLight: string;
  primaryDark: string;
  accent: string;
  accentLight: string;
  accentHover: string;
  primaryTint: string;
  accentGradientStart: string;
  accentGradientEnd: string;

  // Status & semantic colors
  success: string;
  successDark: string;
  successLight: string;
  warning: string;
  warningDark: string;
  warningLight: string;
  danger: string;
  dangerDark: string;
  dangerLight: string;
  info: string;
  infoLight: string;

  // Neutrals & Surfaces
  background: string;
  backgroundSecondary: string;
  surface: string;
  surfaceSubtle: string;
  cardBackground: string;
  border: string;
  borderDark: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  white: string;

  // Category palette (for dynamic product tags & avatars)
  categoryColors: { bg: string; text: string; border: string }[];
}

export const lightColors: ThemeColors = {
  primary: '#0F172A', // Slate 900
  primaryLight: '#1E293B', // Slate 800
  primaryDark: '#020617', // Slate 950
  accent: '#2563EB', // Electric Blue 600
  accentLight: '#3B82F6', // Blue 500
  accentHover: '#1D4ED8',
  primaryTint: '#EFF6FF', // Blue 50
  accentGradientStart: '#2563EB',
  accentGradientEnd: '#4F46E5',

  // Status & semantic colors
  success: '#10B981', // Emerald 500
  successDark: '#059669', // Emerald 600
  successLight: '#ECFDF5',
  warning: '#F59E0B', // Amber 500
  warningDark: '#D97706', // Amber 600
  warningLight: '#FFFBEB',
  danger: '#EF4444', // Red 500
  dangerDark: '#DC2626', // Red 600
  dangerLight: '#FEF2F2',
  info: '#0EA5E9', // Sky 500
  infoLight: '#F0F9FF',

  // Neutrals & Surfaces
  background: '#F8FAFC', // Slate 50
  backgroundSecondary: '#F1F5F9', // Slate 100
  surface: '#FFFFFF',
  surfaceSubtle: '#F8FAFC',
  cardBackground: '#FFFFFF',
  border: '#E2E8F0', // Slate 200
  borderDark: '#CBD5E1', // Slate 300
  text: '#0F172A', // Slate 900
  textSecondary: '#64748B', // Slate 500
  textMuted: '#94A3B8', // Slate 400
  white: '#FFFFFF',

  // Category palette
  categoryColors: [
    { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' }, // Blue
    { bg: '#ECFDF5', text: '#047857', border: '#A7F3D0' }, // Green
    { bg: '#F5F3FF', text: '#6D28D9', border: '#DDD6FE' }, // Purple
    { bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA' }, // Orange
    { bg: '#FDF2F8', text: '#BE185D', border: '#FBCFE8' }, // Pink
    { bg: '#F0FDFA', text: '#0F766E', border: '#99F6E4' }, // Teal
  ],
};

export const darkColors: ThemeColors = {
  primary: '#38BDF8', // Sky 400 / Vibrant in dark mode
  primaryLight: '#60A5FA', // Blue 400
  primaryDark: '#1E293B', // Slate 800
  accent: '#3B82F6', // Vibrant Electric Blue
  accentLight: '#60A5FA',
  accentHover: '#2563EB',
  primaryTint: 'rgba(59, 130, 246, 0.15)',
  accentGradientStart: '#3B82F6',
  accentGradientEnd: '#6366F1',

  // Status & semantic colors
  success: '#10B981', // Emerald 500
  successDark: '#059669',
  successLight: 'rgba(16, 185, 129, 0.15)',
  warning: '#F59E0B', // Amber 500
  warningDark: '#D97706',
  warningLight: 'rgba(245, 158, 11, 0.15)',
  danger: '#EF4444', // Red 500
  dangerDark: '#DC2626',
  dangerLight: 'rgba(239, 68, 68, 0.15)',
  info: '#38BDF8',
  infoLight: 'rgba(56, 189, 248, 0.15)',

  // Neutrals & Surfaces (Deep Midnight Dark Theme)
  background: '#090D16', // Deep Midnight
  backgroundSecondary: '#0F172A', // Slate 900
  surface: '#1E293B', // Slate 800
  surfaceSubtle: '#162032',
  cardBackground: '#1E293B',
  border: '#334155', // Slate 700
  borderDark: '#475569', // Slate 600
  text: '#F8FAFC', // Slate 50 (High contrast light text)
  textSecondary: '#94A3B8', // Slate 400
  textMuted: '#64748B', // Slate 500
  white: '#FFFFFF',

  // Category palette (Dark adapted)
  categoryColors: [
    { bg: 'rgba(59, 130, 246, 0.2)', text: '#93C5FD', border: 'rgba(59, 130, 246, 0.4)' },
    { bg: 'rgba(16, 185, 129, 0.2)', text: '#6EE7B7', border: 'rgba(16, 185, 129, 0.4)' },
    { bg: 'rgba(139, 92, 246, 0.2)', text: '#C4B5FD', border: 'rgba(139, 92, 246, 0.4)' },
    { bg: 'rgba(249, 115, 22, 0.2)', text: '#FDBA74', border: 'rgba(249, 115, 22, 0.4)' },
    { bg: 'rgba(236, 72, 153, 0.2)', text: '#F9A8D4', border: 'rgba(236, 72, 153, 0.4)' },
    { bg: 'rgba(20, 184, 166, 0.2)', text: '#5EEAD4', border: 'rgba(20, 184, 166, 0.4)' },
  ],
};

// Default fallback colors (Light)
export const colors = lightColors;

export function getThemeColors(mode: 'light' | 'dark'): ThemeColors {
  return mode === 'dark' ? darkColors : lightColors;
}

export const shadows = {
  sm: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 6,
    elevation: 2,
  },
  floating: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 8,
  },
  glow: {
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  touchTarget: 48,
};

export const typography = {
  h1: { fontSize: 24, fontWeight: '700' as const },
  h2: { fontSize: 20, fontWeight: '700' as const },
  h3: { fontSize: 16, fontWeight: '600' as const },
  body: { fontSize: 14, fontWeight: '400' as const },
  bodySecondary: { fontSize: 14, fontWeight: '400' as const },
  caption: { fontSize: 12, fontWeight: '500' as const },
  mono: { fontSize: 16, fontWeight: '600' as const },
};
