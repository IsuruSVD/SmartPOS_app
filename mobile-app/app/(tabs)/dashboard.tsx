import React, { useCallback, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useDb } from '../_layout';
import type { Sale } from '../../src/db/types';
import { colors, spacing, shadows } from '../../src/ui/theme';
import { useTheme } from '../../src/ui/ThemeContext';
import { useLanguage } from '../../src/i18n/LanguageContext';
import { Header } from '../../src/ui/components/Header';
import { Card } from '../../src/ui/components/Card';
import { EmptyState } from '../../src/ui/components/EmptyState';

type RecentSale = Sale & { item_count: number; payment_methods: string };
type Metrics = {
  salesCents: number;
  transactionCount: number;
  avgOrderCents: number;
  grossProfitCents: number;
  profitMarginPct: number;
  lowStockCount: number;
  cashSalesCents: number;
  cardSalesCents: number;
};

const money = (cents: number) => `LKR ${(cents / 100).toFixed(2)}`;

export default function DashboardScreen() {
  const db = useDb();
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [recent, setRecent] = useState<RecentSale[]>([]);

  const load = useCallback(async () => {
    try {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);

      const [report, products, recentSales] = await Promise.all([
        db.reports.getReport(start.toISOString(), end.toISOString()),
        db.products.findAll(),
        db.sales.findHistory(6),
      ]);

      const quantities = await Promise.all(
        products.map(async (product) => ({
          product,
          onHand: await db.stock.getOnHand(product.id),
        }))
      );

      const cashSales = report.payments.find((p) => p.method === 'cash')?.total_cents ?? 0;
      const cardSales = report.payments.find((p) => p.method === 'card')?.total_cents ?? 0;
      const avgOrder = report.transaction_count > 0 ? Math.round(report.net_sales_cents / report.transaction_count) : 0;

      setMetrics({
        salesCents: report.net_sales_cents,
        transactionCount: report.transaction_count,
        avgOrderCents: avgOrder,
        grossProfitCents: report.gross_profit_cents,
        profitMarginPct: report.profit_margin_pct,
        lowStockCount: quantities.filter(
          ({ product, onHand }) => product.track_stock && onHand <= product.low_stock_threshold_milli
        ).length,
        cashSalesCents: cashSales,
        cardSalesCents: cardSales,
      });

      setRecent(recentSales);
    } catch (e) {
      Alert.alert('Dashboard Error', e instanceof Error ? e.message : String(e));
    }
  }, [db]);

  useFocusEffect(useCallback(() => { load().catch(() => undefined); }, [load]));

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <Header title={t('nav_dashboard')} subtitle={new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })} />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* Quick Action Command Center */}
        <View style={styles.quickActionsRow}>
          <TouchableOpacity
            style={[styles.actionTile, { backgroundColor: colors.accent }]}
            onPress={() => router.push('/(tabs)/pos')}
            accessibilityLabel="New Sale"
          >
            <Ionicons name="cart" size={20} color={colors.white} />
            <Text style={styles.actionTileText}>New Sale</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionTileSecondary, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push('/(tabs)/products')}
            accessibilityLabel="Manage Inventory"
          >
            <Ionicons name="cube-outline" size={20} color={colors.primary} />
            <Text style={[styles.actionTileSecondaryText, { color: colors.text }]}>{t('nav_products')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionTileSecondary, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push('/(tabs)/sales')}
            accessibilityLabel="Transactions"
          >
            <Ionicons name="receipt-outline" size={20} color={colors.primary} />
            <Text style={[styles.actionTileSecondaryText, { color: colors.text }]}>{t('nav_sales')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionTileSecondary, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push('/(tabs)/settings')}
            accessibilityLabel="Reports & Z-Report"
          >
            <Ionicons name="pie-chart-outline" size={20} color={colors.primary} />
            <Text style={[styles.actionTileSecondaryText, { color: colors.text }]}>{t('nav_settings')}</Text>
          </TouchableOpacity>
        </View>

        {/* Executive KPI Grid */}
        <View style={styles.grid}>
          {/* Net Sales */}
          <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.kpiTop}>
              <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>{t('today_sales')}</Text>
              <View style={[styles.kpiIconBubble, { backgroundColor: isDark ? 'rgba(37,99,235,0.2)' : '#EFF6FF' }]}>
                <Ionicons name="trending-up" size={18} color={colors.accent} />
              </View>
            </View>
            <Text style={[styles.kpiValue, { color: colors.text }]}>{metrics ? money(metrics.salesCents) : '--'}</Text>
            <Text style={[styles.kpiSub, { color: colors.textMuted }]}>Net completed revenue</Text>
          </View>

          {/* Transactions & AOV */}
          <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.kpiTop}>
              <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>{t('total_orders')}</Text>
              <View style={[styles.kpiIconBubble, { backgroundColor: isDark ? 'rgba(16,185,129,0.2)' : '#ECFDF5' }]}>
                <Ionicons name="receipt" size={18} color={colors.success} />
              </View>
            </View>
            <Text style={[styles.kpiValue, { color: colors.text }]}>{metrics ? String(metrics.transactionCount) : '--'}</Text>
            <Text style={[styles.kpiSub, { color: colors.textMuted }]}>Avg Ticket: {metrics ? money(metrics.avgOrderCents) : '--'}</Text>
          </View>

          {/* Est. Gross Profit */}
          <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.kpiTop}>
              <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>{t('gross_profit')}</Text>
              <View style={[styles.kpiIconBubble, { backgroundColor: isDark ? 'rgba(124,58,237,0.2)' : '#F5F3FF' }]}>
                <Ionicons name="analytics" size={18} color="#7C3AED" />
              </View>
            </View>
            <Text style={[styles.kpiValue, { color: colors.text }]}>{metrics ? money(metrics.grossProfitCents) : '--'}</Text>
            <View style={[styles.marginPill, isDark && { backgroundColor: 'rgba(124,58,237,0.2)' }]}>
              <Text style={styles.marginPillText}>{metrics ? `${metrics.profitMarginPct}% Margin` : '0% Margin'}</Text>
            </View>
          </View>

          {/* Inventory Health */}
          <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.kpiTop}>
              <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>{t('low_stock_alerts')}</Text>
              <View style={[styles.kpiIconBubble, { backgroundColor: (metrics?.lowStockCount ?? 0) > 0 ? (isDark ? 'rgba(239,68,68,0.2)' : '#FEF2F2') : (isDark ? 'rgba(16,185,129,0.2)' : '#F0FDF4') }]}>
                <Ionicons
                  name={(metrics?.lowStockCount ?? 0) > 0 ? "alert-circle" : "checkmark-circle"}
                  size={18}
                  color={(metrics?.lowStockCount ?? 0) > 0 ? colors.danger : colors.success}
                />
              </View>
            </View>
            <Text style={[styles.kpiValue, (metrics?.lowStockCount ?? 0) > 0 ? { color: colors.danger } : { color: colors.text }]}>
              {metrics ? String(metrics.lowStockCount) : '--'}
            </Text>
            <Text style={[styles.kpiSub, { color: colors.textMuted }]}>
              {(metrics?.lowStockCount ?? 0) > 0 ? 'Requires attention' : 'All items well stocked'}
            </Text>
          </View>
        </View>

        {/* Payment Tender Distribution Bar */}
        {metrics && metrics.salesCents > 0 && (
          <View style={[styles.tenderMixCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardHeaderTitle, { color: colors.text }]}>Today's Payment Mix</Text>
            <View style={[styles.mixBarTrack, { backgroundColor: colors.backgroundSecondary }]}>
              <View
                style={[
                  styles.mixBarSegment,
                  {
                    flex: Math.max(0.01, metrics.cashSalesCents),
                    backgroundColor: colors.success,
                    borderTopLeftRadius: 6,
                    borderBottomLeftRadius: 6,
                  },
                ]}
              />
              <View
                style={[
                  styles.mixBarSegment,
                  {
                    flex: Math.max(0.01, metrics.cardSalesCents),
                    backgroundColor: colors.accent,
                    borderTopRightRadius: 6,
                    borderBottomRightRadius: 6,
                  },
                ]}
              />
            </View>
            <View style={styles.mixLegendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
                <Text style={[styles.legendText, { color: colors.textSecondary }]}>Cash ({money(metrics.cashSalesCents)})</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.accent }]} />
                <Text style={[styles.legendText, { color: colors.textSecondary }]}>Card ({money(metrics.cardSalesCents)})</Text>
              </View>
            </View>
          </View>
        )}

        {/* Recent Transactions List */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('recent_activity')}</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/sales')}>
              <Text style={styles.viewAllText}>View All →</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.recentList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {recent.length ? (
              recent.map((sale) => (
                <TouchableOpacity
                  key={sale.id}
                  style={[styles.recentRow, { borderBottomColor: colors.border }]}
                  activeOpacity={0.7}
                  onPress={() => router.push('/(tabs)/sales')}
                >
                  <View style={[styles.invoiceIconCircle, { backgroundColor: colors.backgroundSecondary }]}>
                    <Ionicons name="receipt-outline" size={18} color={colors.primary} />
                  </View>
                  <View style={styles.recentDetails}>
                    <Text style={[styles.invoice, { color: colors.text }]}>{sale.invoice_number}</Text>
                    <Text style={[styles.recentMeta, { color: colors.textSecondary }]}>
                      {new Date(sale.completed_at ?? sale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ·{' '}
                      {sale.payment_methods.toUpperCase() || 'PAID'}
                    </Text>
                  </View>
                  <View style={styles.recentAmountCol}>
                    <Text style={styles.recentTotal}>{money(sale.total_cents)}</Text>
                    <View style={styles.statusPill}>
                      <Text style={styles.statusPillText}>{sale.status}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <EmptyState title="No Sales Yet" description="Completed sales will appear here in real time." />
            )}
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, gap: spacing.lg, paddingBottom: 60 },

  // Quick Action Command Center
  quickActionsRow: { flexDirection: 'row', gap: spacing.sm },
  actionTile: {
    flex: 1,
    height: 64,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    ...shadows.glow,
  },
  actionTileText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  actionTileSecondary: {
    flex: 1,
    height: 64,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    ...shadows.sm,
  },
  actionTileSecondaryText: { color: colors.primary, fontSize: 12, fontWeight: '700' },

  // KPI Grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  kpiCard: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
    ...shadows.card,
  },
  kpiTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kpiLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  kpiIconBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiValue: { fontSize: 20, fontWeight: '800', color: colors.text, marginTop: 4 },
  kpiSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  marginPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#F5F3FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 2,
  },
  marginPillText: { fontSize: 11, fontWeight: '700', color: '#7C3AED' },

  // Payment Mix Card
  tenderMixCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
    ...shadows.card,
  },
  cardHeaderTitle: { fontSize: 14, fontWeight: '700', color: colors.primary },
  mixBarTrack: {
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.backgroundSecondary,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  mixBarSegment: { height: '100%' },
  mixLegendRow: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12, color: colors.textSecondary, fontWeight: '500' },

  // Recent Transactions Section
  section: { gap: spacing.sm },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: colors.primary },
  viewAllText: { fontSize: 13, fontWeight: '700', color: colors.accent },
  recentList: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadows.card,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  invoiceIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentDetails: { flex: 1 },
  invoice: { fontSize: 15, fontWeight: '700', color: colors.text },
  recentMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  recentAmountCol: { alignItems: 'flex-end', gap: 2 },
  recentTotal: { fontSize: 15, fontWeight: '800', color: colors.accent },
  statusPill: {
    backgroundColor: colors.successLight,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  statusPillText: { fontSize: 10, fontWeight: '700', color: colors.successDark, textTransform: 'uppercase' },
});
