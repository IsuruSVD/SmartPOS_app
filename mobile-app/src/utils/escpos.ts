import type { PaymentMethod } from '../db/types';

export interface EscPosReceiptItem {
  name: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
}

export interface EscPosReceiptData {
  storeName: string;
  storeAddress?: string;
  storePhone?: string;
  taxId?: string;
  invoiceNumber: string;
  dateStr: string;
  items: EscPosReceiptItem[];
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  paidCents: number;
  changeCents: number;
  paymentMethod: string;
  payments?: Array<{ method: PaymentMethod | string; amount_cents: number }>;
  footerNote?: string;
}

const moneyStr = (cents: number) => `Rs. ${(cents / 100).toFixed(2)}`;

/** Formats a receipt for 58mm (32 columns) or 80mm (48 columns) thermal printers. */
export function formatMonospaceReceipt(data: EscPosReceiptData, width = 32): string {
  const padRight = (str: string, len: number) => (str.length >= len ? str.slice(0, len) : str + ' '.repeat(len - str.length));
  const padLeft = (str: string, len: number) => (str.length >= len ? str.slice(0, len) : ' '.repeat(len - str.length) + str);
  const center = (str: string, len: number) => {
    if (str.length >= len) return str.slice(0, len);
    const leftPad = Math.floor((len - str.length) / 2);
    return ' '.repeat(leftPad) + str + ' '.repeat(len - str.length - leftPad);
  };
  const line = (char = '-') => char.repeat(width);

  const out: string[] = [];
  out.push(line('='));
  out.push(center(data.storeName.toUpperCase(), width));
  if (data.storeAddress) out.push(center(data.storeAddress, width));
  if (data.storePhone) out.push(center(`Tel: ${data.storePhone}`, width));
  if (data.taxId) out.push(center(`Tax ID: ${data.taxId}`, width));
  out.push(line('-'));

  out.push(`Invoice: ${data.invoiceNumber}`);
  out.push(`Date:    ${data.dateStr}`);
  out.push(line('-'));

  // Table header
  out.push(padRight('Item', width - 12) + padLeft('Total', 12));
  out.push(line('.'));

  // Items
  for (const item of data.items) {
    const qtyPrice = `  ${item.quantity} x ${moneyStr(item.unitPriceCents)}`;
    const lineTotal = moneyStr(item.lineTotalCents);

    if (item.name.length <= width - 12) {
      out.push(padRight(item.name, width - 12) + padLeft(lineTotal, 12));
    } else {
      out.push(item.name);
      out.push(padLeft(lineTotal, width));
    }
    out.push(padRight(qtyPrice, width));
  }

  out.push(line('-'));
  out.push(padRight('Subtotal:', width - 14) + padLeft(moneyStr(data.subtotalCents), 14));
  if (data.taxCents > 0) {
    out.push(padRight('Tax / VAT:', width - 14) + padLeft(moneyStr(data.taxCents), 14));
  }
  out.push(padRight('TOTAL:', width - 14) + padLeft(moneyStr(data.totalCents), 14));
  out.push(line('-'));

  out.push(padRight('Paid:', width - 14) + padLeft(moneyStr(data.paidCents), 14));
  if (data.changeCents > 0) {
    out.push(padRight('Change:', width - 14) + padLeft(moneyStr(data.changeCents), 14));
  }

  if (data.payments && data.payments.length > 0) {
    out.push('Tender:');
    for (const p of data.payments) {
      out.push(`  ${padRight(p.method.toUpperCase(), width - 16)} ${padLeft(moneyStr(p.amount_cents), 14)}`);
    }
  } else {
    out.push(`Tender: ${data.paymentMethod.toUpperCase()}`);
  }

  out.push(line('-'));
  if (data.footerNote) {
    out.push(center(data.footerNote, width));
  }
  out.push(center('Software by TechknowLK SmartPOS', width));
  out.push(line('='));

  return out.join('\n');
}

/**
 * Builds raw ESC/POS binary command buffer ready to be transmitted over
 * Bluetooth SPP, USB OTG, or TCP/IP socket to any ESC/POS thermal printer.
 */
export function buildEscPosBytes(data: EscPosReceiptData, widthChars = 32): Uint8Array {
  const ESC = 0x1b;
  const GS = 0x1d;

  const bytes: number[] = [
    ESC, 0x40, // Initialize printer
    ESC, 0x61, 0x01, // Center align
    ESC, 0x21, 0x20, // Double height & width
  ];

  // Store name
  const enc = (s: string) => Array.from(new TextEncoder().encode(s));
  bytes.push(...enc(data.storeName + '\n'));

  // Regular font
  bytes.push(ESC, 0x21, 0x00);
  if (data.storeAddress) bytes.push(...enc(data.storeAddress + '\n'));
  if (data.storePhone) bytes.push(...enc(`Tel: ${data.storePhone}\n`));
  if (data.taxId) bytes.push(...enc(`Tax ID: ${data.taxId}\n`));

  // Left align
  bytes.push(ESC, 0x61, 0x00);
  bytes.push(...enc('-'.repeat(widthChars) + '\n'));
  bytes.push(...enc(`Invoice: ${data.invoiceNumber}\n`));
  bytes.push(...enc(`Date: ${data.dateStr}\n`));
  bytes.push(...enc('-'.repeat(widthChars) + '\n'));

  // Items
  for (const item of data.items) {
    bytes.push(ESC, 0x21, 0x08); // Bold
    bytes.push(...enc(item.name + '\n'));
    bytes.push(ESC, 0x21, 0x00); // Normal
    const qtyPrice = `  ${item.quantity} x ${(item.unitPriceCents / 100).toFixed(2)}`;
    const lineTotal = (item.lineTotalCents / 100).toFixed(2);
    const spacing = Math.max(1, widthChars - qtyPrice.length - lineTotal.length);
    bytes.push(...enc(qtyPrice + ' '.repeat(spacing) + lineTotal + '\n'));
  }

  bytes.push(...enc('-'.repeat(widthChars) + '\n'));

  // Totals
  const padLine = (lbl: string, val: string) => {
    const sp = Math.max(1, widthChars - lbl.length - val.length);
    return lbl + ' '.repeat(sp) + val + '\n';
  };

  bytes.push(...enc(padLine('Subtotal:', moneyStr(data.subtotalCents))));
  if (data.taxCents > 0) {
    bytes.push(...enc(padLine('Tax:', moneyStr(data.taxCents))));
  }
  bytes.push(ESC, 0x21, 0x08); // Bold total
  bytes.push(...enc(padLine('TOTAL:', moneyStr(data.totalCents))));
  bytes.push(ESC, 0x21, 0x00);

  bytes.push(...enc(padLine('Paid:', moneyStr(data.paidCents))));
  if (data.changeCents > 0) {
    bytes.push(...enc(padLine('Change:', moneyStr(data.changeCents))));
  }

  // Footer
  bytes.push(ESC, 0x61, 0x01); // Center align
  bytes.push(...enc('-'.repeat(widthChars) + '\n'));
  if (data.footerNote) bytes.push(...enc(data.footerNote + '\n'));
  bytes.push(...enc('Thank you for your visit!\n'));

  // Paper feed & Cut
  bytes.push(
    ESC, 0x64, 0x03, // Feed 3 lines
    GS, 0x56, 0x00,  // Full paper cut
  );

  return new Uint8Array(bytes);
}
