import { SQLiteDatabase } from 'expo-sqlite';
import { newId } from '../id';
import { runTransaction } from '../connection';
import type { PaymentMethod } from '../types';

export interface CheckoutCartLine { product_id: string; quantity_milli: number; }
export interface CheckoutPayment { method: PaymentMethod; amount_cents: number; }
export interface CheckoutResult {
  sale_id: string;
  invoice_number: string;
  subtotal_cents: number;
  discount_cents: number;
  tax_cents: number;
  total_cents: number;
  paid_cents: number;
  change_cents: number;
}

/** Completes a checkout with optional discount and multi-tender support as one serialized SQLite transaction. */
export class CheckoutService {
  constructor(private readonly db: SQLiteDatabase) {}

  async checkout(
    lines: CheckoutCartLine[],
    paidCents: number,
    method: PaymentMethod = 'cash',
    payments?: CheckoutPayment[],
    discountCents = 0
  ): Promise<CheckoutResult> {
    if (lines.length === 0) throw new Error('Cart is empty.');
    if (!Number.isSafeInteger(paidCents) || paidCents < 0) throw new Error('Enter a valid payment amount.');
    if (!Number.isSafeInteger(discountCents) || discountCents < 0) throw new Error('Enter a valid discount amount.');

    return runTransaction(this.db, async (tx) => {
      const cart = new Map<string, number>();
      for (const line of lines) {
        if (!Number.isSafeInteger(line.quantity_milli) || line.quantity_milli <= 0) throw new Error('Invalid item quantity.');
        cart.set(line.product_id, (cart.get(line.product_id) ?? 0) + line.quantity_milli);
      }
      const items: { id: string; name: string; sku: string | null; quantity: number; price: number; cost: number; lineTotal: number }[] = [];
      for (const [productId, quantity] of cart) {
        const product = await tx.getFirstAsync<{ id: string; name: string; sku: string | null; price_cents: number; cost_cents: number; track_stock: number }>(
          'SELECT id,name,sku,price_cents,cost_cents,track_stock FROM products WHERE id=? AND deleted_at IS NULL', [productId]
        );
        if (!product) throw new Error('A product in the cart is unavailable.');
        if (product.track_stock) {
          const stock = await tx.getFirstAsync<{ qty: number }>('SELECT COALESCE(SUM(quantity_delta_milli),0) AS qty FROM stock_movements WHERE product_id=?', [productId]);
          if ((stock?.qty ?? 0) < quantity) throw new Error(`Not enough stock for ${product.name}.`);
        }
        const lineTotal = Math.round(product.price_cents * quantity / 1000);
        items.push({ id: productId, name: product.name, sku: product.sku, quantity, price: product.price_cents, cost: product.cost_cents ?? 0, lineTotal });
      }
      const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
      const discount = Math.max(0, Math.min(subtotal, Math.round(discountCents)));
      const discountedSubtotal = subtotal - discount;

      const settings = await tx.getAllAsync<{ key: string; value: string }>("SELECT key,value FROM settings WHERE key IN ('tax_rate_bps','tax_inclusive','invoice_prefix','next_invoice_number')");
      const config = Object.fromEntries(settings.map((row) => [row.key, row.value]));
      const taxRate = Math.max(0, Number.parseInt(config.tax_rate_bps ?? '0', 10) || 0);
      const inclusive = config.tax_inclusive !== '0';
      const tax = inclusive ? Math.round(discountedSubtotal * taxRate / (10000 + taxRate)) : Math.round(discountedSubtotal * taxRate / 10000);
      const total = inclusive ? discountedSubtotal : discountedSubtotal + tax;
      const tenderLines = payments?.length ? payments : [{ method, amount_cents: paidCents }];
      if (tenderLines.some((payment) => !Number.isSafeInteger(payment.amount_cents) || payment.amount_cents < 0)) throw new Error('Enter valid tender amounts.');
      const tenderTotal = tenderLines.reduce((sum, payment) => sum + payment.amount_cents, 0);
      if (tenderTotal < total) throw new Error('Tendered amount is less than the sale total.');
      if (tenderLines.length === 1 && method !== 'cash' && tenderTotal !== total) throw new Error('Non-cash tender must match the sale total.');

      const saleId = newId();
      const invoiceNo = Number.parseInt(config.next_invoice_number ?? '1', 10) || 1;
      const invoice = `${config.invoice_prefix ?? 'INV'}-${String(invoiceNo).padStart(6, '0')}`;
      const change = tenderLines.some((payment) => payment.method === 'cash') ? tenderTotal - total : 0;
      await tx.runAsync(
        `INSERT INTO sales (id,invoice_number,status,subtotal_cents,discount_cents,tax_cents,total_cents,paid_cents,change_cents,completed_at)
         VALUES (?,?,'completed',?,?,?,?,?,?,strftime('%Y-%m-%dT%H:%M:%fZ','now'))`,
        [saleId, invoice, subtotal, discount, tax, total, paidCents, change]
      );
      for (const item of items) {
        await tx.runAsync(
          `INSERT INTO sale_items (id,sale_id,product_id,product_name,product_sku,quantity_milli,unit_price_cents,unit_cost_cents,discount_cents,line_total_cents)
           VALUES (?,?,?,?,?,?,?,?,0,?)`,
          [newId(), saleId, item.id, item.name, item.sku, item.quantity, item.price, item.cost, item.lineTotal]
        );
        await tx.runAsync(
          `INSERT INTO stock_movements (id,product_id,movement_type,quantity_delta_milli,reference_id,reference_type)
           SELECT ?,?,'sale',? ,?,'sale' WHERE (SELECT track_stock FROM products WHERE id=?)=1`,
          [newId(), item.id, -item.quantity, saleId, item.id]
        );
      }
      for (const payment of tenderLines) {
        if (payment.amount_cents > 0) await tx.runAsync('INSERT INTO payments (id,sale_id,method,amount_cents) VALUES (?,?,?,?)', [newId(), saleId, payment.method, payment.amount_cents]);
      }
      await tx.runAsync("UPDATE settings SET value=?, version=version+1, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'), sync_status='pending' WHERE key='next_invoice_number'", [String(invoiceNo + 1)]);
      return {
        sale_id: saleId,
        invoice_number: invoice,
        subtotal_cents: subtotal,
        discount_cents: discount,
        tax_cents: tax,
        total_cents: total,
        paid_cents: paidCents,
        change_cents: change,
      };
    });
  }
}
