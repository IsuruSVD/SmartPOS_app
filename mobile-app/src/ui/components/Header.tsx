import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing, shadows } from '../theme';

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
  return (
    <View style={styles.container}>
      <View style={styles.titleArea}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        <View style={styles.subtitleRow}>
          {showOfflineBadge && (
            <View style={styles.offlineBadge}>
              <View style={styles.dot} />
              <Text style={styles.offlineText}>Ready</Text>
            </View>
          )}
          {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
      </View>
      {rightAction ? <View style={styles.rightAction}>{rightAction}</View> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
    color: colors.primary,
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
    color: colors.textSecondary,
    fontWeight: '500',
    flexShrink: 1,
    minWidth: 0,
  },
  offlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    gap: 4,
    flexShrink: 0,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.success,
  },
  offlineText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.successDark,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  rightAction: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
});
