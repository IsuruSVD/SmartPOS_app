import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  Share,
  Platform,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useDb } from '../_layout';
import { colors, spacing } from '../../src/ui/theme';
import { Header } from '../../src/ui/components/Header';
import { Card } from '../../src/ui/components/Card';
import { Badge } from '../../src/ui/components/Badge';
import { Button } from '../../src/ui/components/Button';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReportSummary } from '../../src/db/services/ReportingService';
import type { BackupValidationResult } from '../../src/db/services/BackupRestoreService';

const money = (cents: number) => `LKR ${(cents / 100).toFixed(2)}`;

export default function SettingsScreen() {
  const db = useDb();

  // Settings state
  const [storeName, setStoreName] = useState('TechknowLK Store');
  const [storePhone, setStorePhone] = useState('');
  const [storeAddress, setStoreAddress] = useState('');
  const [receiptFooter, setReceiptFooter] = useState('Thank you for shopping with us!');
  const [taxId, setTaxId] = useState('');
  const [taxRateBps, setTaxRateBps] = useState('0');
  const [taxInclusive, setTaxInclusive] = useState('1');
  const [managerPin, setManagerPin] = useState('');
  const [requireRefundPin, setRequireRefundPin] = useState('0');

  // Modals
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [reportsModalVisible, setReportsModalVisible] = useState(false);
  const [taxModalVisible, setTaxModalVisible] = useState(false);
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [restoreModalVisible, setRestoreModalVisible] = useState(false);

  // Disaster Recovery / Backup Restore
  const [restoreJsonInput, setRestoreJsonInput] = useState('');
  const [restoreValidation, setRestoreValidation] = useState<BackupValidationResult | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  // Form states
  const [editStoreName, setEditStoreName] = useState('');
  const [editStorePhone, setEditStorePhone] = useState('');
  const [editStoreAddress, setEditStoreAddress] = useState('');
  const [editReceiptFooter, setEditReceiptFooter] = useState('');
  const [editTaxId, setEditTaxId] = useState('');
  const [editTaxRateBps, setEditTaxRateBps] = useState('');
  const [editPin, setEditPin] = useState('');

  // Report state
  const [reportPeriod, setReportPeriod] = useState<'today' | 'week' | 'month'>('today');
  const [reportData, setReportData] = useState<ReportSummary | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      const allSettings = await db.settings.getAll();
      const cfg = Object.fromEntries(allSettings.map((s) => [s.key, s.value]));
      if (cfg.store_name) setStoreName(cfg.store_name);
      if (cfg.store_phone) setStorePhone(cfg.store_phone);
      if (cfg.store_address) setStoreAddress(cfg.store_address);
      if (cfg.receipt_footer) setReceiptFooter(cfg.receipt_footer);
      if (cfg.tax_id) setTaxId(cfg.tax_id);
      if (cfg.tax_rate_bps !== undefined) setTaxRateBps(cfg.tax_rate_bps);
      if (cfg.tax_inclusive !== undefined) setTaxInclusive(cfg.tax_inclusive);
      if (cfg.manager_pin) setManagerPin(cfg.manager_pin);
      if (cfg.require_refund_pin !== undefined) setRequireRefundPin(cfg.require_refund_pin);
    } catch {
      // Fallback to default state
    }
  }, [db]);

  useFocusEffect(useCallback(() => { loadSettings(); }, [loadSettings]));

  const openProfileModal = () => {
    setEditStoreName(storeName);
    setEditStorePhone(storePhone);
    setEditStoreAddress(storeAddress);
    setEditReceiptFooter(receiptFooter);
    setEditTaxId(taxId);
    setProfileModalVisible(true);
  };

  const saveProfile = async () => {
    try {
      const name = editStoreName.trim() || 'TechknowLK Store';
      await db.settings.set('store_name', name);
      await db.settings.set('store_phone', editStorePhone.trim());
      await db.settings.set('store_address', editStoreAddress.trim());
      await db.settings.set('receipt_footer', editReceiptFooter.trim());
      await db.settings.set('tax_id', editTaxId.trim());

      setStoreName(name);
      setStorePhone(editStorePhone.trim());
      setStoreAddress(editStoreAddress.trim());
      setReceiptFooter(editReceiptFooter.trim());
      setTaxId(editTaxId.trim());
      setProfileModalVisible(false);
      Alert.alert('Saved', 'Business profile has been updated.');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to save profile');
    }
  };

  const openTaxModal = () => {
    setEditTaxRateBps(taxRateBps);
    setTaxModalVisible(true);
  };

  const saveTax = async () => {
    try {
      const rate = Math.max(0, parseInt(editTaxRateBps || '0', 10));
      await db.settings.set('tax_rate_bps', String(rate));
      setTaxRateBps(String(rate));
      setTaxModalVisible(false);
      Alert.alert('Saved', `Tax rate set to ${(rate / 100).toFixed(2)}%.`);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to save tax');
    }
  };

  const openPinModal = () => {
    setEditPin(managerPin);
    setPinModalVisible(true);
  };

  const savePin = async () => {
    try {
      const pin = editPin.trim();
      await db.settings.set('manager_pin', pin);
      const req = pin ? '1' : '0';
      await db.settings.set('require_refund_pin', req);
      setManagerPin(pin);
      setRequireRefundPin(req);
      setPinModalVisible(false);
      Alert.alert('Saved', pin ? 'Manager PIN set.' : 'Manager PIN cleared.');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not save PIN');
    }
  };

  const toggleRefundPin = async () => {
    try {
      const next = requireRefundPin === '1' ? '0' : '1';
      await db.settings.set('require_refund_pin', next);
      setRequireRefundPin(next);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not toggle setting');
    }
  };

  const loadReport = useCallback(async (period: 'today' | 'week' | 'month') => {
    setReportLoading(true);
    try {
      const now = new Date();
      let start = new Date(now);
      start.setHours(0, 0, 0, 0);

      if (period === 'week') {
        start.setDate(now.getDate() - 7);
      } else if (period === 'month') {
        start.setDate(now.getDate() - 30);
      }

      const end = new Date(now);
      end.setDate(now.getDate() + 1);
      end.setHours(0, 0, 0, 0);

      const data = await db.getReport(start.toISOString(), end.toISOString());
      setReportData(data);
    } catch (e) {
      Alert.alert('Report Error', e instanceof Error ? e.message : 'Could not generate report');
    } finally {
      setReportLoading(false);
    }
  }, [db]);

  const openReportsModal = () => {
    setReportsModalVisible(true);
    loadReport(reportPeriod);
  };

  const shareZReport = async () => {
    try {
      const text = await db.generateZReport(new Date().toISOString());
      await Share.share({
        title: `Z-Report - ${new Date().toLocaleDateString()}`,
        message: text,
      });
    } catch (e) {
      Alert.alert('Share Error', e instanceof Error ? e.message : 'Failed to share report');
    }
  };

  const exportBackup = async () => {
    try {
      const json = await db.exportBackupJson();
      await Share.share({
        title: `SmartPOS-Backup-${new Date().toISOString().slice(0, 10)}.json`,
        message: json,
      });
    } catch (e) {
      Alert.alert('Export Error', e instanceof Error ? e.message : 'Failed to export backup');
    }
  };

  const handleValidateBackup = () => {
    const trimmed = restoreJsonInput.trim();
    if (!trimmed) {
      Alert.alert('Empty Input', 'Please paste JSON backup contents to validate.');
      return;
    }
    const val = db.validateBackupJson(trimmed);
    setRestoreValidation(val);
    if (val.valid) {
      Alert.alert(
        'Backup Validated ✓',
        `Version: ${val.version}\n` +
        `Products: ${val.counts?.products}\n` +
        `Categories: ${val.counts?.categories}\n` +
        `Sales: ${val.counts?.sales}\n` +
        `Stock Movements: ${val.counts?.stock_movements}\n\n` +
        `Schema and foreign-key integrity confirmed.`
      );
    } else {
      Alert.alert('Validation Error ✗', val.error || 'Failed schema validation.');
    }
  };

  const handleLoadCurrentBackupPreview = async () => {
    try {
      const json = await db.exportBackupJson();
      setRestoreJsonInput(json);
      const val = db.validateBackupJson(json);
      setRestoreValidation(val);
    } catch (e) {
      Alert.alert('Preview Error', e instanceof Error ? e.message : 'Failed to generate backup preview.');
    }
  };

  const executeRestore = async () => {
    if (!restoreValidation?.valid) {
      Alert.alert('Validation Required', 'Please validate the backup schema first.');
      return;
    }

    Alert.alert(
      '⚠️ Overwrite Local Database?',
      `Restoring will replace all current database records with the backup (${restoreValidation.counts?.products} products, ${restoreValidation.counts?.sales} sales).\n\nAre you sure you want to proceed?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore Now',
          style: 'destructive',
          onPress: async () => {
            setIsRestoring(true);
            try {
              const res = await db.restoreBackupJson(restoreJsonInput);
              await loadSettings();
              setIsRestoring(false);
              setRestoreModalVisible(false);
              setRestoreJsonInput('');
              setRestoreValidation(null);
              Alert.alert(
                'Restore Complete ✓',
                `Successfully restored database!\n\n` +
                `• Products: ${res.counts.products}\n` +
                `• Categories: ${res.counts.categories}\n` +
                `• Sales History: ${res.counts.sales}\n` +
                `• Stock Movements: ${res.counts.stockMovements}\n` +
                `• Payments: ${res.counts.payments}`
              );
            } catch (err) {
              setIsRestoring(false);
              Alert.alert('Restore Failed', err instanceof Error ? err.message : String(err));
            }
          },
        },
      ]
    );
  };

  const handleSeedDemoProducts = () => {
    Alert.alert(
      'Load 50 Test Products?',
      'This will insert 50 Sri Lankan retail products across 6 departments (Beverages, Snacks, Dairy, Groceries, Bakery, Household) with opening inventory.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Load 50 Products',
          style: 'default',
          onPress: async () => {
            try {
              const res = await db.seedDemoData();
              await loadSettings();
              Alert.alert('Demo Catalog Loaded', `Successfully added ${res.productsCount} products across ${res.categoriesCount} departments.`);
            } catch (e) {
              Alert.alert('Seed Failed', String(e));
            }
          },
        },
      ]
    );
  };

  const handleClearAllTestData = () => {
    Alert.alert(
      'Clear All Database Data?',
      'Warning: This will permanently wipe all products, categories, inventory ledger, and sales history. Invoice numbering will reset to 1.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All Data',
          style: 'destructive',
          onPress: async () => {
            try {
              await db.clearAllTestData();
              await loadSettings();
              Alert.alert('Database Cleared', 'All test products, categories, and sales have been reset to a fresh state.');
            } catch (e) {
              Alert.alert('Clear Failed', String(e));
            }
          },
        },
      ]
    );
  };

  const taxPct = (parseInt(taxRateBps, 10) / 100).toFixed(2);

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Settings"
        subtitle="Configuration & Operations"
      />

      <ScrollView contentContainerStyle={styles.container}>
        {/* Reports & Auditing */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Analytics & Auditing</Text>
          <Card style={styles.card}>
            <TouchableOpacity style={styles.row} onPress={openReportsModal}>
              <View style={styles.infoCol}>
                <Text style={styles.itemTitle}>Daily Reports & Z-Report</Text>
                <Text style={styles.itemSub}>View profit, sales breakdown, and share daily audit</Text>
              </View>
              <Badge label="Active" variant="success" />
            </TouchableOpacity>
          </Card>
        </View>

        {/* Testing & Demo Tools */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Testing & Catalog Tools</Text>
          <Card style={styles.card}>
            <TouchableOpacity style={styles.row} onPress={handleSeedDemoProducts}>
              <View style={styles.infoCol}>
                <Text style={styles.itemTitle}>Load 50 Test Products</Text>
                <Text style={styles.itemSub}>Seeds 50 retail items across 6 departments with opening stock</Text>
              </View>
              <Badge label="Load 50" variant="success" />
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.row} onPress={handleClearAllTestData}>
              <View style={styles.infoCol}>
                <Text style={[styles.itemTitle, { color: colors.danger }]}>Clear All Database Data</Text>
                <Text style={styles.itemSub}>Permanently wipes all catalog, inventory, and sales history</Text>
              </View>
              <Badge label="Reset All" variant="danger" />
            </TouchableOpacity>
          </Card>
        </View>

        {/* Store & Profile */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Store Configuration</Text>
          <Card style={styles.card}>
            <TouchableOpacity style={styles.row} onPress={openProfileModal}>
              <View style={styles.infoCol}>
                <Text style={styles.itemTitle}>Business Profile</Text>
                <Text style={styles.itemSub}>
                  {storeName}{storePhone ? ` · ${storePhone}` : ''}
                </Text>
              </View>
              <Badge label="Configure" variant="neutral" />
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.row} onPress={openTaxModal}>
              <View style={styles.infoCol}>
                <Text style={styles.itemTitle}>Tax / VAT Settings</Text>
                <Text style={styles.itemSub}>
                  Current: {taxPct}% {taxInclusive === '1' ? '(Inclusive)' : '(Exclusive)'}
                </Text>
              </View>
              <Badge label={`${taxPct}%`} variant={taxRateBps === '0' ? 'neutral' : 'success'} />
            </TouchableOpacity>
          </Card>
        </View>

        {/* Testing & Demo Tools */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Testing & Catalog Tools</Text>
          <Card style={styles.card}>
            <TouchableOpacity style={styles.row} onPress={handleSeedDemoProducts}>
              <View style={styles.infoCol}>
                <Text style={styles.itemTitle}>Load 50 Test Products</Text>
                <Text style={styles.itemSub}>Seeds 50 retail items across 6 departments with opening stock</Text>
              </View>
              <Badge label="Load 50" variant="success" />
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.row} onPress={handleClearAllTestData}>
              <View style={styles.infoCol}>
                <Text style={[styles.itemTitle, { color: colors.danger }]}>Clear All Database Data</Text>
                <Text style={styles.itemSub}>Permanently wipes all catalog, inventory, and sales history</Text>
              </View>
              <Badge label="Reset All" variant="danger" />
            </TouchableOpacity>
          </Card>
        </View>

        {/* Currency & Regional */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Currency & Regional</Text>
          <Card style={styles.card}>
            <View style={styles.row}>
              <View style={styles.infoCol}>
                <Text style={styles.itemTitle}>Default Currency</Text>
                <Text style={styles.itemSub}>Sri Lankan Rupee (LKR · Rs.)</Text>
              </View>
              <Badge label="LKR (Default)" variant="success" />
            </View>
          </Card>
        </View>

        {/* Hardware & Peripherals */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hardware & Receipts</Text>
          <Card style={styles.card}>
            <View style={styles.row}>
              <View style={styles.infoCol}>
                <Text style={styles.itemTitle}>Bluetooth Thermal Printer</Text>
                <Text style={styles.itemSub}>ESC/POS receipt printer support (Awaiting bridge)</Text>
              </View>
              <Badge label="Planned" variant="warning" />
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <View style={styles.infoCol}>
                <Text style={styles.itemTitle}>Barcode Camera Scanner</Text>
                <Text style={styles.itemSub}>Camera barcode scanning (Awaiting native permissions)</Text>
              </View>
              <Badge label="Planned" variant="warning" />
            </View>
          </Card>
        </View>

        {/* Database & Offline Storage */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data & Offline Storage</Text>
          <Card style={styles.card}>
            <View style={styles.row}>
              <View style={styles.infoCol}>
                <Text style={styles.itemTitle}>Local Database Engine</Text>
                <Text style={styles.itemSub}>expo-sqlite ACID local store (Shared connection)</Text>
              </View>
              <Badge label="Configured" variant="success" />
            </View>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.row} onPress={exportBackup}>
              <View style={styles.infoCol}>
                <Text style={styles.itemTitle}>Database Backup & Export</Text>
                <Text style={styles.itemSub}>Export complete catalog, sales & stock as JSON</Text>
              </View>
              <Badge label="Export" variant="neutral" />
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.row} onPress={() => setRestoreModalVisible(true)}>
              <View style={styles.infoCol}>
                <Text style={styles.itemTitle}>Disaster Recovery & Restore</Text>
                <Text style={styles.itemSub}>Validate schema, foreign keys & restore database from JSON</Text>
              </View>
              <Badge label="Restore" variant="neutral" />
            </TouchableOpacity>
          </Card>
        </View>

        {/* Testing & Demo Tools */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Testing & Catalog Tools</Text>
          <Card style={styles.card}>
            <TouchableOpacity style={styles.row} onPress={handleSeedDemoProducts}>
              <View style={styles.infoCol}>
                <Text style={styles.itemTitle}>Load 50 Test Products</Text>
                <Text style={styles.itemSub}>Seeds 50 retail items across 6 departments with opening stock</Text>
              </View>
              <Badge label="Load 50" variant="success" />
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.row} onPress={handleClearAllTestData}>
              <View style={styles.infoCol}>
                <Text style={[styles.itemTitle, { color: colors.danger }]}>Clear All Database Data</Text>
                <Text style={styles.itemSub}>Permanently wipes all catalog, inventory, and sales history</Text>
              </View>
              <Badge label="Reset All" variant="danger" />
            </TouchableOpacity>
          </Card>
        </View>

        {/* App Info */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>SmartPOS v1.0.0 (Phase 4 Active)</Text>
          <Text style={styles.footerSub}>TechknowLK Mobile Applications</Text>
        </View>
      </ScrollView>

      {/* Profile Edit Modal */}
      <Modal visible={profileModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Business Profile</Text>
            <Text style={styles.modalSub}>Appears on itemized receipts and reports</Text>
            <ScrollView style={styles.modalForm}>
              <Text style={styles.inputLabel}>Store Name</Text>
              <TextInput
                style={styles.input}
                value={editStoreName}
                onChangeText={setEditStoreName}
                placeholder="Store Name"
              />
              <Text style={styles.inputLabel}>Phone Number</Text>
              <TextInput
                style={styles.input}
                value={editStorePhone}
                onChangeText={setEditStorePhone}
                placeholder="e.g. +94 77 123 4567"
                keyboardType="phone-pad"
              />
              <Text style={styles.inputLabel}>Address / Location</Text>
              <TextInput
                style={styles.input}
                value={editStoreAddress}
                onChangeText={setEditStoreAddress}
                placeholder="e.g. 123 Main St, Colombo"
              />
              <Text style={styles.inputLabel}>Tax / Business Reg No</Text>
              <TextInput
                style={styles.input}
                value={editTaxId}
                onChangeText={setEditTaxId}
                placeholder="e.g. VAT-123456"
              />
              <Text style={styles.inputLabel}>Receipt Footer Message</Text>
              <TextInput
                style={styles.input}
                value={editReceiptFooter}
                onChangeText={setEditReceiptFooter}
                placeholder="Thank you for shopping with us!"
              />
            </ScrollView>
            <View style={styles.modalActions}>
              <Button title="Cancel" variant="outline" onPress={() => setProfileModalVisible(false)} style={styles.actionBtn} />
              <Button title="Save Profile" variant="primary" onPress={saveProfile} style={styles.actionBtn} />
            </View>
          </View>
        </View>
      </Modal>

      {/* Tax Rate Modal */}
      <Modal visible={taxModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Tax / VAT Settings</Text>
            <Text style={styles.modalSub}>Enter basis points (e.g. 1500 = 15.00%, 0 = exempt)</Text>
            <TextInput
              style={[styles.input, { marginTop: spacing.md }]}
              value={editTaxRateBps}
              onChangeText={setEditTaxRateBps}
              placeholder="0"
              keyboardType="numeric"
            />
            <View style={[styles.modalActions, { marginTop: spacing.lg }]}>
              <Button title="Cancel" variant="outline" onPress={() => setTaxModalVisible(false)} style={styles.actionBtn} />
              <Button title="Save Tax" variant="primary" onPress={saveTax} style={styles.actionBtn} />
            </View>
          </View>
        </View>
      </Modal>

      {/* Manager PIN Modal */}
      <Modal visible={pinModalVisible} animationType="fade" transparent onRequestClose={() => setPinModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Manager Security PIN</Text>
            <Text style={styles.modalSub}>Enter a 4-digit PIN to protect refunds and managerial operations. Leave blank to disable.</Text>
            <TextInput
              style={[styles.input, { marginTop: spacing.md, textAlign: 'center', fontSize: 24, letterSpacing: 8 }]}
              value={editPin}
              onChangeText={setEditPin}
              placeholder="••••"
              keyboardType="number-pad"
              maxLength={6}
              secureTextEntry
            />
            <View style={[styles.modalActions, { marginTop: spacing.lg }]}>
              <Button title="Cancel" variant="outline" onPress={() => setPinModalVisible(false)} style={styles.actionBtn} />
              <Button title="Save PIN" variant="primary" onPress={savePin} style={styles.actionBtn} />
            </View>
          </View>
        </View>
      </Modal>

      {/* Reports & Z-Report Modal */}
      <Modal visible={reportsModalVisible} animationType="slide">
        <SafeAreaView style={styles.safeArea}>
          <Header
            title="Sales & Profit Reports"
            subtitle="Financial Performance & Z-Report"
          />
          <View style={styles.reportTabs}>
            {(['today', 'week', 'month'] as const).map((p) => (
              <TouchableOpacity
                key={p}
                style={[styles.reportTab, reportPeriod === p && styles.reportTabActive]}
                onPress={() => { setReportPeriod(p); loadReport(p); }}
              >
                <Text style={[styles.reportTabText, reportPeriod === p && styles.reportTabTextActive]}>
                  {p === 'today' ? 'Today' : p === 'week' ? 'Last 7 Days' : 'Last 30 Days'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView contentContainerStyle={styles.reportScroll}>
            {reportData && (
              <>
                <View style={styles.reportGrid}>
                  <Card style={styles.reportCard}>
                    <Text style={styles.reportCardLabel}>Net Sales</Text>
                    <Text style={styles.reportCardVal}>{money(reportData.net_sales_cents)}</Text>
                    <Text style={styles.reportCardSub}>After refunds deducted</Text>
                  </Card>
                  <Card style={styles.reportCard}>
                    <Text style={styles.reportCardLabel}>Est. Gross Profit</Text>
                    <Text style={styles.reportCardVal}>{money(reportData.gross_profit_cents)}</Text>
                    <Text style={styles.reportCardSub}>{reportData.profit_margin_pct}% margin</Text>
                  </Card>
                  <Card style={styles.reportCard}>
                    <Text style={styles.reportCardLabel}>Transactions</Text>
                    <Text style={styles.reportCardVal}>{reportData.transaction_count}</Text>
                    <Text style={styles.reportCardSub}>{reportData.completed_sales_count} sales · {reportData.refunds_count} refunds</Text>
                  </Card>
                  <Card style={styles.reportCard}>
                    <Text style={styles.reportCardLabel}>Cost of Goods (COGS)</Text>
                    <Text style={styles.reportCardVal}>{money(reportData.cogs_cents)}</Text>
                    <Text style={styles.reportCardSub}>Product cost snapshot</Text>
                  </Card>
                </View>

                {/* Tender Breakdown */}
                <Text style={styles.reportSectionHeader}>Payment Breakdown</Text>
                <Card style={styles.card}>
                  {reportData.payments.length === 0 ? (
                    <Text style={styles.itemSub}>No payments recorded in this period</Text>
                  ) : (
                    reportData.payments.map((p, idx) => (
                      <React.Fragment key={p.method}>
                        {idx > 0 && <View style={styles.divider} />}
                        <View style={styles.row}>
                          <Text style={[styles.itemTitle, { textTransform: 'capitalize' }]}>{p.method}</Text>
                          <Text style={styles.itemTitle}>{money(p.total_cents)} ({p.count})</Text>
                        </View>
                      </React.Fragment>
                    ))
                  )}
                </Card>

                {/* Top Products */}
                {reportData.top_products.length > 0 && (
                  <>
                    <Text style={styles.reportSectionHeader}>Top Selling Products</Text>
                    <Card style={styles.card}>
                      {reportData.top_products.map((prod, idx) => (
                        <React.Fragment key={prod.product_id}>
                          {idx > 0 && <View style={styles.divider} />}
                          <View style={styles.row}>
                            <View style={styles.infoCol}>
                              <Text style={styles.itemTitle}>{prod.product_name}</Text>
                              <Text style={styles.itemSub}>Qty: {(prod.quantity_milli / 1000).toFixed(1)} units</Text>
                            </View>
                            <Text style={styles.itemTitle}>{money(prod.revenue_cents)}</Text>
                          </View>
                        </React.Fragment>
                      ))}
                    </Card>
                  </>
                )}

                <View style={styles.reportBtnRow}>
                  <Button
                    title="Share Daily Z-Report"
                    variant="primary"
                    onPress={shareZReport}
                    style={{ flex: 1 }}
                  />
                </View>
              </>
            )}
            <View style={{ height: spacing.xl }} />
          </ScrollView>

          <View style={styles.reportFooterClose}>
            <Button title="Close Reports" variant="outline" onPress={() => setReportsModalVisible(false)} />
          </View>
        </SafeAreaView>
      </Modal>

      {/* Disaster Recovery / Restore Modal */}
      <Modal visible={restoreModalVisible} animationType="slide" transparent onRequestClose={() => setRestoreModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '92%', width: '92%', maxWidth: 500 }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="shield-checkmark-outline" size={22} color={colors.accent} />
                <Text style={styles.modalTitle}>Database Disaster Recovery</Text>
              </View>
              <TouchableOpacity onPress={() => setRestoreModalVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.md }}>
              <View style={styles.warningBox}>
                <Ionicons name="warning-outline" size={18} color="#D97706" />
                <Text style={styles.warningBoxText}>
                  Restoring replaces current local database records with the imported snapshot. Operations are wrapped in an atomic SQLite transaction.
                </Text>
              </View>

              <Text style={styles.inputLabel}>Backup JSON Payload</Text>
              <TextInput
                style={styles.restoreTextArea}
                multiline
                numberOfLines={8}
                value={restoreJsonInput}
                onChangeText={(text) => {
                  setRestoreJsonInput(text);
                  setRestoreValidation(null);
                }}
                placeholder="Paste backup JSON string here..."
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <View style={{ flexDirection: 'row', gap: spacing.xs, marginVertical: spacing.sm }}>
                <Button
                  title="Validate Schema"
                  variant="outline"
                  onPress={handleValidateBackup}
                  disabled={!restoreJsonInput.trim() || isRestoring}
                  style={{ flex: 1 }}
                />
                <Button
                  title="Load Preview"
                  variant="outline"
                  onPress={handleLoadCurrentBackupPreview}
                  disabled={isRestoring}
                  style={{ flex: 1 }}
                />
                <Button
                  title="Clear"
                  variant="outline"
                  onPress={() => {
                    setRestoreJsonInput('');
                    setRestoreValidation(null);
                  }}
                  disabled={!restoreJsonInput || isRestoring}
                />
              </View>

              {/* Validation Status Indicator */}
              {restoreValidation && (
                <View style={[styles.validationCard, restoreValidation.valid ? styles.validationCardSuccess : styles.validationCardError]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <Ionicons
                      name={restoreValidation.valid ? 'checkmark-circle' : 'alert-circle'}
                      size={18}
                      color={restoreValidation.valid ? colors.success : colors.danger}
                    />
                    <Text style={[styles.validationTitle, { color: restoreValidation.valid ? colors.success : colors.danger }]}>
                      {restoreValidation.valid ? 'Schema & Foreign Keys Validated' : 'Validation Failed'}
                    </Text>
                  </View>

                  {restoreValidation.valid ? (
                    <View style={styles.statsGrid}>
                      <Text style={styles.statLine}>• Format Version: <Text style={{ fontWeight: '700' }}>{restoreValidation.version}</Text></Text>
                      <Text style={styles.statLine}>• Products: <Text style={{ fontWeight: '700' }}>{restoreValidation.counts?.products}</Text></Text>
                      <Text style={styles.statLine}>• Categories: <Text style={{ fontWeight: '700' }}>{restoreValidation.counts?.categories}</Text></Text>
                      <Text style={styles.statLine}>• Sales Records: <Text style={{ fontWeight: '700' }}>{restoreValidation.counts?.sales}</Text></Text>
                      <Text style={styles.statLine}>• Stock Ledger: <Text style={{ fontWeight: '700' }}>{restoreValidation.counts?.stock_movements}</Text></Text>
                      <Text style={styles.statLine}>• Payments: <Text style={{ fontWeight: '700' }}>{restoreValidation.counts?.payments}</Text></Text>
                    </View>
                  ) : (
                    <Text style={styles.statErrorText}>{restoreValidation.error}</Text>
                  )}
                </View>
              )}

              <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
                <Button
                  title={isRestoring ? 'Restoring Database…' : 'Execute Restore (Atomic Transaction)'}
                  onPress={executeRestore}
                  disabled={!restoreValidation?.valid || isRestoring}
                />
                <Button
                  title="Cancel"
                  variant="outline"
                  onPress={() => setRestoreModalVisible(false)}
                  disabled={isRestoring}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    padding: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: spacing.touchTarget,
  },
  infoCol: {
    flex: 1,
    marginRight: spacing.md,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },
  itemSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  footer: {
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  footerText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  footerSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.lg,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },
  modalSub: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
    marginBottom: spacing.md,
  },
  modalForm: {
    maxHeight: 320,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: spacing.sm,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.background,
    minHeight: 44,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  actionBtn: {
    flex: 1,
  },
  reportTabs: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  reportTab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  reportTabActive: {
    backgroundColor: colors.primary,
  },
  reportTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  reportTabTextActive: {
    color: colors.white,
  },
  reportScroll: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  reportGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  reportCard: {
    flexBasis: '47%',
    flexGrow: 1,
    padding: spacing.md,
  },
  reportCardLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  reportCardVal: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 4,
  },
  reportCardSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  reportSectionHeader: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
    marginTop: spacing.sm,
  },
  reportBtnRow: {
    marginTop: spacing.md,
  },
  reportFooterClose: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(217, 119, 6, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.3)',
    borderRadius: 10,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  warningBoxText: {
    flex: 1,
    fontSize: 12,
    color: '#B45309',
    lineHeight: 16,
    fontWeight: '500',
  },
  restoreTextArea: {
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.md,
    color: colors.text,
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    height: 120,
    textAlignVertical: 'top',
  },
  validationCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: spacing.sm,
    marginTop: spacing.xs,
  },
  validationCardSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  validationCardError: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  validationTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  statsGrid: {
    gap: 2,
    marginTop: 4,
  },
  statLine: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  statErrorText: {
    fontSize: 12,
    color: colors.danger,
    marginTop: 2,
    fontWeight: '500',
  },
});
