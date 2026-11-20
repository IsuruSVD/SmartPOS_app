import type { SQLiteDatabase } from 'expo-sqlite';
import { newId } from '../id';

export interface DemoSeedResult {
  categoriesCount: number;
  productsCount: number;
}

export const DEMO_CATEGORIES = [
  { name: 'Beverages', color: '#2563EB' },
  { name: 'Snacks & Sweets', color: '#D97706' },
  { name: 'Dairy & Chilled', color: '#059669' },
  { name: 'Groceries & Staples', color: '#DC2626' },
  { name: 'Bakery & Breakfast', color: '#7C3AED' },
  { name: 'Personal & Home', color: '#0891B2' },
];

export const DEMO_PRODUCTS = [
  // Beverages (8)
  { cat: 'Beverages', name: 'Dilmah Premium Ceylon Tea 100B', name_si: 'ඩිල්මා සිලෝන් තේ 100B', price: 85000, cost: 68000, stock: 40, sku: 'BEV-001', barcode: '4791001001015' },
  { cat: 'Beverages', name: 'Watawala Pure Ceylon Tea 200g', name_si: 'වටවල සිලෝන් තේ 200g', price: 42000, cost: 33000, stock: 35, sku: 'BEV-002', barcode: '4791001001022' },
  { cat: 'Beverages', name: 'Milo Malt Chocolate Drink 180ml', name_si: 'මයිලෝ චොක්ලට් බීම 180ml', price: 15000, cost: 12000, stock: 75, sku: 'BEV-003', barcode: '4791001001039' },
  { cat: 'Beverages', name: 'Elephant House Cream Soda 400ml', name_si: 'එලිෆන්ට් හවුස් ක්‍රීම් සෝඩා 400ml', price: 18000, cost: 14000, stock: 60, sku: 'BEV-004', barcode: '4791001001046' },
  { cat: 'Beverages', name: 'Elephant House Necto 400ml', name_si: 'එලිෆන්ට් හවුස් නෙක්ටෝ 400ml', price: 18000, cost: 14000, stock: 50, sku: 'BEV-005', barcode: '4791001001053' },
  { cat: 'Beverages', name: 'Coca-Cola Pet Bottle 400ml', name_si: 'කොකා-කෝලා බෝතලය 400ml', price: 18000, cost: 14500, stock: 65, sku: 'BEV-006', barcode: '4791001001060' },
  { cat: 'Beverages', name: 'Smak Mixed Fruit Nectar 200ml', name_si: 'ස්මැක් මිශ්‍ර පළතුරු බීම 200ml', price: 12000, cost: 9500, stock: 45, sku: 'BEV-007', barcode: '4791001001077' },
  { cat: 'Beverages', name: 'Nescafe Classic Instant Coffee 50g', name_si: 'නෙස්කැෆේ ක්ලැසික් කෝපි 50g', price: 65000, cost: 52000, stock: 25, sku: 'BEV-008', barcode: '4791001001084' },

  // Snacks & Sweets (9)
  { cat: 'Snacks & Sweets', name: 'Munchee Super Cream Cracker 490g', name_si: 'මන්චි සුපර් ක්‍රීම් ක්‍රැකර් 490g', price: 45000, cost: 36000, stock: 55, sku: 'SNK-001', barcode: '4792002002012' },
  { cat: 'Snacks & Sweets', name: 'Munchee Chocolate Puff 200g', name_si: 'මන්චි චොක්ලට් පෆ් 200g', price: 24000, cost: 19000, stock: 40, sku: 'SNK-002', barcode: '4792002002029' },
  { cat: 'Snacks & Sweets', name: 'Maliban Gold Marie Biscuits 300g', name_si: 'මැලිබන් ගෝල්ඩ් මාරි 300g', price: 32000, cost: 25000, stock: 50, sku: 'SNK-003', barcode: '4792002002036' },
  { cat: 'Snacks & Sweets', name: 'Maliban Chocolate Cream 100g', name_si: 'මැලිබන් චොක්ලට් ක්‍රීම් 100g', price: 15000, cost: 11500, stock: 60, sku: 'SNK-004', barcode: '4792002002043' },
  { cat: 'Snacks & Sweets', name: 'Ritzbury Revello Dark Chocolate 50g', name_si: 'රිට්ස්බරි රෙවෙලෝ චොක්ලට් 50g', price: 38000, cost: 30000, stock: 30, sku: 'SNK-005', barcode: '4792002002050' },
  { cat: 'Snacks & Sweets', name: 'Tiara Swiss Roll Chocolate 180g', name_si: 'ටියාරා ස්විස් රෝල් 180g', price: 35000, cost: 27500, stock: 25, sku: 'SNK-006', barcode: '4792002002067' },
  { cat: 'Snacks & Sweets', name: 'Rancrisp Spiced Cassava Chips 100g', name_si: 'රන්ක්‍රිස්ප් මඤ්ඤොක්කා චිප්ස් 100g', price: 22000, cost: 17000, stock: 45, sku: 'SNK-007', barcode: '4792002002074' },
  { cat: 'Snacks & Sweets', name: 'Sunbites Roasted Salted Peanuts 50g', name_si: 'සන්බයිට්ස් බැදපු රටකජු 50g', price: 14000, cost: 11000, stock: 50, sku: 'SNK-008', barcode: '4792002002081' },
  { cat: 'Snacks & Sweets', name: 'Munchee Real Ginger Biscuits 200g', name_si: 'මන්චි ඉඟුරු බිස්කට් 200g', price: 22000, cost: 17500, stock: 40, sku: 'SNK-009', barcode: '4792002002098' },

  // Dairy & Chilled (9)
  { cat: 'Dairy & Chilled', name: 'Highland Pasteurized Fresh Milk 1L', name_si: 'හයිලන්ඩ් නැවුම් එළකිරි 1L', price: 48000, cost: 41000, stock: 30, sku: 'DAI-001', barcode: '4793003003019' },
  { cat: 'Dairy & Chilled', name: 'Highland Sterilized Milk 450ml', name_si: 'හයිලන්ඩ් ජීවානුහරිත කිරි 450ml', price: 24000, cost: 20000, stock: 40, sku: 'DAI-002', barcode: '4793003003026' },
  { cat: 'Dairy & Chilled', name: 'Kotmale Vanilla Fresh Milk 180ml', name_si: 'කොත්මලේ වැනිලා කිරි 180ml', price: 14000, cost: 11500, stock: 65, sku: 'DAI-003', barcode: '4793003003033' },
  { cat: 'Dairy & Chilled', name: 'Kotmale Full Cream Cheddar 200g', name_si: 'කොත්මලේ චෙඩර් චීස් 200g', price: 115000, cost: 92000, stock: 20, sku: 'DAI-004', barcode: '4793003003040' },
  { cat: 'Dairy & Chilled', name: 'Anchor Pure Salted Butter 227g', name_si: 'ඇන්කර් ලුණු සහිත බටර් 227g', price: 98000, cost: 81000, stock: 25, sku: 'DAI-005', barcode: '4793003003057' },
  { cat: 'Dairy & Chilled', name: 'Astra Vitamin Enriched Spread 250g', name_si: 'ඇස්ට්‍රා විටමින් ස්ප්‍රෙඩ් 250g', price: 42000, cost: 34500, stock: 35, sku: 'DAI-006', barcode: '4793003003064' },
  { cat: 'Dairy & Chilled', name: 'Highland Sweet Vanilla Yoghurt 80g', name_si: 'හයිලන්ඩ් වැනිලා යෝගට් 80g', price: 8000, cost: 6500, stock: 80, sku: 'DAI-007', barcode: '4793003003071' },
  { cat: 'Dairy & Chilled', name: 'Ambewela Low Fat Milk 1L', name_si: 'අඹේවෙල අඩු මේද කිරි 1L', price: 52000, cost: 44000, stock: 25, sku: 'DAI-008', barcode: '4793003003088' },
  { cat: 'Dairy & Chilled', name: 'Keells Traditional Chicken Sausages 500g', name_si: 'කීල්ස් චිකන් සොසේජස් 500g', price: 88000, cost: 72000, stock: 20, sku: 'DAI-009', barcode: '4793003003095' },

  // Groceries & Staples (9)
  { cat: 'Groceries & Staples', name: 'Fortune Refined White Sugar 1kg', name_si: 'ෆෝචූන් පිරිපහදු කළ සුදු සීනි 1kg', price: 28000, cost: 24500, stock: 70, sku: 'GRO-001', barcode: '4794004004016' },
  { cat: 'Groceries & Staples', name: 'Prima All-Purpose Flour 1kg', name_si: 'ප්‍රීමා තිරිඟු පිටි 1kg', price: 26000, cost: 22000, stock: 60, sku: 'GRO-002', barcode: '4794004004023' },
  { cat: 'Groceries & Staples', name: 'Raigam Pure De-odized Salt 400g', name_si: 'රයිගම් අයඩීකෘත ලුණු 400g', price: 12000, cost: 9500, stock: 50, sku: 'GRO-003', barcode: '4794004004030' },
  { cat: 'Groceries & Staples', name: 'Marina Pure Coconut Cooking Oil 1L', name_si: 'මැරීනා පොල් තෙල් 1L', price: 89000, cost: 75000, stock: 30, sku: 'GRO-004', barcode: '4794004004047' },
  { cat: 'Groceries & Staples', name: 'Maggi 2-Minute Chicken Noodles 72g', name_si: 'මැගී චිකන් නූඩ්ල්ස් 72g', price: 14000, cost: 11000, stock: 90, sku: 'GRO-005', barcode: '4794004004054' },
  { cat: 'Groceries & Staples', name: 'Kist Fresh Tomato Sauce 400g', name_si: 'කිස්ට් තක්කාලි සෝස් 400g', price: 38000, cost: 30000, stock: 35, sku: 'GRO-006', barcode: '4794004004061' },
  { cat: 'Groceries & Staples', name: 'MD Mixed Fruit Jam 485g', name_si: 'එම්ඩී මිශ්‍ර පළතුරු ජෑම් 485g', price: 62000, cost: 49000, stock: 25, sku: 'GRO-007', barcode: '4794004004078' },
  { cat: 'Groceries & Staples', name: 'Ruhunu Roasted Chili Powder 100g', name_si: 'රුහුණු බැදපු මිරිස් කුඩු 100g', price: 25000, cost: 19500, stock: 40, sku: 'GRO-008', barcode: '4794004004085' },
  { cat: 'Groceries & Staples', name: 'Wijaya Pure Curry Powder 100g', name_si: 'විජය තුනපහ කුඩු 100g', price: 22000, cost: 17500, stock: 45, sku: 'GRO-009', barcode: '4794004004092' },

  // Bakery & Breakfast (8)
  { cat: 'Bakery & Breakfast', name: 'Prima Crusty Sandwich Bread 450g', name_si: 'ප්‍රීමා සැන්ඩ්විච් පාන් 450g', price: 19000, cost: 15500, stock: 30, sku: 'BAK-001', barcode: '4795005005013' },
  { cat: 'Bakery & Breakfast', name: 'Edinborough Strawberry Fruit Spread 300g', name_si: 'එඩින්බරෝ ස්ට්‍රෝබෙරි ජෑම් 300g', price: 42000, cost: 33000, stock: 25, sku: 'BAK-002', barcode: '4795005005020' },
  { cat: 'Bakery & Breakfast', name: 'Marmite Classic Yeast Extract 100g', name_si: 'මාමයිට් ඊස්ට් සාරය 100g', price: 75000, cost: 61000, stock: 20, sku: 'BAK-003', barcode: '4795005005037' },
  { cat: 'Bakery & Breakfast', name: 'Kelloggs Crispy Corn Flakes 250g', name_si: 'කෙලොග්ස් කෝන් ෆ්ලේක්ස් 250g', price: 95000, cost: 78000, stock: 20, sku: 'BAK-004', barcode: '4795005005044' },
  { cat: 'Bakery & Breakfast', name: 'Quaker Quick Cooking White Oats 400g', name_si: 'ක්වේකර් ඕට්ස් 400g', price: 85000, cost: 69000, stock: 25, sku: 'BAK-005', barcode: '4795005005051' },
  { cat: 'Bakery & Breakfast', name: 'Finagle Herb & Garlic Toasts 120g', name_si: 'ෆිනෑගල් ගාලික් ටෝස්ට් 120g', price: 26000, cost: 20500, stock: 35, sku: 'BAK-006', barcode: '4795005005068' },
  { cat: 'Bakery & Breakfast', name: 'Harischandra Pure Roasted Coffee 100g', name_si: 'හරිශ්චන්ද්‍ර බැදපු කෝපි 100g', price: 38000, cost: 30000, stock: 30, sku: 'BAK-007', barcode: '4795005005075' },
  { cat: 'Bakery & Breakfast', name: 'Maliban Crunchy Tea Rusks 200g', name_si: 'මැලිබන් ටී රස්ක් 200g', price: 24000, cost: 19000, stock: 40, sku: 'BAK-008', barcode: '4795005005082' },

  // Personal & Home (7)
  { cat: 'Personal & Home', name: 'Sunlight Fragrant Lemon Soap 115g', name_si: 'සන්ලයිට් දෙහි සුවඳ සබන් 115g', price: 16000, cost: 12800, stock: 65, sku: 'HME-001', barcode: '4796006006010' },
  { cat: 'Personal & Home', name: 'Lifebuoy Total Active Red Soap 100g', name_si: 'ලයිෆ්බෝයි රතු සබන් 100g', price: 17000, cost: 13500, stock: 60, sku: 'HME-002', barcode: '4796006006027' },
  { cat: 'Personal & Home', name: 'Signal Action White Toothpaste 120g', name_si: 'සිග්නල් වයිට් දන්තාලේප 120g', price: 28000, cost: 22000, stock: 45, sku: 'HME-003', barcode: '4796006006034' },
  { cat: 'Personal & Home', name: 'Sunsilk Black Shine Shampoo 180ml', name_si: 'සන්සිල්ක් ෂැම්පු 180ml', price: 49000, cost: 39500, stock: 30, sku: 'HME-004', barcode: '4796006006041' },
  { cat: 'Personal & Home', name: 'Dettol Disinfectant Antiseptic 125ml', name_si: 'ඩෙටෝල් විෂබීජ නාශක 125ml', price: 58000, cost: 46500, stock: 25, sku: 'HME-005', barcode: '4796006006058' },
  { cat: 'Personal & Home', name: 'Vim Dishwash Gel Fresh Lime 500ml', name_si: 'විම් දීසි සේදුම් ජෙල් 500ml', price: 38000, cost: 30000, stock: 35, sku: 'HME-006', barcode: '4796006006065' },
  { cat: 'Personal & Home', name: 'Surf Excel Quick Wash Powder 500g', name_si: 'සර්ෆ් එක්සෙල් රෙදි සේදුම් කුඩු 500g', price: 42000, cost: 33500, stock: 40, sku: 'HME-007', barcode: '4796006006072' },
];

export async function seedDemoData(db: SQLiteDatabase): Promise<DemoSeedResult> {
  let categoriesCount = 0;
  let productsCount = 0;

  await db.withExclusiveTransactionAsync(async (txn) => {
    // 1. Ensure Categories exist
    const categoryIdMap: Record<string, string> = {};

    for (const cat of DEMO_CATEGORIES) {
      const existing = await txn.getFirstAsync<{ id: string }>(
        `SELECT id FROM categories WHERE name = ? AND deleted_at IS NULL`,
        [cat.name]
      );

      if (existing) {
        categoryIdMap[cat.name] = existing.id;
      } else {
        const id = newId();
        await txn.runAsync(
          `INSERT INTO categories (id, name, color) VALUES (?, ?, ?)`,
          [id, cat.name, cat.color]
        );
        categoryIdMap[cat.name] = id;
        categoriesCount++;
      }
    }

    // 2. Insert 50 Products and their Opening Stock Ledger
    for (const item of DEMO_PRODUCTS) {
      const existingProd = await txn.getFirstAsync<{ id: string }>(
        `SELECT id FROM products WHERE name = ? AND deleted_at IS NULL`,
        [item.name]
      );

      if (!existingProd) {
        const prodId = newId();
        const catId = categoryIdMap[item.cat] ?? null;
        const openingMilli = item.stock * 1000;

        await txn.runAsync(
          `INSERT INTO products (
            id, category_id, name, name_en, name_si, sku, barcode, price_cents, cost_cents, unit,
            track_stock, low_stock_threshold_milli
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'units', 1, 5000)`,
          [prodId, catId, item.name, item.name, item.name_si, item.sku, item.barcode, item.price, item.cost]
        );

        // Record opening stock in stock_movements ledger
        await txn.runAsync(
          `INSERT INTO stock_movements (id, product_id, movement_type, quantity_delta_milli, note)
           VALUES (?, ?, 'opening_stock', ?, 'Initial Demo Stock Seed')`,
          [newId(), prodId, openingMilli]
        );

        productsCount++;
      }
    }
  });

  return { categoriesCount, productsCount };
}

export async function clearAllTestData(db: SQLiteDatabase): Promise<void> {
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(`DELETE FROM refunds`);
    await txn.runAsync(`DELETE FROM payments`);
    await txn.runAsync(`DELETE FROM sale_items`);
    await txn.runAsync(`DELETE FROM sales`);
    await txn.runAsync(`DELETE FROM purchase_items`);
    await txn.runAsync(`DELETE FROM purchases`);
    await txn.runAsync(`DELETE FROM stock_movements`);
    await txn.runAsync(`DELETE FROM products`);
    await txn.runAsync(`DELETE FROM categories`);
    await txn.runAsync(`DELETE FROM suppliers`);

    // Reset invoice numbering sequence back to 1
    await txn.runAsync(
      `UPDATE settings SET value = '1' WHERE key = 'next_invoice_number'`
    );
  });
}
