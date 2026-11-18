# SmartPOS (TechknowLK Mobile POS) — Project Task Board

**Project:** TechknowLK SmartPOS  
**Status:** In Progress (Phase 4 Reporting & Hardening Active)  
**Target Stack:** React Native, Expo, TypeScript, `expo-sqlite`  
**Architecture:** Offline-first V1, Local SQLite (one shared connection), Configurable Currency (LKR Default), Sync-extensible Schema  

---

## 1. Roadmap & Phase Tracking

| Phase | Description | Status | Primary Acceptance Gate |
| :--- | :--- | :--- | :--- |
| **Phase 1** | Foundation & Offline Architecture | **COMPLETE** | App boots cold offline; single shared `SQLiteDatabase` initialized; schema migrations run; CRUD transactions ACID-compliant across restarts. Verified in Expo Go on iPhone. |
| **Phase 2** | Catalog & Stock Management | **COMPLETE** | 1,000+ local products searchable; configurable currency with LKR default formatting; stock auto-decrements on sale; immutable movement ledger; manual stock adjustments; supplier purchasing. |
| **Phase 3** | Sales Engine, Refunds & Checkout | **COMPLETE** | Searchable register; cart calculations; cash change calculator; split tender checkout; atomic sale/payment/ledger commits; confirmed full-sale refunds with inventory restoration. |
| **Phase 4** | Receipts, Reporting & Launch Hardening | **IN PROGRESS** | Daily Z-Report audit reconciliation; gross profit calculation with cost snapshots; store profile configuration; JSON backup export; digital receipt sharing; peripheral bridges planned. |

---

## 2. Implementation Log & Deliverables

### Phase 4 Deliverables (2026-11-17)

- **Cost Snapshots & Profit Auditing:** Added additive migration `003_reports_and_store_profile.ts` adding `unit_cost_cents` to `sale_items`. `CheckoutService` now records point-in-time product cost snapshots on every sale item.
- **Reporting Engine:** Created `ReportingService.ts` to compute net sales, refunds, tax, cost of goods sold (COGS), gross profit, and profit margin percentages over arbitrary date ranges (Today, 7 days, 30 days).
- **Daily Z-Report:** Implemented automated Daily Z-Report generation formatting store headers, sales totals, discounts, taxes, tender breakdowns, cash-in-drawer, top-selling items, and shift sign-off text, ready to share via native share sheet.
- **Interactive Reports UI:** Added a dedicated Reports & Z-Report modal in Settings with period selectors (Today, Last 7 Days, Last 30 Days), KPI cards, payment method distribution, and top product lists.
- **Business Profile Configuration:** Added store settings modal in Settings allowing live editing of Store Name, Phone Number, Address, Tax/Business Reg Number, and Receipt Footer message saved to the local SQLite database.
- **Database Backup Export:** Implemented full database JSON export in Settings allowing merchants to export and share their complete catalog, sales history, and inventory ledger.
- **Branded Digital Receipts:** Updated `sales.tsx` receipt sharing to dynamically incorporate the merchant's business profile and custom receipt footer into shared receipts.
- **Live Gross Profit on Dashboard:** Updated `dashboard.tsx` with live gross profit calculation and margin percentage, replacing previous static placeholders.
- **Category Management & Quick POS Filtering:** Added dynamic category creation (`createCategory`) and assignment to products. In POS Register, added horizontal category chips for fast department filtering (`All`, category names with counts). In Products & Stock, added a category filter row, category creation modal, and category badges on product cards.
- **Line-Item Partial Returns:** Implemented atomic partial-sale refund engine in `RefundService.refundPartial` with remaining refundable quantity tracking per line, proportional tax calculation, and inventory restoration only for returned items. Sales History allows returning specific quantities per item, updating sale status to `partially_refunded`.
- **Thermal Receipt ESC/POS Formatter & Preview:** Created `escpos.ts` generating standard 58mm/80mm monospace layouts and raw ESC/POS binary command streams (init, align, font sizing, paper cut). Added an interactive Thermal Print Preview sheet in Sales History with one-tap receipt sharing.
- **Verification:** 3-case Python SQLite test suite updated and passing; full strict TypeScript validation passing with zero errors (`npx tsc --noEmit`).

---

## 3. Pending Founder Scope Choices

The following scope items from the initiation draft remain pending founder approval:

1. **Scanner & Printer:**
   - Confirm whether camera-based barcode scanning and physical Bluetooth ESC/POS receipt printing are required for MVP, or if manual item search and digital receipt sharing (WhatsApp/SMS/PDF) are sufficient.
2. **Tax Configuration:**
   - Default flat 0% rate is seeded; configurable in Settings (basis points). Clarify if specific Sri Lankan VAT / SSCL tax breakdown rules are required on receipts for v1.
3. **Currency Model:**
   - Configurable currency with LKR as default is established for v1; clarify whether the system enforces one single active currency per installation or requires concurrent multi-currency transactions.
4. **Backup Encryption & Destination:**
   - JSON export via native share sheet is implemented. Confirm whether local database export files must be encrypted and define target cloud destinations (Google Drive / iCloud).
5. **Cashier Access & Roles:**
   - Decide between single-user open kiosk access vs. multi-cashier PIN protection/role separation (admin vs. cashier).
6. **Tablet Scope & Form Factor:**
   - Confirm target form factors: smartphone portrait only, tablet landscape split-screen grid, or adaptive responsive design.
7. **Refund & Partial-Return Rules:**
   - Current implementation supports full-sale refunds with inventory restoration and requires explicit user confirmation. Clarify operational policies including manager PIN authorization and support for partial-item returns vs. full-order voids.
8. **Split Tender Payments:**
   - Implemented as cash plus one non-cash method. Confirm whether more than two tender lines or arbitrary combinations are required.

---

## 4. Development Constraints & Guardrails

- **Code & Asset Preservation:** Preserve existing unrelated files and the uploads directory; all POS modules live under `C:\Users\isuru\SmartPOS\mobile-app`.
- **Offline Integrity:** All core POS operations, reports, and data exports function completely offline on device.
- **Sync Extensibility:** All local entities maintain forward-compatible sync fields for future cloud integration.
