import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing } from '../theme';

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
        <View style={styles.row}>
          <Text style={styles.title}>{title}</Text>
          {showOfflineBadge && (
            <View style={styles.offlineBadge}>
              <View style={styles.dot} />
              <Text style={styles.offlineText}>Offline</Text>
            </View>
          )}
        </View>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
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
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleArea: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  offlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
  },
  offlineText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.success,
  },
  rightAction: {
    marginLeft: spacing.md,
  },
});
