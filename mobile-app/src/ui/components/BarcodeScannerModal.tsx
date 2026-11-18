import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  TextInput,
  Platform,
  Alert,
  ScrollView,
  Vibration,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing, shadows } from '../theme';

export interface ScannedItemRecord {
  id: string;
  name: string;
  barcode: string;
  time: string;
  success: boolean;
  priceCents?: number;
}

export interface BarcodeScanResult {
  success: boolean;
  name?: string;
  priceCents?: number;
  message?: string;
}

interface BarcodeScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onScan: (barcode: string) => BarcodeScanResult | void;
  sampleBarcodes?: { name: string; barcode: string; priceCents?: number }[];
  cartCount?: number;
  cartTotalCents?: number;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  visible,
  onClose,
  onScan,
  sampleBarcodes = [],
  cartCount = 0,
  cartTotalCents = 0,
}) => {
  const [manualCode, setManualCode] = useState('');
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [rapidScanMode, setRapidScanMode] = useState(true);
  const [recentScans, setRecentScans] = useState<ScannedItemRecord[]>([]);
  const [feedback, setFeedback] = useState<{
    type: 'idle' | 'success' | 'error';
    title: string;
    subtitle?: string;
  }>({ type: 'idle', title: '' });

  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset local session state on modal open
  useEffect(() => {
    if (visible) {
      setRecentScans([]);
      setFeedback({ type: 'idle', title: '' });
      setManualCode('');
    } else {
      if (feedbackTimerRef.current) {
        clearTimeout(feedbackTimerRef.current);
      }
    }
  }, [visible]);

  const triggerFeedback = (success: boolean, name?: string, priceCents?: number, rawCode?: string) => {
    // 1. Haptic Feedback
    if (Platform.OS !== 'web') {
      try {
        if (success) {
          Vibration.vibrate(40);
        } else {
          Vibration.vibrate([0, 50, 40, 50]);
        }
      } catch {
        // Safe fallback if vibration hardware unavailable
      }
    }

    // 2. Visual Pulse Feedback
    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current);
    }

    if (success) {
      setFeedback({
        type: 'success',
        title: `✓ Added: ${name || rawCode}`,
        subtitle: priceCents !== undefined ? `LKR ${(priceCents / 100).toFixed(2)}` : undefined,
      });
    } else {
      setFeedback({
        type: 'error',
        title: `✗ Unrecognized: "${rawCode}"`,
        subtitle: 'Not in catalog or barcode mismatch',
      });
    }

    feedbackTimerRef.current = setTimeout(() => {
      setFeedback({ type: 'idle', title: '' });
    }, 1800);
  };

  const processBarcode = (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;

    const res = onScan(trimmed);
    const isSuccess = res ? res.success : true;
    const itemName = res?.name || trimmed;
    const itemPrice = res?.priceCents;

    // Log to session history
    const newRecord: ScannedItemRecord = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: itemName,
      barcode: trimmed,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      success: isSuccess,
      priceCents: itemPrice,
    };

    setRecentScans((prev) => [newRecord, ...prev.slice(0, 9)]);
    triggerFeedback(isSuccess, itemName, itemPrice, trimmed);

    // If single scan mode is toggled, close immediately
    if (!rapidScanMode) {
      onClose();
    }
  };

  const handleManualSubmit = () => {
    const trimmed = manualCode.trim();
    if (!trimmed) {
      Alert.alert('Empty Code', 'Please enter a barcode or SKU number.');
      return;
    }
    processBarcode(trimmed);
    setManualCode('');
  };

  const handleSelectSample = (code: string) => {
    processBarcode(code);
  };

  const reticleColor =
    feedback.type === 'success'
      ? colors.success
      : feedback.type === 'error'
      ? colors.danger
      : colors.accent;

  const totalSessionAdded = recentScans.filter((s) => s.success).length;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={[styles.scannerIconWrapper, feedback.type === 'success' && styles.scannerIconSuccess]}>
                <Ionicons
                  name={feedback.type === 'success' ? 'checkmark-circle' : 'barcode-outline'}
                  size={22}
                  color={feedback.type === 'success' ? colors.success : colors.accent}
                />
              </View>
              <View>
                <Text style={styles.headerTitle}>Barcode Scanner</Text>
                <Text style={styles.headerSubtitle}>
                  {rapidScanMode ? 'Continuous Rapid-Scan Mode' : 'Single-Scan Mode'}
                </Text>
              </View>
            </View>

            <View style={styles.headerActions}>
              {/* Rapid Mode Toggle */}
              <TouchableOpacity
                style={[styles.modeToggle, rapidScanMode && styles.modeToggleActive]}
                onPress={() => setRapidScanMode(!rapidScanMode)}
                accessibilityLabel="Toggle Rapid Continuous Scan"
              >
                <Ionicons
                  name={rapidScanMode ? 'flash' : 'flash-outline'}
                  size={14}
                  color={rapidScanMode ? '#FEF08A' : '#94A3B8'}
                />
                <Text style={[styles.modeToggleText, rapidScanMode && styles.modeToggleTextActive]}>
                  {rapidScanMode ? 'Rapid ON' : 'Single'}
                </Text>
              </TouchableOpacity>

              {/* Torch Toggle */}
              <TouchableOpacity
                style={[styles.iconButton, torchEnabled && styles.iconButtonActive]}
                onPress={() => setTorchEnabled(!torchEnabled)}
                accessibilityLabel="Toggle Torch"
              >
                <Ionicons
                  name={torchEnabled ? 'flashlight' : 'flashlight-outline'}
                  size={18}
                  color={torchEnabled ? colors.warning : colors.white}
                />
              </TouchableOpacity>

              {/* Close Button */}
              <TouchableOpacity style={styles.iconButton} onPress={onClose} accessibilityLabel="Close Scanner">
                <Ionicons name="close" size={20} color={colors.white} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Viewfinder / Camera Simulation Area */}
          <View style={[styles.viewfinderContainer, feedback.type === 'success' && styles.viewfinderSuccess]}>
            <View style={styles.reticle}>
              {/* Corner brackets with dynamic pulse color */}
              <View style={[styles.corner, styles.cornerTL, { borderColor: reticleColor }]} />
              <View style={[styles.corner, styles.cornerTR, { borderColor: reticleColor }]} />
              <View style={[styles.corner, styles.cornerBL, { borderColor: reticleColor }]} />
              <View style={[styles.corner, styles.cornerBR, { borderColor: reticleColor }]} />

              {/* Laser Aiming Guide */}
              <View
                style={[
                  styles.laserGuide,
                  feedback.type === 'success'
                    ? { backgroundColor: colors.success, height: 3 }
                    : feedback.type === 'error'
                    ? { backgroundColor: colors.danger, height: 3 }
                    : { backgroundColor: colors.danger },
                ]}
              />
            </View>

            {/* Visual Feedback Banner */}
            {feedback.type !== 'idle' ? (
              <View
                style={[
                  styles.feedbackBanner,
                  feedback.type === 'success' ? styles.feedbackSuccess : styles.feedbackError,
                ]}
              >
                <Ionicons
                  name={feedback.type === 'success' ? 'checkmark-circle' : 'alert-circle'}
                  size={16}
                  color={colors.white}
                />
                <View style={styles.feedbackTextCol}>
                  <Text style={styles.feedbackTitle} numberOfLines={1}>
                    {feedback.title}
                  </Text>
                  {Boolean(feedback.subtitle) && (
                    <Text style={styles.feedbackSubtitle}>{feedback.subtitle}</Text>
                  )}
                </View>
              </View>
            ) : (
              <Text style={styles.instructionText}>
                {rapidScanMode
                  ? '⚡ Rapid Scan: Align barcodes in reticle to scan continuously'
                  : 'Align barcode within frame to scan once'}
              </Text>
            )}
          </View>

          {/* Manual Entry Fallback */}
          <View style={styles.manualEntrySection}>
            <View style={styles.inputRow}>
              <TextInput
                value={manualCode}
                onChangeText={setManualCode}
                placeholder="Type barcode or SKU..."
                placeholderTextColor="#64748B"
                style={styles.manualInput}
                keyboardType="default"
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={handleManualSubmit}
              />
              <TouchableOpacity
                style={[styles.submitBtn, Boolean(manualCode.trim()) && styles.submitBtnActive]}
                onPress={handleManualSubmit}
              >
                <Ionicons name="add" size={20} color={colors.white} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Quick Test Barcode Simulation Chips */}
          {sampleBarcodes.length > 0 && (
            <View style={styles.sampleSection}>
              <Text style={styles.sampleTitle}>Tap catalog item to simulate scan:</Text>
              <View style={styles.sampleChipsRow}>
                {sampleBarcodes.slice(0, 4).map((sample, idx) => (
                  <TouchableOpacity
                    key={`${sample.barcode}-${idx}`}
                    style={styles.sampleChip}
                    onPress={() => handleSelectSample(sample.barcode)}
                  >
                    <Ionicons name="scan-outline" size={12} color={colors.accent} />
                    <Text style={styles.sampleChipText} numberOfLines={1}>
                      {sample.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Bottom Mini-Summary (Continuous Scan Status) */}
          <View style={styles.miniSummarySection}>
            <View style={styles.summaryHeaderRow}>
              <View style={styles.summaryBadge}>
                <Ionicons name="cart" size={14} color={colors.white} />
                <Text style={styles.summaryBadgeText}>
                  Cart: {cartCount} items
                </Text>
              </View>
              {cartTotalCents > 0 && (
                <Text style={styles.summaryTotalText}>
                  Total: LKR {(cartTotalCents / 100).toFixed(2)}
                </Text>
              )}
              {totalSessionAdded > 0 && (
                <View style={styles.sessionCountTag}>
                  <Text style={styles.sessionCountText}>+{totalSessionAdded} this session</Text>
                </View>
              )}
            </View>

            {/* Recent Scans Feed */}
            {recentScans.length > 0 ? (
              <ScrollView
                style={styles.recentScansList}
                nestedScrollEnabled
                showsVerticalScrollIndicator={false}
              >
                {recentScans.slice(0, 3).map((item) => (
                  <View key={item.id} style={styles.recentScanItem}>
                    <Ionicons
                      name={item.success ? 'checkmark-circle' : 'close-circle'}
                      size={15}
                      color={item.success ? colors.success : colors.danger}
                    />
                    <Text style={styles.recentScanName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    {item.priceCents !== undefined && (
                      <Text style={styles.recentScanPrice}>
                        LKR {(item.priceCents / 100).toFixed(2)}
                      </Text>
                    )}
                    <Text style={styles.recentScanTime}>{item.time}</Text>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.emptyScansText}>No items scanned yet in this session.</Text>
            )}

            {/* Finish Scanning Button */}
            <TouchableOpacity style={styles.doneBtn} onPress={onClose}>
              <Ionicons name="checkmark-done" size={18} color={colors.white} />
              <Text style={styles.doneBtnText}>
                {cartCount > 0 ? `Done Scanning (${cartCount} in Cart)` : 'Done / Close'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  container: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#1E293B',
    borderRadius: 24,
    overflow: 'hidden',
    padding: spacing.lg,
    maxHeight: '94%',
    ...shadows.floating,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  scannerIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannerIconSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.white,
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  modeToggleActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  modeToggleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  modeToggleTextActive: {
    color: '#FDE68A',
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.3)',
  },
  viewfinderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 165,
    backgroundColor: '#0F172A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    marginVertical: spacing.xs,
    position: 'relative',
    overflow: 'hidden',
  },
  viewfinderSuccess: {
    borderColor: colors.success,
  },
  reticle: {
    width: 210,
    height: 105,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  corner: {
    position: 'absolute',
    width: 22,
    height: 22,
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },
  laserGuide: {
    width: '92%',
    height: 2,
    opacity: 0.9,
    borderRadius: 1,
  },
  instructionText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: spacing.sm,
  },
  feedbackBanner: {
    position: 'absolute',
    bottom: 8,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  feedbackSuccess: {
    backgroundColor: '#059669',
  },
  feedbackError: {
    backgroundColor: '#DC2626',
  },
  feedbackTextCol: {
    flex: 1,
  },
  feedbackTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.white,
  },
  feedbackSubtitle: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  manualEntrySection: {
    marginTop: spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 6,
  },
  manualInput: {
    flex: 1,
    height: 40,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    color: colors.white,
    fontSize: 13,
  },
  submitBtn: {
    width: 40,
    height: 40,
    backgroundColor: '#334155',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnActive: {
    backgroundColor: colors.accent,
  },
  sampleSection: {
    marginTop: spacing.xs,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  sampleTitle: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 4,
  },
  sampleChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  sampleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    borderRadius: 7,
    paddingHorizontal: 7,
    paddingVertical: 3,
    maxWidth: '48%',
  },
  sampleChipText: {
    fontSize: 10,
    color: '#93C5FD',
    fontWeight: '600',
  },
  miniSummarySection: {
    marginTop: spacing.sm,
    backgroundColor: '#0F172A',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    padding: spacing.sm,
  },
  summaryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  summaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#2563EB',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  summaryBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.white,
  },
  summaryTotalText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.success,
  },
  sessionCountTag: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  sessionCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6EE7B7',
  },
  recentScansList: {
    maxHeight: 70,
    marginBottom: 8,
  },
  recentScanItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  recentScanName: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    color: colors.white,
  },
  recentScanPrice: {
    fontSize: 11,
    fontWeight: '600',
    color: '#93C5FD',
  },
  recentScanTime: {
    fontSize: 9,
    color: '#64748B',
  },
  emptyScansText: {
    fontSize: 10,
    color: '#64748B',
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: 4,
  },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 9,
    marginTop: 2,
  },
  doneBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.white,
  },
});
