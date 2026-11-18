# SmartPOS (TechknowLK Mobile POS) — Project Task Board

**Project:** TechknowLK SmartPOS  
**Current Phase:** Phase 4: Receipts, Reporting & Launch Hardening (**IN PROGRESS**)  
**Active Project Root:** `C:\Users\isuru\OneDrive\Documents\GitHub\SmartPOS_app`  
**Mobile Codebase:** `C:\Users\isuru\OneDrive\Documents\GitHub\SmartPOS_app\mobile-app`  
**Target Stack:** React Native, Expo, TypeScript, `expo-sqlite`  
**Architecture:** Offline-first V1, Local SQLite (one shared connection), Configurable Currency (LKR Default), Sync-extensible Schema  

---

## 1. Roadmap & Phase Tracking

| Phase | Description | Status | Primary Acceptance Gate |
| :--- | :--- | :--- | :--- |
| **Phase 1** | Foundation & Offline Architecture | **COMPLETE** | Cold-boot offline startup; shared `SQLiteDatabase` initialized; schema migrations operational; CRUD transactions ACID-compliant across restarts. |
| **Phase 2** | Catalog & Stock Management | **COMPLETE** | 1,000+ local products searchable <100ms; LKR currency formatting; stock auto-decrements on sale; immutable movement ledger; manual stock adjustments; supplier purchasing. |
| **Phase 3** | Sales Engine, Refunds & Checkout | **COMPLETE** | Searchable register; cart calculations; cash change calculator; split tender checkout; atomic sale/payment/ledger commits; confirmed full-sale and partial line-item returns. |
| **Phase 4** | Receipts, Reporting & Launch Hardening | **IN PROGRESS** | Daily Z-Report audit reconciliation; gross profit calculation with cost snapshots; store profile configuration; JSON backup export; digital receipt sharing; peripheral bridges. |

---

## 2. Current Sprint Status (Phase 4 Hardening)

### Sprint Focus Areas
1. **UI/UX Responsiveness & Adaptive Design Audit:**
   - Standardized typography and spacing scale in `theme.ts` with responsive elevation and card shadow tokens.
   - Dual **Grid & List layout toggle** in POS Register (`pos.tsx`) with dynamic category initial avatars, instant in-cart quantity badges, and floating bottom checkout pill.
   - Executive Command Center in `dashboard.tsx` with quick action shortcuts, KPI cards with trend indicators, and payment distribution bars.
   - Responsive layout audit underway for tablet landscape (split-pane: catalog left, persistent cart right) vs. phone portrait layouts.

2. **50-Item Retail Demo Seeder & Data Reset:**
   - Implemented `DemoDataSeeder.ts` providing instant 1-tap seeding of 50 authentic Sri Lankan retail products across 6 departments (Beverages, Snacks & Sweets, Dairy & Chilled, Groceries & Staples, Bakery & Breakfast, Personal & Home).
   - Each item includes EAN-13 barcodes, SKU codes, retail prices in LKR, cost price snapshots, and opening stock ledger entries.
   - One-tap controls added in Settings (`settings.tsx`) and the POS Register empty state (`pos.tsx`) for rapid QA and demonstration.

3. **Phase 4 Completion Gates (Definition of Done):**
   - **Gate 4.1 (Financial Reporting & Margin Accuracy):** Daily Z-Report generation verified with exact cash drawer reconciliation, gross profit computation, and tender breakdowns.
   - **Gate 4.2 (Manager Security & Auditing):** Configurable 4-digit Manager PIN enforced for sensitive actions (full/partial refunds, manual stock adjustments).
   - **Gate 4.3 (Peripheral Hardware Integration):** Camera barcode scanning active for rapid product entry; ESC/POS binary formatters generating compliant 58mm/80mm print streams.
   - **Gate 4.4 (Stability & Data Resilience):** Zero crash rate across 100+ consecutive stress-test transactions; full offline JSON backup and export verification; strict TypeScript typing with zero warnings.

---

## 3. Team Milestone Coordination Matrix

| Team Member | Role & Ownership | Current Milestone & Assigned Deliverables | Status |
| :--- | :--- | :--- | :--- |
| **Techknowlk_UXUI** | UI/UX & Design Systems | - Complete responsive breakpoint audit across phone and tablet viewports.<br>- Define tablet landscape POS wireframe (catalog grid left, persistent receipt cart right).<br>- Ensure touch target accessibility (min 44×44pt on all interactive elements) and high-contrast retail legibility. | **IN PROGRESS** |
| **Techknowlk_MobileDev** | Mobile Engineering (RN/Expo) | - Integrate camera-based barcode scanning modal into POS search bar (`expo-camera` / `expo-barcode-scanner`).<br>- Implement Bluetooth Low Energy (BLE) / Classic serial ESC/POS printer discovery and transmission bridge.<br>- Implement adaptive tablet split-screen layout for POS Register. | **IN PROGRESS** |
| **Techknowlk_BackEnd** | Database & Integrity | - Benchmark SQLite index performance with 1,000+ local products.<br>- Validate transactional integrity across partial refunds, stock ledger decrements, and COGS snapshots.<br>- Build JSON database backup import/restore validator for disaster recovery. | **IN PROGRESS** |
| **Techknowlk_PM** | Project Management & Delivery | - Maintain task boards, milestones, acceptance gates, and sprint velocity tracking.<br>- Coordinate cross-functional handoffs between UX, Mobile Dev, and Backend.<br>- Track hardware peripheral testing and founder approval resolutions. | **ACTIVE** |

---

## 4. Peripheral Hardware Integration Progress

### A. Camera Barcode Scanning
- **Objective:** Enable instant product scanning at checkout using mobile camera.
- **Current State:**
  - Fast text-based SKU and barcode search operational in POS Register and Products catalog.
  - `DemoDataSeeder` seeds standard 13-digit EAN-13 barcodes for all 50 demo retail products.
- **Next Milestone:**
  - Add camera barcode scanner modal button directly in POS Register search bar.
  - Support single-scan (add to cart and close) and continuous scan mode (scan multiple items rapidly).
  - Audio/haptic feedback on successful barcode recognition.

### B. Bluetooth ESC/POS Thermal Printing
- **Objective:** Wireless thermal receipt printing on 58mm and 80mm mobile receipt printers.
- **Current State:**
  - Formatting engine complete in `src/utils/escpos.ts`.
  - Supports monospace text alignment, double-height headers, itemized tabular layouts, totals, tax breakdowns, custom receipt footers, and standard cut/line-feed commands.
  - Visual Thermal Print Preview sheet operational in Sales History with one-tap digital receipt sharing.
- **Next Milestone:**
  - Connect raw ESC/POS binary command stream to Bluetooth serial / BLE printer device connection.
  - Implement printer discovery and pairing dialog in Settings (`settings.tsx`).
  - Cache paired printer MAC address / UUID for automated post-checkout printing.

---

## 5. Implementation Log & Deliverables

### Phase 4 Deliverables (2026-11-18 Update)
- **Demo Data Seeding & Database Reset Engine:** Built `DemoDataSeeder.ts` enabling instant in-app population of 50 realistic Sri Lankan retail products across 6 departments with opening stock ledger entries, EAN-13 barcodes, SKUs, and retail/cost pricing. Added 1-tap **"Load 50 Test Products"** and **"Clear All Database Data"** controls in Settings (`settings.tsx`) and POS Register empty state (`pos.tsx`).
- **Commercial-Grade Visual & UX Overhaul:**
  - Redesigned design system in `theme.ts` with sophisticated elevation layers, card shadows, category monogram color schemes, and polished slate/emerald/accent typography.
  - Upgraded Bottom Navigation (`_layout.tsx`) using active/outline vector icons from `@expo/vector-icons/Ionicons`.
  - Rebuilt `pos.tsx` with a dual **Grid & List layout toggle**, dynamic category initial avatars, instant in-cart quantity badges, floating Square-style bottom checkout pill, quick round-cash tender shortcuts (Exact, +500, +1000, +5000 LKR), real-time live change computation, and post-sale celebration sheet with 1-tap WhatsApp and thermal receipt preview.
  - Rebuilt `dashboard.tsx` as an Executive Command Center with quick action shortcut tiles, 4 KPI cards with trend icons, visual payment distribution bar, and live transaction feeds.
  - Elevated `products.tsx` and `sales.tsx` with visual status tags, search containers with clear buttons, and modern modal presentation.
- **Promotional Order Discounts:** Added cart-level discount input (`pos.tsx`) supporting fixed LKR and percentage discounts. `CheckoutService` records `discount_cents` on the sale, decrements total payable amount, updates digital/thermal receipts, and factors discounts into Daily Z-Reports and net sales calculations.
- **Manager Security PIN Access Control:** Implemented configurable 4-digit Manager PIN and authorization toggle in Settings (`settings.tsx`). Enforced Manager PIN authorization modals in Sales History (`sales.tsx`) for full and partial refunds, and in Products (`products.tsx`) for manual inventory stock adjustments.
- **Project Relocation & Git Integration:** Project migrated to GitHub repo folder at `C:\Users\isuru\OneDrive\Documents\GitHub\SmartPOS_app` with verified repository integrity and preserved assets.

### Phase 4 Deliverables (2026-11-17)
- **Cost Snapshots & Profit Auditing:** Added additive migration `003_reports_and_store_profile.ts` adding `unit_cost_cents` to `sale_items`. `CheckoutService` records point-in-time product cost snapshots on every sale item.
- **Reporting Engine:** Created `ReportingService.ts` to compute net sales, refunds, tax, cost of goods sold (COGS), gross profit, and profit margin percentages over arbitrary date ranges (Today, 7 days, 30 days).
- **Daily Z-Report:** Implemented automated Daily Z-Report generation formatting store headers, sales totals, discounts, taxes, tender breakdowns, cash-in-drawer, top-selling items, and shift sign-off text, ready to share via native share sheet.
- **Interactive Reports UI:** Added a dedicated Reports & Z-Report modal in Settings with period selectors (Today, Last 7 Days, Last 30 Days), KPI cards, payment method distribution, and top product lists.
- **Business Profile Configuration:** Added store settings modal in Settings allowing live editing of Store Name, Phone Number, Address, Tax/Business Reg Number, and Receipt Footer message saved to local SQLite database.
- **Database Backup Export:** Implemented full database JSON export in Settings allowing merchants to export and share their complete catalog, sales history, and inventory ledger.
- **Branded Digital Receipts:** Updated `sales.tsx` receipt sharing to dynamically incorporate the merchant's business profile and custom receipt footer into shared receipts.
- **Category Management & Quick POS Filtering:** Added dynamic category creation (`createCategory`) and assignment to products. In POS Register, added horizontal category chips for fast department filtering (`All`, category names with counts). In Products & Stock, added a category filter row, category creation modal, and category badges on product cards.
- **Line-Item Partial Returns:** Implemented atomic partial-sale refund engine in `RefundService.refundPartial` with remaining refundable quantity tracking per line, proportional tax calculation, and inventory restoration only for returned items. Sales History allows returning specific quantities per item, updating sale status to `partially_refunded`.
- **Thermal Receipt ESC/POS Formatter & Preview:** Created `escpos.ts` generating standard 58mm/80mm monospace layouts and raw ESC/POS binary command streams. Added an interactive Thermal Print Preview sheet in Sales History with one-tap receipt sharing.

---

## 6. Pending Founder Scope Choices

The following scope items from the initiation draft remain pending founder approval:

1. **Scanner & Printer Hardware Requirement:**
   - Confirm whether camera-based barcode scanning and physical Bluetooth ESC/POS receipt printing are mandatory for initial commercial launch or if digital receipt sharing and manual search are acceptable as initial fallbacks.
2. **Tax Configuration:**
   - Default flat 0% rate is seeded; configurable in Settings (basis points). Clarify if specific Sri Lankan VAT / SSCL tax breakdown rules are required on receipts for v1.
3. **Currency Model:**
   - Configurable currency with LKR as default is established for v1; clarify whether the system enforces one single active currency per installation or requires concurrent multi-currency transactions.
4. **Backup Encryption & Destination:**
   - JSON export via native share sheet is implemented. Confirm whether local database export files must be encrypted and define target cloud destinations (Google Drive / iCloud).
5. **Cashier Access & Roles:**
   - Single-user open kiosk with 4-digit Manager PIN override is implemented. Decide whether multi-cashier PIN accounts with individual shift tracking are needed for v1.
6. **Tablet Scope & Form Factor:**
   - Confirm target form factors: smartphone portrait priority vs. dedicated tablet landscape split-screen grid.
7. **Refund & Partial-Return Rules:**
   - Current implementation supports both full and partial line-item returns with inventory restoration, protected by Manager PIN. Clarify if customer return window limits (e.g., 7 days) are required.
8. **Split Tender Payments:**
   - Implemented as cash plus one non-cash method. Confirm whether more than two tender lines or arbitrary combinations are required.

---

## 7. Development Constraints & Guardrails

- **Code & Asset Preservation:** Preserve existing unrelated files and the uploads directory; all POS modules live under `C:\Users\isuru\OneDrive\Documents\GitHub\SmartPOS_app\mobile-app`.
- **Offline Integrity:** All core POS operations, reports, and data exports function completely offline on device.
- **Sync Extensibility:** All local entities maintain forward-compatible sync fields for future cloud integration.
