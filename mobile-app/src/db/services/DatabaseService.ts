import { getDatabase, runTransaction } from '../connection';
import { SQLiteDatabase } from 'expo-sqlite';
import { newId } from '../id';
import type { PaymentMethod } from '../types';
import { runMigrations } from '../migrations/runner';
import { SettingsRepository } from '../repositories/SettingsRepository';
import { CategoryRepository }  from '../repositories/CategoryRepository';
import { ProductRepository }   from '../repositories/ProductRepository';
import { StockRepository }     from '../repositories/StockRepository';
import { SaleRepository }      from '../repositories/SaleRepository';
import { PaymentRepository }   from '../repositories/PaymentRepository';
import { SupplierRepository } from '../repositories/SupplierRepository';
import { PurchaseRepository } from '../repositories/PurchaseRepository';
import { RefundRepository } from '../repositories/RefundRepository';
import { CheckoutService } from './CheckoutService';
import type { CheckoutCartLine, CheckoutResult, CheckoutPayment } from './CheckoutService';
import { RefundService } from './RefundService';
import type { RefundResult, RefundItemInput } from './RefundService';
import { PurchaseService } from './PurchaseService';
import type { PurchaseLineInput } from './PurchaseService';
import { ReportingService } from './ReportingService';
import type { ReportSummary } from './ReportingService';

/**
 * DatabaseService — single entry point for the whole local database layer.
 *
 * SINGLETON PATTERN
 *   init() is promise-memoised: calling it concurrently (e.g. React Strict Mode
 *   double-invocation of useEffect) or repeatedly always returns the same Promise
 *   and the same instance. The database is opened and migrated exactly once.
 *
 * Usage:
 *   const db = await DatabaseService.init();
 *   const products = await db.products.findAll();
 */
import { seedDemoData, clearAllTestData, type DemoSeedResult } from './DemoDataSeeder';
import { BackupRestoreService, type BackupValidationResult, type BackupRestoreResult } from './BackupRestoreService';

export class DatabaseService {
  private static _initPromise: Promise<DatabaseService> | null = null;

  readonly settings:   SettingsRepository;
  readonly categories: CategoryRepository;
  readonly products:   ProductRepository;
  readonly stock:      StockRepository;
  readonly sales:      SaleRepository;
  readonly payments:   PaymentRepository;
  readonly suppliers:  SupplierRepository;
  readonly purchases:  PurchaseRepository;
  readonly refunds:    RefundRepository;
  readonly reports:    ReportingService;

  private constructor(
    private readonly db: SQLiteDatabase,
    settings:   SettingsRepository,
    categories: CategoryRepository,
    products:   ProductRepository,
    stock:      StockRepository,
    sales:      SaleRepository,
    payments:   PaymentRepository,
    suppliers:  SupplierRepository,
    purchases:  PurchaseRepository,
    refunds:    RefundRepository,
    reports:    ReportingService,
  ) {
    this.settings   = settings;
    this.categories = categories;
    this.products   = products;
    this.stock      = stock;
    this.sales      = sales;
    this.payments   = payments;
    this.suppliers  = suppliers;
    this.purchases  = purchases;
    this.refunds    = refunds;
    this.reports    = reports;
  }

  /**
   * Opens the database, runs all pending migrations, and returns the shared service.
   * Promise-memoised: safe to call concurrently and from React Strict Mode effects.
   */
  static init(): Promise<DatabaseService> {
    if (!DatabaseService._initPromise) {
      DatabaseService._initPromise = (async () => {
        const db = await getDatabase();
        await runMigrations(db);
        return new DatabaseService(
          db,
          new SettingsRepository(db),
          new CategoryRepository(db),
          new ProductRepository(db),
          new StockRepository(db),
          new SaleRepository(db),
          new PaymentRepository(db),
          new SupplierRepository(db),
          new PurchaseRepository(db),
          new RefundRepository(db),
          new ReportingService(db),
        );
      })();
    }
    return DatabaseService._initPromise;
  }

  /** Create a catalog item and opening stock atomically with bilingual support. */
  async createProduct(input: {
    name?: string;
    name_en?: string | null;
    name_si?: string | null;
    category_id?: string | null;
    sku?: string | null;
    barcode?: string | null;
    price_cents: number;
    cost_cents: number;
    opening_quantity_milli: number;
  }): Promise<string> {
    const id = newId();
    const primaryName = input.name?.trim() || input.name_en?.trim() || input.name_si?.trim() || 'Product';
    await runTransaction(this.db, async (tx) => {
      await tx.runAsync(
        `INSERT INTO products (
          id, category_id, name, name_en, name_si, sku, barcode,
          price_cents, cost_cents, track_stock, low_stock_threshold_milli
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 5000)`,
        [
          id,
          input.category_id ?? null,
          primaryName,
          input.name_en?.trim() || null,
          input.name_si?.trim() || null,
          input.sku?.trim() || null,
          input.barcode?.trim() || null,
          input.price_cents,
          input.cost_cents,
        ]
      );
      if (input.opening_quantity_milli > 0) {
        await tx.runAsync(
          `INSERT INTO stock_movements (id, product_id, movement_type, quantity_delta_milli, note)
           VALUES (?, ?, 'initial_stock', ?, 'Opening inventory')`,
          [newId(), id, input.opening_quantity_milli]
        );
      }
    });
    this.stock.clearCache();
    return id;
  }

  /** Bilingual catalog search across name, name_en, name_si, sku, and barcode. */
  async searchProducts(query: string, categoryId?: string | null) {
    return this.products.searchBilingual(query, categoryId);
  }

  async createCategory(name: string, color?: string): Promise<string> {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Enter a category name.');
    const id = newId();
    await this.categories.insert({ id, name: trimmed, color: color ?? null, sort_order: 0, deleted_at: null });
    return id;
  }

  async checkout(lines: CheckoutCartLine[], paidCents: number, method: PaymentMethod = 'cash', payments?: CheckoutPayment[], discountCents = 0): Promise<CheckoutResult> {
    const result = await new CheckoutService(this.db).checkout(lines, paidCents, method, payments, discountCents);
    this.stock.clearCache();
    return result;
  }

  /** Record an inventory correction as an immutable ledger entry. */
  async adjustStock(productId: string, direction: 'add' | 'remove', quantityMilli: number, note: string): Promise<void> {
    if (!Number.isSafeInteger(quantityMilli) || quantityMilli <= 0) {
      throw new Error('Enter a stock adjustment greater than zero, with up to three decimal places.');
    }
    await runTransaction(this.db, async (tx) => {
      const product = await tx.getFirstAsync<{ name: string; track_stock: number }>(
        'SELECT name, track_stock FROM products WHERE id = ? AND deleted_at IS NULL', [productId]
      );
      if (!product) throw new Error('This product is no longer available.');
      if (!product.track_stock) throw new Error('Turn on stock tracking for this product before adjusting inventory.');

      const balance = await tx.getFirstAsync<{ quantity: number }>(
        'SELECT COALESCE(SUM(quantity_delta_milli),0) AS quantity FROM stock_movements WHERE product_id = ?', [productId]
      );
      const delta = direction === 'add' ? quantityMilli : -quantityMilli;
      if (delta < 0 && (balance?.quantity ?? 0) < quantityMilli) {
        throw new Error(`Cannot remove more than the ${product.name} stock on hand.`);
      }
      await tx.runAsync(
        `INSERT INTO stock_movements (id,product_id,movement_type,quantity_delta_milli,note)
         VALUES (?,?,?,?,?)`,
        [newId(), productId, direction === 'add' ? 'adjustment_add' : 'adjustment_remove', delta, note.trim() || 'Manual stock adjustment']
      );
    });
    this.stock.clearCache();
  }

  async refundSale(saleId: string, method: PaymentMethod, reason: string): Promise<RefundResult> {
    const result = await new RefundService(this.db).refundSale(saleId, method, reason);
    this.stock.clearCache();
    return result;
  }

  async refundPartialSale(saleId: string, items: RefundItemInput[], method: PaymentMethod, reason: string): Promise<RefundResult> {
    const result = await new RefundService(this.db).refundPartial(saleId, items, method, reason);
    this.stock.clearCache();
    return result;
  }

  async createSupplier(input: { name: string; phone?: string; email?: string; notes?: string }): Promise<string> {
    const name = input.name.trim();
    if (!name) throw new Error('Enter a supplier name.');
    const id = newId();
    await this.suppliers.insert({ id, name, phone: input.phone?.trim() || null, email: input.email?.trim() || null, notes: input.notes?.trim() || null });
    return id;
  }

  async receivePurchase(input: { supplier_id?: string | null; reference_no?: string; note?: string; lines: PurchaseLineInput[] }): Promise<string> {
    const id = await new PurchaseService(this.db).receive(input);
    this.stock.clearCache();
    return id;
  }

  async getReport(startIso: string, endIso: string): Promise<ReportSummary> {
    return this.reports.getReport(startIso, endIso);
  }

  async generateZReport(dateIso: string): Promise<string> {
    return this.reports.buildZReportText(dateIso);
  }

  async exportBackupJson(): Promise<string> {
    return this.reports.exportDatabaseJson();
  }

  validateBackupJson(rawJson: string): BackupValidationResult {
    return new BackupRestoreService(this.db).validateBackup(rawJson);
  }

  async restoreBackupJson(rawJson: string): Promise<BackupRestoreResult> {
    const result = await new BackupRestoreService(this.db).restoreBackup(rawJson);
    this.stock.clearCache();
    return result;
  }

  async seedDemoData(): Promise<DemoSeedResult> {
    const result = await seedDemoData(this.db);
    this.stock.clearCache();
    return result;
  }

  async clearAllTestData(): Promise<void> {
    await clearAllTestData(this.db);
    this.stock.clearCache();
  }

  /** For testing only — clears the singleton. */
  static _resetForTest(): void {
    DatabaseService._initPromise = null;
  }
}
