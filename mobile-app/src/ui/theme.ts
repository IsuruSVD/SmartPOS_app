export const colors = {
  primary: '#0F172A', // Slate 900
  primaryLight: '#1E293B', // Slate 800
  accent: '#2563EB', // Blue 600
  accentHover: '#1D4ED8',
  primaryTint: '#EFF6FF', // Blue 50
  success: '#059669', // Emerald 600
  successLight: '#ECFDF5',
  warning: '#D97706', // Amber 600
  warningLight: '#FFFBEB',
  danger: '#DC2626', // Red 600
  dangerLight: '#FEF2F2',
  background: '#F8FAFC', // Slate 50
  surface: '#FFFFFF',
  border: '#E2E8F0', // Slate 200
  borderDark: '#CBD5E1', // Slate 300
  text: '#0F172A',
  textSecondary: '#64748B', // Slate 500
  textMuted: '#94A3B8', // Slate 400
  white: '#FFFFFF',
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
