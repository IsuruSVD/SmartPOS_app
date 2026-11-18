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
        for version, filename in ((1, "001_initial.ts"), (2, "002_operations.ts"), (3, "003_reports_and_store_profile.ts")):
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
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM schema_migrations").fetchone()[0], 3)
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


if __name__ == "__main__":
    unittest.main(verbosity=2)
