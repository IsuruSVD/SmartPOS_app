export const colors = {
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
  border: '#E2E8F0', // Slate 200
  borderDark: '#CBD5E1', // Slate 300
  text: '#0F172A', // Slate 900
  textSecondary: '#64748B', // Slate 500
  textMuted: '#94A3B8', // Slate 400
  white: '#FFFFFF',

  // Category palette (for dynamic product tags & avatars)
  categoryColors: [
    { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' }, // Blue
    { bg: '#ECFDF5', text: '#047857', border: '#A7F3D0' }, // Green
    { bg: '#F5F3FF', text: '#6D28D9', border: '#DDD6FE' }, // Purple
    { bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA' }, // Orange
    { bg: '#FDF2F8', text: '#BE185D', border: '#FBCFE8' }, // Pink
    { bg: '#F0FDFA', text: '#0F766E', border: '#99F6E4' }, // Teal
  ],
};

export const shadows = {
  sm: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  card: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  floating: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
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
  touchTarget: 48, // Minimum accessible touch target in dp
};

export const typography = {
  h1: { fontSize: 24, fontWeight: '700' as const, color: colors.text },
  h2: { fontSize: 20, fontWeight: '700' as const, color: colors.text },
  h3: { fontSize: 16, fontWeight: '600' as const, color: colors.text },
  body: { fontSize: 14, fontWeight: '400' as const, color: colors.text },
  bodySecondary: { fontSize: 14, fontWeight: '400' as const, color: colors.textSecondary },
  caption: { fontSize: 12, fontWeight: '500' as const, color: colors.textMuted },
  mono: { fontSize: 16, fontWeight: '600' as const, color: colors.text },
};
