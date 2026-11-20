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
  Platform,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useDb } from '../_layout';
import type { Category, PaymentMethod, Product } from '../../src/db/types';
import { colors, spacing, shadows } from '../../src/ui/theme';
import { useTheme } from '../../src/ui/ThemeContext';
import { useLanguage } from '../../src/i18n/LanguageContext';
import { Header } from '../../src/ui/components/Header';
import { EmptyState } from '../../src/ui/components/EmptyState';
import { Button } from '../../src/ui/components/Button';
import { formatMonospaceReceipt } from '../../src/utils/escpos';
import { BarcodeScannerModal } from '../../src/ui/components/BarcodeScannerModal';
import { blePrinter } from '../../src/utils/blePrinter';

const money = (cents: number) => `LKR ${(cents / 100).toFixed(2)}`;

export default function PosScreen() {
  const db = useDb();
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { language, t, getProductName } = useLanguage();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stockMap, setStockMap] = useState<Record<string, number>>({});
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Cart state
  const [cart, setCart] = useState<Record<string, number>>({});
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [discountType, setDiscountType] = useState<'fixed' | 'percent'>('fixed');
  const [discountValue, setDiscountValue] = useState('');

  // Payment state
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [cashTendered, setCashTendered] = useState('');
  const [splitTender, setSplitTender] = useState(false);
  const [secondaryMethod, setSecondaryMethod] = useState<PaymentMethod>('card');
  const [secondaryAmount, setSecondaryAmount] = useState('');
  const [saving, setSaving] = useState(false);

  // Success modal state
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [completedSale, setCompletedSale] = useState<{
    invoice: string;
    total: number;
    paid: number;
    change: number;
    paymentSummary: string;
    items: { name: string; qty: number; lineTotal: number }[];
  } | null>(null);

  // Thermal preview modal state
  const [thermalPreviewOpen, setThermalPreviewOpen] = useState(false);
  const [thermalText, setThermalText] = useState('');

  // Barcode scanner modal & BLE printer state
  const [scannerOpen, setScannerOpen] = useState(false);
  const [isPrintingBle, setIsPrintingBle] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [prods, cats] = await Promise.all([
        db.products.findAll(),
        db.categories.findAll(),
      ]);
      setProducts(prods);
      setCategories(cats);

      // Load stock levels for badges
      const stockPairs = await Promise.all(
        prods.map(async (p) => [p.id, await db.stock.getOnHand(p.id)] as const)
      );
      setStockMap(Object.fromEntries(stockPairs));
    } catch (e) {
      Alert.alert('Catalog could not load', String(e));
    }
  }, [db]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  // Category color mapper for avatars
  const getCategoryTheme = useCallback((catId: string | null) => {
    if (!catId) return colors.categoryColors[0];
    const index = Math.abs(catId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)) % colors.categoryColors.length;
    return colors.categoryColors[index];
  }, []);

  const available = useMemo(() => {
    const q = search.trim().toLocaleLowerCase();
    return products.filter((p) => {
      const matchesQuery =
        !q ||
        [p.name, p.name_en, p.name_si, p.sku, p.barcode].some((value) =>
          value?.toLocaleLowerCase().includes(q)
        );
      const matchesCategory = !selectedCategory || p.category_id === selectedCategory;
      return matchesQuery && matchesCategory;
    });
  }, [products, search, selectedCategory]);

  const cartItems = useMemo(() => {
    return Object.entries(cart)
      .map(([id, quantity]) => ({ product: products.find((p) => p.id === id), quantity }))
      .filter((entry): entry is { product: Product; quantity: number } => Boolean(entry.product));
  }, [cart, products]);

  const totalCents = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + Math.round(item.product.price_cents * item.quantity / 1000), 0);
  }, [cartItems]);

  const itemCount = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + item.quantity / 1000, 0);
  }, [cartItems]);

  // Compute discount cents
  const discountCents = useMemo(() => {
    const val = Number(discountValue);
    if (!val || val <= 0 || isNaN(val)) return 0;
    if (discountType === 'percent') {
      const clampedPct = Math.min(100, Math.max(0, val));
      return Math.round((totalCents * clampedPct) / 100);
    }
    return Math.min(totalCents, Math.round(val * 100));
  }, [discountType, discountValue, totalCents]);

  const finalTotalCents = Math.max(0, totalCents - discountCents);

  // Quick cash shortcuts
  const cashShortcuts = useMemo(() => {
    const currentTotal = finalTotalCents / 100;
    const rounded500 = Math.ceil(currentTotal / 500) * 500;
    const rounded1000 = Math.ceil(currentTotal / 1000) * 1000;
    const rounded5000 = Math.ceil(currentTotal / 5000) * 5000;

    const values = [currentTotal, rounded500, rounded1000, rounded5000];
    return Array.from(new Set(values.filter((v) => v >= currentTotal))).slice(0, 4);
  }, [finalTotalCents]);

  // Live change calculation
  const liveChangeCents = useMemo(() => {
    if (paymentMethod !== 'cash') return 0;
    const tendered = Number(cashTendered) * 100;
    if (isNaN(tendered) || tendered < finalTotalCents) return 0;
    return Math.round(tendered - finalTotalCents);
  }, [cashTendered, finalTotalCents, paymentMethod]);

  const addToCart = (id: string) => {
    setCart((old) => ({ ...old, [id]: (old[id] ?? 0) + 1000 }));
  };

  const changeQty = (id: string, delta: number) => {
    setCart((old) => {
      const next = { ...old, [id]: (old[id] ?? 0) + delta * 1000 };
      if (next[id] <= 0) delete next[id];
      return next;
    });
  };

  const clearCart = () => {
    setCart({});
  };

  const openCheckout = () => {
    setDiscountValue('');
    setDiscountType('fixed');
    setCashTendered((finalTotalCents / 100).toFixed(2));
    setSecondaryAmount('');
    setSplitTender(false);
    setPaymentMethod('cash');
    setCheckoutOpen(true);
  };

  const finishSale = async () => {
    const primaryCents = paymentMethod === 'cash'
      ? (/^\d+(\.\d{1,2})?$/.test(cashTendered) ? Math.round(Number(cashTendered) * 100) : NaN)
      : finalTotalCents;
    const secondaryCents = splitTender
      ? (/^\d+(\.\d{1,2})?$/.test(secondaryAmount) ? Math.round(Number(secondaryAmount) * 100) : NaN)
      : 0;

    const paidCents = primaryCents + secondaryCents;
    if (!Number.isSafeInteger(paidCents) || paidCents < finalTotalCents) {
      Alert.alert('Insufficient Tender', 'Paid amount must be at least the total payable.');
      return;
    }

    setSaving(true);
    try {
      const payments = splitTender
        ? [{ method: paymentMethod, amount_cents: primaryCents }, { method: secondaryMethod, amount_cents: secondaryCents }]
        : undefined;

      const itemsSnapshot = cartItems.map(({ product, quantity }) => ({
        name: getProductName(product, language),
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

      setCompletedSale({
        invoice: result.invoice_number,
        total: result.total_cents,
        paid: result.paid_cents,
        change: result.change_cents,
        paymentSummary: splitTender ? 'Split Tender' : paymentMethod.toUpperCase(),
        items: itemsSnapshot,
      });

      setCart({});
      setCheckoutOpen(false);
      setSuccessModalOpen(true);
      await loadData();
    } catch (e) {
      Alert.alert('Checkout Failed', e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const shareReceipt = async () => {
    if (!completedSale) return;
    try {
      const cfgRows = await db.settings.getAll();
      const cfg = Object.fromEntries(cfgRows.map((s) => [s.key, s.value]));
      const storeName = cfg.store_name || 'TechknowLK Store';

      const receipt = [
        `================================`,
        `       ${storeName.toUpperCase()}`,
        cfg.store_address,
        cfg.store_phone ? `Tel: ${cfg.store_phone}` : '',
        `================================`,
        `Invoice: ${completedSale.invoice}`,
        `Date: ${new Date().toLocaleString()}`,
        `Tender: ${completedSale.paymentSummary}`,
        `--------------------------------`,
        ...completedSale.items.map((i) => `${i.name} x ${i.qty}\n  ${money(i.lineTotal)}`),
        `--------------------------------`,
        `TOTAL:   ${money(completedSale.total)}`,
        `PAID:    ${money(completedSale.paid)}`,
        completedSale.change ? `CHANGE:  ${money(completedSale.change)}` : '',
        `================================`,
        cfg.receipt_footer || 'Thank you for shopping with us!',
      ].filter(Boolean).join('\n');

      await Share.share({ message: receipt, title: `Receipt ${completedSale.invoice}` });
    } catch (e) {
      Alert.alert('Share Error', e instanceof Error ? e.message : 'Could not share receipt');
    }
  };

  const previewThermal = async () => {
    if (!completedSale) return;
    try {
      const cfgRows = await db.settings.getAll();
      const cfg = Object.fromEntries(cfgRows.map((s) => [s.key, s.value]));

      const text = formatMonospaceReceipt({
        storeName: cfg.store_name || 'TechknowLK Store',
        storePhone: cfg.store_phone,
        storeAddress: cfg.store_address,
        taxId: cfg.tax_id,
        invoiceNumber: completedSale.invoice,
        dateStr: new Date().toLocaleString(),
        items: completedSale.items.map((i) => ({
          name: i.name,
          quantity: i.qty,
          unitPriceCents: i.qty > 0 ? Math.round(i.lineTotal / i.qty) : i.lineTotal,
          lineTotalCents: i.lineTotal,
        })),
        subtotalCents: completedSale.total,
        taxCents: 0,
        totalCents: completedSale.total,
        paidCents: completedSale.paid,
        changeCents: completedSale.change,
        paymentMethod: completedSale.paymentSummary,
        payments: [{ method: paymentMethod, amount_cents: completedSale.paid }],
        footerNote: cfg.receipt_footer || 'Thank you for shopping with us!',
      }, 32);

      setThermalText(text);
      setThermalPreviewOpen(true);
    } catch (e) {
      Alert.alert('Receipt Error', String(e));
    }
  };

  const handleSeedDemo = async () => {
    try {
      const res = await db.seedDemoData();
      await loadData();
      Alert.alert('Demo Catalog Loaded', `Successfully added ${res.productsCount} test products across ${res.categoriesCount} departments.`);
    } catch (e) {
      Alert.alert('Seed Failed', String(e));
    }
  };

  const handleBarcodeScan = (scannedCode: string) => {
    const code = scannedCode.trim().toLowerCase();
    const matched = products.find(
      (p) =>
        (p.barcode && p.barcode.toLowerCase() === code) ||
        (p.sku && p.sku.toLowerCase() === code)
    );

    if (matched) {
      addToCart(matched.id);
      return { success: true, name: matched.name, priceCents: matched.price_cents };
    } else {
      return { success: false, message: `No catalog item matches barcode/SKU: "${scannedCode}"` };
    }
  };

  const handleBlePrint = async () => {
    if (!completedSale) return;
    setIsPrintingBle(true);
    try {
      const cfgRows = await db.settings.getAll();
      const cfg = Object.fromEntries(cfgRows.map((s) => [s.key, s.value]));

      // Connect to printer (auto-discover or use paired device)
      if (!blePrinter.getConnectedPrinter()) {
        const devices = blePrinter.getDiscoveredDevices();
        if (devices.length > 0) {
          await blePrinter.connect(devices[0].id);
        } else {
          await blePrinter.startScan(2000);
          const scanned = blePrinter.getDiscoveredDevices();
          if (scanned.length > 0) {
            await blePrinter.connect(scanned[0].id);
          }
        }
      }

      const receiptData = {
        storeName: cfg.store_name || 'TechknowLK Store',
        storeAddress: cfg.store_address,
        storePhone: cfg.store_phone,
        taxId: cfg.tax_id,
        invoiceNumber: completedSale.invoice,
        dateStr: new Date().toLocaleString(),
        items: completedSale.items.map((i) => ({
          name: i.name,
          quantity: i.qty,
          unitPriceCents: Math.round(i.lineTotal / i.qty),
          lineTotalCents: i.lineTotal,
        })),
        subtotalCents: completedSale.total,
        taxCents: 0,
        totalCents: completedSale.total,
        paidCents: completedSale.paid,
        changeCents: completedSale.change,
        paymentMethod: completedSale.paymentSummary,
        payments: [{ method: paymentMethod, amount_cents: completedSale.paid }],
        footerNote: cfg.receipt_footer || 'Thank you for shopping with us!',
      };

      const result = await blePrinter.printReceipt(receiptData, 32);
      if (result.success) {
        Alert.alert('Printed Successfully', result.message);
      } else {
        Alert.alert('BLE Notice', result.message);
      }
    } catch (e) {
      Alert.alert('Printer Error', e instanceof Error ? e.message : String(e));
    } finally {
      setIsPrintingBle(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="POS Register"
        subtitle="Quick Billing & Checkout"
        rightAction={
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={() => setViewMode((m) => (m === 'grid' ? 'list' : 'grid'))}
              accessibilityLabel="Toggle View Mode"
            >
              <Ionicons name={viewMode === 'grid' ? 'list' : 'grid'} size={20} color={colors.primary} />
            </TouchableOpacity>
            {products.length === 0 && (
              <TouchableOpacity
                style={[styles.headerBtn, { backgroundColor: colors.successLight }]}
                onPress={handleSeedDemo}
                accessibilityLabel="Load 50 Test Products"
              >
                <Ionicons name="sparkles" size={18} color={colors.successDark} />
              </TouchableOpacity>
            )}
            {itemCount > 0 && (
              <TouchableOpacity style={styles.clearBtn} onPress={clearCart} accessibilityLabel="Clear Cart">
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
              </TouchableOpacity>
            )}
          </View>
        }
      />

      {/* Search & Scanner Row */}
      <View style={styles.searchRow}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color={colors.textMuted} style={styles.searchIcon} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t('search_placeholder')}
            placeholderTextColor={colors.textMuted}
            style={[styles.searchInput, { color: colors.text }]}
            accessibilityLabel="Search catalog"
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity
          style={styles.scannerBtn}
          onPress={() => setScannerOpen(true)}
          accessibilityLabel="Open Barcode Scanner"
        >
          <Ionicons name="barcode-outline" size={22} color={colors.accent} />
        </TouchableOpacity>
      </View>

      {/* Category Filter Carousel */}
      <View style={styles.categoryBarWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryBar}>
          <TouchableOpacity
            style={[styles.catChip, selectedCategory === null && styles.catChipActive]}
            onPress={() => setSelectedCategory(null)}
          >
            <Ionicons
              name="apps"
              size={14}
              color={selectedCategory === null ? colors.white : colors.textSecondary}
              style={{ marginRight: 4 }}
            />
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

      {/* Product Catalog Display (Grid or List) */}
      <FlatList
        key={viewMode}
        data={available}
        numColumns={viewMode === 'grid' ? 2 : 1}
        keyExtractor={(p) => p.id}
        contentContainerStyle={available.length ? (viewMode === 'grid' ? styles.gridContent : styles.listContent) : styles.emptyContainer}
        ListEmptyComponent={
          <EmptyState
            title={products.length ? 'No Products Found' : 'Catalog Is Empty'}
            description={products.length ? 'Try a different keyword or category.' : 'Tap below to load 50 test products with opening inventory.'}
            actionTitle={products.length ? undefined : 'Load 50 Test Products'}
            onAction={products.length ? undefined : handleSeedDemo}
          />
        }
        renderItem={({ item }) => {
          const qtyInCart = (cart[item.id] ?? 0) / 1000;
          const onHand = (stockMap[item.id] ?? 0) / 1000;
          const theme = getCategoryTheme(item.category_id);
          const displayName = getProductName(item, language);
          const initial = displayName.charAt(0).toUpperCase();

          if (viewMode === 'grid') {
            return (
              <TouchableOpacity
                activeOpacity={0.7}
                style={[styles.gridCard, qtyInCart > 0 && styles.gridCardSelected]}
                onPress={() => addToCart(item.id)}
                accessibilityLabel={`Add ${displayName}`}
              >
                {qtyInCart > 0 && (
                  <View style={styles.cartBadge}>
                    <Text style={styles.cartBadgeText}>{qtyInCart}</Text>
                  </View>
                )}
                <View style={[styles.productAvatar, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                  <Text style={[styles.avatarText, { color: theme.text }]}>{initial}</Text>
                </View>
                <Text style={styles.gridProductName} numberOfLines={2}>{displayName}</Text>
                <Text style={styles.gridProductPrice}>{money(item.price_cents)}</Text>
                <View style={styles.gridStockRow}>
                  {item.track_stock ? (
                    <Text style={[styles.gridStockText, onHand <= item.low_stock_threshold_milli / 1000 && styles.lowStockText]}>
                      {onHand <= 0 ? 'Out of stock' : `${onHand} ${item.unit || 'in stock'}`}
                    </Text>
                  ) : (
                    <Text style={styles.gridStockText}>In stock</Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity
              activeOpacity={0.7}
              style={[styles.listCard, qtyInCart > 0 && styles.listCardSelected]}
              onPress={() => addToCart(item.id)}
            >
              <View style={[styles.listAvatar, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                <Text style={[styles.avatarText, { color: theme.text }]}>{initial}</Text>
              </View>
              <View style={styles.listDetails}>
                <Text style={styles.listProductName}>{displayName}</Text>
                <Text style={styles.listProductMeta}>
                  {item.sku ? `SKU: ${item.sku} · ` : ''}
                  {item.track_stock ? `${onHand} in stock` : 'Active'}
                </Text>
              </View>
              <View style={styles.listPriceCol}>
                <Text style={styles.listProductPrice}>{money(item.price_cents)}</Text>
                {qtyInCart > 0 ? (
                  <View style={styles.listQtyPill}>
                    <Text style={styles.listQtyText}>{qtyInCart} in cart</Text>
                  </View>
                ) : (
                  <View style={styles.addBtnPill}>
                    <Ionicons name="add" size={16} color={colors.accent} />
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* Floating Bottom Cart Bar */}
      {itemCount > 0 ? (
        <View style={styles.floatingCartContainer}>
          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.floatingCartBar}
            onPress={openCheckout}
            accessibilityRole="button"
            accessibilityLabel={`Cart with ${itemCount} items, total ${money(finalTotalCents)}. Tap to review`}
          >
            <View style={styles.cartLeft}>
              <View style={styles.cartIconWrapper}>
                <Ionicons name="cart" size={20} color={colors.white} />
                <View style={styles.cartCountPill}>
                  <Text style={styles.cartCountPillText}>{itemCount}</Text>
                </View>
              </View>
              <View>
                <Text style={styles.floatingCartSubtitle}>Current Order</Text>
                <Text style={styles.floatingCartTotal}>{money(finalTotalCents)}</Text>
              </View>
            </View>
            <View style={styles.cartRight}>
              <Text style={styles.chargeBtnText}>Charge</Text>
              <Ionicons name="arrow-forward" size={18} color={colors.white} />
            </View>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Commercial Review & Checkout Bottom Sheet */}
      <Modal visible={checkoutOpen} animationType="slide" transparent onRequestClose={() => setCheckoutOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.checkoutSheet}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>Review & Pay</Text>
                <Text style={styles.sheetSubtitle}>{itemCount} {itemCount === 1 ? 'item' : 'items'} in order</Text>
              </View>
              <TouchableOpacity onPress={() => setCheckoutOpen(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.sheetItemsScroll} showsVerticalScrollIndicator={false}>
              {cartItems.map(({ product, quantity }) => {
                const lineTotal = Math.round(product.price_cents * quantity / 1000);
                const units = quantity / 1000;
                return (
                  <View key={product.id} style={styles.cartItemRow}>
                    <View style={styles.cartItemInfo}>
                      <Text style={styles.cartItemName}>{getProductName(product, language)}</Text>
                      <Text style={styles.cartItemUnitPrice}>{money(product.price_cents)} each</Text>
                    </View>
                    <View style={styles.cartItemStepper}>
                      <TouchableOpacity style={styles.stepperBtn} onPress={() => changeQty(product.id, -1)}>
                        <Ionicons name="remove" size={16} color={colors.primary} />
                      </TouchableOpacity>
                      <Text style={styles.stepperQty}>{units}</Text>
                      <TouchableOpacity style={styles.stepperBtn} onPress={() => changeQty(product.id, 1)}>
                        <Ionicons name="add" size={16} color={colors.primary} />
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.cartItemTotal}>{money(lineTotal)}</Text>
                  </View>
                );
              })}

              {/* Order Discount Section */}
              <View style={styles.discountContainer}>
                <View style={styles.discountHeaderRow}>
                  <Text style={styles.sectionLabel}>Order Discount</Text>
                  <View style={styles.discountToggleRow}>
                    <TouchableOpacity
                      style={[styles.discountTypeBtn, discountType === 'fixed' && styles.discountTypeBtnActive]}
                      onPress={() => setDiscountType('fixed')}
                    >
                      <Text style={[styles.discountTypeText, discountType === 'fixed' && styles.discountTypeTextActive]}>LKR</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.discountTypeBtn, discountType === 'percent' && styles.discountTypeBtnActive]}
                      onPress={() => setDiscountType('percent')}
                    >
                      <Text style={[styles.discountTypeText, discountType === 'percent' && styles.discountTypeTextActive]}>%</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <TextInput
                  value={discountValue}
                  onChangeText={setDiscountValue}
                  keyboardType="numeric"
                  placeholder={discountType === 'percent' ? 'e.g. 10%' : 'e.g. 250.00'}
                  placeholderTextColor={colors.textMuted}
                  style={styles.discountInput}
                />
              </View>

              {/* Order Totals Card */}
              <View style={styles.totalsCard}>
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLabel}>Subtotal</Text>
                  <Text style={styles.totalsValue}>{money(totalCents)}</Text>
                </View>
                {discountCents > 0 && (
                  <View style={styles.totalsRow}>
                    <Text style={[styles.totalsLabel, { color: colors.danger }]}>Discount</Text>
                    <Text style={[styles.totalsValue, { color: colors.danger }]}>−{money(discountCents)}</Text>
                  </View>
                )}
                <View style={[styles.totalsRow, styles.totalsGrandRow]}>
                  <Text style={styles.totalsGrandLabel}>Amount Due</Text>
                  <Text style={styles.totalsGrandValue}>{money(finalTotalCents)}</Text>
                </View>
              </View>

              {/* Tender Methods */}
              <View style={styles.paymentSection}>
                <View style={styles.paymentMethodTabs}>
                  <TouchableOpacity
                    style={[styles.payTab, paymentMethod === 'cash' && !splitTender && styles.payTabActive]}
                    onPress={() => { setPaymentMethod('cash'); setSplitTender(false); }}
                  >
                    <Ionicons name="cash-outline" size={18} color={paymentMethod === 'cash' && !splitTender ? colors.white : colors.text} />
                    <Text style={[styles.payTabText, paymentMethod === 'cash' && !splitTender && styles.payTabTextActive]}>Cash</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.payTab, paymentMethod === 'card' && !splitTender && styles.payTabActive]}
                    onPress={() => { setPaymentMethod('card'); setSplitTender(false); }}
                  >
                    <Ionicons name="card-outline" size={18} color={paymentMethod === 'card' && !splitTender ? colors.white : colors.text} />
                    <Text style={[styles.payTabText, paymentMethod === 'card' && !splitTender && styles.payTabTextActive]}>Card</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.payTab, splitTender && styles.payTabActive]}
                    onPress={() => setSplitTender(true)}
                  >
                    <Ionicons name="swap-horizontal-outline" size={18} color={splitTender ? colors.white : colors.text} />
                    <Text style={[styles.payTabText, splitTender && styles.payTabTextActive]}>Split</Text>
                  </TouchableOpacity>
                </View>

                {/* Cash Tender Details & Live Calculator */}
                {paymentMethod === 'cash' && !splitTender && (
                  <View style={styles.cashBox}>
                    <Text style={styles.cashBoxLabel}>Cash Received</Text>
                    <TextInput
                      value={cashTendered}
                      onChangeText={setCashTendered}
                      keyboardType="numeric"
                      placeholder="0.00"
                      placeholderTextColor={colors.textMuted}
                      style={styles.cashTenderInput}
                    />

                    {/* Quick Round Cash Shortcuts */}
                    <View style={styles.shortcutsRow}>
                      {cashShortcuts.map((amount) => (
                        <TouchableOpacity
                          key={amount}
                          style={styles.shortcutBtn}
                          onPress={() => setCashTendered(amount.toFixed(2))}
                        >
                          <Text style={styles.shortcutText}>
                            {amount === finalTotalCents / 100 ? 'Exact' : `${amount}`}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Prominent Live Change Card */}
                    <View style={styles.changeBanner}>
                      <Text style={styles.changeBannerLabel}>Change Due:</Text>
                      <Text style={styles.changeBannerValue}>{money(liveChangeCents)}</Text>
                    </View>
                  </View>
                )}

                {/* Split Tender Setup */}
                {splitTender && (
                  <View style={styles.splitBox}>
                    <Text style={styles.splitSubLabel}>Cash Portion</Text>
                    <TextInput
                      value={cashTendered}
                      onChangeText={(val) => {
                        setCashTendered(val);
                        const cVal = Number(val);
                        if (!isNaN(cVal)) {
                          const rem = Math.max(0, finalTotalCents / 100 - cVal);
                          setSecondaryAmount(rem.toFixed(2));
                        }
                      }}
                      keyboardType="numeric"
                      placeholder="Cash amount"
                      placeholderTextColor={colors.textMuted}
                      style={styles.cashTenderInput}
                    />
                    <Text style={[styles.splitSubLabel, { marginTop: spacing.md }]}>Secondary Method ({secondaryMethod.toUpperCase()})</Text>
                    <View style={styles.methodsRow}>
                      {(['card', 'transfer', 'other'] as const).map((m) => (
                        <TouchableOpacity
                          key={m}
                          style={[styles.secondaryMethodBtn, secondaryMethod === m && styles.secondaryMethodBtnActive]}
                          onPress={() => setSecondaryMethod(m)}
                        >
                          <Text style={[styles.secondaryMethodText, secondaryMethod === m && styles.secondaryMethodTextActive]}>
                            {m.toUpperCase()}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <TextInput
                      value={secondaryAmount}
                      onChangeText={setSecondaryAmount}
                      keyboardType="numeric"
                      placeholder="Secondary amount"
                      placeholderTextColor={colors.textMuted}
                      style={[styles.cashTenderInput, { marginTop: spacing.sm }]}
                    />
                  </View>
                )}
              </View>
            </ScrollView>

            <View style={styles.sheetFooter}>
              <Button
                title={saving ? 'Processing Sale…' : `Complete Sale · ${money(finalTotalCents)}`}
                onPress={finishSale}
                disabled={saving || finalTotalCents < 0}
                style={styles.completeBtn}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Post-Sale Celebration & Receipt Modal */}
      <Modal visible={successModalOpen} transparent animationType="fade" onRequestClose={() => setSuccessModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.successCard}>
            <View style={styles.successIconBubble}>
              <Ionicons name="checkmark-circle" size={54} color={colors.success} />
            </View>
            <Text style={styles.successTitle}>Payment Successful!</Text>
            <Text style={styles.successInvoice}>{completedSale?.invoice}</Text>

            <View style={styles.successAmountsCard}>
              <View style={styles.successRow}>
                <Text style={styles.successLabel}>Total Charged</Text>
                <Text style={styles.successValue}>{money(completedSale?.total ?? 0)}</Text>
              </View>
              {completedSale && completedSale.change > 0 && (
                <View style={[styles.successRow, styles.changeHighlight]}>
                  <Text style={styles.changeHighlightLabel}>Change Given</Text>
                  <Text style={styles.changeHighlightValue}>{money(completedSale.change)}</Text>
                </View>
              )}
            </View>

            <View style={styles.successActions}>
              <TouchableOpacity style={styles.shareReceiptBtn} onPress={shareReceipt}>
                <Ionicons name="share-social-outline" size={18} color={colors.white} style={{ marginRight: 6 }} />
                <Text style={styles.shareReceiptText}>Share Digital Receipt</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.shareReceiptBtn, { backgroundColor: colors.accent, marginTop: spacing.xs }]}
                onPress={handleBlePrint}
                disabled={isPrintingBle}
              >
                <Ionicons name="bluetooth" size={18} color={colors.white} style={{ marginRight: 6 }} />
                <Text style={styles.shareReceiptText}>
                  {isPrintingBle ? 'Printing…' : 'Print via Bluetooth (BLE)'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.previewThermalBtn} onPress={previewThermal}>
                <Ionicons name="print-outline" size={18} color={colors.primary} style={{ marginRight: 6 }} />
                <Text style={styles.previewThermalText}>Thermal Preview</Text>
              </TouchableOpacity>
              <Button
                title="New Sale"
                variant="outline"
                onPress={() => setSuccessModalOpen(false)}
                style={{ marginTop: spacing.sm }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Thermal Preview Sheet */}
      <Modal visible={thermalPreviewOpen} animationType="slide" transparent onRequestClose={() => setThermalPreviewOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.thermalCard}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Thermal Receipt (58mm)</Text>
              <TouchableOpacity onPress={() => setThermalPreviewOpen(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.thermalPaper}>
              <Text style={styles.thermalText}>{thermalText}</Text>
            </ScrollView>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
              <Button
                title={isPrintingBle ? 'Printing…' : 'Print (BLE)'}
                onPress={handleBlePrint}
                disabled={isPrintingBle}
                style={{ flex: 1 }}
              />
              <Button
                title="Close"
                variant="outline"
                onPress={() => setThermalPreviewOpen(false)}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Camera-based Barcode Scanner Modal with Continuous Rapid-Scan Mode */}
      <BarcodeScannerModal
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleBarcodeScan}
        sampleBarcodes={products
          .filter((p) => Boolean(p.barcode))
          .map((p) => ({ name: p.name, barcode: p.barcode!, priceCents: p.price_cents }))}
        cartCount={itemCount}
        cartTotalCents={finalTotalCents}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: colors.dangerLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    height: 44,
    ...shadows.sm,
  },
  scannerBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  searchIcon: { marginRight: spacing.sm },
  searchInput: { flex: 1, fontSize: 14, color: colors.text },
  categoryBarWrapper: { paddingVertical: spacing.sm },
  categoryBar: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  catChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  catChipText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  catChipTextActive: { color: colors.white },
  gridContent: { paddingHorizontal: spacing.lg, paddingBottom: 100, gap: spacing.md },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: 100, gap: spacing.sm },
  emptyContainer: { flexGrow: 1 },

  // Grid Card Styling
  gridCard: {
    flex: 1,
    margin: 4,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    position: 'relative',
    ...shadows.card,
  },
  gridCardSelected: { borderColor: colors.accent, borderWidth: 1.5, backgroundColor: colors.primaryTint },
  cartBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: colors.accent,
    borderRadius: 12,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadgeText: { color: colors.white, fontSize: 11, fontWeight: '800' },
  productAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  avatarText: { fontSize: 20, fontWeight: '800' },
  gridProductName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    minHeight: 36,
  },
  gridProductPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.accent,
    marginTop: 4,
  },
  gridStockRow: { marginTop: 4 },
  gridStockText: { fontSize: 11, color: colors.textMuted, fontWeight: '500' },
  lowStockText: { color: colors.warningDark, fontWeight: '700' },

  // List Card Styling
  listCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
    ...shadows.sm,
  },
  listCardSelected: { borderColor: colors.accent, backgroundColor: colors.primaryTint },
  listAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listDetails: { flex: 1 },
  listProductName: { fontSize: 15, fontWeight: '700', color: colors.text },
  listProductMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  listPriceCol: { alignItems: 'flex-end', gap: 4 },
  listProductPrice: { fontSize: 15, fontWeight: '800', color: colors.accent },
  listQtyPill: {
    backgroundColor: colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  listQtyText: { color: colors.white, fontSize: 11, fontWeight: '700' },
  addBtnPill: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Floating Bottom Cart Bar
  floatingCartContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 24 : 16,
    left: spacing.lg,
    right: spacing.lg,
  },
  floatingCartBar: {
    backgroundColor: colors.primary,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    ...shadows.floating,
  },
  cartLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cartIconWrapper: { position: 'relative' },
  cartCountPill: {
    position: 'absolute',
    top: -6,
    right: -8,
    backgroundColor: colors.accent,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartCountPillText: { color: colors.white, fontSize: 10, fontWeight: '800' },
  floatingCartSubtitle: { color: colors.textMuted, fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
  floatingCartTotal: { color: colors.white, fontSize: 18, fontWeight: '800' },
  cartRight: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
  },
  chargeBtnText: { color: colors.white, fontSize: 14, fontWeight: '700' },

  // Checkout Sheet
  modalOverlay: {
    flex: 1,
    backgroundColor: '#0008',
    justifyContent: 'flex-end',
  },
  checkoutSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    padding: spacing.xl,
    paddingBottom: Platform.OS === 'ios' ? 36 : spacing.xl,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: colors.primary },
  sheetSubtitle: { fontSize: 13, color: colors.textSecondary },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetItemsScroll: { maxHeight: 220, marginBottom: spacing.md },
  cartItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cartItemInfo: { flex: 1 },
  cartItemName: { fontSize: 14, fontWeight: '700', color: colors.text },
  cartItemUnitPrice: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  cartItemStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: spacing.md,
  },
  stepperBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperQty: { fontSize: 14, fontWeight: '700', color: colors.text, minWidth: 20, textAlign: 'center' },
  cartItemTotal: { fontSize: 14, fontWeight: '800', color: colors.text, minWidth: 70, textAlign: 'right' },

  // Discount Section
  discountContainer: {
    marginVertical: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 12,
  },
  discountHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  discountToggleRow: { flexDirection: 'row', gap: 4 },
  discountTypeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: colors.surface,
  },
  discountTypeBtnActive: { backgroundColor: colors.accent },
  discountTypeText: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
  discountTypeTextActive: { color: colors.white },
  discountInput: {
    height: 40,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    fontSize: 14,
    color: colors.text,
  },

  // Totals Card
  totalsCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: spacing.md,
    gap: 6,
    marginVertical: spacing.sm,
  },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalsLabel: { fontSize: 13, color: colors.textSecondary },
  totalsValue: { fontSize: 14, fontWeight: '600', color: colors.text },
  totalsGrandRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
    marginTop: 4,
  },
  totalsGrandLabel: { fontSize: 16, fontWeight: '800', color: colors.primary },
  totalsGrandValue: { fontSize: 20, fontWeight: '800', color: colors.accent },

  // Payment Section
  paymentSection: { marginVertical: spacing.sm },
  paymentMethodTabs: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  payTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  payTabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  payTabText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  payTabTextActive: { color: colors.white },

  cashBox: { marginTop: spacing.xs, gap: spacing.xs },
  cashBoxLabel: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  cashTenderInput: {
    height: 46,
    borderWidth: 1.5,
    borderColor: colors.accent,
    borderRadius: 10,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  shortcutsRow: { flexDirection: 'row', gap: spacing.xs, marginVertical: spacing.xs },
  shortcutBtn: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 8,
    alignItems: 'center',
  },
  shortcutText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  changeBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.successLight,
    padding: spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    marginTop: 6,
  },
  changeBannerLabel: { fontSize: 14, fontWeight: '700', color: colors.successDark },
  changeBannerValue: { fontSize: 18, fontWeight: '800', color: colors.successDark },

  splitBox: { marginTop: spacing.xs },
  splitSubLabel: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 4 },
  methodsRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.xs },
  secondaryMethodBtn: {
    flex: 1,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    alignItems: 'center',
  },
  secondaryMethodBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  secondaryMethodText: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
  secondaryMethodTextActive: { color: colors.white },

  sheetFooter: { marginTop: spacing.md },
  completeBtn: { width: '100%', height: 48 },

  // Success Modal
  successCard: {
    margin: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadows.floating,
  },
  successIconBubble: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.successLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  successTitle: { fontSize: 22, fontWeight: '800', color: colors.primary },
  successInvoice: { fontSize: 14, color: colors.textSecondary, marginTop: 2, fontWeight: '600' },
  successAmountsCard: {
    width: '100%',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 14,
    padding: spacing.md,
    marginVertical: spacing.lg,
    gap: 8,
  },
  successRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  successLabel: { fontSize: 14, color: colors.textSecondary },
  successValue: { fontSize: 16, fontWeight: '800', color: colors.text },
  changeHighlight: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  changeHighlightLabel: { fontSize: 15, fontWeight: '700', color: colors.successDark },
  changeHighlightValue: { fontSize: 18, fontWeight: '800', color: colors.successDark },
  successActions: { width: '100%', gap: spacing.sm },
  shareReceiptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    height: 46,
    borderRadius: 12,
  },
  shareReceiptText: { color: colors.white, fontSize: 14, fontWeight: '700' },
  previewThermalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundSecondary,
    height: 46,
    borderRadius: 12,
  },
  previewThermalText: { color: colors.primary, fontSize: 14, fontWeight: '700' },

  // Thermal Sheet
  thermalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.xl,
    maxHeight: '85%',
  },
  thermalPaper: {
    backgroundColor: '#FEFEFE',
    borderWidth: 1,
    borderColor: '#CCC',
    borderRadius: 10,
    padding: spacing.md,
    maxHeight: 360,
  },
  thermalText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 12,
    color: '#111',
    lineHeight: 16,
  },
});
