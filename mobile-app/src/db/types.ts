/**
 * Shared TypeScript types for the SmartPOS local database layer.
 *
 * MONEY  : _cents  → INTEGER minor units  (Rs. 1.00 = 100)
 * QUANTITY: _milli → INTEGER milli-units  (1 unit = 1000; 1.5 kg = 1500)
 * IDs    : UUID v4 strings via expo-crypto (see src/db/id.ts)
 * version: INTEGER starting at 1; incremented on every UPDATE in repositories.
 *          Used for optimistic concurrency checks and future sync conflict detection.
 * sync_status: 'pending' | 'synced' | 'conflict' — v1 no-op; consumed by v2 sync engine.
 */

export type SyncStatus = 'pending' | 'synced' | 'conflict';

export type MovementType =
  | 'initial_stock'
  | 'purchase_received'
  | 'sale'
  | 'sale_refund'
  | 'adjustment_add'
  | 'adjustment_remove'
  | 'wastage';

export type SaleStatus =
  | 'open'
  | 'completed'
  | 'refunded'
  | 'partially_refunded'
  | 'cancelled'
  | 'void';

export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'other';

// ── Entities ─────────────────────────────────────────────────────────────────

export interface Setting {
  key: string;
  value: string;
  version: number;
  updated_at: string;
  sync_status: SyncStatus;
}

export interface Category {
  id: string;
  name: string;
  color: string | null;
  sort_order: number;
  version: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
}

export interface Product {
  id: string;
  category_id: string | null;
  name: string;
  name_en?: string | null;
  name_si?: string | null;
  sku: string | null;
  barcode: string | null;
  description: string | null;
  unit: string;
  price_cents: number;
  cost_cents: number;
  image_uri: string | null;
  track_stock: number;
  low_stock_threshold_milli: number;
  version: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
}

/** Immutable ledger — INSERT only, never UPDATE. No version column needed. */
export interface StockMovement {
  id: string;
  product_id: string;
  movement_type: MovementType;
  quantity_delta_milli: number;
  reference_id: string | null;
  reference_type: string | null;
  note: string | null;
  created_at: string;
  sync_status: SyncStatus;
}

/** Immutable after status = completed. Refund = new inverse Sale. */
export interface Sale {
  id: string;
  invoice_number: string;
  status: SaleStatus;
  subtotal_cents: number;
  discount_cents: number;
  tax_cents: number;
  total_cents: number;
  paid_cents: number;
  change_cents: number;
  note: string | null;
  version: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
}

/** Immutable after insertion. Product fields are point-in-time snapshots. */
export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  product_name: string;
  product_sku: string | null;
  quantity_milli: number;
  unit_price_cents: number;
  unit_cost_cents?: number;
  discount_cents: number;
  line_total_cents: number;
  created_at: string;
}

export interface Payment {
  id: string;
  sale_id: string;
  method: PaymentMethod;
  amount_cents: number;
  reference: string | null;
  created_at: string;
  sync_status: SyncStatus;
}

// ── Insert / Update DTOs ──────────────────────────────────────────────────────

export type NewCategory     = Omit<Category,  'created_at' | 'updated_at' | 'sync_status' | 'version'>;
export type NewProduct      = Omit<Product,   'created_at' | 'updated_at' | 'sync_status' | 'version'>;
export type NewSale         = Omit<Sale,      'created_at' | 'updated_at' | 'sync_status' | 'version'>;
export type NewSaleItem     = Omit<SaleItem,  'created_at'>;
export type NewPayment      = Omit<Payment,   'created_at' | 'sync_status'>;
export type NewStockMovement = Omit<StockMovement, 'created_at' | 'sync_status'>;
