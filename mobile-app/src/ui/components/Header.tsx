import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { spacing, shadows } from '../theme';
import { useTheme } from '../ThemeContext';

interface HeaderProps {
  title: string;
  subtitle?: string;
  rightAction?: React.ReactNode;
  showOfflineBadge?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  rightAction,
  showOfflineBadge = true,
}) => {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
      <View style={styles.titleArea}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{title}</Text>
        <View style={styles.subtitleRow}>
          {showOfflineBadge && (
            <View style={[styles.offlineBadge, { backgroundColor: colors.successLight, borderColor: colors.success }]}>
              <View style={[styles.dot, { backgroundColor: colors.success }]} />
              <Text style={[styles.offlineText, { color: colors.successDark }]}>Ready</Text>
            </View>
          )}
          {subtitle ? <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
      </View>
      {rightAction ? <View style={styles.rightAction}>{rightAction}</View> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 64,
    ...shadows.sm,
  },
  titleArea: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
    minWidth: 0,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '500',
    flexShrink: 1,
    minWidth: 0,
  },
  offlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
    flexShrink: 0,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  offlineText: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  rightAction: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
});
