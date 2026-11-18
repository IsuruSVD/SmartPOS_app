import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View, SafeAreaView } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useDb } from '../_layout';
import type { Sale } from '../../src/db/types';
import { colors, spacing } from '../../src/ui/theme';
import { Header } from '../../src/ui/components/Header';
import { Card } from '../../src/ui/components/Card';
import { EmptyState } from '../../src/ui/components/EmptyState';

type RecentSale = Sale & { item_count: number; payment_methods: string };
type Metrics = {
  salesCents: number;
  transactionCount: number;
  grossProfitCents: number;
  profitMarginPct: number;
  lowStockCount: number;
};
const money = (cents: number) => `LKR ${(cents / 100).toFixed(2)}`;

export default function DashboardScreen() {
  const db = useDb();
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
        db.sales.findHistory(5),
      ]);
      const quantities = await Promise.all(products.map(async (product) => ({
        product,
        onHand: await db.stock.getOnHand(product.id),
      })));
      setMetrics({
        salesCents: report.net_sales_cents,
        transactionCount: report.transaction_count,
        grossProfitCents: report.gross_profit_cents,
        profitMarginPct: report.profit_margin_pct,
        lowStockCount: quantities.filter(({ product, onHand }) => product.track_stock && onHand <= product.low_stock_threshold_milli).length,
      });
      setRecent(recentSales);
    } catch (e) {
      Alert.alert('Dashboard could not load', e instanceof Error ? e.message : String(e));
    }
  }, [db]);

  useFocusEffect(useCallback(() => { load().catch(() => undefined); }, [load]));

  return <SafeAreaView style={styles.safeArea}>
    <Header title="Dashboard" subtitle="Business Overview" />
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.grid}>
        <Metric label="Today's Sales" value={metrics ? money(metrics.salesCents) : '--'} hint="Net completed sales" />
        <Metric label="Transactions" value={metrics ? String(metrics.transactionCount) : '--'} hint="Completed today" />
        <Metric label="Est. Gross Profit" value={metrics ? money(metrics.grossProfitCents) : '--'} hint={metrics ? `${metrics.profitMarginPct}% margin` : 'Revenue less product costs'} />
        <Metric label="Low Stock Items" value={metrics ? String(metrics.lowStockCount) : '--'} hint="At or below threshold" />
      </View>

      <Card style={styles.alertCard}>
        <Text style={styles.alertTitle}>Inventory Monitoring</Text>
        <Text style={styles.alertBody}>{metrics ? `${metrics.lowStockCount} tracked ${metrics.lowStockCount === 1 ? 'product is' : 'products are'} at or below the configured stock threshold.` : 'Loading stock status…'}</Text>
      </Card>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Transactions</Text>
        <Card style={styles.recentCard}>
          {recent.length ? recent.map((sale) => <View key={sale.id} style={styles.recentRow}>
            <View style={styles.recentDetails}>
              <Text style={styles.invoice}>{sale.invoice_number}</Text>
              <Text style={styles.recentMeta}>{new Date(sale.completed_at ?? sale.created_at).toLocaleString()} · {sale.payment_methods.split(',').filter(Boolean).join(', ') || 'Unpaid'}</Text>
            </View>
            <Text style={styles.recentTotal}>{money(sale.total_cents)}</Text>
          </View>) : <EmptyState title="No Transactions" description="Completed sales and receipt details will appear here." />}
        </Card>
      </View>
    </ScrollView>
  </SafeAreaView>;
}

function Metric(props: { label: string; value: string; hint: string }) {
  return <Card style={styles.metricCard}>
    <Text style={styles.metricLabel}>{props.label}</Text>
    <Text style={styles.metricValue}>{props.value}</Text>
    <Text style={styles.metricSub}>{props.hint}</Text>
  </Card>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, gap: spacing.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  metricCard: { flexBasis: '47%', flexGrow: 1, padding: spacing.md, minHeight: 90 },
  metricLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: '500' },
  metricValue: { fontSize: 20, fontWeight: '700', color: colors.primary, marginTop: spacing.xs },
  metricSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  alertCard: { backgroundColor: colors.surface, borderColor: colors.border, gap: spacing.xs },
  alertTitle: { fontSize: 14, fontWeight: '600', color: colors.primary },
  alertBody: { fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
  section: { gap: spacing.sm },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.primary },
  recentCard: { padding: spacing.md, gap: spacing.sm },
  recentRow: { minHeight: spacing.touchTarget, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, borderBottomWidth: 1, borderColor: colors.border, paddingVertical: spacing.sm },
  recentDetails: { flex: 1, gap: 2 },
  invoice: { fontSize: 14, fontWeight: '700', color: colors.text },
  recentMeta: { fontSize: 11, color: colors.textSecondary },
  recentTotal: { fontSize: 14, fontWeight: '700', color: colors.accent },
});
