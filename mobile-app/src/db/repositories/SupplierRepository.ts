import { SQLiteDatabase } from 'expo-sqlite';
import { BaseRepository } from './BaseRepository';

export interface Supplier { id: string; name: string; phone: string | null; email: string | null; notes: string | null; deleted_at: string | null; }
export interface NewSupplier { id: string; name: string; phone?: string | null; email?: string | null; notes?: string | null; }

export class SupplierRepository extends BaseRepository {
  constructor(db: SQLiteDatabase) { super(db); }
  findAll(): Promise<Supplier[]> {
    return this.db.getAllAsync<Supplier>('SELECT * FROM suppliers WHERE deleted_at IS NULL ORDER BY name');
  }
  findById(id: string): Promise<Supplier | null> {
    return this.db.getFirstAsync<Supplier>('SELECT * FROM suppliers WHERE id = ? AND deleted_at IS NULL', [id]);
  }
  async insert(s: NewSupplier): Promise<void> {
    await this.db.runAsync('INSERT INTO suppliers (id,name,phone,email,notes) VALUES (?,?,?,?,?)', [s.id,s.name,s.phone ?? null,s.email ?? null,s.notes ?? null]);
  }
  async softDelete(id: string): Promise<void> {
    await this.db.runAsync("UPDATE suppliers SET deleted_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'), version=version+1, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'), sync_status='pending' WHERE id=?", [id]);
  }
}
