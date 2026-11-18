import { SQLiteDatabase } from 'expo-sqlite';
import { runTransaction } from '../connection';
import { newId } from '../id';

export interface PurchaseLineInput {
  product_id: string;
  quantity_milli: number;
  unit_cost_cents: number;
}

/** Records a received delivery and its inventory ledger entries atomically. */
export class PurchaseService {
  constructor(private readonly db: SQLiteDatabase) {}

  async receive(input: {
    supplier_id?: string | null;
    reference_no?: string | null;
    note?: string | null;
    lines: PurchaseLineInput[];
  }): Promise<string> {
    if (!input.lines.length) throw new Error('Add at least one product to the delivery.');
    for (const line of input.lines) {
      if (!Number.isSafeInteger(line.quantity_milli) || line.quantity_milli <= 0 ||
          !Number.isSafeInteger(line.unit_cost_cents) || line.unit_cost_cents < 0) {
        throw new Error('Each product needs a valid quantity and non-negative unit cost.');
      }
    }

    const purchaseId = newId();
    await runTransaction(this.db, async (tx) => {
      if (input.supplier_id) {
        const supplier = await tx.getFirstAsync<{ id: string }>(
          'SELECT id FROM suppliers WHERE id=? AND deleted_at IS NULL', [input.supplier_id]
        );
        if (!supplier) throw new Error('The selected supplier is no longer available.');
      }
      await tx.runAsync(
        `INSERT INTO purchases (id,supplier_id,reference_no,note,status,received_at)
         VALUES (?,?,?,?,'received',strftime('%Y-%m-%dT%H:%M:%fZ','now'))`,
        [purchaseId, input.supplier_id ?? null, input.reference_no?.trim() || null, input.note?.trim() || null]
      );
      let total = 0;
      for (const line of input.lines) {
        const product = await tx.getFirstAsync<{ id: string; name: string; track_stock: number }>(
          'SELECT id,name,track_stock FROM products WHERE id=? AND deleted_at IS NULL', [line.product_id]
        );
        if (!product) throw new Error('A selected product is no longer available.');
        const lineTotal = Math.round(line.quantity_milli * line.unit_cost_cents / 1000);
        if (!Number.isSafeInteger(lineTotal) || !Number.isSafeInteger(total + lineTotal)) {
          throw new Error('The delivery total is too large to record safely.');
        }
        total += lineTotal;
        await tx.runAsync(
          `INSERT INTO purchase_items (id,purchase_id,product_id,product_name,quantity_milli,unit_cost_cents,line_total_cents)
           VALUES (?,?,?,?,?,?,?)`,
          [newId(), purchaseId, product.id, product.name, line.quantity_milli, line.unit_cost_cents, lineTotal]
        );
        if (product.track_stock) {
          await tx.runAsync(
            `INSERT INTO stock_movements (id,product_id,movement_type,quantity_delta_milli,reference_id,reference_type,note)
             VALUES (?,?,'purchase_received',?,?,?,'Purchase received')`,
            [newId(), product.id, line.quantity_milli, purchaseId, 'purchase']
          );
        }
      }
      await tx.runAsync(
        `UPDATE purchases SET total_cents=?,version=version+1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),sync_status='pending' WHERE id=?`,
        [total, purchaseId]
      );
    });
    return purchaseId;
  }
}
