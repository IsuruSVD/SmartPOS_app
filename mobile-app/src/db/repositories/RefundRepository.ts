import { SQLiteDatabase } from 'expo-sqlite';
import { BaseRepository } from './BaseRepository';

export interface Refund { id: string; original_sale_id: string; refund_sale_id: string; reason: string | null; refund_method: string; total_cents: number; created_at: string; }
export class RefundRepository extends BaseRepository {
  constructor(db: SQLiteDatabase) { super(db); }
  findByOriginalSale(saleId: string): Promise<Refund[]> {
    return this.db.getAllAsync<Refund>('SELECT * FROM refunds WHERE original_sale_id=? ORDER BY created_at DESC', [saleId]);
  }
}
