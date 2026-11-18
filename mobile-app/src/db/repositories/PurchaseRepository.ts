import { SQLiteDatabase } from 'expo-sqlite';
import { BaseRepository } from './BaseRepository';

export interface Purchase { id: string; supplier_id: string | null; reference_no: string | null; status: 'draft' | 'received' | 'cancelled'; total_cents: number; note: string | null; received_at: string | null; created_at: string; }
export interface PurchaseItem { id: string; purchase_id: string; product_id: string; product_name: string; quantity_milli: number; unit_cost_cents: number; line_total_cents: number; }
export class PurchaseRepository extends BaseRepository {
  constructor(db: SQLiteDatabase) { super(db); }
  findRecent(limit = 50): Promise<Array<Purchase & { supplier_name: string | null }>> {
    return this.db.getAllAsync<Purchase & { supplier_name: string | null }>(
      `SELECT purchases.*, suppliers.name AS supplier_name
         FROM purchases LEFT JOIN suppliers ON suppliers.id=purchases.supplier_id
        ORDER BY COALESCE(purchases.received_at,purchases.created_at) DESC LIMIT ?`, [limit]
    );
  }
  findItems(purchaseId: string): Promise<PurchaseItem[]> {
    return this.db.getAllAsync<PurchaseItem>('SELECT * FROM purchase_items WHERE purchase_id=? ORDER BY created_at', [purchaseId]);
  }
  async create(p: { id: string; supplier_id?: string | null; reference_no?: string | null; note?: string | null }): Promise<void> {
    await this.db.runAsync("INSERT INTO purchases (id,supplier_id,reference_no,note) VALUES (?,?,?,?)", [p.id,p.supplier_id ?? null,p.reference_no ?? null,p.note ?? null]);
  }
}
