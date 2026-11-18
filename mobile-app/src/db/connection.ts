import * as SQLite from 'expo-sqlite';

/**
 * Promise-memoised database handle.
 *
 * Storing the Promise (not the resolved value) means that concurrent callers
 * that arrive before the first open completes all await the same Promise and
 * receive the same instance — no second connection is ever opened, even under
 * React Strict Mode double-invocation or concurrent module initialisation.
 */
let _dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
let operationTail: Promise<void> = Promise.resolve();

/** FIFO gate shared by repository calls and whole transactions. */
export function withDatabaseLock<T>(operation: () => Promise<T>): Promise<T> {
  const result = operationTail.then(operation, operation);
  operationTail = result.then(() => undefined, () => undefined);
  return result;
}

async function openAndInit(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync('smartpos.db');
  // Write-Ahead Logging: improves concurrent read throughput.
  await db.execAsync('PRAGMA journal_mode = WAL;');
  // Foreign key enforcement must be set on this specific connection.
  // withExclusiveTransactionAsync opens a NEW connection and does NOT
  // inherit this PRAGMA — that is why we use runTransaction() everywhere.
  await db.execAsync('PRAGMA foreign_keys = ON;');
  return db;
}

/**
 * Returns the shared SQLiteDatabase instance (singleton, promise-memoised).
 * Safe to call concurrently and repeatedly — always returns the same DB handle.
 */
export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!_dbPromise) {
    _dbPromise = openAndInit();
  }
  return _dbPromise;
}

/**
 * Runs `fn` inside a BEGIN IMMEDIATE transaction on the shared connection.
 *
 * BEGIN IMMEDIATE acquires the write lock before executing any statement,
 * preventing interleaving writes from other async chains on the same
 * connection. All PRAGMAs (including foreign_keys = ON) carry through
 * because we reuse the shared connection — not withExclusiveTransactionAsync,
 * which would open a fresh connection and lose the PRAGMA.
 *
 * On any error, the transaction is rolled back and the error re-thrown.
 */
export async function runTransaction<T>(
  db: SQLite.SQLiteDatabase,
  fn: (db: SQLite.SQLiteDatabase) => Promise<T>
): Promise<T> {
  return withDatabaseLock(async () => {
    await db.execAsync('BEGIN IMMEDIATE');
    try {
      const result = await fn(db);
      await db.execAsync('COMMIT');
      return result;
    } catch (err) {
      try { await db.execAsync('ROLLBACK'); } catch { /* suppress rollback errors */ }
      throw err;
    }
  });
}

/** For testing only — clears the singleton so a fresh DB can be opened. */
export function _resetDatabaseForTest(): void {
  _dbPromise = null;
}

