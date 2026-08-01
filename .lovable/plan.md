## Inventory Module Overhaul

Rebuild the Inventory area into four screens modelled on the reference UI, while keeping the existing premium dark/gold theme (no white/green Stackwise palette), NPR currency, and Kathmandu time via `timeUtils.ts`.

```text
/inventory            → Product Catalog (sortable table, filters, row actions)
/inventory/movements  → Stock Movements ledger (filters + type summary cards)
/inventory/analytics  → Stock analytics (KPIs, charts, turnover/reorder)
/setup/suppliers      → Suppliers master (new)
```

---

### Phase 1 — Core catalog, movements & records (higher value, moderate complexity)

**1. Database migration** (`db/migrations/2026-08-01_inventory_v2.sql`, mirrored into `db/schema.sql`)
- New `inv_suppliers` table (name, contact person, phone, email, address, active) with GRANTs + RLS matching the existing `inv_*` tables.
- `inv_items`: add `supplier_id`, `description`, `reorder_quantity`.
- `inv_movements`: add `supplier_id`, `from_store_id`, `to_store_id`, `performed_by_name`, `balance_after`; widen the `type` check to include `transfer`.
- Indexes on `inv_movements(created_at desc)` and `inv_movements(type, created_at desc)` for the ledger.

**2. Data layer** (`src/lib/inventory-store.ts`, `src/hooks/use-inventory.ts`)
- Supplier CRUD + `useSuppliers` hook.
- New `useAllMovements()` — loads the global movement feed joined with item/store/supplier names (not per-item only).
- New mutations: `adjustStock(itemId, delta, reason)` and `transferStock(itemId, fromStore, toStore, qty, ref)`.
- Every movement writes `balance_after` and the acting user, and also writes an entry to the existing audit-log pipeline (`src/lib/audit-log.ts`) so stock actions are traceable system-wide.
- All timestamps via `getSystemTimestamp()` from `timeUtils.ts`.

**3. Product Catalog page** (rewrite `src/pages/Inventory.tsx`)
- Header: title, item count, Export CSV, Import (CSV), New Item.
- Filter bar: search (name/SKU-code), Category (item group), Supplier, Status, Location (store).
- Table columns — every header click-sortable with asc/desc arrow: Name, Code/SKU, Category, Qty (+ In Stock / Low Stock / Out of Stock dot badge), Location, Supplier, and a row kebab menu (View movements, Add stock, Issue stock, Adjust, Edit, Delete).
- Row selection checkboxes with a bulk bar (export selected, bulk deactivate).
- Keeps footer totals (qty + NPR valuation) and the existing `PremiumReportFrame` export/print behaviour.

**4. Add/Edit Item modal** (`AddItemModal.tsx` → side sheet)
- Restructured into the reference's labelled sections: Basic Info (Name, SKU/code, Description), Classification (Category, Unit of Measure), Stock Settings (Current stock, Reorder point, Reorder quantity), Pricing (Rate, NPR VAT-incl), Assignment (Supplier, Location/Store), Status (Active/Inactive).

**5. Stock Movements page** (new `src/pages/InventoryMovements.tsx`)
- Header: "Stock movements", count, Export CSV, "Log Movement".
- Filters: Type checkboxes (Received / Issued / Adjusted / Transferred), Item select, Date range (from/to), Performed By.
- Four summary cards: Total, Received, Issued, Adjustments.
- Table: Type (icon + label), Item, Quantity (+N green / −N red), Direction (in/out chip), Performed By, Reference, Time (relative, Kathmandu), expandable row showing note, store, balance after.

**6. Log Movement sheet** (`AddStockModal.tsx` generalised)
- One sheet with Item, Movement Type (Received / Issued / Adjusted / Transferred), Quantity, Rate (received only), From/To store (transfer only), Reference Note; Save Movement / Cancel.

**7. Reports integration** (`src/pages/Reports.tsx`)
- Add an "Inventory" report section: Stock Position (valuation by store/category) and Stock Movement Register (date-ranged, printable/exportable via the existing report frame).

---

### Phase 2 — Suppliers module & analytics (dependent on Phase 1 data)

**8. Suppliers setup page** (`src/pages/setup/Suppliers.tsx`, route + sidebar entry)
- CRUD table following the existing `Stores.tsx` / `ItemGroups.tsx` pattern; deletion blocked when items reference the supplier.

**9. Analytics page** (new `src/pages/InventoryAnalytics.tsx`)
- Tabs: Stock Overview | Suppliers.
- Filters: date range, Category, Supplier, Location.
- KPI cards: Total Inventory Value (NPR), Total SKUs, Avg Stock Level, Below Reorder Point.
- Charts (recharts, existing chart tokens): Items by Category (horizontal bars), Stock Status Distribution (donut with In/Low/Out %), Movement Trends (multi-line by type over the selected range).
- Turnover & Reorder Analysis: three ranked lists — Fastest Moving, Slowest Moving, Most Reordered (turnover = issued qty ÷ avg stock over the window).
- Suppliers tab: items supplied, receipts count, total received value, last receipt date per supplier.
- Export CSV for each block.

**10. Polish**
- CSV import for items (Phase 1 button wired here if not completed earlier).
- Low-stock notification badge feeding the existing notification panel.
- Permission keys for inventory movements/analytics in the RBAC action list.

---

### Technical notes
- No new global state: all reads go through TanStack Query hooks keyed under `["inv", ...]`; mutations invalidate that prefix.
- Sorting/filtering happens client-side on the cached item list (dataset is small); the movements ledger is server-paged by date range.
- Valuation stays `quantity × avg rate` (single rate retained, VAT-inclusive) — no cost/selling split.
- Every stock-changing action produces both an `inv_movements` row and an `audit_logs` entry, so history is reconstructible.
