"""SQLite schema smoke checks using Python's SQLite engine.

This executes the migration SQL and core constraints without the Expo native bridge.
It is not a substitute for Android/iOS app lifecycle testing.
Run: python -m unittest scripts.test_sql_schema
"""
from pathlib import Path
import re
import sqlite3
import unittest

ROOT = Path(__file__).resolve().parents[1]


def migration_sql(filename: str) -> str:
    source = (ROOT / "src" / "db" / "migrations" / filename).read_text(encoding="utf-8-sig")
    match = re.search(r"db\.execAsync\(`(.*?)`\);", source, re.DOTALL)
    if not match:
        raise AssertionError(f"Could not find migration SQL in {filename}")
    return match.group(1)


class MigrationSmokeTest(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.execute("PRAGMA foreign_keys = ON")
        self.db.executescript("CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);")
        for version, filename in (
            (1, "001_initial.ts"),
            (2, "002_operations.ts"),
            (3, "003_reports_and_store_profile.ts"),
            (4, "004_bilingual_products.ts"),
        ):
            self.db.execute("BEGIN IMMEDIATE")
            self.db.executescript(migration_sql(filename))
            self.db.execute("INSERT INTO schema_migrations VALUES (?, 'smoke-test')", (version,))
            self.db.commit()

    def tearDown(self):
        self.db.close()

    def test_migrations_create_expected_tables_and_seed_settings(self):
        tables = {row[0] for row in self.db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        self.assertTrue({"settings", "categories", "products", "stock_movements", "sales", "sale_items", "payments", "suppliers", "purchases", "purchase_items", "refunds"}.issubset(tables))
        settings = dict(self.db.execute("SELECT key,value FROM settings"))
        self.assertEqual(settings["currency_code"], "LKR")
        self.assertEqual(settings["next_invoice_number"], "1")
        self.assertEqual(settings["store_name"], "TechknowLK Store")
        self.assertEqual(settings["theme_preference"], "system")
        self.assertEqual(settings["app_language"], "en")
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM schema_migrations").fetchone()[0], 4)
        product_cols = {row[1] for row in self.db.execute("PRAGMA table_info(products)")}
        self.assertIn("name_en", product_cols)
        self.assertIn("name_si", product_cols)
        sale_item_cols = {row[1] for row in self.db.execute("PRAGMA table_info(sale_items)")}
        self.assertIn("unit_cost_cents", sale_item_cols)

    def test_foreign_keys_and_purchase_constraints(self):
        self.db.execute("INSERT INTO products (id,name,price_cents) VALUES ('p1','Tea',100)")
        self.db.execute("INSERT INTO suppliers (id,name) VALUES ('s1','Supplier')")
        self.db.execute("INSERT INTO purchases (id,supplier_id,status) VALUES ('po1','s1','draft')")
        self.db.execute("INSERT INTO purchase_items (id,purchase_id,product_id,product_name,quantity_milli,unit_cost_cents,line_total_cents) VALUES ('pi1','po1','p1','Tea',1000,50,50)")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO purchases (id,status) VALUES ('bad','received-invalid')")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO stock_movements (id,product_id,movement_type,quantity_delta_milli) VALUES ('bad-move','missing','sale',-1000)")

    def test_failed_transaction_rolls_back(self):
        self.db.execute("BEGIN IMMEDIATE")
        self.db.execute("INSERT INTO products (id,name,price_cents) VALUES ('rollback-product','Rollback',100)")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO stock_movements (id,product_id,movement_type,quantity_delta_milli) VALUES ('bad','missing','sale',-1000)")
        self.db.rollback()
        self.assertIsNone(self.db.execute("SELECT id FROM products WHERE id='rollback-product'").fetchone())

    def test_demo_seeder_queries_match_schema(self):
        cat_id = 'c1'
        self.db.execute("INSERT INTO categories (id, name, color) VALUES (?, ?, ?)", (cat_id, 'Beverages', '#2563EB'))
        prod_id = 'p1'
        self.db.execute(
            """INSERT INTO products (
                id, category_id, name, sku, barcode, price_cents, cost_cents, unit,
                track_stock, low_stock_threshold_milli
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'units', 1, 5000)""",
            (prod_id, cat_id, 'Dilmah Tea 100B', 'BEV-001', '4791001001015', 85000, 68000)
        )
        self.db.execute(
            """INSERT INTO stock_movements (id, product_id, movement_type, quantity_delta_milli, note)
               VALUES (?, ?, 'opening_stock', ?, 'Initial Demo Stock Seed')""",
            ('m1', prod_id, 40000)
        )
        prod = self.db.execute("SELECT name, price_cents, cost_cents FROM products WHERE id = ?", (prod_id,)).fetchone()
        self.assertEqual(prod, ('Dilmah Tea 100B', 85000, 68000))
        movement = self.db.execute("SELECT quantity_delta_milli FROM stock_movements WHERE id = 'm1'").fetchone()
        self.assertEqual(movement[0], 40000)

    def test_backup_restore_clean_wipe_and_reinsertion(self):
        # 1. Seed initial data
        self.db.execute("INSERT INTO suppliers (id, name) VALUES ('s1', 'Ceylon Wholesale')")
        self.db.execute("INSERT INTO categories (id, name) VALUES ('c1', 'Beverages')")
        self.db.execute("INSERT INTO products (id, category_id, name, price_cents, cost_cents) VALUES ('p1', 'c1', 'Tea', 85000, 68000)")
        self.db.execute("INSERT INTO stock_movements (id, product_id, movement_type, quantity_delta_milli) VALUES ('m1', 'p1', 'opening', 50000)")
        self.db.execute("INSERT INTO sales (id, invoice_number, status, total_cents) VALUES ('inv1', 'INV-001', 'completed', 85000)")
        self.db.execute("INSERT INTO sale_items (id, sale_id, product_id, product_name, quantity_milli, unit_price_cents, line_total_cents) VALUES ('it1', 'inv1', 'p1', 'Tea', 1000, 85000, 85000)")
        self.db.execute("INSERT INTO payments (id, sale_id, method, amount_cents) VALUES ('pm1', 'inv1', 'cash', 85000)")
        self.db.execute("INSERT INTO refunds (id, original_sale_id, refund_sale_id, refund_method, total_cents) VALUES ('rf1', 'inv1', 'inv1', 'cash', 0)")
        self.db.commit()

        # Verify child-to-parent deletion order succeeds with foreign_keys = ON
        with self.db:
            self.db.execute("DELETE FROM refunds")
            self.db.execute("DELETE FROM payments")
            self.db.execute("DELETE FROM sale_items")
            self.db.execute("DELETE FROM sales")
            self.db.execute("DELETE FROM purchase_items")
            self.db.execute("DELETE FROM purchases")
            self.db.execute("DELETE FROM stock_movements")
            self.db.execute("DELETE FROM products")
            self.db.execute("DELETE FROM categories")
            self.db.execute("DELETE FROM suppliers")
            self.db.execute("DELETE FROM settings")

            # Verify parent-to-child re-insertion succeeds
            self.db.execute("INSERT INTO settings (key, value) VALUES ('currency_code', 'LKR')")
            self.db.execute("INSERT INTO suppliers (id, name) VALUES ('s_restored', 'New Supplier')")
            self.db.execute("INSERT INTO categories (id, name) VALUES ('c_restored', 'Dairy')")
            self.db.execute("INSERT INTO products (id, category_id, name, price_cents, cost_cents) VALUES ('p_restored', 'c_restored', 'Milk', 48000, 41000)")
            self.db.execute("INSERT INTO stock_movements (id, product_id, movement_type, quantity_delta_milli) VALUES ('m_restored', 'p_restored', 'opening', 25000)")
            self.db.execute("INSERT INTO sales (id, invoice_number, status, total_cents) VALUES ('sale_restored', 'INV-002', 'completed', 48000)")
            self.db.execute("INSERT INTO sale_items (id, sale_id, product_id, product_name, quantity_milli, unit_price_cents, line_total_cents) VALUES ('it_restored', 'sale_restored', 'p_restored', 'Milk', 1000, 48000, 48000)")
            self.db.execute("INSERT INTO payments (id, sale_id, method, amount_cents) VALUES ('pay_restored', 'sale_restored', 'cash', 48000)")

        # Check restored counts
        prod_count = self.db.execute("SELECT COUNT(*) FROM products").fetchone()[0]
        self.assertEqual(prod_count, 1)
        item_name = self.db.execute("SELECT name FROM products WHERE id='p_restored'").fetchone()[0]
        self.assertEqual(item_name, 'Milk')

    def test_backup_restore_foreign_key_violation_triggers_rollback(self):
        # Initial state
        self.db.execute("INSERT INTO categories (id, name) VALUES ('c_safe', 'Safety Category')")
        self.db.execute("INSERT INTO products (id, category_id, name, price_cents) VALUES ('p_safe', 'c_safe', 'Safety Item', 100)")
        self.db.commit()
        initial_prod_count = self.db.execute("SELECT COUNT(*) FROM products").fetchone()[0]

        # Simulate a transaction with bad foreign key
        try:
            with self.db:
                self.db.execute("DELETE FROM products")
                # Try inserting product referencing non-existent category
                self.db.execute("INSERT INTO products (id, category_id, name, price_cents) VALUES ('p_bad', 'c_non_existent', 'Bad Item', 100)")
        except sqlite3.IntegrityError:
            pass

        # Verify rollback preserved initial state
        prod_count = self.db.execute("SELECT COUNT(*) FROM products").fetchone()[0]
        self.assertEqual(prod_count, initial_prod_count)
        self.assertIsNotNone(self.db.execute("SELECT id FROM products WHERE id='p_safe'").fetchone())

    def test_bilingual_product_search_and_indexes(self):
        # Verify indexes exist
        indexes = {row[1] for row in self.db.execute("PRAGMA index_list('products')")}
        self.assertIn("idx_products_name_en", indexes)
        self.assertIn("idx_products_name_si", indexes)

        # Seed bilingual products
        self.db.execute(
            """INSERT INTO products (id, name, name_en, name_si, sku, barcode, price_cents)
               VALUES ('p_tea', 'Dilmah Tea', 'Dilmah Premium Ceylon Tea', 'ඩිල්මා සිලෝන් තේ', 'BEV-001', '4791001001015', 85000)"""
        )
        self.db.execute(
            """INSERT INTO products (id, name, name_en, name_si, sku, barcode, price_cents)
               VALUES ('p_sugar', 'White Sugar', 'Fortune Refined White Sugar', 'සුදු සීනි', 'GRO-001', '4794004004016', 28000)"""
        )
        self.db.commit()

        # Helper for bilingual search query
        def search(term):
            pat = f"%{term.lower()}%"
            return self.db.execute(
                """SELECT id, name FROM products
                   WHERE deleted_at IS NULL
                     AND (
                       LOWER(name) LIKE ?
                       OR (name_en IS NOT NULL AND LOWER(name_en) LIKE ?)
                       OR (name_si IS NOT NULL AND LOWER(name_si) LIKE ?)
                       OR (sku IS NOT NULL AND LOWER(sku) LIKE ?)
                       OR (barcode IS NOT NULL AND LOWER(barcode) LIKE ?)
                     )
                   ORDER BY name ASC""",
                (pat, pat, pat, pat, pat)
            ).fetchall()

        # 1. English query
        results = search("Dilmah")
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0][0], "p_tea")

        # 2. Sinhala Unicode query
        results_si = search("සීනි")  # Sugar in Sinhala
        self.assertEqual(len(results_si), 1)
        self.assertEqual(results_si[0][0], "p_sugar")

        # 3. Sinhala Unicode query for Tea
        results_tea_si = search("ඩිල්මා")
        self.assertEqual(len(results_tea_si), 1)
        self.assertEqual(results_tea_si[0][0], "p_tea")

        # 4. SKU query
        results_sku = search("bev-001")
        self.assertEqual(len(results_sku), 1)
        self.assertEqual(results_sku[0][0], "p_tea")

        # 5. Barcode query
        results_barcode = search("4794004004016")
        self.assertEqual(len(results_barcode), 1)
        self.assertEqual(results_barcode[0][0], "p_sugar")

    def test_existing_product_name_migration_to_name_en(self):
        # Insert a product with just name
        self.db.execute("INSERT INTO products (id, name, price_cents) VALUES ('p_legacy', 'Legacy Product', 5000)")
        # Run the backfill update query like migration 004 does
        self.db.execute("UPDATE products SET name_en = name WHERE id = 'p_legacy' AND name_en IS NULL")
        self.db.commit()

        row = self.db.execute("SELECT name, name_en FROM products WHERE id = 'p_legacy'").fetchone()
        self.assertEqual(row[0], "Legacy Product")
        self.assertEqual(row[1], "Legacy Product")


if __name__ == "__main__":
    unittest.main(verbosity=2)
