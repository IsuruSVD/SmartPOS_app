import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useDb } from '../_layout';
import type { Payment, PaymentMethod, Sale, SaleItem } from '../../src/db/types';
import type { Refund } from '../../src/db/repositories/RefundRepository';
import { colors, spacing } from '../../src/ui/theme';
import { Header } from '../../src/ui/components/Header';
import { EmptyState } from '../../src/ui/components/EmptyState';
import { Button } from '../../src/ui/components/Button';
import { formatMonospaceReceipt } from '../../src/utils/escpos';

type SaleHistoryRow = Sale & { item_count: number; payment_methods: string };
type Filter = 'all' | 'today' | 'cash' | 'card';

const money = (cents: number) => `LKR ${(cents / 100).toFixed(2)}`;
const statusLabel: Record<string, string> = {
  completed: 'Completed',
  refunded: 'Refunded',
  partially_refunded: 'Partially refunded',
  cancelled: 'Cancelled',
};

export default function SalesScreen() {
  const db = useDb();
  const [history, setHistory] = useState<SaleHistoryRow[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSale, setSelectedSale] = useState<SaleHistoryRow | null>(null);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);

  // Print Preview Modal
  const [previewOpen, setPreviewOpen] = useState(false);
  const [monospaceText, setMonospaceText] = useState('');

  // Refund Modals
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundMode, setRefundMode] = useState<'full' | 'partial'>('full');
  const [refundMethod, setRefundMethod] = useState<PaymentMethod>('cash');
  const [refundReason, setRefundReason] = useState('');
  const [refundSaving, setRefundSaving] = useState(false);

  // Partial return state: maps sale_item_id -> quantity_milli to return
  const [partialQuantities, setPartialQuantities] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      setHistory(await db.sales.findHistory());
    } catch (e) {
      Alert.alert('Sales could not load', e instanceof Error ? e.message : String(e));
    } finally {
      setRefreshing(false);
    }
  }, [db]);

  useFocusEffect(useCallback(() => { load().catch(() => undefined); }, [load]));

  const visible = useMemo(() => {
    const q = search.trim().toLocaleLowerCase();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return history.filter((sale) => {
      const saleDate = new Date(sale.completed_at ?? sale.created_at);
      const invoiceMatch = !q || sale.invoice_number.toLocaleLowerCase().includes(q);
      const methods = sale.payment_methods.toLocaleLowerCase();
      const filterMatch =
        filter === 'all' ||
        (filter === 'today' && saleDate >= today) ||
        (filter === 'cash' && methods.includes('cash')) ||
        (filter === 'card' && methods.includes('card'));
      return invoiceMatch && filterMatch;
    });
  }, [history, search, filter]);

  const openSale = async (sale: SaleHistoryRow) => {
    setSelectedSale(sale);
    try {
      const [items, pays, refs] = await Promise.all([
        db.sales.findItems(sale.id),
        db.payments.findBySale(sale.id),
        db.refunds.findByOriginalSale(sale.id),
      ]);
      setSaleItems(items);
      setPayments(pays);
      setRefunds(refs);
      setDetailOpen(true);
    } catch (e) {
      Alert.alert('Sale could not open', e instanceof Error ? e.message : String(e));
    }
  };

  const getStoreProfile = async () => {
    const allSettings = await db.settings.getAll();
    return Object.fromEntries(allSettings.map((s) => [s.key, s.value]));
  };

  const shareReceipt = async () => {
    if (!selectedSale) return;
    try {
      const cfg = await getStoreProfile();
      const storeName = cfg.store_name || 'TechknowLK Store';
      const headerParts = [
        storeName,
        cfg.store_address,
        cfg.store_phone ? `Tel: ${cfg.store_phone}` : '',
        cfg.tax_id ? `Tax ID: ${cfg.tax_id}` : '',
      ].filter(Boolean);
      const storeHeader = headerParts.join('\n');
      const storeFooter = cfg.receipt_footer || '';

      const lines = saleItems.map((item) => `${item.product_name} × ${item.quantity_milli / 1000}  ${money(item.line_total_cents)}`);
      const tender = payments.map((p) => `${p.method.toUpperCase()}: ${money(p.amount_cents)}`).join('\n');
      const receipt = [
        storeHeader,
        '--------------------------------',
        `Invoice: ${selectedSale.invoice_number}`,
        `Date:    ${new Date(selectedSale.completed_at ?? selectedSale.created_at).toLocaleString()}`,
        '--------------------------------',
        ...lines,
        '--------------------------------',
        `Subtotal: ${money(selectedSale.subtotal_cents)}`,
        selectedSale.tax_cents ? `Tax:      ${money(selectedSale.tax_cents)}` : '',
        `Total:    ${money(selectedSale.total_cents)}`,
        `Paid:     ${money(selectedSale.paid_cents)}`,
        selectedSale.change_cents ? `Change:   ${money(selectedSale.change_cents)}` : '',
        tender ? `\nTender:\n${tender}` : '',
        refunds.length ? `\nRefunds:\n${refunds.map((r) => `${money(r.total_cents)} via ${r.refund_method}`).join('\n')}` : '',
        `Status:   ${statusLabel[selectedSale.status] ?? selectedSale.status}`,
        storeFooter ? `\n${storeFooter}` : '',
      ].filter(Boolean).join('\n');

      await Share.share({ message: receipt, title: `Receipt ${selectedSale.invoice_number}` });
    } catch (e) {
      Alert.alert('Receipt could not be shared', e instanceof Error ? e.message : String(e));
    }
  };

  const openPrintPreview = async () => {
    if (!selectedSale) return;
    try {
      const cfg = await getStoreProfile();
      const formatted = formatMonospaceReceipt({
        storeName: cfg.store_name || 'TechknowLK Store',
        storeAddress: cfg.store_address,
        storePhone: cfg.store_phone,
        taxId: cfg.tax_id,
        invoiceNumber: selectedSale.invoice_number,
        dateStr: new Date(selectedSale.completed_at ?? selectedSale.created_at).toLocaleString(),
        items: saleItems.map((item) => ({
          name: item.product_name,
          quantity: item.quantity_milli / 1000,
          unitPriceCents: item.unit_price_cents,
          lineTotalCents: item.line_total_cents,
        })),
        subtotalCents: selectedSale.subtotal_cents,
        taxCents: selectedSale.tax_cents,
        totalCents: selectedSale.total_cents,
        paidCents: selectedSale.paid_cents,
        changeCents: selectedSale.change_cents,
        paymentMethod: selectedSale.payment_methods || 'cash',
        payments: payments.map((p) => ({ method: p.method, amount_cents: p.amount_cents })),
        footerNote: cfg.receipt_footer,
      }, 32);

      setMonospaceText(formatted);
      setPreviewOpen(true);
    } catch (e) {
      Alert.alert('Preview Error', e instanceof Error ? e.message : 'Could not generate preview');
    }
  };

  const openRefundModal = (mode: 'full' | 'partial') => {
    setRefundMode(mode);
    setRefundMethod('cash');
    setRefundReason('');
    const initialPartials: Record<string, number> = {};
    for (const item of saleItems) {
      initialPartials[item.id] = 0;
    }
    setPartialQuantities(initialPartials);
    setRefundOpen(true);
  };

  const changePartialQty = (itemId: string, maxMilli: number, deltaUnits: number) => {
    setPartialQuantities((prev) => {
      const current = prev[itemId] ?? 0;
      const next = Math.max(0, Math.min(maxMilli, current + deltaUnits * 1000));
      return { ...prev, [itemId]: next };
    });
  };

  const partialReturnTotal = useMemo(() => {
    let subtotal = 0;
    for (const item of saleItems) {
      const qtyMilli = partialQuantities[item.id] ?? 0;
      if (qtyMilli > 0) {
        subtotal += Math.round(item.unit_price_cents * qtyMilli / 1000);
      }
    }
    if (!selectedSale || selectedSale.subtotal_cents <= 0) return subtotal;
    const taxRatio = selectedSale.tax_cents / selectedSale.subtotal_cents;
    return subtotal + Math.round(subtotal * taxRatio);
  }, [partialQuantities, saleItems, selectedSale]);

  const confirmRefund = async () => {
    if (!selectedSale) return;
    setRefundSaving(true);
    try {
      if (refundMode === 'full') {
        const result = await db.refundSale(selectedSale.id, refundMethod, refundReason);
        setRefundOpen(false);
        setDetailOpen(false);
        await load();
        Alert.alert('Refund complete', `Recorded full refund ${result.invoice_number} for ${money(result.total_cents)}.`);
      } else {
        const returnLines = Object.entries(partialQuantities)
          .filter(([, qtyMilli]) => qtyMilli > 0)
          .map(([sale_item_id, quantity_milli]) => ({ sale_item_id, quantity_milli }));

        if (!returnLines.length) {
          Alert.alert('No items selected', 'Choose at least one item quantity to return.');
          setRefundSaving(false);
          return;
        }

        const result = await db.refundPartialSale(selectedSale.id, returnLines, refundMethod, refundReason);
        setRefundOpen(false);
        setDetailOpen(false);
        await load();
        Alert.alert('Return processed', `Recorded partial return ${result.invoice_number} for ${money(result.total_cents)}.`);
      }
    } catch (e) {
      Alert.alert('Refund failed', e instanceof Error ? e.message : String(e));
    } finally {
      setRefundSaving(false);
    }
  };

  const filters: { id: Filter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'today', label: 'Today' },
    { id: 'cash', label: 'Cash' },
    { id: 'card', label: 'Card' },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Sales History" subtitle="Receipts & Invoices" />

      <View style={styles.searchRow}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search invoice number"
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
          accessibilityLabel="Search invoice number"
        />
      </View>

      <View style={styles.filterRow}>
        {filters.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.filterChip, filter === item.id && styles.filterChipActive]}
            onPress={() => setFilter(item.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === item.id }}
          >
            <Text style={[styles.filterText, filter === item.id && styles.filterTextActive]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={visible}
        keyExtractor={(sale) => sale.id}
        contentContainerStyle={visible.length ? styles.salesList : styles.emptyList}
        refreshing={refreshing}
        onRefresh={() => { load().catch(() => undefined); }}
        ListEmptyComponent={
          <EmptyState
            title={history.length ? 'No Matching Sales' : 'No Sales Recorded'}
            description={history.length ? 'Try a different invoice number or filter.' : 'Completed sales will appear here with their itemized receipts.'}
          />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.saleCard}
            onPress={() => openSale(item)}
            accessibilityRole="button"
            accessibilityLabel={`Open invoice ${item.invoice_number}`}
          >
            <View style={styles.saleTop}>
              <View style={styles.saleTitleGroup}>
                <Text style={styles.invoice}>{item.invoice_number}</Text>
                <Text style={styles.saleDate}>{new Date(item.completed_at ?? item.created_at).toLocaleString()}</Text>
              </View>
              <Text style={styles.saleTotal}>{money(item.total_cents)}</Text>
            </View>
            <View style={styles.saleBottom}>
              <Text style={styles.saleMeta}>
                {item.item_count} {item.item_count === 1 ? 'line' : 'lines'} · {item.payment_methods.split(',').filter(Boolean).join(', ') || 'No payment record'}
              </Text>
              <Text style={[styles.saleStatus, item.status === 'refunded' && { color: colors.danger }]}>
                {statusLabel[item.status] ?? item.status}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />

      {/* Sale Detail / Receipt Modal */}
      <Modal visible={detailOpen} animationType="slide" transparent onRequestClose={() => setDetailOpen(false)}>
        <View style={styles.modalShade}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalTitle}>Receipt {selectedSale?.invoice_number}</Text>
                {selectedSale && (
                  <Text style={styles.saleDate}>
                    {new Date(selectedSale.completed_at ?? selectedSale.created_at).toLocaleString()} · {statusLabel[selectedSale.status] ?? selectedSale.status}
                  </Text>
                )}
              </View>
              <TouchableOpacity onPress={openPrintPreview} style={styles.previewBtn} accessibilityLabel="Thermal print preview">
                <Text style={styles.previewBtnText}>Print Preview</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.itemList}>
              {saleItems.map((item) => (
                <View key={item.id} style={styles.itemRow}>
                  <View style={styles.itemDescription}>
                    <Text style={styles.itemName}>{item.product_name}</Text>
                    <Text style={styles.saleDate}>{item.quantity_milli / 1000} × {money(item.unit_price_cents)}</Text>
                  </View>
                  <Text style={styles.itemTotal}>{money(item.line_total_cents)}</Text>
                </View>
              ))}
            </ScrollView>

            {selectedSale && (
              <View style={styles.receiptTotals}>
                <ReceiptValue label="Subtotal" value={selectedSale.subtotal_cents} />
                <ReceiptValue label="Tax" value={selectedSale.tax_cents} />
                <ReceiptValue label="Total" value={selectedSale.total_cents} emphasized />
                <ReceiptValue label="Paid" value={selectedSale.paid_cents} />
                <ReceiptValue label="Change" value={selectedSale.change_cents} />
              </View>
            )}

            <Text style={styles.paymentHeading}>Payment</Text>
            {payments.map((payment) => (
              <View key={payment.id} style={styles.paymentRow}>
                <Text style={styles.saleMeta}>{payment.method.toUpperCase()}</Text>
                <Text style={styles.saleMeta}>{money(payment.amount_cents)}</Text>
              </View>
            ))}

            {refunds.map((refund) => (
              <Text key={refund.id} style={styles.refundNote}>
                Refunded {money(refund.total_cents)} via {refund.refund_method} · {refund.reason}
              </Text>
            ))}

            <View style={styles.modalActions}>
              <Button title="Close" variant="outline" onPress={() => setDetailOpen(false)} style={styles.modalButton} />
              <Button title="Share Receipt" onPress={shareReceipt} style={styles.modalButton} />
            </View>

            {(selectedSale?.status === 'completed' || selectedSale?.status === 'partially_refunded') && (
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
                <Button
                  title="Partial Return"
                  variant="outline"
                  onPress={() => openRefundModal('partial')}
                  style={{ flex: 1 }}
                />
                <Button
                  title="Full Refund"
                  variant="danger"
                  onPress={() => openRefundModal('full')}
                  style={{ flex: 1 }}
                />
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Thermal Print Preview Modal */}
      <Modal visible={previewOpen} animationType="slide" transparent onRequestClose={() => setPreviewOpen(false)}>
        <View style={styles.modalShade}>
          <View style={[styles.modalCard, { maxHeight: '90%' }]}>
            <Text style={styles.modalTitle}>Thermal Receipt Preview (58mm)</Text>
            <Text style={styles.modalHint}>Standard ESC/POS monospace layout</Text>
            <ScrollView style={styles.thermalPaper}>
              <Text style={styles.thermalText}>{monospaceText}</Text>
            </ScrollView>
            <View style={styles.modalActions}>
              <Button title="Close" variant="outline" onPress={() => setPreviewOpen(false)} style={styles.modalButton} />
              <Button
                title="Share Receipt"
                variant="primary"
                onPress={async () => {
                  await Share.share({ message: monospaceText, title: 'ESC/POS Thermal Receipt' });
                }}
                style={styles.modalButton}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Refund / Return Modal */}
      <Modal visible={refundOpen} animationType="slide" transparent onRequestClose={() => setRefundOpen(false)}>
        <View style={styles.modalShade}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {refundMode === 'full' ? 'Full Sale Refund' : 'Return Specific Items'}
            </Text>
            <Text style={styles.saleDate}>
              Invoice {selectedSale?.invoice_number} · Total {money(refundMode === 'full' ? selectedSale?.total_cents ?? 0 : partialReturnTotal)}
            </Text>

            {/* Partial return item selector */}
            {refundMode === 'partial' && (
              <ScrollView style={{ maxHeight: 180, marginVertical: spacing.xs }}>
                {saleItems.map((item) => {
                  const maxUnits = item.quantity_milli / 1000;
                  const returningMilli = partialQuantities[item.id] ?? 0;
                  return (
                    <View key={item.id} style={styles.partialRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemName}>{item.product_name}</Text>
                        <Text style={styles.saleDate}>Max: {maxUnits} · {money(item.unit_price_cents)}/ea</Text>
                      </View>
                      <View style={styles.partialControls}>
                        <TouchableOpacity style={styles.qtyBtn} onPress={() => changePartialQty(item.id, item.quantity_milli, -1)}>
                          <Text style={styles.qtyText}>−</Text>
                        </TouchableOpacity>
                        <Text style={styles.qty}>{returningMilli / 1000}</Text>
                        <TouchableOpacity style={styles.qtyBtn} onPress={() => changePartialQty(item.id, item.quantity_milli, 1)}>
                          <Text style={styles.qtyText}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            )}

            <Text style={styles.paymentHeading}>Refund payment method</Text>
            <View style={styles.refundMethods}>
              {(['cash', 'card', 'transfer', 'other'] as PaymentMethod[]).map((method) => (
                <TouchableOpacity
                  key={method}
                  style={[styles.refundMethod, refundMethod === method && styles.refundMethodActive]}
                  onPress={() => setRefundMethod(method)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: refundMethod === method }}
                >
                  <Text style={[styles.refundMethodText, refundMethod === method && styles.refundMethodTextActive]}>
                    {method === 'transfer' ? 'Transfer' : method.charAt(0).toUpperCase() + method.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.paymentHeading}>Reason (optional)</Text>
            <TextInput
              value={refundReason}
              onChangeText={setRefundReason}
              placeholder="e.g. Customer return, damaged item"
              placeholderTextColor={colors.textMuted}
              style={styles.reasonInput}
              accessibilityLabel="Refund reason"
            />

            <Text style={styles.saleDate}>
              Restores stock ledger entries for returned items.
            </Text>

            <View style={styles.modalActions}>
              <Button title="Back" variant="outline" onPress={() => setRefundOpen(false)} style={styles.modalButton} />
              <Button
                title={refundSaving ? 'Saving…' : 'Confirm Return'}
                onPress={confirmRefund}
                disabled={refundSaving || (refundMode === 'partial' && partialReturnTotal <= 0)}
                style={styles.modalButton}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function ReceiptValue(props: { label: string; value: number; emphasized?: boolean }) {
  return (
    <View style={styles.receiptValueRow}>
      <Text style={[styles.receiptLabel, props.emphasized && styles.receiptEmphasis]}>{props.label}</Text>
      <Text style={[styles.receiptAmount, props.emphasized && styles.receiptEmphasis]}>{money(props.value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  searchRow: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  searchInput: { minHeight: spacing.touchTarget, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: spacing.md, fontSize: 14, color: colors.text },
  filterRow: { flexDirection: 'row', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.sm },
  filterChip: { flex: 1, paddingHorizontal: spacing.sm, borderRadius: 24, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center', minHeight: spacing.touchTarget },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { fontSize: 13, fontWeight: '500', color: colors.textSecondary },
  filterTextActive: { color: colors.white, fontWeight: '600' },
  salesList: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.sm },
  emptyList: { flexGrow: 1 },
  saleCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: spacing.lg, gap: spacing.md },
  saleTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md },
  saleTitleGroup: { flex: 1, gap: spacing.xs },
  invoice: { fontSize: 16, fontWeight: '700', color: colors.primary },
  saleDate: { fontSize: 12, color: colors.textSecondary },
  saleTotal: { fontSize: 16, fontWeight: '700', color: colors.accent },
  saleBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderColor: colors.border, paddingTop: spacing.sm },
  saleMeta: { fontSize: 13, color: colors.textSecondary },
  saleStatus: { fontSize: 13, fontWeight: '600', color: colors.accent },
  modalShade: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#0007' },
  modalCard: { maxHeight: '90%', backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing.xl, gap: spacing.sm },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  modalTitle: { fontSize: 20, fontWeight: '700', color: colors.primary },
  modalHint: { fontSize: 12, color: colors.textSecondary, marginBottom: spacing.xs },
  previewBtn: { paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: colors.borderDark },
  previewBtnText: { fontSize: 12, fontWeight: '600', color: colors.primary },
  itemList: { maxHeight: 180, marginVertical: spacing.xs },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.xs, borderBottomWidth: 1, borderColor: colors.border },
  itemDescription: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: '600', color: colors.text },
  itemTotal: { fontSize: 14, fontWeight: '600', color: colors.text },
  receiptTotals: { borderTopWidth: 1, borderColor: colors.border, paddingVertical: spacing.xs, gap: 2 },
  receiptValueRow: { flexDirection: 'row', justifyContent: 'space-between' },
  receiptLabel: { fontSize: 13, color: colors.textSecondary },
  receiptAmount: { fontSize: 13, color: colors.text },
  receiptEmphasis: { fontWeight: '700', color: colors.accent, fontSize: 15 },
  paymentHeading: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', marginTop: spacing.xs },
  paymentRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  refundNote: { fontSize: 12, color: colors.danger, fontWeight: '500', marginTop: 2 },
  modalActions: { flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.xs },
  modalButton: { flex: 1 },
  refundMethods: { flexDirection: 'row', gap: spacing.xs, marginVertical: spacing.xs },
  refundMethod: { flex: 1, minHeight: spacing.touchTarget, borderWidth: 1, borderColor: colors.border, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  refundMethodActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  refundMethodText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  refundMethodTextActive: { color: colors.white },
  reasonInput: { minHeight: spacing.touchTarget, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: spacing.md, fontSize: 14, color: colors.text, backgroundColor: colors.background },
  thermalPaper: { backgroundColor: '#fefefe', borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: spacing.md, maxHeight: 300, marginVertical: spacing.sm },
  thermalText: { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 12, color: '#111', lineHeight: 16 },
  partialRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.xs, borderBottomWidth: 1, borderColor: colors.border },
  partialControls: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  qtyBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  qtyText: { fontSize: 16, fontWeight: '600', color: colors.primary },
  qty: { minWidth: 24, textAlign: 'center', fontWeight: '600', fontSize: 14 },
});
