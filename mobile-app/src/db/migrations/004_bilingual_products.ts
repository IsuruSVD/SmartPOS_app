import { SQLiteDatabase } from 'expo-sqlite';

/**
 * Migration 004 — Bilingual Product Names (English & Sinhala) and Unicode Search Indexes.
 *
 * Adds name_en and name_si columns to products table.
 * Migrates existing product names into name_en to preserve existing records.
 * Creates dedicated indexes for fast bilingual searching across 1,000+ catalog items.
 */
export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    ALTER TABLE products ADD COLUMN name_en TEXT;
    ALTER TABLE products ADD COLUMN name_si TEXT;

    UPDATE products SET name_en = name WHERE name_en IS NULL;

    CREATE INDEX IF NOT EXISTS idx_products_name_en ON products(name_en) WHERE deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_products_name_si ON products(name_si) WHERE deleted_at IS NULL;

    INSERT OR IGNORE INTO settings (key, value) VALUES
      ('theme_preference', 'system'),
      ('app_language',     'en');
  `);
}
