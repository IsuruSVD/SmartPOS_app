import { SQLiteDatabase } from 'expo-sqlite';
import { BaseRepository } from './BaseRepository';
import { Setting } from '../types';

export class SettingsRepository extends BaseRepository {
  constructor(db: SQLiteDatabase) { super(db); }

  async get(key: string): Promise<string | null> {
    const row = await this.db.getFirstAsync<Setting>(
      'SELECT value FROM settings WHERE key = ?', [key]
    );
    return row?.value ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO settings (key, value, version, updated_at, sync_status)
       VALUES (?, ?, 1, strftime('%Y-%m-%dT%H:%M:%fZ','now'), 'pending')
       ON CONFLICT(key) DO UPDATE SET
         value       = excluded.value,
         version     = version + 1,
         updated_at  = excluded.updated_at,
         sync_status = 'pending'`,
      [key, value]
    );
  }

  async getAll(): Promise<Setting[]> {
    return this.db.getAllAsync<Setting>('SELECT * FROM settings');
  }
}
