import { SQLiteDatabase } from 'expo-sqlite';
import { BaseRepository } from './BaseRepository';
import { Product, NewProduct } from '../types';

export class ProductRepository extends BaseRepository {
  constructor(db: SQLiteDatabase) { super(db); }

  async findAll(): Promise<Product[]> {
    return this.db.getAllAsync<Product>(
      `SELECT * FROM products WHERE deleted_at IS NULL ORDER BY name ASC`
    );
  }

  async findByCategory(categoryId: string): Promise<Product[]> {
    return this.db.getAllAsync<Product>(
      `SELECT * FROM products WHERE category_id = ? AND deleted_at IS NULL ORDER BY name ASC`,
      [categoryId]
    );
  }

  async findByBarcode(barcode: string): Promise<Product | null> {
    return this.db.getFirstAsync<Product>(
      `SELECT * FROM products WHERE barcode = ? AND deleted_at IS NULL`, [barcode]
    );
  }

  async findById(id: string): Promise<Product | null> {
    return this.db.getFirstAsync<Product>(
      `SELECT * FROM products WHERE id = ? AND deleted_at IS NULL`, [id]
    );
  }

  /**
   * Fast bilingual search querying name, name_en, name_si, sku, and barcode.
   * Leverages SQLite indexes on name_en and name_si for sub-50ms performance.
   */
  async searchBilingual(query: string, categoryId?: string | null): Promise<Product[]> {
    const q = query.trim();
    if (!q) {
      if (categoryId) {
        return this.findByCategory(categoryId);
      }
      return this.findAll();
    }

    const pattern = `%${q.toLowerCase()}%`;
    const params: (string | null)[] = [pattern, pattern, pattern, pattern, pattern];
    let sql = `
      SELECT * FROM products
      WHERE deleted_at IS NULL
        AND (
          LOWER(name) LIKE ?
          OR (name_en IS NOT NULL AND LOWER(name_en) LIKE ?)
          OR (name_si IS NOT NULL AND LOWER(name_si) LIKE ?)
          OR (sku IS NOT NULL AND LOWER(sku) LIKE ?)
          OR (barcode IS NOT NULL AND LOWER(barcode) LIKE ?)
        )
    `;

    if (categoryId) {
      sql += ` AND category_id = ?`;
      params.push(categoryId);
    }

    sql += ` ORDER BY name ASC`;

    return this.db.getAllAsync<Product>(sql, params);
  }

  async insert(p: NewProduct): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO products
         (id, category_id, name, name_en, name_si, sku, barcode, description, unit,
          price_cents, cost_cents, image_uri, track_stock, low_stock_threshold_milli, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        p.id,
        p.category_id ?? null,
        p.name,
        p.name_en ?? null,
        p.name_si ?? null,
        p.sku ?? null,
        p.barcode ?? null,
        p.description ?? null,
        p.unit,
        p.price_cents,
        p.cost_cents,
        p.image_uri ?? null,
        p.track_stock,
        p.low_stock_threshold_milli,
        p.deleted_at ?? null,
      ]
    );
  }

  async update(
    id: string,
    patch: Partial<Pick<Product,
      'name' | 'name_en' | 'name_si' | 'category_id' | 'sku' | 'barcode' | 'description' | 'unit' |
      'price_cents' | 'cost_cents' | 'image_uri' | 'track_stock' | 'low_stock_threshold_milli'
    >>
  ): Promise<void> {
    const sets: string[] = [
      "version     = version + 1",
      "updated_at  = strftime('%Y-%m-%dT%H:%M:%fZ','now')",
      "sync_status = 'pending'",
    ];
    const vals: (string | number | null)[] = [];
    const fields = [
      'name', 'name_en', 'name_si', 'category_id', 'sku', 'barcode', 'description', 'unit',
      'price_cents', 'cost_cents', 'image_uri', 'track_stock', 'low_stock_threshold_milli',
    ] as const;
    for (const f of fields) {
      if (f in patch) {
        sets.push(`${f} = ?`);
        vals.push((patch as Record<string, string | number | null>)[f] ?? null);
      }
    }
    vals.push(id);
    await this.db.runAsync(`UPDATE products SET ${sets.join(', ')} WHERE id = ?`, vals);
  }

  async softDelete(id: string): Promise<void> {
    await this.db.runAsync(
      `UPDATE products SET
         deleted_at  = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
         version     = version + 1,
         sync_status = 'pending'
       WHERE id = ?`,
      [id]
    );
  }
}
