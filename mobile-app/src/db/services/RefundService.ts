import type { SQLiteDatabase } from 'expo-sqlite';
import { newId } from '../id';
import { runTransaction } from '../connection';
import type { PaymentMethod } from '../types';

export interface RefundResult {
  refund_id: string;
  refund_sale_id: string;
  invoice_number: string;
  total_cents: number;
  method: PaymentMethod;
}

export interface RefundItemInput {
  sale_item_id: string;
  quantity_milli: number;
}

/** Records full or partial sale refunds and restores stock atomically. */
export class RefundService {
  constructor(private readonly db: SQLiteDatabase) {}

  async refundSale(saleId: string, method: PaymentMethod, reason: string): Promise<RefundResult> {
    return runTransaction(this.db, async (tx) => {
      const original = await tx.getFirstAsync<{
        id: string; invoice_number: string; status: string; subtotal_cents: number;
        discount_cents: number; tax_cents: number; total_cents: number;
      }>('SELECT id,invoice_number,status,subtotal_cents,discount_cents,tax_cents,total_cents FROM sales WHERE id=?', [saleId]);
      if (!original) throw new Error('The original sale could not be found.');
      if (original.status !== 'completed' && original.status !== 'partially_refunded') {
        throw new Error('Only a completed or partially refunded sale can be refunded.');
      }
      if (!Number.isSafeInteger(original.total_cents) || original.total_cents <= 0) {
        throw new Error('This sale does not have a refundable total.');
      }

      const items = await tx.getAllAsync<{
        id: string; product_id: string; product_name: string; product_sku: string | null;
        quantity_milli: number; unit_price_cents: number; unit_cost_cents: number; discount_cents: number; line_total_cents: number;
      }>('SELECT id,product_id,product_name,product_sku,quantity_milli,unit_price_cents,unit_cost_cents,discount_cents,line_total_cents FROM sale_items WHERE sale_id=? ORDER BY created_at ASC', [saleId]);
      if (!items.length) throw new Error('This sale has no item details to refund.');

      // Check if previous refunds exist on this sale
      const previousReturns = await tx.getAllAsync<{ product_id: string; returned_milli: number }>(
        `SELECT si.product_id, SUM(-si.quantity_milli) AS returned_milli
         FROM sale_items si
         JOIN refunds r ON r.refund_sale_id = si.sale_id
         WHERE r.original_sale_id = ?
         GROUP BY si.product_id`,
        [saleId]
      );
      const returnedMap = new Map(previousReturns.map((r) => [r.product_id, r.returned_milli]));

      const refundId = newId();
      const refundSaleId = newId();
      const invoiceNumber = `RF-${refundSaleId.toUpperCase().slice(0, 12)}`;
      const cleanReason = reason.trim() || 'Full sale refund';

      let refundSubtotal = 0;
      let itemsToRefundCount = 0;

      for (const item of items) {
        const alreadyReturned = returnedMap.get(item.product_id) ?? 0;
        const remaining = item.quantity_milli - alreadyReturned;
        if (remaining <= 0) continue;

        itemsToRefundCount++;
        const lineTotal = Math.round(item.unit_price_cents * remaining / 1000);
        refundSubtotal += lineTotal;

        await tx.runAsync(
          `INSERT INTO sale_items (id,sale_id,product_id,product_name,product_sku,quantity_milli,unit_price_cents,unit_cost_cents,discount_cents,line_total_cents)
           VALUES (?,?,?,?,?,?,?,?,0,?)`,
          [newId(), refundSaleId, item.product_id, item.product_name, item.product_sku, remaining, -item.unit_price_cents, item.unit_cost_cents ?? 0, -lineTotal]
        );

        await tx.runAsync(
          `INSERT INTO stock_movements (id,product_id,movement_type,quantity_delta_milli,reference_id,reference_type,note)
           SELECT ?,?,'sale_refund',?,?,'refund',?
           WHERE (SELECT track_stock FROM products WHERE id=?)=1`,
          [newId(), item.product_id, remaining, refundId, `Returned from ${original.invoice_number}`, item.product_id]
        );
      }

      if (itemsToRefundCount === 0) {
        throw new Error('All items from this sale have already been returned.');
      }

      const taxRatio = original.subtotal_cents > 0 ? original.tax_cents / original.subtotal_cents : 0;
      const refundTax = Math.round(refundSubtotal * taxRatio);
      const refundTotal = refundSubtotal + refundTax;

      await tx.runAsync(
        `INSERT INTO sales (id,invoice_number,status,subtotal_cents,discount_cents,tax_cents,total_cents,paid_cents,change_cents,note,completed_at)
         VALUES (?,?,'refunded',?,0,?,?,?,0,?,strftime('%Y-%m-%dT%H:%M:%fZ','now'))`,
        [refundSaleId, invoiceNumber, -refundSubtotal, -refundTax, -refundTotal, -refundTotal, `Refund of ${original.invoice_number}`]
      );

      await tx.runAsync('INSERT INTO payments (id,sale_id,method,amount_cents,reference) VALUES (?,?,?,?,?)', [newId(), refundSaleId, method, -refundTotal, original.invoice_number]);
      await tx.runAsync(
        'INSERT INTO refunds (id,original_sale_id,refund_sale_id,reason,refund_method,total_cents) VALUES (?,?,?,?,?,?)',
        [refundId, original.id, refundSaleId, cleanReason, method, refundTotal]
      );
      await tx.runAsync(
        `UPDATE sales SET status='refunded',version=version+1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),sync_status='pending' WHERE id=?`,
        [original.id]
      );
      return { refund_id: refundId, refund_sale_id: refundSaleId, invoice_number: invoiceNumber, total_cents: refundTotal, method };
    });
  }

  async refundPartial(originalSaleId: string, returnItems: RefundItemInput[], method: PaymentMethod, reason: string): Promise<RefundResult> {
    if (!returnItems.length) throw new Error('Select at least one item to refund.');

    return runTransaction(this.db, async (tx) => {
      const original = await tx.getFirstAsync<{
        id: string; invoice_number: string; status: string; subtotal_cents: number;
        discount_cents: number; tax_cents: number; total_cents: number;
      }>('SELECT id,invoice_number,status,subtotal_cents,discount_cents,tax_cents,total_cents FROM sales WHERE id=?', [originalSaleId]);
      if (!original) throw new Error('Original sale not found.');
      if (original.status !== 'completed' && original.status !== 'partially_refunded') {
        throw new Error('This sale cannot be refunded.');
      }

      const allOriginalItems = await tx.getAllAsync<{
        id: string; product_id: string; product_name: string; product_sku: string | null;
        quantity_milli: number; unit_price_cents: number; unit_cost_cents: number; discount_cents: number; line_total_cents: number;
      }>('SELECT id,product_id,product_name,product_sku,quantity_milli,unit_price_cents,unit_cost_cents,discount_cents,line_total_cents FROM sale_items WHERE sale_id=?', [originalSaleId]);

      const previousReturns = await tx.getAllAsync<{ product_id: string; returned_milli: number }>(
        `SELECT si.product_id, SUM(-si.quantity_milli) AS returned_milli
         FROM sale_items si
         JOIN refunds r ON r.refund_sale_id = si.sale_id
         WHERE r.original_sale_id = ?
         GROUP BY si.product_id`,
        [originalSaleId]
      );
      const returnedMap = new Map(previousReturns.map((r) => [r.product_id, r.returned_milli]));

      let refundSubtotalCents = 0;
      const itemsToRefund: Array<{
        product_id: string;
        product_name: string;
        product_sku: string | null;
        quantity_milli: number;
        unit_price_cents: number;
        unit_cost_cents: number;
        line_total_cents: number;
      }> = [];

      for (const req of returnItems) {
        if (!Number.isSafeInteger(req.quantity_milli) || req.quantity_milli <= 0) {
          throw new Error('Invalid refund quantity.');
        }
        const origItem = allOriginalItems.find((i) => i.id === req.sale_item_id);
        if (!origItem) throw new Error('Item not found in this sale.');

        const alreadyReturned = returnedMap.get(origItem.product_id) ?? 0;
        const remainingMilli = origItem.quantity_milli - alreadyReturned;
        if (req.quantity_milli > remainingMilli) {
          throw new Error(`Cannot return more than the remaining quantity for ${origItem.product_name}.`);
        }

        const lineRefund = Math.round(origItem.unit_price_cents * req.quantity_milli / 1000);
        refundSubtotalCents += lineRefund;
        itemsToRefund.push({
          product_id: origItem.product_id,
          product_name: origItem.product_name,
          product_sku: origItem.product_sku,
          quantity_milli: req.quantity_milli,
          unit_price_cents: origItem.unit_price_cents,
          unit_cost_cents: origItem.unit_cost_cents ?? 0,
          line_total_cents: lineRefund,
        });
      }

      const taxRateRatio = original.subtotal_cents > 0 ? original.tax_cents / original.subtotal_cents : 0;
      const refundTaxCents = Math.round(refundSubtotalCents * taxRateRatio);
      const refundTotalCents = refundSubtotalCents + refundTaxCents;

      const refundId = newId();
      const refundSaleId = newId();
      const invoiceNumber = `RF-${refundSaleId.toUpperCase().slice(0, 12)}`;
      const cleanReason = reason.trim() || 'Partial sale return';

      await tx.runAsync(
        `INSERT INTO sales (id,invoice_number,status,subtotal_cents,discount_cents,tax_cents,total_cents,paid_cents,change_cents,note,completed_at)
         VALUES (?,?,'refunded',?,0,?,?,?,0,?,strftime('%Y-%m-%dT%H:%M:%fZ','now'))`,
        [refundSaleId, invoiceNumber, -refundSubtotalCents, -refundTaxCents, -refundTotalCents, -refundTotalCents, `Partial refund of ${original.invoice_number}`]
      );

      for (const item of itemsToRefund) {
        await tx.runAsync(
          `INSERT INTO sale_items (id,sale_id,product_id,product_name,product_sku,quantity_milli,unit_price_cents,unit_cost_cents,discount_cents,line_total_cents)
           VALUES (?,?,?,?,?,?,?,?,0,?)`,
          [newId(), refundSaleId, item.product_id, item.product_name, item.product_sku, item.quantity_milli, -item.unit_price_cents, item.unit_cost_cents, -item.line_total_cents]
        );

        await tx.runAsync(
          `INSERT INTO stock_movements (id,product_id,movement_type,quantity_delta_milli,reference_id,reference_type,note)
           SELECT ?,?,'sale_refund',?,?,'refund',?
           WHERE (SELECT track_stock FROM products WHERE id=?)=1`,
          [newId(), item.product_id, item.quantity_milli, refundId, `Returned from ${original.invoice_number}`, item.product_id]
        );
      }

      await tx.runAsync('INSERT INTO payments (id,sale_id,method,amount_cents,reference) VALUES (?,?,?,?,?)', [newId(), refundSaleId, method, -refundTotalCents, original.invoice_number]);
      await tx.runAsync(
        'INSERT INTO refunds (id,original_sale_id,refund_sale_id,reason,refund_method,total_cents) VALUES (?,?,?,?,?,?)',
        [refundId, original.id, refundSaleId, cleanReason, method, refundTotalCents]
      );

      let totalRemainingMilli = 0;
      for (const origItem of allOriginalItems) {
        const previouslyRet = returnedMap.get(origItem.product_id) ?? 0;
        const nowRet = itemsToRefund.find((i) => i.product_id === origItem.product_id)?.quantity_milli ?? 0;
        totalRemainingMilli += Math.max(0, origItem.quantity_milli - (previouslyRet + nowRet));
      }

      const nextStatus = totalRemainingMilli <= 0 ? 'refunded' : 'partially_refunded';
      await tx.runAsync(
        `UPDATE sales SET status=?, version=version+1, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'), sync_status='pending' WHERE id=?`,
        [nextStatus, original.id]
      );

      return {
        refund_id: refundId,
        refund_sale_id: refundSaleId,
        invoice_number: invoiceNumber,
        total_cents: refundTotalCents,
        method,
      };
    });
  }
}
