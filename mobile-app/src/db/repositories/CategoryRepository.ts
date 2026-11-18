import { SQLiteDatabase } from 'expo-sqlite';
import { BaseRepository } from './BaseRepository';
import { Category, NewCategory } from '../types';

export class CategoryRepository extends BaseRepository {
  constructor(db: SQLiteDatabase) { super(db); }

  async findAll(): Promise<Category[]> {
    return this.db.getAllAsync<Category>(
      `SELECT * FROM categories WHERE deleted_at IS NULL ORDER BY sort_order ASC, name ASC`
    );
  }

  async findById(id: string): Promise<Category | null> {
    return this.db.getFirstAsync<Category>(
      `SELECT * FROM categories WHERE id = ? AND deleted_at IS NULL`, [id]
    );
  }

  async insert(c: NewCategory): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO categories (id, name, color, sort_order, deleted_at)
       VALUES (?, ?, ?, ?, ?)`,
      [c.id, c.name, c.color ?? null, c.sort_order, c.deleted_at ?? null]
    );
  }

  async update(id: string, patch: Partial<Pick<Category, 'name' | 'color' | 'sort_order'>>): Promise<void> {
    const sets: string[] = [
      "version     = version + 1",
      "updated_at  = strftime('%Y-%m-%dT%H:%M:%fZ','now')",
      "sync_status = 'pending'",
    ];
    const vals: (string | number | null)[] = [];
    if (patch.name       !== undefined) { sets.push('name = ?');       vals.push(patch.name); }
    if (patch.color      !== undefined) { sets.push('color = ?');      vals.push(patch.color); }
    if (patch.sort_order !== undefined) { sets.push('sort_order = ?'); vals.push(patch.sort_order); }
    vals.push(id);
    await this.db.runAsync(`UPDATE categories SET ${sets.join(', ')} WHERE id = ?`, vals);
  }

  async softDelete(id: string): Promise<void> {
    await this.db.runAsync(
      `UPDATE categories SET
         deleted_at  = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
         version     = version + 1,
         sync_status = 'pending'
       WHERE id = ?`,
      [id]
    );
  }
}
