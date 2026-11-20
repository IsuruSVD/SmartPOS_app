export type AppLanguage = 'en' | 'si';

export const translations = {
  en: {
    // Navigation
    nav_pos: 'Register',
    nav_products: 'Products',
    nav_sales: 'Sales',
    nav_dashboard: 'Dashboard',
    nav_settings: 'Settings',

    // POS Register
    search_placeholder: 'Search products / නිෂ්පාදන සොයන්න',
    cart: 'Cart',
    items: 'items',
    total: 'Total',
    subtotal: 'Subtotal',
    discount: 'Discount',
    charge: 'Charge',
    cash_tendered: 'Cash Tendered',
    change: 'Change',
    complete_sale: 'Complete Sale',
    all_categories: 'All',
    empty_cart: 'Cart is empty',
    tap_to_add: 'Tap a product to start ringing up sales',
    rapid_scan: 'Rapid Scan',
    single_scan: 'Single Scan',
    done_scanning: 'Done Scanning',

    // Products
    add_product: 'Add Product',
    edit_product: 'Edit Product',
    product_name_en: 'Product Name (English)',
    product_name_si: 'Product Name (Sinhala)',
    price: 'Price',
    cost: 'Cost',
    stock: 'Stock',
    category: 'Category',
    sku: 'SKU Code',
    barcode: 'Barcode / EAN-13',
    track_stock: 'Track Inventory',
    save: 'Save Product',
    cancel: 'Cancel',
    delete: 'Delete',
    at_least_one_name: 'Enter at least one product name (English or Sinhala).',

    // Settings
    settings_title: 'Settings',
    theme: 'App Theme',
    theme_sub: 'Switch between Light, Dark, and System appearance',
    theme_system: 'System Default',
    theme_light: 'Light Mode',
    theme_dark: 'Dark Mode',
    language: 'Language',
    language_sub: 'Choose between English and Sinhala user interface',
    lang_en: 'English',
    lang_si: 'Sinhala (සිංහල)',
    business_profile: 'Business Profile',
    tax_settings: 'Tax / VAT Settings',
    manager_pin: 'Manager Security PIN',
    backup_export: 'Database Backup & Export',
    backup_restore: 'Disaster Recovery & Restore',
    load_demo: 'Load 50 Test Products',
    clear_all: 'Clear All Database Data',

    // Dashboard
    today_sales: "Today's Sales",
    total_orders: 'Total Orders',
    gross_profit: 'Gross Profit',
    low_stock_alerts: 'Low Stock Alerts',
    quick_actions: 'Quick Actions',
    recent_activity: 'Recent Activity',

    // Sales History
    sales_history: 'Sales History',
    receipt: 'Receipt',
    refund: 'Refund',
    print_ble: 'Print (BLE)',
    completed: 'Completed',
    refunded: 'Refunded',
    partially_refunded: 'Partially Refunded',
  },

  si: {
    // Navigation
    nav_pos: 'ලියාපදිංචිය',
    nav_products: 'නිෂ්පාදන',
    nav_sales: 'විකුණුම්',
    nav_dashboard: 'පාලක පුවරුව',
    nav_settings: 'සැකසුම්',

    // POS Register
    search_placeholder: 'නිෂ්පාදන සොයන්න / Search products',
    cart: 'කරත්තය',
    items: 'භාණ්ඩ',
    total: 'මුළු එකතුව',
    subtotal: 'උප එකතුව',
    discount: 'වට්ටම්',
    charge: 'අයකිරීම',
    cash_tendered: 'ලැබුණු මුදල',
    change: 'ඉතිරි මුදල',
    complete_sale: 'විකිණීම සම්පූර්ණ කරන්න',
    all_categories: 'සියල්ල',
    empty_cart: 'කරත්තය හිස්ය',
    tap_to_add: 'විකිණීමට නිෂ්පාදනයක් තෝරන්න',
    rapid_scan: 'වේගවත් ස්කෑන්',
    single_scan: 'තනි ස්කෑන්',
    done_scanning: 'ස්කෑන් කිරීම අවසන්',

    // Products
    add_product: 'නිෂ්පාදනයක් එක් කරන්න',
    edit_product: 'නිෂ්පාදනය සංස්කරණය',
    product_name_en: 'නිෂ්පාදන නම (ඉංග්‍රීසි)',
    product_name_si: 'නිෂ්පාදන නම (සිංහල)',
    price: 'විකුණුම් මිල',
    cost: 'පිරිවැය',
    stock: 'තොගය',
    category: 'ප්‍රවර්ගය',
    sku: 'SKU කේතය',
    barcode: 'තීරු කේතය (EAN-13)',
    track_stock: 'තොග නිරීක්ෂණය කරන්න',
    save: 'සුරකින්න',
    cancel: 'අවලංගු කරන්න',
    delete: 'මකන්න',
    at_least_one_name: 'අවම වශයෙන් එක් නමක් (ඉංග්‍රීසි හෝ සිංහල) ඇතුළත් කරන්න.',

    // Settings
    settings_title: 'සැකසුම්',
    theme: 'යෙදුම් තේමාව',
    theme_sub: 'ලා පැහැය, තද පැහැය හෝ පද්ධති තේමාව තෝරන්න',
    theme_system: 'පද්ධති පෙරනිමිය',
    theme_light: 'ලා පැහැය',
    theme_dark: 'තද පැහැය',
    language: 'භාෂාව',
    language_sub: 'යෙදුම සඳහා ඉංග්‍රීසි හෝ සිංහල භාෂාව තෝරන්න',
    lang_en: 'English (ඉංග්‍රීසි)',
    lang_si: 'සිංහල',
    business_profile: 'ව්‍යාපාරික තොරතුරු',
    tax_settings: 'බදු / VAT සැකසුම්',
    manager_pin: 'කළමනාකරු PIN අංකය',
    backup_export: 'දත්ත උපස්ථය සහ අපනයනය',
    backup_restore: 'දත්ත ප්‍රතිසාධනය (Restore)',
    load_demo: 'පරීක්ෂණ භාණ්ඩ 50ක් එක් කරන්න',
    clear_all: 'සියලු දත්ත මකන්න',

    // Dashboard
    today_sales: 'අද දින විකුණුම්',
    total_orders: 'මුළු ඇණවුම්',
    gross_profit: 'දළ ලාභය',
    low_stock_alerts: 'අඩු තොග අනතුරු ඇඟවීම්',
    quick_actions: 'කෙටි මං',
    recent_activity: 'මෑත විකුණුම්',

    // Sales History
    sales_history: 'විකුණුම් ඉතිහාසය',
    receipt: 'රිසිට්පත',
    refund: 'මුදල් ආපසු ගෙවීම',
    print_ble: 'මුද්‍රණය (BLE)',
    completed: 'සම්පූර්ණයි',
    refunded: 'ආපසු ගෙවන ලදී',
    partially_refunded: 'කොටසක් ආපසු ගෙවන ලදී',
  },
};

export type TranslationKey = keyof typeof translations.en;

/**
 * Returns localized product name based on current language with robust fallbacks:
 * If Sinhala (si): returns name_si -> name_en -> name.
 * If English (en): returns name_en -> name_si -> name.
 */
export function getProductName(
  product: { name: string; name_en?: string | null; name_si?: string | null },
  lang: AppLanguage = 'en'
): string {
  if (lang === 'si') {
    return product.name_si?.trim() || product.name_en?.trim() || product.name;
  }
  return product.name_en?.trim() || product.name_si?.trim() || product.name;
}
