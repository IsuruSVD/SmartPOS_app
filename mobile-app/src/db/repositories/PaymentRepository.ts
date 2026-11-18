import { SQLiteDatabase } from 'expo-sqlite';
import { BaseRepository } from './BaseRepository';
import { Payment, NewPayment } from '../types';

export class PaymentRepository extends BaseRepository {
  constructor(db: SQLiteDatabase) { super(db); }

  async insert(p: NewPayment): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO payments (id, sale_id, method, amount_cents, reference)
       VALUES (?, ?, ?, ?, ?)`,
      [p.id, p.sale_id, p.method, p.amount_cents, p.reference ?? null]
    );
  }

  async findBySale(saleId: string): Promise<Payment[]> {
    return this.db.getAllAsync<Payment>(
      'SELECT * FROM payments WHERE sale_id = ? ORDER BY created_at ASC',
      [saleId]
    );
  }
}
