
# Implementation Plan — Outlet Scoping, Overpaid Status, TZ Strictness, Cashier Report

This is a large, cross-cutting change (~10 files modified + 1 migration). Approving this plan lets me execute all 9 tasks in one pass.

---

## 1. Outlet attachment on all financial writes
**Schema** (`db/migrations/2026-06-13_outlet_scoping_overpaid.sql`):
- Add nullable `outlet_id uuid` to `public.charges`, `public.payments`, and (if present) `public.transactions`.
- Index `(outlet_id, created_at desc)` on each.
- Backfill: leave NULL (legacy) — UI shows "All outlets" for those.

**Code**:
- `src/lib/charges.ts` — `createChargeForBooking`, `createManualCharge`, `applyAdvance` accept `outletId` and persist it both in the `charges` insert and the legacy transaction mirror.
- `src/components/RecordChargeModal.tsx` — add Outlet `<Select>` defaulting to `useOutlet().selected`. Active outlets only. Required.
- All callers (`OutletPOSView`, `Bookings`, `Transactions` settlement, `QuickBalanceModal` advance) pass `selected.id`.

## 2. New `overpaid` transaction status
**Schema**: extend status check (we use plain text columns today) — derive `overpaid` in `member-ledger.ts` when `paid - charged > 0` for a member's running balance, and surface a chip everywhere status is rendered.

**Code**:
- `src/lib/mock-data.ts` — add `"overpaid"` to `TransactionStatus` union + `statusColors` (amber).
- `src/components/StatusBadge.tsx` already token-driven — no change.
- `src/lib/member-ledger.ts` — emit `overpaid` rows when net balance < 0.
- Reports (`LedgerReport`, `Reports.tsx` cashier/ageing) and `Transactions.tsx` filter pill list include "Overpaid".

## 3. TZ-strict dates everywhere
- `src/components/DateRangeFilter.tsx` defaults via `toIsoDayInTz(new Date())`.
- `src/pages/Bookings.tsx`, `Forecast.tsx`, `Transactions.tsx`, `Reports.tsx`: replace remaining `new Date().toISOString().slice(0,10)` and `toLocaleDateString()` with `toIsoDayInTz` / `formatInTz`.
- `src/lib/member-ledger.ts` grouping keys use `toIsoDayInTz`.

## 4. Same-day resettle guard
- `src/pages/Transactions.tsx` — disable "Resettle" button when `toIsoDayInTz(txn.date) !== toIsoDayInTz(new Date())`. Tooltip: "Resettlement only allowed on the day of the original transaction."

## 5. Outlet-id filtering on global views
- `useMembers`, `useBookings`, `useTransactions`, `useCharges` accept `{ outletId }` and filter client-side (RLS already restricts).
- `MembersList`, `Bookings`, `Transactions`, `Reports`, `OutletPOSView`, `Users` page pass `useOutlet().selected?.id`.
- When no outlet selected → empty result + prompt to pick outlet.

## 6. Confirmation modals for void / settle
- `src/components/TransactionDetailModal.tsx` + `Transactions.tsx`: wrap Void and Settle actions in `AlertDialog` with member, amount, and method shown; require typed confirmation for Void.
- Validation guards: cannot void already-paid transactions older than today; cannot settle a void/charge with zero remaining.

## 7. Member fetch by outlet
- `useMembers(outletId?)` — query param attached; `MembersList`, `MemberProfile`, `QuickBalanceModal`, `RecordChargeModal` all pass current outlet.

## 8. Cashier Report rework (`src/pages/Reports.tsx`)
Columns by default: **Date** | Member | Receipt | Method | Net Amount | **Settled At (timestamp)**.

Toolbar toggle "Show details" reveals extra columns: **Billed Amount**, **Discount**, **Collected Amount**, **User** (uses `transaction.createdBy` / settlement audit row).

## 9. Cleanup
Delete unused: `next.config.ts`, `prisma/schema.prisma` (project is Vite, not Next/Prisma), stray demo files (`src/test/example.test.ts`), unused mock helpers. Strip dead `// TODO` blocks and unused exports surfaced by `rg`.

---

## Verification
- Build passes (auto-run).
- Manually click: record charge → outlet attached; settle today vs yesterday (button disabled); overpaid badge on a member with credit; Cashier Report "Show details" toggle expands columns; switching outlets refilters Members/Bookings/Transactions.

## Files touched
Migration: `db/migrations/2026-06-13_outlet_scoping_overpaid.sql`
Edits: `charges.ts`, `member-ledger.ts`, `mock-data.ts`, `tz.ts`(minor), `RecordChargeModal.tsx`, `OutletPOSView.tsx`, `QuickBalanceModal.tsx`, `TransactionDetailModal.tsx`, `Transactions.tsx`, `Bookings.tsx`, `Forecast.tsx`, `Reports.tsx`, `MembersList.tsx`, `MemberProfile.tsx`, `Users.tsx`, `use-firestore.ts`, `use-charges.ts`, `DateRangeFilter.tsx`.
Deletes: `next.config.ts`, `prisma/`, `src/test/example.test.ts`.

Approve to execute.
