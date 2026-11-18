import { SQLiteDatabase } from 'expo-sqlite';
import { withDatabaseLock } from '../connection';

/** Shared connection proxy serializes individual repository calls with transactions. */
export abstract class BaseRepository {
  protected readonly db: SQLiteDatabase;

  protected constructor(db: SQLiteDatabase) {
    this.db = new Proxy(db, {
      get(target, property, receiver) {
        const value = Reflect.get(target, property, receiver);
        if (typeof value !== 'function') return value;
        return (...args: unknown[]) => withDatabaseLock(() => value.apply(target, args));
      },
    });
  }
}
