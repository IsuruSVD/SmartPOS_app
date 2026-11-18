import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useDb } from '../_layout';
import type { Category, Product, StockMovement } from '../../src/db/types';
import type { Supplier } from '../../src/db/repositories/SupplierRepository';
import type { Purchase } from '../../src/db/repositories/PurchaseRepository';
import { colors, spacing, shadows } from '../../src/ui/theme';
import { Header } from '../../src/ui/components/Header';
import { EmptyState } from '../../src/ui/components/EmptyState';
import { Button } from '../../src/ui/components/Button';

type InventoryTab = 'products' | 'movements' | 'lowStock' | 'suppliers';
type Draft = {
  name: string;
  category_id: string;
  sku: string;
  barcode: string;
  price: string;
  cost: string;
  stock: string;
};
type MovementRow = StockMovement & { product_name: string; unit: string };
type PurchaseRow = Purchase & { supplier_name: string | null };
type PurchaseDraftLine = { product_id: string; quantity: string; unit_cost: string };

const emptyDraft: Draft = {
  name: '',
  category_id: '',
  sku: '',
  barcode: '',
  price: '',
  cost: '',
  stock: '0',
};
const moneyText = (cents: number) => `LKR ${(cents / 100).toFixed(2)}`;
const moneyCents = (s: string) => Math.round(Number(s) * 100);
const movementTitle = (type: string) =>
  ({
    initial_stock: 'Opening stock',
    sale: 'Sale',
    sale_refund: 'Refund returned',
    adjustment_add: 'Stock added',
    adjustment_remove: 'Stock removed',
    purchase_received: 'Purchase received',
    wastage: 'Wastage',
  } as Record<string, string>)[type] ?? 'Stock movement';

export default function ProductsScreen() {
  const db = useDb();
  const [activeTab, setActiveTab] = useState<InventoryTab>('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [movements, setMovements] = useState<MovementRow[]>([]);
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Category modal
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  // Stock Adjustment
  const [adjustmentOpen, setAdjustmentOpen] = useState(false);
  const [adjustmentProductId, setAdjustmentProductId] = useState('');
  const [adjustmentDirection, setAdjustmentDirection] = useState<'add' | 'remove'>('add');
  const [adjustmentQuantity, setAdjustmentQuantity] = useState('');
  const [adjustmentNote, setAdjustmentNote] = useState('');
  const [adjustmentSaving, setAdjustmentSaving] = useState(false);

  // Manager PIN authorization state
  const [managerPin, setManagerPin] = useState('');
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');

  // Suppliers & Purchases
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [supplierName, setSupplierName] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [supplierEmail, setSupplierEmail] = useState('');
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [purchaseSupplierId, setPurchaseSupplierId] = useState<string | null>(null);
  const [purchaseReference, setPurchaseReference] = useState('');
  const [purchaseNote, setPurchaseNote] = useState('');
  const [purchaseProductId, setPurchaseProductId] = useState('');
  const [purchaseQuantity, setPurchaseQuantity] = useState('1');
  const [purchaseUnitCost, setPurchaseUnitCost] = useState('0.00');
  const [purchaseLines, setPurchaseLines] = useState<PurchaseDraftLine[]>([]);
  const [purchaseSaving, setPurchaseSaving] = useState(false);

  const load = useCallback(async () => {
    const [all, cats, settings] = await Promise.all([
      db.products.findAll(),
      db.categories.findAll(),
      db.settings.getAll(),
    ]);
    setProducts(all);
    setCategories(cats);
    const cfg = Object.fromEntries(settings.map((s) => [s.key, s.value]));
    setManagerPin(cfg.manager_pin || '');
    const stockPairs = await Promise.all(all.map(async (p) => [p.id, await db.stock.getOnHand(p.id)] as const));
    setQuantities(Object.fromEntries(stockPairs));
    setMovements(await db.stock.findRecentMovements());
    setSuppliers(await db.suppliers.findAll());
    setPurchases(await db.purchases.findRecent());
  }, [db]);

  useFocusEffect(useCallback(() => { load().catch((e) => Alert.alert('Inventory could not load', String(e))); }, [load]));

  const visible = useMemo(() => {
    const q = search.trim().toLocaleLowerCase();
    return products.filter((p) => {
      if (activeTab === 'lowStock' && (!p.track_stock || (quantities[p.id] ?? 0) > p.low_stock_threshold_milli)) return false;
      if (selectedCategory && p.category_id !== selectedCategory) return false;
      if (!q) return true;
      return [p.name, p.sku, p.barcode].some((v) => v?.toLocaleLowerCase().includes(q));
    });
  }, [products, quantities, search, activeTab, selectedCategory]);

  const visibleMovements = useMemo(() => {
    const q = search.trim().toLocaleLowerCase();
    return movements.filter((movement) =>
      !q || [movement.product_name, movement.note, movementTitle(movement.movement_type)].some((value) => value?.toLocaleLowerCase().includes(q))
    );
  }, [movements, search]);

  const saveProduct = async () => {
    const name = draft.name.trim();
    const validMoney = /^\d+(\.\d{1,2})?$/.test(draft.price) && /^\d+(\.\d{1,2})?$/.test(draft.cost);
    const validStock = /^\d+(\.\d{1,3})?$/.test(draft.stock);
    if (!name || !validMoney || (!editingProductId && !validStock) || Number(draft.price) <= 0) {
      Alert.alert('Check product details', 'Enter a name, a price greater than zero, a valid cost, and stock quantity with up to 3 decimal places.');
      return;
    }
    setSaving(true);
    try {
      if (editingProductId) {
        await db.products.update(editingProductId, {
          name,
          category_id: draft.category_id || null,
          sku: draft.sku.trim() || null,
          barcode: draft.barcode.trim() || null,
          price_cents: moneyCents(draft.price),
          cost_cents: moneyCents(draft.cost),
        });
      } else {
        await db.createProduct({
          name,
          category_id: draft.category_id || null,
          sku: draft.sku,
          barcode: draft.barcode,
          price_cents: moneyCents(draft.price),
          cost_cents: moneyCents(draft.cost),
          opening_quantity_milli: Math.round(Number(draft.stock) * 1000),
        });
      }
      setDraft(emptyDraft);
      setEditingProductId(null);
      setFormOpen(false);
      await load();
    } catch (e) {
      Alert.alert('Could not save product', e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const editProduct = (product: Product) => {
    setEditingProductId(product.id);
    setDraft({
      name: product.name,
      category_id: product.category_id ?? '',
      sku: product.sku ?? '',
      barcode: product.barcode ?? '',
      price: (product.price_cents / 100).toFixed(2),
      cost: (product.cost_cents / 100).toFixed(2),
      stock: '0',
    });
    setFormOpen(true);
  };

  const openAdjustment = (productId?: string) => {
    const trackedProducts = products.filter((product) => product.track_stock);
    if (!trackedProducts.length) {
      Alert.alert('No tracked products', 'Add a product with stock tracking enabled before making an adjustment.');
      return;
    }
    setAdjustmentProductId(productId ?? trackedProducts[0].id);
    setAdjustmentDirection('add');
    setAdjustmentQuantity('');
    setAdjustmentNote('');
    setAdjustmentOpen(true);
  };

  const executeAdjustment = async () => {
    const quantityValid = /^\d+(\.\d{1,3})?$/.test(adjustmentQuantity);
    const quantityMilli = quantityValid ? Math.round(Number(adjustmentQuantity) * 1000) : 0;
    const selected = products.find((product) => product.id === adjustmentProductId);
    if (!selected || !quantityMilli) {
      Alert.alert('Check adjustment details', 'Choose a product and enter a quantity greater than zero with up to three decimal places.');
      return;
    }
    setAdjustmentSaving(true);
    try {
      await db.adjustStock(selected.id, adjustmentDirection, quantityMilli, adjustmentNote);
      setAdjustmentOpen(false);
      await load();
      Alert.alert('Stock updated', `${selected.name}: ${adjustmentDirection === 'add' ? '+' : '−'}${quantityMilli / 1000} ${selected.unit}`);
    } catch (e) {
      Alert.alert('Adjustment could not be saved', e instanceof Error ? e.message : String(e));
    } finally {
      setAdjustmentSaving(false);
    }
  };

  const saveAdjustment = async () => {
    const quantityValid = /^\d+(\.\d{1,3})?$/.test(adjustmentQuantity);
    const quantityMilli = quantityValid ? Math.round(Number(adjustmentQuantity) * 1000) : 0;
    const selected = products.find((product) => product.id === adjustmentProductId);
    if (!selected || !quantityMilli) {
      Alert.alert('Check adjustment details', 'Choose a product and enter a quantity greater than zero with up to three decimal places.');
      return;
    }

    if (managerPin) {
      setEnteredPin('');
      setPinModalVisible(true);
      return;
    }
    await executeAdjustment();
  };

  const verifyAndProceedAdjustment = async () => {
    if (enteredPin.trim() !== managerPin.trim()) {
      Alert.alert('Authorization Failed', 'Incorrect Manager PIN. Stock adjustment not authorized.');
      return;
    }
    setPinModalVisible(false);
    await executeAdjustment();
  };

  const openPurchase = () => {
    const first = products[0];
    setPurchaseSupplierId(suppliers[0]?.id ?? null);
    setPurchaseReference('');
    setPurchaseNote('');
    setPurchaseLines([]);
    setPurchaseProductId(first?.id ?? '');
    setPurchaseQuantity('1');
    setPurchaseUnitCost(first ? (first.cost_cents / 100).toFixed(2) : '0.00');
    setPurchaseOpen(true);
  };

  const addPurchaseLine = () => {
    const qtyOk = /^\d+(\.\d{1,3})?$/.test(purchaseQuantity) && Number(purchaseQuantity) > 0;
    const costOk = /^\d+(\.\d{1,2})?$/.test(purchaseUnitCost);
    if (!purchaseProductId || !qtyOk || !costOk) {
      Alert.alert('Check delivery item', 'Choose a product and enter a valid quantity and unit cost.');
      return;
    }
    setPurchaseLines((lines) => [...lines, { product_id: purchaseProductId, quantity: purchaseQuantity, unit_cost: purchaseUnitCost }]);
  };

  const saveSupplier = async () => {
    if (!supplierName.trim()) {
      Alert.alert('Supplier name required', 'Enter a supplier name.');
      return;
    }
    try {
      await db.createSupplier({ name: supplierName, phone: supplierPhone, email: supplierEmail });
      setSupplierOpen(false);
      setSupplierName('');
      setSupplierPhone('');
      setSupplierEmail('');
      await load();
    } catch (e) {
      Alert.alert('Could not save supplier', e instanceof Error ? e.message : String(e));
    }
  };

  const saveCategory = async () => {
    const name = newCatName.trim();
    if (!name) {
      Alert.alert('Name required', 'Enter a category name.');
      return;
    }
    try {
      await db.createCategory(name);
      setNewCatName('');
      setCategoryOpen(false);
      await load();
      Alert.alert('Category created', `Category "${name}" added.`);
    } catch (e) {
      Alert.alert('Could not save category', e instanceof Error ? e.message : String(e));
    }
  };

  const receivePurchase = async () => {
    if (!purchaseLines.length) {
      Alert.alert('Delivery is empty', 'Add at least one product line before receiving.');
      return;
    }
    setPurchaseSaving(true);
    try {
      await db.receivePurchase({
        supplier_id: purchaseSupplierId,
        reference_no: purchaseReference,
        note: purchaseNote,
        lines: purchaseLines.map((line) => ({
          product_id: line.product_id,
          quantity_milli: Math.round(Number(line.quantity) * 1000),
          unit_cost_cents: moneyCents(line.unit_cost),
        })),
      });
      setPurchaseOpen(false);
      await load();
      Alert.alert('Delivery received', 'Purchase recorded and tracked stock updated.');
    } catch (e) {
      Alert.alert('Could not receive delivery', e instanceof Error ? e.message : String(e));
    } finally {
      setPurchaseSaving(false);
    }
  };

  const tabs: { id: InventoryTab; label: string }[] = [
    { id: 'products', label: 'Products' },
    { id: 'movements', label: 'Movements' },
    { id: 'lowStock', label: 'Low Stock' },
    { id: 'suppliers', label: 'Suppliers & Purchases' },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Product Catalog"
        subtitle="Inventory & Stock"
        rightAction={
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => {
              setEditingProductId(null);
              setDraft(emptyDraft);
              setFormOpen(true);
            }}
            accessibilityLabel="Add product"
            accessibilityRole="button"
          >
            <Ionicons name="add" size={18} color={colors.white} />
            <Text style={styles.addBtnText}>Product</Text>
          </TouchableOpacity>
        }
      />

      <View style={styles.segmentsWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.segments}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[styles.segment, activeTab === tab.id && styles.segmentActive]}
              onPress={() => setActiveTab(tab.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === tab.id }}
            >
              <Text style={[styles.segmentText, activeTab === tab.id && styles.segmentTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Category selector on products tab */}
      {(activeTab === 'products' || activeTab === 'lowStock') && (
        <View style={styles.categoryFilterRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryChips}>
            <TouchableOpacity
              style={styles.addCatChip}
              onPress={() => setCategoryOpen(true)}
              accessibilityLabel="Add category"
            >
              <Ionicons name="add" size={14} color={colors.accent} />
              <Text style={styles.addCatChipText}>Category</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.catFilterChip, selectedCategory === null && styles.catFilterChipActive]}
              onPress={() => setSelectedCategory(null)}
            >
              <Text style={[styles.catFilterChipText, selectedCategory === null && styles.catFilterChipTextActive]}>
                All Categories ({products.length})
              </Text>
            </TouchableOpacity>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[styles.catFilterChip, selectedCategory === cat.id && styles.catFilterChipActive]}
                onPress={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
              >
                <Text style={[styles.catFilterChipText, selectedCategory === cat.id && styles.catFilterChipTextActive]}>
                  {cat.name} ({products.filter((p) => p.category_id === cat.id).length})
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {activeTab !== 'suppliers' && (
        <View style={styles.searchContainer}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search name, SKU or barcode"
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
            accessibilityLabel="Search products"
          />
        </View>
      )}

      {activeTab === 'products' || activeTab === 'lowStock' ? (
        <FlatList
          data={visible}
          keyExtractor={(item) => item.id}
          contentContainerStyle={visible.length ? styles.list : styles.emptyList}
          onRefresh={() => { load().catch((e) => Alert.alert('Refresh failed', String(e))); }}
          refreshing={false}
          ListEmptyComponent={
            <EmptyState
              title={activeTab === 'lowStock' ? 'No Low-Stock Products' : 'No Products Yet'}
              description={activeTab === 'lowStock' ? 'Products below their stock threshold will appear here.' : 'Add products to build your catalog and record opening stock.'}
              actionTitle={activeTab === 'products' ? 'Add Product' : undefined}
              onAction={activeTab === 'products' ? () => { setEditingProductId(null); setDraft(emptyDraft); setFormOpen(true); } : undefined}
            />
          }
          renderItem={({ item }) => {
            const cat = categories.find((c) => c.id === item.category_id);
            const onHand = (quantities[item.id] ?? 0) / 1000;
            const isLow = item.track_stock && onHand <= item.low_stock_threshold_milli / 1000 && onHand > 0;
            const isOut = item.track_stock && onHand <= 0;
            const initial = item.name.charAt(0).toUpperCase();

            return (
              <View style={styles.productCard}>
                <View style={styles.productTop}>
                  <View style={styles.productAvatarCircle}>
                    <Text style={styles.productAvatarText}>{initial}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.productName}>{item.name}</Text>
                    {cat && <Text style={styles.categoryBadge}>{cat.name}</Text>}
                    <Text style={styles.productMeta}>
                      {item.sku ? `SKU: ${item.sku} · ` : ''}
                      Cost: {moneyText(item.cost_cents)}
                    </Text>
                  </View>
                  <Text style={styles.productPrice}>{moneyText(item.price_cents)}</Text>
                </View>

                <View style={styles.productBottomRow}>
                  <View style={[
                    styles.stockStatusBadge,
                    isOut ? styles.stockOutBadge : isLow ? styles.stockLowBadge : styles.stockOkBadge
                  ]}>
                    <Text style={[
                      styles.stockStatusText,
                      isOut ? styles.stockOutText : isLow ? styles.stockLowText : styles.stockOkText
                    ]}>
                      {item.track_stock ? (isOut ? 'Out of Stock' : `${onHand} ${item.unit} on hand`) : 'Tracking Off'}
                    </Text>
                  </View>

                  <View style={styles.cardActionsRow}>
                    {item.track_stock && (
                      <TouchableOpacity
                        style={styles.cardActionBtn}
                        onPress={() => openAdjustment(item.id)}
                        accessibilityRole="button"
                        accessibilityLabel={`Adjust stock for ${item.name}`}
                      >
                        <Ionicons name="swap-vertical" size={14} color={colors.primary} />
                        <Text style={styles.cardActionBtnText}>Adjust</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.cardActionBtn}
                      onPress={() => editProduct(item)}
                      accessibilityRole="button"
                      accessibilityLabel={`Edit ${item.name}`}
                    >
                      <Ionicons name="create-outline" size={14} color={colors.primary} />
                      <Text style={styles.cardActionBtnText}>Edit</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          }}
        />
      ) : activeTab === 'movements' ? (
        <View style={styles.movementPane}>
          <Button title="New stock adjustment" onPress={() => openAdjustment()} style={styles.newAdjustment} />
          <FlatList
            data={visibleMovements}
            keyExtractor={(item) => item.id}
            contentContainerStyle={visibleMovements.length ? styles.list : styles.emptyList}
            onRefresh={() => { load().catch((e) => Alert.alert('Refresh failed', String(e))); }}
            refreshing={false}
            ListEmptyComponent={
              <EmptyState
                title={movements.length ? 'No Matching Movements' : 'No Stock Movements Yet'}
                description={movements.length ? 'Try another product name, movement type, or reason.' : 'Opening stock, sales, and manual adjustments will appear here as an audit trail.'}
              />
            }
            renderItem={({ item }) => (
              <View style={styles.movementCard}>
                <View style={styles.movementTop}>
                  <Text style={styles.productName}>{item.product_name}</Text>
                  <Text style={[styles.movementQuantity, item.quantity_delta_milli < 0 && styles.movementNegative]}>
                    {item.quantity_delta_milli > 0 ? '+' : ''}
                    {item.quantity_delta_milli / 1000} {item.unit}
                  </Text>
                </View>
                <Text style={styles.productMeta}>
                  {movementTitle(item.movement_type)} · {new Date(item.created_at).toLocaleString()}
                </Text>
                {item.note ? <Text style={styles.movementNote}>{item.note}</Text> : null}
              </View>
            )}
          />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          <View style={styles.purchaseActions}>
            <Button title="Add supplier" variant="outline" onPress={() => setSupplierOpen(true)} style={styles.purchaseAction} />
            <Button title="Receive delivery" onPress={openPurchase} disabled={!products.length} style={styles.purchaseAction} />
          </View>
          <Text style={styles.sectionTitle}>Suppliers · {suppliers.length}</Text>
          {suppliers.length ? (
            suppliers.map((supplier) => (
              <View key={supplier.id} style={styles.purchaseCard}>
                <Text style={styles.productName}>{supplier.name}</Text>
                {supplier.phone ? <Text style={styles.productMeta}>{supplier.phone}</Text> : null}
                {supplier.email ? <Text style={styles.productMeta}>{supplier.email}</Text> : null}
              </View>
            ))
          ) : (
            <Text style={styles.sectionHint}>No suppliers yet. Add one or receive an unassigned delivery.</Text>
          )}
          <Text style={styles.sectionTitle}>Recent deliveries</Text>
          {purchases.length ? (
            purchases.map((purchase) => (
              <PurchaseCard
                key={purchase.id}
                purchase={purchase}
                onPress={async () => {
                  const items = await db.purchases.findItems(purchase.id);
                  Alert.alert(
                    'Purchase details',
                    items.map((item) => `${item.product_name}: ${item.quantity_milli / 1000} × ${moneyText(item.unit_cost_cents)}`).join('\n') || 'No items recorded.'
                  );
                }}
              />
            ))
          ) : (
            <Text style={styles.sectionHint}>Received deliveries will appear here.</Text>
          )}
        </ScrollView>
      )}

      {/* Product Form Modal */}
      <Modal
        visible={formOpen}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setFormOpen(false);
          setDraft(emptyDraft);
          setEditingProductId(null);
        }}
      >
        <KeyboardAvoidingView style={styles.modalShade} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editingProductId ? 'Edit product' : 'Add product'}</Text>
            <Text style={styles.modalHint}>
              {editingProductId ? 'Update the product details. Use Movements to change stock.' : 'Price and cost are entered in LKR. Opening stock is optional.'}
            </Text>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Field label="Product name" value={draft.name} onChangeText={(name) => setDraft({ ...draft, name })} placeholder="e.g. Tea 100 g" />

              {/* Category Picker in Product Form */}
              {categories.length > 0 && (
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Category (optional)</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 4 }}>
                    <TouchableOpacity
                      style={[styles.catFormChip, !draft.category_id && styles.catFormChipActive]}
                      onPress={() => setDraft({ ...draft, category_id: '' })}
                    >
                      <Text style={[styles.catFormChipText, !draft.category_id && styles.catFormChipTextActive]}>None</Text>
                    </TouchableOpacity>
                    {categories.map((c) => (
                      <TouchableOpacity
                        key={c.id}
                        style={[styles.catFormChip, draft.category_id === c.id && styles.catFormChipActive]}
                        onPress={() => setDraft({ ...draft, category_id: c.id })}
                      >
                        <Text style={[styles.catFormChipText, draft.category_id === c.id && styles.catFormChipTextActive]}>
                          {c.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              <Field label="SKU (optional)" value={draft.sku} onChangeText={(sku) => setDraft({ ...draft, sku })} placeholder="e.g. TEA-100" />
              <Field label="Barcode (optional)" value={draft.barcode} onChangeText={(barcode) => setDraft({ ...draft, barcode })} placeholder="Scan or type barcode" keyboardType="number-pad" />
              <Field label="Selling price (LKR)" value={draft.price} onChangeText={(price) => setDraft({ ...draft, price })} placeholder="0.00" keyboardType="decimal-pad" />
              <Field label="Unit cost (LKR)" value={draft.cost} onChangeText={(cost) => setDraft({ ...draft, cost })} placeholder="0.00" keyboardType="decimal-pad" />
              {!editingProductId ? (
                <Field label="Opening quantity" value={draft.stock} onChangeText={(stock) => setDraft({ ...draft, stock })} placeholder="0" keyboardType="decimal-pad" />
              ) : null}
            </ScrollView>
            <View style={styles.actions}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => {
                  setFormOpen(false);
                  setDraft(emptyDraft);
                  setEditingProductId(null);
                }}
                style={styles.actionButton}
              />
              <Button
                title={saving ? 'Saving…' : editingProductId ? 'Save Changes' : 'Save Product'}
                onPress={saveProduct}
                disabled={saving}
                style={styles.actionButton}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Category Creation Modal */}
      <Modal visible={categoryOpen} animationType="fade" transparent onRequestClose={() => setCategoryOpen(false)}>
        <KeyboardAvoidingView style={styles.modalShade} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add Category</Text>
            <Text style={styles.modalHint}>Organize products for faster billing at the POS.</Text>
            <Field label="Category Name" value={newCatName} onChangeText={setNewCatName} placeholder="e.g. Beverages, Bakery, Dairy" />
            <View style={styles.actions}>
              <Button title="Cancel" variant="outline" onPress={() => setCategoryOpen(false)} style={styles.actionButton} />
              <Button title="Save Category" variant="primary" onPress={saveCategory} style={styles.actionButton} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Stock Adjustment Modal */}
      <Modal visible={adjustmentOpen} animationType="slide" transparent onRequestClose={() => setAdjustmentOpen(false)}>
        <KeyboardAvoidingView style={styles.modalShade} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Adjust stock</Text>
            <Text style={styles.modalHint}>Each change is recorded in the stock movement history.</Text>
            <Text style={styles.fieldLabel}>Product</Text>
            <ScrollView style={styles.productPicker} keyboardShouldPersistTaps="handled">
              {products
                .filter((product) => product.track_stock)
                .map((product) => (
                  <TouchableOpacity
                    key={product.id}
                    style={[styles.productOption, product.id === adjustmentProductId && styles.productOptionActive]}
                    onPress={() => setAdjustmentProductId(product.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: product.id === adjustmentProductId }}
                  >
                    <Text style={styles.productOptionName}>{product.name}</Text>
                    <Text style={styles.productMeta}>On hand: {(quantities[product.id] ?? 0) / 1000} {product.unit}</Text>
                  </TouchableOpacity>
                ))}
            </ScrollView>
            <Text style={styles.fieldLabel}>Adjustment</Text>
            <View style={styles.directionRow}>
              <TouchableOpacity
                style={[styles.directionButton, adjustmentDirection === 'add' && styles.directionButtonActive]}
                onPress={() => setAdjustmentDirection('add')}
                accessibilityRole="button"
                accessibilityState={{ selected: adjustmentDirection === 'add' }}
              >
                <Text style={[styles.directionText, adjustmentDirection === 'add' && styles.directionTextActive]}>Add stock</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.directionButton, adjustmentDirection === 'remove' && styles.directionButtonActive]}
                onPress={() => setAdjustmentDirection('remove')}
                accessibilityRole="button"
                accessibilityState={{ selected: adjustmentDirection === 'remove' }}
              >
                <Text style={[styles.directionText, adjustmentDirection === 'remove' && styles.directionTextActive]}>Remove stock</Text>
              </TouchableOpacity>
            </View>
            <Field label="Quantity" value={adjustmentQuantity} onChangeText={setAdjustmentQuantity} placeholder="0.000" keyboardType="decimal-pad" />
            <Field label="Reason (optional)" value={adjustmentNote} onChangeText={setAdjustmentNote} placeholder="e.g. Count correction" />
            <View style={styles.actions}>
              <Button title="Cancel" variant="outline" onPress={() => setAdjustmentOpen(false)} style={styles.actionButton} />
              <Button title={adjustmentSaving ? 'Saving…' : 'Save adjustment'} onPress={saveAdjustment} disabled={adjustmentSaving} style={styles.actionButton} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Supplier Modal */}
      <Modal visible={supplierOpen} animationType="slide" transparent onRequestClose={() => setSupplierOpen(false)}>
        <KeyboardAvoidingView style={styles.modalShade} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add supplier</Text>
            <Field label="Supplier name" value={supplierName} onChangeText={setSupplierName} placeholder="Business name" />
            <Field label="Phone (optional)" value={supplierPhone} onChangeText={setSupplierPhone} placeholder="Phone number" />
            <Field label="Email (optional)" value={supplierEmail} onChangeText={setSupplierEmail} placeholder="Email address" />
            <View style={styles.actions}>
              <Button title="Cancel" variant="outline" onPress={() => setSupplierOpen(false)} style={styles.actionButton} />
              <Button title="Save supplier" onPress={saveSupplier} style={styles.actionButton} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Purchase Modal */}
      <Modal visible={purchaseOpen} animationType="slide" transparent onRequestClose={() => setPurchaseOpen(false)}>
        <KeyboardAvoidingView style={styles.modalShade} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Receive delivery</Text>
            <Text style={styles.modalHint}>Receiving adds to tracked stock and stores item cost snapshots.</Text>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>Supplier (optional)</Text>
              <View style={styles.productPicker}>
                <TouchableOpacity style={[styles.productOption, !purchaseSupplierId && styles.productOptionActive]} onPress={() => setPurchaseSupplierId(null)}>
                  <Text style={styles.productOptionName}>No supplier</Text>
                </TouchableOpacity>
                {suppliers.map((supplier) => (
                  <TouchableOpacity
                    key={supplier.id}
                    style={[styles.productOption, purchaseSupplierId === supplier.id && styles.productOptionActive]}
                    onPress={() => setPurchaseSupplierId(supplier.id)}
                  >
                    <Text style={styles.productOptionName}>{supplier.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Field label="Supplier reference (optional)" value={purchaseReference} onChangeText={setPurchaseReference} placeholder="Invoice or delivery note" />
              <Text style={styles.fieldLabel}>Product</Text>
              <View style={styles.productPicker}>
                {products.map((product) => (
                  <TouchableOpacity
                    key={product.id}
                    style={[styles.productOption, purchaseProductId === product.id && styles.productOptionActive]}
                    onPress={() => {
                      setPurchaseProductId(product.id);
                      setPurchaseUnitCost((product.cost_cents / 100).toFixed(2));
                    }}
                  >
                    <Text style={styles.productOptionName}>{product.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Field label="Quantity" value={purchaseQuantity} onChangeText={setPurchaseQuantity} placeholder="1" keyboardType="decimal-pad" />
              <Field label="Unit cost (LKR)" value={purchaseUnitCost} onChangeText={setPurchaseUnitCost} placeholder="0.00" keyboardType="decimal-pad" />
              <Button title="Add item to delivery" variant="outline" onPress={addPurchaseLine} style={styles.addLineButton} />
              {purchaseLines.map((line, index) => {
                const product = products.find((item) => item.id === line.product_id);
                return (
                  <View key={`${line.product_id}-${index}`} style={styles.lineRow}>
                    <Text style={styles.lineText}>
                      {product?.name ?? 'Product'} · {line.quantity} × LKR {line.unit_cost}
                    </Text>
                    <TouchableOpacity
                      onPress={() => setPurchaseLines((items) => items.filter((_, row) => row !== index))}
                      style={styles.removeLine}
                      accessibilityRole="button"
                      accessibilityLabel="Remove delivery item"
                    >
                      <Text style={styles.removeLineText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
              <Field label="Note (optional)" value={purchaseNote} onChangeText={setPurchaseNote} placeholder="Delivery notes" />
            </ScrollView>
            <View style={styles.actions}>
              <Button title="Cancel" variant="outline" onPress={() => setPurchaseOpen(false)} style={styles.actionButton} />
              <Button
                title={purchaseSaving ? 'Receiving…' : 'Receive & update stock'}
                onPress={receivePurchase}
                disabled={purchaseSaving || !purchaseLines.length}
                style={styles.actionButton}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Manager PIN Authorization Modal */}
      <Modal visible={pinModalVisible} transparent animationType="fade" onRequestClose={() => setPinModalVisible(false)}>
        <View style={styles.modalShade}>
          <View style={[styles.modalCard, { paddingBottom: spacing.xxl }]}>
            <Text style={styles.modalTitle}>Manager Authorization</Text>
            <Text style={styles.modalHint}>Enter manager PIN to authorize this stock adjustment</Text>
            <TextInput
              value={enteredPin}
              onChangeText={setEnteredPin}
              placeholder="Enter PIN"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              secureTextEntry
              maxLength={8}
              autoFocus
              style={styles.input}
              accessibilityLabel="Manager PIN"
            />
            <View style={styles.actions}>
              <Button title="Cancel" variant="outline" onPress={() => setPinModalVisible(false)} style={styles.actionButton} />
              <Button title="Authorize" onPress={verifyAndProceedAdjustment} style={styles.actionButton} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'decimal-pad' | 'number-pad';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{props.label}</Text>
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        keyboardType={props.keyboardType ?? 'default'}
        style={styles.input}
        autoCapitalize={props.keyboardType ? 'none' : 'sentences'}
      />
    </View>
  );
}

function PurchaseCard(props: { purchase: PurchaseRow; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={styles.purchaseCard}
      onPress={props.onPress}
      accessibilityRole="button"
      accessibilityLabel="View received purchase details"
    >
      <View style={styles.productTop}>
        <Text style={styles.productName}>{props.purchase.reference_no || 'Received delivery'}</Text>
        <Text style={styles.productPrice}>{moneyText(props.purchase.total_cents)}</Text>
      </View>
      <Text style={styles.productMeta}>
        {props.purchase.supplier_name || 'No supplier'} ·{' '}
        {props.purchase.received_at ? new Date(props.purchase.received_at).toLocaleDateString() : 'Date unavailable'}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  addBtn: {
    minHeight: spacing.touchTarget,
    paddingHorizontal: 14,
    backgroundColor: colors.accent,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    ...shadows.sm,
  },
  addBtnText: { fontSize: 13, fontWeight: '700', color: colors.white },
  segmentsWrapper: {
    paddingTop: 10,
    paddingBottom: 8,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  segments: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: spacing.lg,
  },
  segment: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: spacing.touchTarget,
  },
  segmentActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  segmentText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  segmentTextActive: { color: colors.white, fontWeight: '700' },
  categoryFilterRow: {
    paddingHorizontal: spacing.lg,
    paddingTop: 12,
    paddingBottom: 8,
  },
  categoryChips: { gap: 8 },
  addCatChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.primaryTint,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    minHeight: 42,
  },
  addCatChipText: { fontSize: 12, fontWeight: '700', color: colors.accent },
  catFilterChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 42,
    justifyContent: 'center',
    alignItems: 'center',
  },
  catFilterChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  catFilterChipText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  catFilterChipTextActive: { color: colors.white, fontWeight: '700' },
  catFormChip: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginRight: spacing.xs },
  catFormChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  catFormChipText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  catFormChipTextActive: { color: colors.white },
  searchContainer: { marginHorizontal: spacing.lg, marginBottom: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md },
  searchInput: { fontSize: 14, color: colors.text },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.sm },
  emptyList: { flexGrow: 1 },
  productCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadows.card,
  },
  productTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  productAvatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryTint,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productAvatarText: { fontSize: 18, fontWeight: '800', color: colors.accent },
  productName: { fontSize: 15, fontWeight: '700', color: colors.text },
  categoryBadge: { fontSize: 11, fontWeight: '700', color: colors.accent, marginTop: 1 },
  productPrice: { fontSize: 16, fontWeight: '800', color: colors.accent },
  productMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  productBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.xs,
  },
  stockStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  stockOkBadge: { backgroundColor: colors.successLight },
  stockLowBadge: { backgroundColor: colors.warningLight },
  stockOutBadge: { backgroundColor: colors.dangerLight },
  stockStatusText: { fontSize: 11, fontWeight: '700' },
  stockOkText: { color: colors.successDark },
  stockLowText: { color: colors.warningDark },
  stockOutText: { color: colors.dangerDark },
  cardActionsRow: { flexDirection: 'row', gap: spacing.xs },
  cardActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.backgroundSecondary,
  },
  cardActionBtnText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  movementPane: { flex: 1 },
  newAdjustment: { marginHorizontal: spacing.lg, marginBottom: spacing.sm },
  movementCard: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: spacing.lg, gap: spacing.xs },
  movementTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  movementQuantity: { color: colors.primary, fontSize: 15, fontWeight: '700' },
  movementNegative: { color: colors.danger },
  movementNote: { color: colors.text, fontSize: 13 },
  purchaseActions: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  purchaseAction: { flex: 1 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: spacing.md, marginBottom: spacing.sm },
  sectionHint: { color: colors.textSecondary, fontSize: 13, paddingVertical: spacing.sm },
  purchaseCard: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: spacing.lg, gap: spacing.xs, marginBottom: spacing.sm },
  addLineButton: { marginBottom: spacing.md },
  lineRow: { minHeight: spacing.touchTarget, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, borderBottomWidth: 1, borderColor: colors.border },
  lineText: { flex: 1, color: colors.text, fontSize: 13 },
  removeLine: { minHeight: spacing.touchTarget, justifyContent: 'center', paddingHorizontal: spacing.sm },
  removeLineText: { color: colors.danger, fontWeight: '600' },
  productPicker: { maxHeight: 160, borderWidth: 1, borderColor: colors.border, borderRadius: 8 },
  productOption: { minHeight: spacing.touchTarget, padding: spacing.sm, borderBottomWidth: 1, borderColor: colors.border, justifyContent: 'center' },
  productOptionActive: { backgroundColor: colors.primaryTint },
  productOptionName: { color: colors.text, fontSize: 14, fontWeight: '600' },
  directionRow: { flexDirection: 'row', gap: spacing.sm },
  directionButton: { minHeight: spacing.touchTarget, flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  directionButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  directionText: { color: colors.textSecondary, fontWeight: '600' },
  directionTextActive: { color: colors.white },
  modalShade: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#0007' },
  modalCard: { maxHeight: '90%', backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing.xl, gap: spacing.sm },
  modalTitle: { fontSize: 22, fontWeight: '700', color: colors.text },
  modalHint: { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.sm },
  field: { marginBottom: spacing.md, gap: spacing.xs },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.text },
  input: { minHeight: spacing.touchTarget, borderWidth: 1, borderColor: colors.borderDark, borderRadius: 8, paddingHorizontal: spacing.md, fontSize: 16, color: colors.text, backgroundColor: colors.white },
  actions: { flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.sm },
  actionButton: { flex: 1 },
});
