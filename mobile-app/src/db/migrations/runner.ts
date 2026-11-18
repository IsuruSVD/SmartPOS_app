import { SQLiteDatabase } from 'expo-sqlite';
import { runTransaction } from '../connection';
import { up as migration001 } from './001_initial';
import { up as migration002 } from './002_operations';
import { up as migration003 } from './003_reports_and_store_profile';

interface Migration {
  version: number;
  up: (db: SQLiteDatabase) => Promise<void>;
}

const ALL_MIGRATIONS: Migration[] = [
  { version: 1, up: migration001 },
  { version: 2, up: migration002 },
  { version: 3, up: migration003 },
  // Append future migrations here — never reorder or remove existing entries.
];

/**
 * Runs every pending migration, each in its own BEGIN IMMEDIATE transaction.
 *
 * Safe contract:
 *   - Idempotent: already-applied versions are skipped.
 *   - Serialised: caller must pass the shared connection; do not call
 *     concurrently (DatabaseService.init() is itself promise-memoised).
 *   - FK-safe: runs on the shared connection so PRAGMA foreign_keys = ON
 *     is active throughout.
 *   - schema_migrations DDL is outside a transaction (SQLite auto-commits
 *     CREATE TABLE IF NOT EXISTS when no explicit transaction is open).
 */
export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const rows = await db.getAllAsync<{ version: number }>(
    'SELECT version FROM schema_migrations ORDER BY version ASC'
  );
  const applied = new Set(rows.map((r) => r.version));
  const pending = ALL_MIGRATIONS.filter((m) => !applied.has(m.version));

  for (const migration of pending) {
    await runTransaction(db, async (tx) => {
      await migration.up(tx);
      await tx.runAsync(
        'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)',
        [migration.version, new Date().toISOString()]
      );
    });
  }
}
