# SmartPOS — TechknowLK Mobile POS

Offline-first Android/iOS point-of-sale app. The current build includes the Phase 1 foundation plus working product creation, opening-stock tracking, searchable inventory, a searchable register cart, and atomic cash checkout with stock deduction and invoice numbering. Supplier purchasing, refunds, scanner/printer, backup and reports are still incomplete.

## Stack and setup

- Expo SDK 58, React Native 0.88, TypeScript, Expo Router
- `expo-sqlite` local database; no cloud backend in v1
- Install with `npm install`; start the development server with `npm start`.
- SDK 58 matches the Expo Go version installed on the test iPhone.

## Project layout

```text
app/                 Expo Router screens and root database provider
src/db/connection.ts Shared SQLite connection and transaction helper
src/db/migrations/   Ordered, additive schema migrations
src/db/repositories/ Data access by domain
src/db/services/     Database initialization and repository wiring
src/ui/              Shared theme and reusable UI components
```

## Data conventions

- Money uses integer minor units (`*_cents`); quantities use integer milli-units (`*_milli`).
- Row IDs are UUID strings; master records use soft deletion.
- Stock is represented as an append-only movement ledger.
- Sales and payment details are snapshots; refunds are linked to original and inverse-sale records.
- Currency defaults to LKR, while tax rate and tax mode remain configuration values pending founder decision.

## Verification\n\nRun the SQL schema smoke checks with python -m unittest scripts.test_sql_schema. These exercise migration SQL and constraints using Python SQLite; Android/iOS native database startup and persistence still require an emulator or device.\n\n## Migrations

Create `src/db/migrations/00N_description.ts` with an `up(db)` migration, then append it to `ALL_MIGRATIONS` in `runner.ts`. Never edit a migration that may already be applied; create a new additive migration instead.

## Scope still awaiting founder choices

Tax treatment/rate, currency model, backup destination/encryption, cashier access, target device sizes, refund/partial-return policy and payment methods need decisions before those workflows are finalized. Barcode scanning and Bluetooth printing depend on native device integration.

No application tests or device builds have been run in this phase.
