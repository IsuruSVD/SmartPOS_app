import { SQLiteDatabase } from 'expo-sqlite';
import { BaseRepository } from './BaseRepository';
import { StockMovement, NewStockMovement } from '../types';

/**
 * Immutable ledger repository — only INSERT, never UPDATE or DELETE rows.
 * Current stock on hand is derived as SUM(quantity_delta_milli).
 */
export class StockRepository extends BaseRepository {
  // Simple in-memory cache: productId → quantity_milli
  private _cache: Map<string, number> = new Map();

  constructor(db: SQLiteDatabase) { super(db); }

  /**
   * Returns current stock in milli-units for the given product.
   * Result is cached per session and invalidated on write.
   */
  async getOnHand(productId: string): Promise<number> {
    if (this._cache.has(productId)) return this._cache.get(productId)!;
    const row = await this.db.getFirstAsync<{ qty: number }>(
      `SELECT COALESCE(SUM(quantity_delta_milli), 0) AS qty
         FROM stock_movements WHERE product_id = ?`,
      [productId]
    );
    const qty = row?.qty ?? 0;
    this._cache.set(productId, qty);
    return qty;
  }

  /** Checks whether stock is sufficient. Respects track_stock flag. */
  async isSufficient(productId: string, requiredMilli: number, trackStock: boolean): Promise<boolean> {
    if (!trackStock) return true;
    const onHand = await this.getOnHand(productId);
    return onHand >= requiredMilli;
  }

  async insert(m: NewStockMovement): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO stock_movements
         (id, product_id, movement_type, quantity_delta_milli,
          reference_id, reference_type, note)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        m.id, m.product_id, m.movement_type, m.quantity_delta_milli,
        m.reference_id ?? null, m.reference_type ?? null, m.note ?? null,
      ]
    );
    // Invalidate cache for this product.
    this._cache.delete(m.product_id);
  }

  async getHistory(productId: string, limit = 50): Promise<StockMovement[]> {
    return this.db.getAllAsync<StockMovement>(
      `SELECT * FROM stock_movements WHERE product_id = ? ORDER BY created_at DESC LIMIT ?`,
      [productId, limit]
    );
  }

  async findRecentMovements(limit = 100): Promise<Array<StockMovement & { product_name: string; unit: string }>> {
    return this.db.getAllAsync<StockMovement & { product_name: string; unit: string }>(
      `SELECT sm.*, p.name AS product_name, p.unit
         FROM stock_movements sm
         JOIN products p ON p.id = sm.product_id
        ORDER BY sm.created_at DESC, sm.id DESC
        LIMIT ?`,
      [limit]
    );
  }

  /** Called at the start of a new session to clear stale cache entries. */
  clearCache(): void {
    this._cache.clear();
  }
}
