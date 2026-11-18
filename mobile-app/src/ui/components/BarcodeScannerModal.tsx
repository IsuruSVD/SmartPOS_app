import React, { useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  TextInput,
  Platform,
  Alert,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing, shadows } from '../theme';

interface BarcodeScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
  sampleBarcodes?: { name: string; barcode: string }[];
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  visible,
  onClose,
  onScan,
  sampleBarcodes = [],
}) => {
  const [manualCode, setManualCode] = useState('');
  const [torchEnabled, setTorchEnabled] = useState(false);

  const handleManualSubmit = () => {
    const trimmed = manualCode.trim();
    if (!trimmed) {
      Alert.alert('Empty Code', 'Please enter a barcode or SKU number.');
      return;
    }
    onScan(trimmed);
    setManualCode('');
    onClose();
  };

  const handleSelectSample = (code: string) => {
    onScan(code);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Ionicons name="barcode-outline" size={24} color={colors.accent} />
              <Text style={styles.headerTitle}>Scan Barcode</Text>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={[styles.iconButton, torchEnabled && styles.iconButtonActive]}
                onPress={() => setTorchEnabled(!torchEnabled)}
                accessibilityLabel="Toggle Torch"
              >
                <Ionicons
                  name={torchEnabled ? 'flash' : 'flash-outline'}
                  size={20}
                  color={torchEnabled ? colors.warning : colors.white}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={onClose}
                accessibilityLabel="Close Scanner"
              >
                <Ionicons name="close" size={22} color={colors.white} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Viewfinder Area */}
          <View style={styles.viewfinderContainer}>
            <View style={styles.reticle}>
              {/* Corner brackets */}
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />

              {/* Red Laser Aiming Guide */}
              <View style={styles.laserGuide} />
            </View>
            <Text style={styles.instructionText}>
              Align barcode within frame to scan automatically
            </Text>
          </View>

          {/* Manual Entry Fallback */}
          <View style={styles.manualEntrySection}>
            <Text style={styles.manualLabel}>Manual SKU / Barcode Entry</Text>
            <View style={styles.inputRow}>
              <TextInput
                value={manualCode}
                onChangeText={setManualCode}
                placeholder="Type barcode or SKU..."
                placeholderTextColor={colors.textMuted}
                style={styles.manualInput}
                keyboardType="default"
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={handleManualSubmit}
              />
              <TouchableOpacity style={styles.submitBtn} onPress={handleManualSubmit}>
                <Ionicons name="arrow-forward" size={18} color={colors.white} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Quick Test Barcode Chips */}
          {sampleBarcodes.length > 0 && (
            <View style={styles.sampleSection}>
              <Text style={styles.sampleTitle}>Tap to simulate scan:</Text>
              <View style={styles.sampleChipsRow}>
                {sampleBarcodes.slice(0, 4).map((sample, idx) => (
                  <TouchableOpacity
                    key={`${sample.barcode}-${idx}`}
                    style={styles.sampleChip}
                    onPress={() => handleSelectSample(sample.barcode)}
                  >
                    <Ionicons name="scan-outline" size={12} color={colors.accent} />
                    <Text style={styles.sampleChipText} numberOfLines={1}>
                      {sample.name} ({sample.barcode})
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  container: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#1E293B',
    borderRadius: 20,
    overflow: 'hidden',
    padding: spacing.lg,
    ...shadows.modal,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.white,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.25)',
  },
  viewfinderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 200,
    backgroundColor: '#0F172A',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    marginVertical: spacing.sm,
    position: 'relative',
  },
  reticle: {
    width: 220,
    height: 120,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  corner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: colors.accent,
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },
  laserGuide: {
    width: '90%',
    height: 2,
    backgroundColor: colors.danger,
    opacity: 0.85,
    borderRadius: 1,
  },
  instructionText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '500',
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  manualEntrySection: {
    marginTop: spacing.md,
  },
  manualLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#CBD5E1',
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  manualInput: {
    flex: 1,
    height: 44,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    color: colors.white,
    fontSize: 14,
  },
  submitBtn: {
    width: 44,
    height: 44,
    backgroundColor: colors.accent,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sampleSection: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  sampleTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 6,
  },
  sampleChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  sampleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    maxWidth: '48%',
  },
  sampleChipText: {
    fontSize: 11,
    color: '#93C5FD',
    fontWeight: '600',
  },
});
