import { SQLiteDatabase } from 'expo-sqlite';

/** Additive operational tables for suppliers, purchasing and refunds. */
export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      notes TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      deleted_at TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      sync_status TEXT NOT NULL DEFAULT 'pending'
    );
    CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name) WHERE deleted_at IS NULL;

    CREATE TABLE IF NOT EXISTS purchases (
      id TEXT PRIMARY KEY,
      supplier_id TEXT REFERENCES suppliers(id),
      reference_no TEXT,
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','received','cancelled')),
      total_cents INTEGER NOT NULL DEFAULT 0,
      note TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      received_at TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      sync_status TEXT NOT NULL DEFAULT 'pending'
    );
    CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON purchases(supplier_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS purchase_items (
      id TEXT PRIMARY KEY,
      purchase_id TEXT NOT NULL REFERENCES purchases(id),
      product_id TEXT NOT NULL REFERENCES products(id),
      product_name TEXT NOT NULL,
      quantity_milli INTEGER NOT NULL CHECK(quantity_milli > 0),
      unit_cost_cents INTEGER NOT NULL CHECK(unit_cost_cents >= 0),
      line_total_cents INTEGER NOT NULL CHECK(line_total_cents >= 0),
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON purchase_items(purchase_id);

    CREATE TABLE IF NOT EXISTS refunds (
      id TEXT PRIMARY KEY,
      original_sale_id TEXT NOT NULL REFERENCES sales(id),
      refund_sale_id TEXT NOT NULL UNIQUE REFERENCES sales(id),
      reason TEXT,
      refund_method TEXT NOT NULL,
      total_cents INTEGER NOT NULL CHECK(total_cents >= 0),
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      sync_status TEXT NOT NULL DEFAULT 'pending'
    );
    CREATE INDEX IF NOT EXISTS idx_refunds_original_sale ON refunds(original_sale_id, created_at DESC);
  `);
}
