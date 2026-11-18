import { SQLiteDatabase } from 'expo-sqlite';

/** Additive schema for store profile and sale item unit costs for profit reporting. */
export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    ALTER TABLE sale_items ADD COLUMN unit_cost_cents INTEGER NOT NULL DEFAULT 0;

    INSERT OR IGNORE INTO settings (key, value) VALUES
      ('store_name',      'TechknowLK Store'),
      ('store_phone',     ''),
      ('store_address',   ''),
      ('receipt_footer',  'Thank you for shopping with us!'),
      ('tax_id',          '');
  `);
}
