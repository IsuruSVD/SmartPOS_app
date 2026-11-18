import type { SQLiteDatabase } from 'expo-sqlite';
import type { PaymentMethod } from '../types';

export interface ReportSummary {
  start_iso: string;
  end_iso: string;
  transaction_count: number;
  completed_sales_count: number;
  refunds_count: number;
  gross_sales_cents: number;
  refunds_cents: number;
  net_sales_cents: number;
  tax_cents: number;
  discount_cents: number;
  cogs_cents: number;
  gross_profit_cents: number;
  profit_margin_pct: number;
  payments: Array<{ method: PaymentMethod; total_cents: number; count: number }>;
  top_products: Array<{ product_id: string; product_name: string; quantity_milli: number; revenue_cents: number }>;
}

export class ReportingService {
  constructor(private readonly db: SQLiteDatabase) {}

  async getReport(startIso: string, endIso: string): Promise<ReportSummary> {
    // 1. Sales metrics
    const salesRow = await this.db.getFirstAsync<{
      completed_count: number;
      gross_sales_cents: number | null;
      tax_cents: number | null;
      discount_cents: number | null;
    }>(
      `SELECT
         COUNT(*) AS completed_count,
         COALESCE(SUM(total_cents), 0) AS gross_sales_cents,
         COALESCE(SUM(tax_cents), 0) AS tax_cents,
         COALESCE(SUM(discount_cents), 0) AS discount_cents
       FROM sales
       WHERE status IN ('completed', 'partially_refunded', 'refunded')
         AND NOT EXISTS (SELECT 1 FROM refunds r WHERE r.refund_sale_id = sales.id)
         AND completed_at >= ? AND completed_at < ?`,
      [startIso, endIso]
    );

    // 2. Refunds metrics
    const refundRow = await this.db.getFirstAsync<{
      refunds_count: number;
      refunds_cents: number | null;
    }>(
      `SELECT
         COUNT(*) AS refunds_count,
         COALESCE(SUM(total_cents), 0) AS refunds_cents
       FROM refunds
       WHERE created_at >= ? AND created_at < ?`,
      [startIso, endIso]
    );

    // 3. COGS calculation from sale items (fallback to product cost_cents if unit_cost_cents is 0)
    const cogsRow = await this.db.getFirstAsync<{ cogs_cents: number | null }>(
      `SELECT
         COALESCE(SUM(
           ROUND(si.quantity_milli * COALESCE(NULLIF(si.unit_cost_cents, 0), p.cost_cents, 0) / 1000.0)
         ), 0) AS cogs_cents
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       LEFT JOIN products p ON p.id = si.product_id
       WHERE s.status IN ('completed', 'partially_refunded', 'refunded')
         AND NOT EXISTS (SELECT 1 FROM refunds r WHERE r.refund_sale_id = s.id)
         AND s.completed_at >= ? AND s.completed_at < ?`,
      [startIso, endIso]
    );

    // 4. Payment breakdown
    const paymentRows = await this.db.getAllAsync<{ method: PaymentMethod; total_cents: number; count: number }>(
      `SELECT
         p.method,
         COALESCE(SUM(p.amount_cents), 0) AS total_cents,
         COUNT(*) AS count
       FROM payments p
       JOIN sales s ON s.id = p.sale_id
       WHERE s.status IN ('completed', 'partially_refunded', 'refunded')
         AND NOT EXISTS (SELECT 1 FROM refunds r WHERE r.refund_sale_id = s.id)
         AND s.completed_at >= ? AND s.completed_at < ?
       GROUP BY p.method
       ORDER BY total_cents DESC`,
      [startIso, endIso]
    );

    // 5. Top selling products
    const productRows = await this.db.getAllAsync<{
      product_id: string;
      product_name: string;
      quantity_milli: number;
      revenue_cents: number;
    }>(
      `SELECT
         si.product_id,
         si.product_name,
         SUM(si.quantity_milli) AS quantity_milli,
         SUM(si.line_total_cents) AS revenue_cents
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       WHERE s.status IN ('completed', 'partially_refunded', 'refunded')
         AND NOT EXISTS (SELECT 1 FROM refunds r WHERE r.refund_sale_id = s.id)
         AND s.completed_at >= ? AND s.completed_at < ?
       GROUP BY si.product_id, si.product_name
       ORDER BY revenue_cents DESC
       LIMIT 10`,
      [startIso, endIso]
    );

    const grossSales = salesRow?.gross_sales_cents ?? 0;
    const refundsTotal = refundRow?.refunds_cents ?? 0;
    const netSales = grossSales - refundsTotal;
    const cogs = cogsRow?.cogs_cents ?? 0;
    const grossProfit = netSales - cogs;
    const profitMargin = netSales > 0 ? (grossProfit / netSales) * 100 : 0;

    return {
      start_iso: startIso,
      end_iso: endIso,
      transaction_count: (salesRow?.completed_count ?? 0) + (refundRow?.refunds_count ?? 0),
      completed_sales_count: salesRow?.completed_count ?? 0,
      refunds_count: refundRow?.refunds_count ?? 0,
      gross_sales_cents: grossSales,
      refunds_cents: refundsTotal,
      net_sales_cents: netSales,
      tax_cents: salesRow?.tax_cents ?? 0,
      discount_cents: salesRow?.discount_cents ?? 0,
      cogs_cents: cogs,
      gross_profit_cents: grossProfit,
      profit_margin_pct: Math.round(profitMargin * 10) / 10,
      payments: paymentRows,
      top_products: productRows,
    };
  }

  async buildZReportText(dateIso: string): Promise<string> {
    const targetDate = new Date(dateIso);
    const start = new Date(targetDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const report = await this.getReport(start.toISOString(), end.toISOString());
    const settingsRows = await this.db.getAllAsync<{ key: string; value: string }>(
      "SELECT key, value FROM settings WHERE key IN ('store_name', 'store_phone', 'store_address', 'currency_code', 'currency_symbol', 'tax_id', 'receipt_footer')"
    );
    const cfg = Object.fromEntries(settingsRows.map((r) => [r.key, r.value]));
    const cur = cfg.currency_symbol || 'Rs.';

    const fmt = (cents: number) => `${cur} ${(cents / 100).toFixed(2)}`;

    const lines: string[] = [];
    lines.push('================================');
    lines.push(`       DAILY Z-REPORT           `);
    lines.push('================================');
    lines.push(cfg.store_name || 'TechknowLK SmartPOS');
    if (cfg.store_address) lines.push(cfg.store_address);
    if (cfg.store_phone) lines.push(`Tel: ${cfg.store_phone}`);
    if (cfg.tax_id) lines.push(`Tax ID: ${cfg.tax_id}`);
    lines.push('--------------------------------');
    lines.push(`Date:      ${start.toLocaleDateString()}`);
    lines.push(`Generated: ${new Date().toLocaleTimeString()}`);
    lines.push('--------------------------------');
    lines.push(`Total Transactions: ${report.transaction_count}`);
    lines.push(`  - Completed Sales: ${report.completed_sales_count}`);
    lines.push(`  - Refunds Issued:  ${report.refunds_count}`);
    lines.push('--------------------------------');
    lines.push(`Gross Sales:       ${fmt(report.gross_sales_cents)}`);
    lines.push(`Refunds Deducted:  ${fmt(report.refunds_cents)}`);
    lines.push(`NET SALES:         ${fmt(report.net_sales_cents)}`);
    lines.push(`Tax Collected:     ${fmt(report.tax_cents)}`);
    lines.push(`Discounts Given:   ${fmt(report.discount_cents)}`);
    lines.push('--------------------------------');
    lines.push(`Cost of Goods:     ${fmt(report.cogs_cents)}`);
    lines.push(`EST. GROSS PROFIT: ${fmt(report.gross_profit_cents)} (${report.profit_margin_pct}%)`);
    lines.push('--------------------------------');
    lines.push('PAYMENT BREAKDOWN:');
    if (report.payments.length === 0) {
      lines.push('  No payments recorded');
    } else {
      for (const p of report.payments) {
        const methodCap = p.method.charAt(0).toUpperCase() + p.method.slice(1);
        lines.push(`  ${methodCap.padEnd(14)} (${p.count}) ${fmt(p.total_cents)}`);
      }
    }
    lines.push('--------------------------------');
    if (report.top_products.length > 0) {
      lines.push('TOP SELLING ITEMS:');
      for (const prod of report.top_products.slice(0, 5)) {
        const qty = (prod.quantity_milli / 1000).toFixed(1);
        lines.push(`  ${prod.product_name.slice(0, 18).padEnd(18)} x${qty} ${fmt(prod.revenue_cents)}`);
      }
      lines.push('--------------------------------');
    }
    lines.push(cfg.receipt_footer || 'Daily Shift Close & Audit');
    lines.push('================================');

    return lines.join('\n');
  }

  async exportDatabaseJson(): Promise<string> {
    const [settings, categories, products, stockMovements, sales, saleItems, payments, suppliers, purchases, purchaseItems, refunds] = await Promise.all([
      this.db.getAllAsync('SELECT * FROM settings'),
      this.db.getAllAsync('SELECT * FROM categories'),
      this.db.getAllAsync('SELECT * FROM products WHERE deleted_at IS NULL'),
      this.db.getAllAsync('SELECT * FROM stock_movements ORDER BY created_at ASC'),
      this.db.getAllAsync('SELECT * FROM sales ORDER BY created_at ASC'),
      this.db.getAllAsync('SELECT * FROM sale_items ORDER BY created_at ASC'),
      this.db.getAllAsync('SELECT * FROM payments ORDER BY created_at ASC'),
      this.db.getAllAsync('SELECT * FROM suppliers WHERE deleted_at IS NULL'),
      this.db.getAllAsync('SELECT * FROM purchases ORDER BY created_at ASC'),
      this.db.getAllAsync('SELECT * FROM purchase_items ORDER BY created_at ASC'),
      this.db.getAllAsync('SELECT * FROM refunds ORDER BY created_at ASC'),
    ]);

    const backup = {
      version: '1.0.0',
      exported_at: new Date().toISOString(),
      data: {
        settings,
        categories,
        products,
        stock_movements: stockMovements,
        sales,
        sale_items: saleItems,
        payments,
        suppliers,
        purchases,
        purchase_items: purchaseItems,
        refunds,
      },
    };

    return JSON.stringify(backup, null, 2);
  }
}
