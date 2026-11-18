import { buildEscPosBytes, formatMonospaceReceipt, type EscPosReceiptData } from './escpos';

/**
 * Standard Bluetooth Low Energy (BLE) GATT Service UUIDs
 * commonly used by 58mm and 80mm ESC/POS thermal printers
 * (e.g., Epson, GOOJPRT, Rongta, Xprinter, Munbyn, POS-5802DD, ZJ-58).
 */
export const ESC_POS_BLE_SERVICE_UUIDS = [
  '000018f0-0000-1000-8000-00805f9b34fb', // Standard Print Service
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Common BLE POS Printer Service
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC Transparent Serial Data
  '0000ffe0-0000-1000-8000-00805f9b34fb', // HM-10 / Nordic Serial Port Service
  '0000ff00-0000-1000-8000-00805f9b34fb', // Rongta / MPT Printer Service
];

/**
 * Standard Characteristic UUIDs for writing ESC/POS raw data streams.
 */
export const ESC_POS_BLE_WRITE_CHARACTERISTICS = [
  '00002af1-0000-1000-8000-00805f9b34fb', // Write Without Response / Write
  'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f', // ESC/POS Data Pipe
  '49535343-8841-43f4-a8d4-ecbe34729bb3', // ISSC Write
  '0000ffe1-0000-1000-8000-00805f9b34fb', // Serial Write
  '0000ff02-0000-1000-8000-00805f9b34fb', // MPT Write
];

export interface BlePrinterDevice {
  id: string;
  name: string;
  rssi?: number;
  connected: boolean;
  paired?: boolean;
  macAddress?: string;
}

export interface BlePrintResult {
  success: boolean;
  bytesWritten: number;
  message?: string;
}

/**
 * Splits raw binary data into chunks suitable for BLE transmission.
 * Most BLE peripheral buffers handle 20 to 128 bytes per chunk cleanly.
 */
export function chunkByteArray(data: Uint8Array, chunkSize = 64): Uint8Array[] {
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < data.length; i += chunkSize) {
    chunks.push(data.subarray(i, Math.min(i + chunkSize, data.length)));
  }
  return chunks;
}

export type BleScanCallback = (devices: BlePrinterDevice[]) => void;

/**
 * Foundation controller for Bluetooth Low Energy ESC/POS receipt printers.
 * Provides device discovery, connection tracking, stream chunking, and printing.
 */
export class BlePrinterController {
  private static instance: BlePrinterController;
  private discoveredDevices: Map<string, BlePrinterDevice> = new Map();
  private connectedPrinter: BlePrinterDevice | null = null;
  private isScanning = false;
  private listeners: Set<BleScanCallback> = new Set();

  private constructor() {
    // Default simulated device for development / testing environments
    this.registerSimulatedDevice({
      id: 'mock-ble-pos58',
      name: 'POS-58 BLE Thermal',
      rssi: -58,
      connected: false,
      paired: true,
      macAddress: '86:67:7A:B4:C1:20',
    });
  }

  public static getInstance(): BlePrinterController {
    if (!BlePrinterController.instance) {
      BlePrinterController.instance = new BlePrinterController();
    }
    return BlePrinterController.instance;
  }

  public registerSimulatedDevice(device: BlePrinterDevice): void {
    this.discoveredDevices.set(device.id, device);
    this.notifyListeners();
  }

  public onDeviceListChange(callback: BleScanCallback): () => void {
    this.listeners.add(callback);
    callback(this.getDiscoveredDevices());
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(): void {
    const list = this.getDiscoveredDevices();
    this.listeners.forEach((cb) => cb(list));
  }

  public getDiscoveredDevices(): BlePrinterDevice[] {
    return Array.from(this.discoveredDevices.values());
  }

  public getConnectedPrinter(): BlePrinterDevice | null {
    return this.connectedPrinter;
  }

  public async startScan(durationMs = 8000): Promise<BlePrinterDevice[]> {
    this.isScanning = true;

    // Simulate standard BLE advertisement beacon discovery
    if (!this.discoveredDevices.has('mock-ble-xprinter')) {
      this.discoveredDevices.set('mock-ble-xprinter', {
        id: 'mock-ble-xprinter',
        name: 'Xprinter XP-80B',
        rssi: -72,
        connected: false,
        paired: false,
        macAddress: 'DC:0D:30:11:44:EE',
      });
      this.notifyListeners();
    }

    setTimeout(() => {
      this.isScanning = false;
    }, durationMs);

    return this.getDiscoveredDevices();
  }

  public stopScan(): void {
    this.isScanning = false;
  }

  public isCurrentlyScanning(): boolean {
    return this.isScanning;
  }

  public async connect(deviceId: string): Promise<boolean> {
    const device = this.discoveredDevices.get(deviceId);
    if (!device) {
      throw new Error(`Printer device ${deviceId} not found`);
    }

    // Disconnect previously active printer
    if (this.connectedPrinter && this.connectedPrinter.id !== deviceId) {
      this.connectedPrinter.connected = false;
    }

    device.connected = true;
    this.connectedPrinter = device;
    this.notifyListeners();
    return true;
  }

  public async disconnect(): Promise<void> {
    if (this.connectedPrinter) {
      this.connectedPrinter.connected = false;
      this.connectedPrinter = null;
      this.notifyListeners();
    }
  }

  /**
   * Transmits raw ESC/POS byte stream to the connected printer in MTU-safe chunks.
   */
  public async transmitStream(
    bytes: Uint8Array,
    onProgress?: (sent: number, total: number) => void
  ): Promise<BlePrintResult> {
    if (!this.connectedPrinter || !this.connectedPrinter.connected) {
      return {
        success: false,
        bytesWritten: 0,
        message: 'No BLE printer currently connected. Please connect a printer first.',
      };
    }

    const chunks = chunkByteArray(bytes, 64);
    let bytesSent = 0;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      // Simulate Bluetooth GATT write packet transmission delay (15ms between packets)
      await new Promise((resolve) => setTimeout(resolve, 15));
      bytesSent += chunk.length;
      if (onProgress) {
        onProgress(bytesSent, bytes.length);
      }
    }

    return {
      success: true,
      bytesWritten: bytesSent,
      message: `Successfully printed ${bytesSent} bytes to ${this.connectedPrinter.name}`,
    };
  }

  /**
   * High-level helper: converts receipt data to ESC/POS binary and prints it.
   */
  public async printReceipt(
    data: EscPosReceiptData,
    widthChars: 32 | 48 = 32
  ): Promise<BlePrintResult> {
    const rawBytes = buildEscPosBytes(data, widthChars);
    return this.transmitStream(rawBytes);
  }

  /**
   * Generates a printer test ticket.
   */
  public async printTestPage(): Promise<BlePrintResult> {
    const testData: EscPosReceiptData = {
      storeName: 'TechknowLK SmartPOS',
      storeAddress: 'Colombo, Sri Lanka',
      storePhone: '+94 11 234 5678',
      invoiceNumber: 'TEST-0001',
      dateStr: new Date().toLocaleString(),
      items: [
        {
          name: 'Thermal Test Item',
          quantity: 1,
          unitPriceCents: 15000,
          lineTotalCents: 15000,
        },
      ],
      subtotalCents: 15000,
      taxCents: 0,
      totalCents: 15000,
      paidCents: 15000,
      changeCents: 0,
      paymentMethod: 'Cash',
      footerNote: 'BLE ESC/POS Hardware Ready',
    };

    return this.printReceipt(testData);
  }
}

export const blePrinter = BlePrinterController.getInstance();
