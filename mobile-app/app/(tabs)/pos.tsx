import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
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
import type { Category, PaymentMethod, Product } from '../../src/db/types';
import { colors, spacing } from '../../src/ui/theme';
import { Header } from '../../src/ui/components/Header';
import { EmptyState } from '../../src/ui/components/EmptyState';
import { Button } from '../../src/ui/components/Button';

const money = (cents: number) => `LKR ${(cents / 100).toFixed(2)}`;

export default function PosScreen() {
  const db = useDb();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [discount, setDiscount] = useState('');
  const [cash, setCash] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [splitTender, setSplitTender] = useState(false);
  const [secondaryMethod, setSecondaryMethod] = useState<PaymentMethod>('card');
  const [secondaryAmount, setSecondaryAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<{ invoice: string; total: number; change: number } | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [prods, cats] = await Promise.all([
        db.products.findAll(),
        db.categories.findAll(),
      ]);
      setProducts(prods);
      setCategories(cats);
    } catch (e) {
      Alert.alert('Catalog could not load', String(e));
    }
  }, [db]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const available = useMemo(() => {
    const q = search.trim().toLocaleLowerCase();
    return products.filter((p) => {
      const matchesQuery = !q || [p.name, p.sku, p.barcode].some((value) => value?.toLocaleLowerCase().includes(q));
      const matchesCategory = !selectedCategory || p.category_id === selectedCategory;
      return matchesQuery && matchesCategory;
    });
  }, [products, search, selectedCategory]);

  const cartItems = Object.entries(cart)
    .map(([id, quantity]) => ({ product: products.find((p) => p.id === id), quantity }))
    .filter((entry): entry is { product: Product; quantity: number } => Boolean(entry.product));

  const totalCents = cartItems.reduce((sum, item) => sum + Math.round(item.product.price_cents * item.quantity / 1000), 0);
  const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const discountCents = /^\d+(\.\d{1,2})?$/.test(discount) ? Math.min(totalCents, Math.round(Number(discount) * 100)) : 0;
  const finalTotalCents = totalCents - discountCents;

  const add = (id: string) => setCart((old) => ({ ...old, [id]: (old[id] ?? 0) + 1000 }));
  const changeQty = (id: string, delta: number) => setCart((old) => {
    const next = { ...old, [id]: (old[id] ?? 0) + delta * 1000 };
    if (next[id] <= 0) delete next[id];
    return next;
  });

  const finishSale = async () => {
    const primaryCents = paymentMethod === 'cash' ? (/^\d+(\.\d{1,2})?$/.test(cash) ? Math.round(Number(cash) * 100) : NaN) : finalTotalCents;
    const secondaryCents = splitTender ? (/^\d+(\.\d{1,2})?$/.test(secondaryAmount) ? Math.round(Number(secondaryAmount) * 100) : NaN) : 0;
    const paidCents = primaryCents + secondaryCents;
    if (!Number.isSafeInteger(paidCents)) {
      Alert.alert('Enter cash received', 'Use a valid amount, such as 1000.00.');
      return;
    }
    setSaving(true);
    try {
      const payments = splitTender
        ? [{ method: paymentMethod, amount_cents: primaryCents }, { method: secondaryMethod, amount_cents: secondaryCents }]
        : undefined;

      const itemsSnapshot = cartItems.map(({ product, quantity }) => ({
        name: product.name,
        qty: quantity / 1000,
        lineTotal: Math.round(product.price_cents * quantity / 1000),
      }));

      const result = await db.checkout(
        cartItems.map(({ product, quantity }) => ({ product_id: product.id, quantity_milli: quantity })),
        paidCents,
        paymentMethod,
        payments,
        discountCents
      );

      setLastReceipt({ invoice: result.invoice_number, total: result.total_cents, change: result.change_cents });
      setCart({});
      setCash('');
      setSecondaryAmount('');
      setSplitTender(false);
      setCheckoutOpen(false);

      Alert.alert(
        'Sale complete',
        `Invoice ${result.invoice_number}\nTotal ${money(result.total_cents)}\nPayment: ${splitTender ? 'Split tender' : paymentMethod}${result.change_cents ? `\nChange ${money(result.change_cents)}` : ''}`,
        [
          { text: 'Done', style: 'default' },
          {
            text: 'Share Receipt',
            onPress: async () => {
              try {
                const cfgRows = await db.settings.getAll();
                const cfg = Object.fromEntries(cfgRows.map((s) => [s.key, s.value]));
                const storeName = cfg.store_name || 'TechknowLK Store';
                const receipt = [
                  storeName,
                  cfg.store_address,
                  cfg.store_phone ? `Tel: ${cfg.store_phone}` : '',
                  '--------------------------------',
                  `Invoice: ${result.invoice_number}`,
                  `Date: ${new Date().toLocaleString()}`,
                  '--------------------------------',
                  ...itemsSnapshot.map((i) => `${i.name} × ${i.qty}  ${money(i.lineTotal)}`),
                  '--------------------------------',
                  `Subtotal: ${money(result.subtotal_cents)}`,
                  result.tax_cents ? `Tax: ${money(result.tax_cents)}` : '',
                  `Total: ${money(result.total_cents)}`,
                  `Paid: ${money(result.paid_cents)}`,
                  result.change_cents ? `Change: ${money(result.change_cents)}` : '',
                  '--------------------------------',
                  cfg.receipt_footer || 'Thank you for shopping with us!',
                ].filter(Boolean).join('\n');

                await Share.share({ message: receipt, title: `Receipt ${result.invoice_number}` });
              } catch (e) {
                Alert.alert('Share error', e instanceof Error ? e.message : 'Could not share receipt');
              }
            },
          },
        ]
      );
    } catch (e) {
      Alert.alert('Checkout could not complete', e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="POS Register" subtitle="Quick Billing" />

      {/* Search Input */}
      <View style={styles.searchBox}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search product, SKU or barcode"
          placeholderTextColor={colors.textMuted}
          style={styles.search}
          accessibilityLabel="Search products for sale"
        />
      </View>

      {/* Category Filter Chips */}
      {categories.length > 0 && (
        <View style={styles.categoryBarWrapper}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryBar}>
            <TouchableOpacity
              style={[styles.catChip, selectedCategory === null && styles.catChipActive]}
              onPress={() => setSelectedCategory(null)}
            >
              <Text style={[styles.catChipText, selectedCategory === null && styles.catChipTextActive]}>
                All ({products.length})
              </Text>
            </TouchableOpacity>
            {categories.map((cat) => {
              const count = products.filter((p) => p.category_id === cat.id).length;
              const isSelected = selectedCategory === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.catChip, isSelected && styles.catChipActive]}
                  onPress={() => setSelectedCategory(isSelected ? null : cat.id)}
                >
                  <Text style={[styles.catChipText, isSelected && styles.catChipTextActive]}>
                    {cat.name} ({count})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Product List */}
      <FlatList
        data={available}
        keyExtractor={(p) => p.id}
        contentContainerStyle={available.length ? styles.list : styles.emptyList}
        ListEmptyComponent={
          <EmptyState
            title={products.length ? 'No Matching Products' : 'Catalog Empty'}
            description={products.length ? 'Try another name, SKU or barcode.' : 'Add products in Products & Stock to begin billing.'}
          />
        }
        renderItem={({ item }) => (
          <View style={styles.productCard}>
            <View style={styles.productInfo}>
              <Text style={styles.productName}>{item.name}</Text>
              <Text style={styles.productPrice}>{money(item.price_cents)}</Text>
              {item.sku ? <Text style={styles.productSku}>SKU {item.sku}</Text> : null}
            </View>
            <TouchableOpacity
              style={styles.addItem}
              onPress={() => add(item.id)}
              accessibilityRole="button"
              accessibilityLabel={`Add ${item.name} to cart`}
            >
              <Text style={styles.addItemText}>{cart[item.id] ? `Add · ${cart[item.id] / 1000}` : 'Add'}</Text>
            </TouchableOpacity>
          </View>
        )}
      />

      {/* Bottom Cart Bar */}
      <View style={styles.cartBar}>
        <View style={styles.cartSummary}>
          <Text style={styles.cartLabel}>{itemCount / 1000} items in cart</Text>
          <Text style={styles.cartTotal}>{money(totalCents)}</Text>
        </View>
        <Button
          title={itemCount ? 'Review & Charge' : 'Cart Empty'}
          onPress={() => {
            setDiscount('');
            setCash((totalCents / 100).toFixed(2));
            setSecondaryAmount('');
            setSplitTender(false);
            setPaymentMethod('cash');
            setCheckoutOpen(true);
          }}
          disabled={!itemCount}
          style={styles.charge}
        />
      </View>

      {/* Checkout Modal */}
      <Modal visible={checkoutOpen} animationType="slide" transparent onRequestClose={() => setCheckoutOpen(false)}>
        <View style={styles.modalShade}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Review sale</Text>
            <ScrollView style={styles.cartList}>
              {cartItems.map(({ product, quantity }) => (
                <View key={product.id} style={styles.cartLine}>
                  <View style={styles.cartLineText}>
                    <Text style={styles.productName}>{product.name}</Text>
                    <Text style={styles.productSku}>{money(Math.round(product.price_cents * quantity / 1000))}</Text>
                  </View>
                  <View style={styles.quantityControls}>
                    <TouchableOpacity style={styles.qtyBtn} onPress={() => changeQty(product.id, -1)} accessibilityLabel={`Remove one ${product.name}`}>
                      <Text style={styles.qtyText}>−</Text>
                    </TouchableOpacity>
                    <Text style={styles.qty}>{quantity / 1000}</Text>
                    <TouchableOpacity style={styles.qtyBtn} onPress={() => changeQty(product.id, 1)} accessibilityLabel={`Add one ${product.name}`}>
                      <Text style={styles.qtyText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>

            {/* Discount Field */}
            <View style={styles.discountRow}>
              <Text style={styles.tenderLabel}>Discount (LKR)</Text>
              <TextInput
                value={discount}
                onChangeText={(val) => {
                  setDiscount(val);
                  const dCents = /^\d+(\.\d{1,2})?$/.test(val) ? Math.min(totalCents, Math.round(Number(val) * 100)) : 0;
                  setCash(((totalCents - dCents) / 100).toFixed(2));
                }}
                keyboardType="numeric"
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
                style={styles.cashInput}
                accessibilityLabel="Discount amount"
              />
            </View>

            <View style={styles.totalBlock}>
              <View>
                <Text style={styles.totalLabel}>Total</Text>
                {discountCents > 0 && (
                  <Text style={styles.subtotalHint}>Subtotal {money(totalCents)} - Disc {money(discountCents)}</Text>
                )}
              </View>
              <Text style={styles.totalValue}>{money(finalTotalCents)}</Text>
            </View>

            {/* Split Tender Switch */}
            <View style={styles.splitToggleRow}>
              <Text style={styles.tenderLabel}>Split tender</Text>
              <TouchableOpacity
                onPress={() => setSplitTender((prev) => !prev)}
                style={[styles.splitBtn, splitTender && styles.splitBtnActive]}
                accessibilityRole="switch"
                accessibilityLabel="Toggle split tender"
              >
                <Text style={[styles.splitBtnText, splitTender && styles.splitBtnTextActive]}>
                  {splitTender ? 'Split On' : 'Split Off'}
                </Text>
              </TouchableOpacity>
            </View>

            {splitTender ? (
              <View style={styles.splitSection}>
                <View style={styles.splitLine}>
                  <Text style={styles.tenderLabel}>Cash tender</Text>
                  <TextInput
                    value={cash}
                    onChangeText={setCash}
                    keyboardType="numeric"
                    placeholder="Cash amount"
                    placeholderTextColor={colors.textMuted}
                    style={styles.cashInput}
                    accessibilityLabel="Primary cash amount"
                  />
                </View>
                <View style={styles.splitLine}>
                  <Text style={styles.tenderLabel}>Secondary tender</Text>
                  <View style={styles.methods}>
                    {(['card', 'transfer', 'other'] as const).map((method) => (
                      <TouchableOpacity
                        key={method}
                        onPress={() => setSecondaryMethod(method)}
                        style={[styles.methodBtn, secondaryMethod === method && styles.methodBtnActive]}
                        accessibilityRole="radio"
                        accessibilityLabel={`Secondary tender ${method}`}
                      >
                        <Text style={[styles.methodText, secondaryMethod === method && styles.methodTextActive]}>
                          {method}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                <View style={styles.splitLine}>
                  <Text style={styles.tenderLabel}>Secondary amount</Text>
                  <TextInput
                    value={secondaryAmount}
                    onChangeText={setSecondaryAmount}
                    keyboardType="numeric"
                    placeholder="Secondary amount"
                    placeholderTextColor={colors.textMuted}
                    style={styles.cashInput}
                    accessibilityLabel="Secondary tender amount"
                  />
                </View>
              </View>
            ) : (
              <>
                <View style={styles.methods}>
                  {(['cash', 'card', 'transfer', 'other'] as const).map((method) => (
                    <TouchableOpacity
                      key={method}
                      onPress={() => setPaymentMethod(method)}
                      style={[styles.methodBtn, paymentMethod === method && styles.methodBtnActive]}
                      accessibilityRole="radio"
                      accessibilityLabel={`Payment method ${method}`}
                    >
                      <Text style={[styles.methodText, paymentMethod === method && styles.methodTextActive]}>
                        {method}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {paymentMethod === 'cash' ? (
                  <View style={styles.cashBlock}>
                    <Text style={styles.tenderLabel}>Cash received</Text>
                    <TextInput
                      value={cash}
                      onChangeText={setCash}
                      keyboardType="numeric"
                      placeholder="0.00"
                      placeholderTextColor={colors.textMuted}
                      style={styles.cashInput}
                      accessibilityLabel="Cash amount received"
                    />
                  </View>
                ) : null}
              </>
            )}

            <View style={styles.actions}>
              <Button title="Back" variant="outline" onPress={() => setCheckoutOpen(false)} style={styles.actionButton} />
              <Button title={saving ? 'Processing…' : 'Complete Sale'} onPress={finishSale} disabled={saving || totalCents <= 0} style={styles.actionButton} />
            </View>
          </View>
        </View>
      </Modal>

      {lastReceipt ? (
        <View accessible accessibilityLabel={`Last sale ${lastReceipt.invoice}`} style={styles.hiddenReceipt}>
          <Text>{lastReceipt.invoice}</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  searchBox: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  search: {
    height: spacing.touchTarget,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    fontSize: 14,
    color: colors.text,
  },
  categoryBarWrapper: {
    paddingBottom: spacing.sm,
  },
  categoryBar: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  catChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  catChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  catChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  catChipTextActive: {
    color: colors.white,
  },
  list: { paddingHorizontal: spacing.lg, gap: spacing.md, paddingBottom: 110 },
  emptyList: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: spacing.lg },
  productCard: {
    minHeight: spacing.touchTarget,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
    padding: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  productInfo: { flex: 1, gap: 2 },
  productName: { fontSize: 15, fontWeight: '600', color: colors.text },
  productPrice: { fontSize: 13, color: colors.textSecondary },
  productSku: { fontSize: 11, color: colors.textMuted },
  addItem: {
    minHeight: spacing.touchTarget,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.primaryLight,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addItemText: { color: colors.white, fontWeight: '600', fontSize: 14 },
  cartBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  cartSummary: { flex: 1 },
  cartLabel: { fontSize: 12, color: colors.textSecondary },
  cartTotal: { fontSize: 18, fontWeight: '700', color: colors.primary },
  charge: { minWidth: 160 },
  modalShade: { flex: 1, backgroundColor: 'rgba(15,23,42,0.4)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: spacing.lg, maxHeight: '85%', gap: spacing.md },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.primary },
  cartList: { maxHeight: 220 },
  cartLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderColor: colors.border },
  cartLineText: { flex: 1 },
  quantityControls: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  qtyBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  qtyText: { fontSize: 18, fontWeight: '600', color: colors.primary },
  qty: { minWidth: 28, textAlign: 'center', fontWeight: '600' },
  totalBlock: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 16, fontWeight: '600', color: colors.text },
  totalValue: { fontSize: 20, fontWeight: '700', color: colors.accent },
  discountRow: { gap: spacing.xs, borderTopWidth: 1, borderColor: colors.border, paddingTop: spacing.xs },
  subtotalHint: { fontSize: 11, color: colors.textMuted },
  splitToggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.xs },
  splitBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  splitBtnActive: { borderColor: colors.accent, backgroundColor: colors.accent },
  splitBtnText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  splitBtnTextActive: { color: colors.white },
  splitSection: { gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: spacing.sm, backgroundColor: colors.background },
  splitLine: { gap: spacing.xs },
  tenderLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  cashBlock: { gap: spacing.xs },
  cashInput: { height: spacing.touchTarget, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: spacing.md, fontSize: 16, color: colors.text, backgroundColor: colors.background },
  methods: { flexDirection: 'row', gap: spacing.sm },
  methodBtn: { flex: 1, height: spacing.touchTarget, borderWidth: 1, borderColor: colors.border, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  methodBtnActive: { borderColor: colors.accent, backgroundColor: colors.primaryLight },
  methodText: { fontSize: 13, textTransform: 'capitalize', color: colors.text, fontWeight: '600' },
  methodTextActive: { color: colors.white },
  actions: { flexDirection: 'row', gap: spacing.md },
  actionButton: { flex: 1 },
  hiddenReceipt: { opacity: 0, height: 0 },
});
