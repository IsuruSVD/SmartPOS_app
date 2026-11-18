import { SQLiteDatabase } from 'expo-sqlite';

/**
 * Migration 001 — Initial schema.
 *
 * CONVENTIONS
 *   _cents   : INTEGER minor units (e.g. Rs. 1.00 = 100). Never REAL.
 *   _milli   : INTEGER milli-units (1 unit = 1000; 1.5 kg = 1500). Never REAL.
 *   id       : TEXT UUID v4 (via expo-crypto.randomUUID)
 *   version  : INTEGER starting at 1, incremented on every UPDATE — used for
 *              optimistic concurrency and future sync conflict detection.
 *   sync_status : TEXT 'pending'|'synced'|'conflict' — v1 no-op sync stub.
 */
export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    -- ── settings ─────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS settings (
      key         TEXT    PRIMARY KEY,
      value       TEXT    NOT NULL,
      version     INTEGER NOT NULL DEFAULT 1,
      updated_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      sync_status TEXT    NOT NULL DEFAULT 'pending'
    );

    -- ── categories ───────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS categories (
      id          TEXT    PRIMARY KEY,
      name        TEXT    NOT NULL,
      color       TEXT,
      sort_order  INTEGER NOT NULL DEFAULT 0,
      version     INTEGER NOT NULL DEFAULT 1,
      deleted_at  TEXT,
      created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      sync_status TEXT    NOT NULL DEFAULT 'pending'
    );

    -- ── products ─────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS products (
      id                        TEXT    PRIMARY KEY,
      category_id               TEXT    REFERENCES categories(id),
      name                      TEXT    NOT NULL,
      sku                       TEXT    UNIQUE,
      barcode                   TEXT,
      description               TEXT,
      unit                      TEXT    NOT NULL DEFAULT 'pcs',
      price_cents               INTEGER NOT NULL,
      cost_cents                INTEGER NOT NULL DEFAULT 0,
      image_uri                 TEXT,
      track_stock               INTEGER NOT NULL DEFAULT 1,
      low_stock_threshold_milli INTEGER NOT NULL DEFAULT 5000,
      version                   INTEGER NOT NULL DEFAULT 1,
      deleted_at                TEXT,
      created_at                TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at                TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      sync_status               TEXT    NOT NULL DEFAULT 'pending'
    );

    CREATE INDEX IF NOT EXISTS idx_products_category
      ON products(category_id) WHERE deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_products_barcode
      ON products(barcode) WHERE barcode IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_products_sku
      ON products(sku) WHERE sku IS NOT NULL;

    -- ── stock_movements  (immutable ledger — INSERT only, never UPDATE) ──
    CREATE TABLE IF NOT EXISTS stock_movements (
      id                   TEXT    PRIMARY KEY,
      product_id           TEXT    NOT NULL REFERENCES products(id),
      movement_type        TEXT    NOT NULL,
      quantity_delta_milli INTEGER NOT NULL,
      reference_id         TEXT,
      reference_type       TEXT,
      note                 TEXT,
      created_at           TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      sync_status          TEXT    NOT NULL DEFAULT 'pending'
    );

    CREATE INDEX IF NOT EXISTS idx_stock_product
      ON stock_movements(product_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_stock_reference
      ON stock_movements(reference_id, reference_type);

    -- ── sales ─────────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS sales (
      id              TEXT    PRIMARY KEY,
      invoice_number  TEXT    UNIQUE NOT NULL,
      status          TEXT    NOT NULL DEFAULT 'open',
      subtotal_cents  INTEGER NOT NULL DEFAULT 0,
      discount_cents  INTEGER NOT NULL DEFAULT 0,
      tax_cents       INTEGER NOT NULL DEFAULT 0,
      total_cents     INTEGER NOT NULL DEFAULT 0,
      paid_cents      INTEGER NOT NULL DEFAULT 0,
      change_cents    INTEGER NOT NULL DEFAULT 0,
      note            TEXT,
      version         INTEGER NOT NULL DEFAULT 1,
      completed_at    TEXT,
      created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      sync_status     TEXT    NOT NULL DEFAULT 'pending'
    );

    CREATE INDEX IF NOT EXISTS idx_sales_status
      ON sales(status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_sales_completed
      ON sales(completed_at DESC) WHERE status = 'completed';

    -- ── sale_items (immutable after sale completion) ───────────────────────
    CREATE TABLE IF NOT EXISTS sale_items (
      id                TEXT    PRIMARY KEY,
      sale_id           TEXT    NOT NULL REFERENCES sales(id),
      product_id        TEXT    NOT NULL REFERENCES products(id),
      product_name      TEXT    NOT NULL,
      product_sku       TEXT,
      quantity_milli    INTEGER NOT NULL,
      unit_price_cents  INTEGER NOT NULL,
      discount_cents    INTEGER NOT NULL DEFAULT 0,
      line_total_cents  INTEGER NOT NULL,
      created_at        TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE INDEX IF NOT EXISTS idx_sale_items_sale
      ON sale_items(sale_id);

    -- ── payments ─────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS payments (
      id           TEXT    PRIMARY KEY,
      sale_id      TEXT    NOT NULL REFERENCES sales(id),
      method       TEXT    NOT NULL,
      amount_cents INTEGER NOT NULL,
      reference    TEXT,
      created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      sync_status  TEXT    NOT NULL DEFAULT 'pending'
    );

    CREATE INDEX IF NOT EXISTS idx_payments_sale
      ON payments(sale_id);

    -- ── default settings seed ─────────────────────────────────────────────
    INSERT OR IGNORE INTO settings (key, value) VALUES
      ('currency_code',       'LKR'),
      ('currency_symbol',     'Rs.'),
      ('next_invoice_number', '1'),
      ('invoice_prefix',      'INV'),
      ('tax_rate_bps',        '0'),
      ('tax_inclusive',       '1'),
      ('timezone',            'Asia/Colombo');
  `);
}
