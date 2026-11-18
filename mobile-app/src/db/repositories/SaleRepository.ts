import { SQLiteDatabase } from 'expo-sqlite';
import { BaseRepository } from './BaseRepository';
import { Sale, SaleItem, NewSale, NewSaleItem, SaleStatus } from '../types';

export class SaleRepository extends BaseRepository {
  constructor(db: SQLiteDatabase) { super(db); }

  async insertSale(s: NewSale): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO sales
         (id, invoice_number, status, subtotal_cents, discount_cents,
          tax_cents, total_cents, paid_cents, change_cents, note, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        s.id, s.invoice_number, s.status, s.subtotal_cents, s.discount_cents,
        s.tax_cents, s.total_cents, s.paid_cents, s.change_cents,
        s.note ?? null, s.completed_at ?? null,
      ]
    );
  }

  async insertItem(item: NewSaleItem): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO sale_items
         (id, sale_id, product_id, product_name, product_sku,
          quantity_milli, unit_price_cents, unit_cost_cents, discount_cents, line_total_cents)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.id, item.sale_id, item.product_id, item.product_name,
        item.product_sku ?? null, item.quantity_milli, item.unit_price_cents,
        item.unit_cost_cents ?? 0, item.discount_cents, item.line_total_cents,
      ]
    );
  }

  async updateStatus(saleId: string, status: SaleStatus, completedAt?: string): Promise<void> {
    await this.db.runAsync(
      `UPDATE sales SET
         status       = ?,
         completed_at = ?,
         version      = version + 1,
         updated_at   = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
         sync_status  = 'pending'
       WHERE id = ?`,
      [status, completedAt ?? null, saleId]
    );
  }

  async findById(id: string): Promise<Sale | null> {
    return this.db.getFirstAsync<Sale>('SELECT * FROM sales WHERE id = ?', [id]);
  }

  async findItems(saleId: string): Promise<SaleItem[]> {
    return this.db.getAllAsync<SaleItem>(
      'SELECT * FROM sale_items WHERE sale_id = ? ORDER BY created_at ASC', [saleId]
    );
  }

  async findRecent(limit = 50): Promise<Sale[]> {
    return this.db.getAllAsync<Sale>(
      `SELECT s.* FROM sales s
        WHERE s.status IN ('completed','refunded','partially_refunded')
          AND NOT EXISTS (SELECT 1 FROM refunds r WHERE r.refund_sale_id = s.id)
        ORDER BY COALESCE(s.completed_at,s.created_at) DESC LIMIT ?`,
      [limit]
    );
  }

  async findHistory(limit = 200): Promise<Array<Sale & { item_count: number; payment_methods: string }>> {
    return this.db.getAllAsync<Sale & { item_count: number; payment_methods: string }>(
      `SELECT s.*, COUNT(DISTINCT si.id) AS item_count,
              COALESCE(GROUP_CONCAT(DISTINCT pay.method), '') AS payment_methods
         FROM sales s
         LEFT JOIN sale_items si ON si.sale_id = s.id
         LEFT JOIN payments pay ON pay.sale_id = s.id
        WHERE s.status IN ('completed','refunded','partially_refunded')
          AND NOT EXISTS (SELECT 1 FROM refunds r WHERE r.refund_sale_id = s.id)
        GROUP BY s.id
        ORDER BY COALESCE(s.completed_at, s.created_at) DESC
        LIMIT ?`,
      [limit]
    );
  }

  async getSummary(startIso: string, endIso: string): Promise<{ sales_cents: number; transaction_count: number }> {
    const row = await this.db.getFirstAsync<{ sales_cents: number | null; transaction_count: number }>(
      `SELECT
         COALESCE((SELECT SUM(s.total_cents) FROM sales s
                    WHERE s.status IN ('completed','partially_refunded','refunded')
                      AND NOT EXISTS (SELECT 1 FROM refunds linked WHERE linked.refund_sale_id=s.id)
                      AND s.completed_at >= ? AND s.completed_at < ?),0)
         - COALESCE((SELECT SUM(r.total_cents) FROM refunds r WHERE r.created_at >= ? AND r.created_at < ?),0)
           AS sales_cents,
         (SELECT COUNT(*) FROM sales s
           WHERE s.status IN ('completed','partially_refunded','refunded')
             AND NOT EXISTS (SELECT 1 FROM refunds linked WHERE linked.refund_sale_id=s.id)
             AND s.completed_at >= ? AND s.completed_at < ?)
         + (SELECT COUNT(*) FROM refunds r WHERE r.created_at >= ? AND r.created_at < ?)
           AS transaction_count`,
      [startIso, endIso, startIso, endIso, startIso, endIso, startIso, endIso]
    );
    return { sales_cents: row?.sales_cents ?? 0, transaction_count: row?.transaction_count ?? 0 };
  }
}
