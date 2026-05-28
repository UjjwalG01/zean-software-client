# Inventory Management Module

Add a complete inventory module to track stock across stores with item groups, items, quantities, rates, and total valuation. Uses the existing premium card + table styling (PremiumReportFrame look) and dark gold theme.

## Navigation
- New sidebar entry **"Inventory"** (icon: `Package`) under Main, route `/inventory`.
- New setup entries under Setup:
  - **Stores** → `/setup/stores`
  - **Item Groups** → `/setup/item-groups`

## Data model (Supabase / Firestore)

Four collections/tables:

1. `stores` — `{ id, name, outlet_id?, location, active }`
2. `item_groups` — `{ id, name, description, active }`
3. `inventory_items` — `{ id, code, name, group_id, store_id, unit (pcs/kg/ltr), quantity, rate (NPR), reorder_level, active, created_at }`
4. `stock_movements` — `{ id, item_id, type ('purchase'|'issue'|'adjustment'), quantity, rate, reference, note, created_by, created_at }`

`quantity` on `inventory_items` is the running balance; each Add Stock / Issue writes a `stock_movements` row and updates the balance.

Valuation per item = `quantity × rate`. Store valuation = Σ items. Total valuation = Σ stores.

## Pages

### 1. `src/pages/Inventory.tsx` — main dashboard
Premium layout:
- **Top stat cards** (StatCard style): Total Items, Total Quantity, Total Valuation (NPR), Low-Stock Items, # Stores.
- **Filter strip**: Store (dropdown), Item Group (dropdown), search by name/code, status (active/low/out).
- **Premium table** (reuse `PremiumReportFrame` style) with columns:
  Code · Item · Group · Store · Unit · Qty · Rate (NPR) · Valuation (NPR) · Status badge (In Stock / Low / Out).
  Group rows by Store; footer totals row for Qty and Valuation. Export Excel + Print supported.
- **Actions in header**: `+ Add Item` (new SKU), `+ Add Stock` (purchase against existing item), row actions: View movements, Edit, Deactivate.

### 2. Add Item modal
Fields: Code (auto-suggest), Name, Group, Store, Unit, Opening Qty, Rate, Reorder Level. Saves item and creates an opening-balance movement.

### 3. Add Stock (Purchase) modal
Fields: Item (searchable), Quantity, Rate (defaults to current, editable), Reference (invoice no.), Note. On save: append `stock_movements` row (`type='purchase'`), increment `inventory_items.quantity`, update rate to weighted-average:
`new_rate = ((old_qty × old_rate) + (add_qty × add_rate)) / (old_qty + add_qty)`.

### 4. Item detail drawer / `src/pages/InventoryItem.tsx`
Header card with current qty, rate, valuation, reorder level. Movements table (date, type, qty, rate, ref, user, balance after). Issue Stock action.

### 5. Setup pages
- `src/pages/setup/Stores.tsx` — premium card list + Add/Edit dialog (name, outlet link, location, active).
- `src/pages/setup/ItemGroups.tsx` — same pattern (name, description, active).

## Files

**Create**
- `src/pages/Inventory.tsx`
- `src/pages/InventoryItem.tsx`
- `src/pages/setup/Stores.tsx`
- `src/pages/setup/ItemGroups.tsx`
- `src/components/inventory/AddItemModal.tsx`
- `src/components/inventory/AddStockModal.tsx`
- `src/components/inventory/IssueStockModal.tsx`
- `src/lib/firebase-inventory.ts` — CRUD + movement helpers (weighted-average rate, balance update)
- `src/hooks/use-inventory.ts` — React Query hooks for stores, groups, items, movements
- Mock seed data in `src/lib/mock-data.ts` (3 stores, 4 groups, ~15 items, sample movements) for offline fallback.

**Edit**
- `src/components/AppSidebar.tsx` — add Inventory + Stores + Item Groups nav entries.
- `src/App.tsx` — register routes: `/inventory`, `/inventory/:id`, `/setup/stores`, `/setup/item-groups`.
- `src/components/GlobalSearch.tsx` — index inventory items so Ctrl+K finds them.

## Business rules
- 13% VAT-inclusive treatment on purchase Rate (consistent with rest of app); valuations display as gross totals.
- NPR formatting via existing currency helpers.
- Low-stock badge when `quantity ≤ reorder_level`; Out when `quantity = 0`.
- All mutations write to Audit Log (per existing pattern in `firebase-services.ts`).
- RBAC: gated via existing custom roles (new permission keys `inventory.view`, `inventory.manage`).

## Technical notes
- Premium table reuses the `PremiumReportFrame` blue header + banded body + group-by Store + footer totals + Excel/Print already implemented.
- Falls back to mock data when Supabase/Firebase is offline (existing pattern).
- Weighted-average rate calc lives in `firebase-inventory.ts` so it stays consistent between web UI and any future imports.
