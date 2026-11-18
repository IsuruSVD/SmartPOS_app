import type { SQLiteDatabase } from 'expo-sqlite';

export interface BackupData {
  version: string;
  exported_at: string;
  data: {
    settings?: any[];
    categories?: any[];
    products?: any[];
    stock_movements?: any[];
    sales?: any[];
    sale_items?: any[];
    payments?: any[];
    suppliers?: any[];
    purchases?: any[];
    purchase_items?: any[];
    refunds?: any[];
  };
}

export interface BackupValidationResult {
  valid: boolean;
  error?: string;
  counts?: {
    settings: number;
    categories: number;
    products: number;
    stock_movements: number;
    sales: number;
    sale_items: number;
    payments: number;
    suppliers: number;
    purchases: number;
    purchase_items: number;
    refunds: number;
  };
  exportedAt?: string;
  version?: string;
}

export interface BackupRestoreResult {
  success: boolean;
  restoredAt: string;
  counts: {
    settings: number;
    categories: number;
    products: number;
    stockMovements: number;
    sales: number;
    saleItems: number;
    payments: number;
    suppliers: number;
    purchases: number;
    refunds: number;
  };
}

export class BackupRestoreService {
  constructor(private readonly db: SQLiteDatabase) {}

  /**
   * Validates schema, version compatibility, and relational foreign-key integrity of raw JSON backup.
   */
  validateBackup(rawJson: string): BackupValidationResult {
    let parsed: any;
    try {
      parsed = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;
    } catch {
      return { valid: false, error: 'Invalid JSON format: Unable to parse backup content.' };
    }

    if (!parsed || typeof parsed !== 'object') {
      return { valid: false, error: 'Invalid backup structure: Root must be a JSON object.' };
    }

    if (typeof parsed.version !== 'string' || !parsed.version.startsWith('1.')) {
      return {
        valid: false,
        error: `Incompatible backup version "${parsed.version ?? 'unknown'}". Supported version range is 1.x.`,
      };
    }

    if (!parsed.data || typeof parsed.data !== 'object') {
      return { valid: false, error: 'Corrupt backup: Missing "data" payload object.' };
    }

    const d = parsed.data;
    const settings = Array.isArray(d.settings) ? d.settings : [];
    const categories = Array.isArray(d.categories) ? d.categories : [];
    const products = Array.isArray(d.products) ? d.products : [];
    const stock_movements = Array.isArray(d.stock_movements) ? d.stock_movements : [];
    const sales = Array.isArray(d.sales) ? d.sales : [];
    const sale_items = Array.isArray(d.sale_items) ? d.sale_items : [];
    const payments = Array.isArray(d.payments) ? d.payments : [];
    const suppliers = Array.isArray(d.suppliers) ? d.suppliers : [];
    const purchases = Array.isArray(d.purchases) ? d.purchases : [];
    const purchase_items = Array.isArray(d.purchase_items) ? d.purchase_items : [];
    const refunds = Array.isArray(d.refunds) ? d.refunds : [];

    // Collect ID lookup sets for FK integrity validation
    const categoryIds = new Set<string>(categories.map((c: any) => c.id).filter(Boolean));
    const productIds = new Set<string>(products.map((p: any) => p.id).filter(Boolean));
    const saleIds = new Set<string>(sales.map((s: any) => s.id).filter(Boolean));
    const supplierIds = new Set<string>(suppliers.map((s: any) => s.id).filter(Boolean));
    const purchaseIds = new Set<string>(purchases.map((p: any) => p.id).filter(Boolean));

    // 1. Products foreign keys
    for (const prod of products) {
      if (!prod.id || typeof prod.name !== 'string') {
        return { valid: false, error: 'Validation failed: Product records must contain an id and name.' };
      }
      if (prod.category_id && !categoryIds.has(prod.category_id)) {
        return {
          valid: false,
          error: `Foreign key mismatch: Product "${prod.name}" references non-existent category_id "${prod.category_id}".`,
        };
      }
    }

    // 2. Stock movements foreign keys
    for (const sm of stock_movements) {
      if (!sm.id || !sm.product_id) {
        return { valid: false, error: 'Validation failed: Stock movement records must contain an id and product_id.' };
      }
      if (!productIds.has(sm.product_id)) {
        return {
          valid: false,
          error: `Foreign key mismatch: Stock movement "${sm.id}" references non-existent product_id "${sm.product_id}".`,
        };
      }
    }

    // 3. Sale items foreign keys
    for (const item of sale_items) {
      if (!item.id || !item.sale_id || !item.product_id) {
        return { valid: false, error: 'Validation failed: Sale item records must contain id, sale_id, and product_id.' };
      }
      if (!saleIds.has(item.sale_id)) {
        return {
          valid: false,
          error: `Foreign key mismatch: Sale item "${item.id}" references non-existent sale_id "${item.sale_id}".`,
        };
      }
      if (!productIds.has(item.product_id)) {
        return {
          valid: false,
          error: `Foreign key mismatch: Sale item "${item.id}" references non-existent product_id "${item.product_id}".`,
        };
      }
    }

    // 4. Payments foreign keys
    for (const p of payments) {
      if (!p.id || !p.sale_id) {
        return { valid: false, error: 'Validation failed: Payment records must contain an id and sale_id.' };
      }
      if (!saleIds.has(p.sale_id)) {
        return {
          valid: false,
          error: `Foreign key mismatch: Payment "${p.id}" references non-existent sale_id "${p.sale_id}".`,
        };
      }
    }

    // 5. Purchases foreign keys
    for (const po of purchases) {
      if (po.supplier_id && !supplierIds.has(po.supplier_id)) {
        return {
          valid: false,
          error: `Foreign key mismatch: Purchase "${po.id}" references non-existent supplier_id "${po.supplier_id}".`,
        };
      }
    }

    // 6. Purchase items foreign keys
    for (const pi of purchase_items) {
      if (pi.purchase_id && !purchaseIds.has(pi.purchase_id)) {
        return {
          valid: false,
          error: `Foreign key mismatch: Purchase item "${pi.id}" references non-existent purchase_id "${pi.purchase_id}".`,
        };
      }
      if (pi.product_id && !productIds.has(pi.product_id)) {
        return {
          valid: false,
          error: `Foreign key mismatch: Purchase item "${pi.id}" references non-existent product_id "${pi.product_id}".`,
        };
      }
    }

    // 7. Refunds foreign keys
    for (const r of refunds) {
      if (!r.original_sale_id || !saleIds.has(r.original_sale_id)) {
        return {
          valid: false,
          error: `Foreign key mismatch: Refund "${r.id}" references non-existent original_sale_id "${r.original_sale_id}".`,
        };
      }
      if (r.refund_sale_id && !saleIds.has(r.refund_sale_id)) {
        return {
          valid: false,
          error: `Foreign key mismatch: Refund "${r.id}" references non-existent refund_sale_id "${r.refund_sale_id}".`,
        };
      }
    }

    return {
      valid: true,
      version: parsed.version,
      exportedAt: parsed.exported_at,
      counts: {
        settings: settings.length,
        categories: categories.length,
        products: products.length,
        stock_movements: stock_movements.length,
        sales: sales.length,
        sale_items: sale_items.length,
        payments: payments.length,
        suppliers: suppliers.length,
        purchases: purchases.length,
        purchase_items: purchase_items.length,
        refunds: refunds.length,
      },
    };
  }

  /**
   * Restores database from validated JSON backup within an atomic SQLite transaction.
   * If any statement fails, the transaction is automatically rolled back.
   */
  async restoreBackup(rawJson: string): Promise<BackupRestoreResult> {
    const validation = this.validateBackup(rawJson);
    if (!validation.valid) {
      throw new Error(validation.error || 'Backup validation failed.');
    }

    const parsed: BackupData = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;
    const d = parsed.data;

    const settings = Array.isArray(d.settings) ? d.settings : [];
    const categories = Array.isArray(d.categories) ? d.categories : [];
    const products = Array.isArray(d.products) ? d.products : [];
    const stock_movements = Array.isArray(d.stock_movements) ? d.stock_movements : [];
    const sales = Array.isArray(d.sales) ? d.sales : [];
    const sale_items = Array.isArray(d.sale_items) ? d.sale_items : [];
    const payments = Array.isArray(d.payments) ? d.payments : [];
    const suppliers = Array.isArray(d.suppliers) ? d.suppliers : [];
    const purchases = Array.isArray(d.purchases) ? d.purchases : [];
    const purchase_items = Array.isArray(d.purchase_items) ? d.purchase_items : [];
    const refunds = Array.isArray(d.refunds) ? d.refunds : [];

    await this.db.withExclusiveTransactionAsync(async (txn) => {
      // 1. Wipe existing data in child-to-parent order to respect foreign key constraints
      await txn.runAsync('DELETE FROM refunds');
      await txn.runAsync('DELETE FROM payments');
      await txn.runAsync('DELETE FROM sale_items');
      await txn.runAsync('DELETE FROM sales');
      await txn.runAsync('DELETE FROM purchase_items');
      await txn.runAsync('DELETE FROM purchases');
      await txn.runAsync('DELETE FROM stock_movements');
      await txn.runAsync('DELETE FROM products');
      await txn.runAsync('DELETE FROM categories');
      await txn.runAsync('DELETE FROM suppliers');
      await txn.runAsync('DELETE FROM settings');

      // 2. Insert parent tables first
      // Settings
      for (const s of settings) {
        if (s.key && s.value !== undefined) {
          await txn.runAsync(
            `INSERT INTO settings (key, value, version, updated_at, sync_status)
             VALUES (?, ?, ?, ?, ?)`,
            [
              s.key,
              String(s.value),
              s.version ?? 1,
              s.updated_at ?? new Date().toISOString(),
              s.sync_status ?? 'pending',
            ]
          );
        }
      }

      // Suppliers
      for (const sup of suppliers) {
        await txn.runAsync(
          `INSERT INTO suppliers (id, name, phone, email, notes, version, deleted_at, created_at, updated_at, sync_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            sup.id,
            sup.name,
            sup.phone ?? null,
            sup.email ?? null,
            sup.notes ?? null,
            sup.version ?? 1,
            sup.deleted_at ?? null,
            sup.created_at ?? new Date().toISOString(),
            sup.updated_at ?? new Date().toISOString(),
            sup.sync_status ?? 'pending',
          ]
        );
      }

      // Categories
      for (const cat of categories) {
        await txn.runAsync(
          `INSERT INTO categories (id, name, color, sort_order, version, deleted_at, created_at, updated_at, sync_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            cat.id,
            cat.name,
            cat.color ?? null,
            cat.sort_order ?? 0,
            cat.version ?? 1,
            cat.deleted_at ?? null,
            cat.created_at ?? new Date().toISOString(),
            cat.updated_at ?? new Date().toISOString(),
            cat.sync_status ?? 'pending',
          ]
        );
      }

      // Products
      for (const prod of products) {
        await txn.runAsync(
          `INSERT INTO products (
            id, category_id, name, sku, barcode, description, unit,
            price_cents, cost_cents, image_uri, track_stock, low_stock_threshold_milli,
            version, deleted_at, created_at, updated_at, sync_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            prod.id,
            prod.category_id ?? null,
            prod.name,
            prod.sku ?? null,
            prod.barcode ?? null,
            prod.description ?? null,
            prod.unit ?? 'pcs',
            prod.price_cents ?? 0,
            prod.cost_cents ?? 0,
            prod.image_uri ?? null,
            prod.track_stock ?? 1,
            prod.low_stock_threshold_milli ?? 5000,
            prod.version ?? 1,
            prod.deleted_at ?? null,
            prod.created_at ?? new Date().toISOString(),
            prod.updated_at ?? new Date().toISOString(),
            prod.sync_status ?? 'pending',
          ]
        );
      }

      // Stock movements
      for (const sm of stock_movements) {
        await txn.runAsync(
          `INSERT INTO stock_movements (
            id, product_id, movement_type, quantity_delta_milli, reference_id,
            reference_type, note, created_at, sync_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            sm.id,
            sm.product_id,
            sm.movement_type ?? 'adjustment',
            sm.quantity_delta_milli ?? 0,
            sm.reference_id ?? null,
            sm.reference_type ?? null,
            sm.note ?? null,
            sm.created_at ?? new Date().toISOString(),
            sm.sync_status ?? 'pending',
          ]
        );
      }

      // Purchases
      for (const po of purchases) {
        await txn.runAsync(
          `INSERT INTO purchases (
            id, supplier_id, reference_no, status, total_cents, note,
            version, received_at, created_at, updated_at, sync_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            po.id,
            po.supplier_id ?? null,
            po.reference_no ?? null,
            po.status ?? 'draft',
            po.total_cents ?? 0,
            po.note ?? null,
            po.version ?? 1,
            po.received_at ?? null,
            po.created_at ?? new Date().toISOString(),
            po.updated_at ?? new Date().toISOString(),
            po.sync_status ?? 'pending',
          ]
        );
      }

      // Purchase items
      for (const pi of purchase_items) {
        await txn.runAsync(
          `INSERT INTO purchase_items (
            id, purchase_id, product_id, product_name, quantity_milli,
            unit_cost_cents, line_total_cents, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            pi.id,
            pi.purchase_id,
            pi.product_id,
            pi.product_name ?? 'Item',
            pi.quantity_milli ?? 1000,
            pi.unit_cost_cents ?? 0,
            pi.line_total_cents ?? 0,
            pi.created_at ?? new Date().toISOString(),
          ]
        );
      }

      // Sales
      for (const s of sales) {
        await txn.runAsync(
          `INSERT INTO sales (
            id, invoice_number, status, subtotal_cents, discount_cents,
            tax_cents, total_cents, paid_cents, change_cents, note,
            version, completed_at, created_at, updated_at, sync_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            s.id,
            s.invoice_number,
            s.status ?? 'completed',
            s.subtotal_cents ?? 0,
            s.discount_cents ?? 0,
            s.tax_cents ?? 0,
            s.total_cents ?? 0,
            s.paid_cents ?? 0,
            s.change_cents ?? 0,
            s.note ?? null,
            s.version ?? 1,
            s.completed_at ?? s.created_at ?? new Date().toISOString(),
            s.created_at ?? new Date().toISOString(),
            s.updated_at ?? new Date().toISOString(),
            s.sync_status ?? 'pending',
          ]
        );
      }

      // Sale items
      for (const item of sale_items) {
        await txn.runAsync(
          `INSERT INTO sale_items (
            id, sale_id, product_id, product_name, product_sku,
            quantity_milli, unit_price_cents, discount_cents, line_total_cents,
            created_at, unit_cost_cents
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            item.id,
            item.sale_id,
            item.product_id,
            item.product_name ?? 'Product',
            item.product_sku ?? null,
            item.quantity_milli ?? 1000,
            item.unit_price_cents ?? 0,
            item.discount_cents ?? 0,
            item.line_total_cents ?? 0,
            item.created_at ?? new Date().toISOString(),
            item.unit_cost_cents ?? 0,
          ]
        );
      }

      // Payments
      for (const pay of payments) {
        await txn.runAsync(
          `INSERT INTO payments (
            id, sale_id, method, amount_cents, reference, created_at, sync_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            pay.id,
            pay.sale_id,
            pay.method ?? 'cash',
            pay.amount_cents ?? 0,
            pay.reference ?? null,
            pay.created_at ?? new Date().toISOString(),
            pay.sync_status ?? 'pending',
          ]
        );
      }

      // Refunds
      for (const ref of refunds) {
        await txn.runAsync(
          `INSERT INTO refunds (
            id, original_sale_id, refund_sale_id, reason, refund_method,
            total_cents, created_at, sync_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            ref.id,
            ref.original_sale_id,
            ref.refund_sale_id,
            ref.reason ?? 'Customer return',
            ref.refund_method ?? 'cash',
            ref.total_cents ?? 0,
            ref.created_at ?? new Date().toISOString(),
            ref.sync_status ?? 'pending',
          ]
        );
      }
    });

    return {
      success: true,
      restoredAt: new Date().toISOString(),
      counts: {
        settings: settings.length,
        categories: categories.length,
        products: products.length,
        stockMovements: stock_movements.length,
        sales: sales.length,
        saleItems: sale_items.length,
        payments: payments.length,
        suppliers: suppliers.length,
        purchases: purchases.length,
        refunds: refunds.length,
      },
    };
  }
}
