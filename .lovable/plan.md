# Implementation Plan

Seven independent changes. Grouped by area for clarity.

---

## 1. Inventory: auto-increment item code

**Files:** `src/components/inventory/AddItemModal.tsx`, `src/lib/inventory-store.ts`

- Add `nextItemCode()` helper in `inventory-store.ts`: scans `_items`, finds max numeric suffix on codes matching `^ITM-?(\d+)$` (or fully numeric), returns `ITM-0001` style padded to 4 digits.
- In `AddItemModal`, when opening for a new item (not editing), prefill `form.code` with `nextItemCode()`.
- Make the Code input `readOnly` for new items (still editable when editing existing).

## 2. Delete-guards for stores, item groups, items

**Files:** `src/lib/inventory-store.ts`, `src/pages/setup/Stores.tsx`, `src/pages/setup/ItemGroups.tsx`

- `deleteStore(id)`: count `inv_items` where `store_id = id` AND count `inv_movements` joined via items in that store. If > 0 → `throw new Error("Cannot delete — store has items or stock movements linked.")`
- `deleteGroup(id)`: count `inv_items` where `group_id = id`. If > 0 → throw.
- `deleteItem` already has guard ✓ (keep as is).
- Hook layer (`useInventoryMutations`) already rethrows; update `Stores.tsx` and `ItemGroups.tsx` delete handlers to `await removeStore.mutateAsync(id)` inside try/catch and `toast.error(err.message)` on failure (currently they swallow).
- Pre-check via lightweight query so the Delete button is `disabled` when locked, matching the GeneralSetup "in use" pattern. Add `useStoreInUse(id)` / `useGroupInUse(id)` hooks that fire one count query each.

## 3. Global error boundary + dashboard fallback

**Files (new):** `src/components/ErrorBoundary.tsx`, `src/components/ErrorFallback.tsx`
**Files (edit):** `src/App.tsx`

- `ErrorBoundary` is a class component implementing `componentDidCatch` + `getDerivedStateFromError`. Logs error to `console.error` and (best-effort) `logAudit({ module: "system", action: "error", ... })`.
- `ErrorFallback` shows a premium dark-themed card: gold "Something went wrong" heading, error message (collapsed), **Go to Dashboard** (navigates to `/`) and **Reload** buttons. Reuses `glass-card` and `gradient-gold` tokens.
- Wrap `<AppLayout>`/route tree in `App.tsx` with `<ErrorBoundary fallback={<ErrorFallback />}>`. Keep the existing route structure intact.

## 4. User deactivation enforcement

**Files:** `src/pages/Users.tsx` (default already active — verify), `src/contexts/AuthContext.tsx`, `src/pages/Login.tsx`, `src/components/RouteGuard.tsx`

- Confirm `initialForm()` sets users as active by default. `createAppUserRecord` already writes `active: data.isActive !== false` → already defaults to active. Make it explicit: pass `isActive: true` when calling `createMutation.mutateAsync`.
- In `AuthContext` after a successful sign-in, fetch the matching `app_users` row (`getAppUserByEmail`) and check `isActive`. If `false`:
  - `await supabase.auth.signOut()`
  - throw `new Error("User deactivated")` so `Login.tsx` `try/catch` surfaces it via `toast.error("User deactivated")`.
- `RouteGuard`: on each render, if current user's `isActive === false`, force sign-out + redirect to `/login` with toast.
- Block transactions: in mutation entry points already used by RouteGuard-protected pages, this is implicitly blocked. No per-mutation changes needed beyond the guard. (If you want belt-and-suspenders, we can add an `assertActive()` helper called from POS/booking save handlers — flag if desired.)

## 5. Services: drop capacity, instructor as dropdown

**Migration (new):** `db/migrations/2026-06-24_services_drop_capacity.sql`

```sql
ALTER TABLE public.services DROP COLUMN IF EXISTS capacity;
```

**Files:** `src/lib/supabase-services.ts`, `src/pages/PlansServices.tsx`, any service display (`Bookings.tsx`, `Reports.tsx` if capacity rendered)

- Remove `capacity` from `FirestoreService` type, `getServices` mapper, `addService`/`updateService` payloads.
- `PlansServices.tsx`:
  - Drop `capacity` from `emptyService`, `newService` state, form input field, table column.
  - Drop `capacity: Number(newService.capacity) || 1` from `handleCreateService` payload.
  - Replace the Instructor text Input with a `<Select>` whose options come from the `setup_instructors` list (already in `companySettings`). Read it via the same `useCompanySettings()` hook used elsewhere; parse the JSON list.
- Fallback `fallbackServices` array: remove `capacity` keys.

## 6. Full-property backup button

**Files (new):** `src/lib/backup.ts`
**Files (edit):** `src/pages/Settings.tsx` (or wherever the user expects the "Backup" CTA — confirm placement)

- `exportPropertyBackup(outletId)` runs in parallel:
  - `supabase.from(...).select("*").eq("outlet_id", outletId)` for: `members`, `bookings`, `transactions`, `services`, `membership_plans`, `inv_items`, `inv_movements`, `inv_stores`, `inv_item_groups`, `audit_log`, `attendance`, `charges`.
  - Tables without `outlet_id` (e.g. `membership_plans`, `plan_durations`, `companySettings`): full select.
- Bundle into a single JSON `{ exportedAt, outletId, tables: { name: rows[] } }`.
- Trigger client download as `vitafit-backup-{outlet-slug}-{YYYY-MM-DD}.json` via Blob + `URL.createObjectURL`.
- Add a "Backup All Data" button in **Settings** page → calls helper with current `useOutlet()` selected outlet. Toast progress + success. Audit-log the export.

## 7. Remove "Plan Durations" tab from General Setup

**File:** `src/pages/GeneralSetup.tsx`

- Drop the `planDurations` entry from the `sections` array and the `useSetupList("setup_planDurations", ...)` hook call.
- Change `defaultValue` on `<Tabs>` from `"planDurations"` to `"bloodGroups"`.
- Leave Plans & Services' duration tab untouched — the canonical Plan Durations live there (DB-backed `plan_durations` table via `usePlanDurations`).

---

## Order of execution

1. Migration `2026-06-24_services_drop_capacity.sql` (run manually after merge).
2. Code: items 1, 2, 5, 7 (pure refactors).
3. Code: item 3 (error boundary wrap).
4. Code: item 4 (auth flow).
5. Code: item 6 (backup utility + Settings button).
6. Smoke check: create item (auto-code), try to delete a store with items, deactivate a user and re-login, create a service without capacity, click Backup.

Proceed?
