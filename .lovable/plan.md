# Implementation Plan

This is a large cross-cutting change spanning DB schema, services, RLS, and UI. I'll deliver it in three coordinated tracks, each with its own migration so it can be rolled back independently.

---

## Track 1 — Global Time Zone

**Settings UI (`src/pages/Settings.tsx` → Time Zone tab)**
- Read browser TZ with `Intl.DateTimeFormat().resolvedOptions().timeZone` and show as the suggested default.
- Persist to `companySettings.timezone` (Firestore doc already used for dynamic config).
- Searchable select using the IANA list from `Intl.supportedValuesOf("timeZone")`.

**Runtime helper (`src/lib/tz.ts` — new)**
- `getAppTimezone()` returns stored TZ or browser TZ.
- `formatInTz(date, fmt)`, `startOfDayInTz(date)`, `endOfDayInTz(date)`, `toIsoDayInTz(date)` using `date-fns-tz`.
- Replace all `.toISOString().slice(0,10)` / `new Date().toDateString()` usages in:
  - `DateRangeFilter` → ranges convert to UTC bounds for the configured TZ.
  - `member-ledger.ts`, `Reports.tsx`, `Bookings.tsx`, `Transactions.tsx`, `Forecast.tsx`, `AuditLogs.tsx`.

---

## Track 2 — Outlet & Module Scoping + RLS

**Migration `2026-06-11_outlet_scoping_rls.sql`**
- Add `outlet_id uuid REFERENCES public.outlets(id) ON DELETE RESTRICT` and `module_id uuid REFERENCES public.modules(id) ON DELETE RESTRICT` to: `bookings`, `transactions`, `payments`, `services`, `plans`, `charges`, `invoices`.
- Add `outlet_id` to `user_role_assignments` (nullable = "all outlets" for admins).
- Backfill `outlet_id` from existing rows where possible; leave NULL otherwise.
- New SECURITY DEFINER function `public.user_has_outlet_access(_user uuid, _outlet uuid) returns boolean` — admin OR `outlet_id IS NULL` OR matches assignment.
- Replace per-table RLS SELECT/INSERT/UPDATE/DELETE policies for the scoped tables to require `public.user_has_outlet_access(auth.uid(), outlet_id)`.
- GRANTs preserved per the public-schema rule.

**Services**
- `firebase-services.ts`: every insert/update writes `outlet_id` from active outlet context and `module_id` from the calling page's module key.
- Queries in `useBookings`, `useTransactions`, `useCharges`, `usePlans`, etc. add `.eq("outlet_id", activeOutletId)` when one is selected.

**UI**
- `RolesManager.tsx`: add a multi-select "Outlets this role can access" column; persist via `user_role_assignments.outlet_id` (one row per outlet for the user, or NULL row = all).
- `OutletPOSView.tsx`, `Bookings.tsx`, `Transactions.tsx`, `Reports.tsx`: enforce active-outlet filter at the React-Query layer.

---

## Track 3 — Prepaid Membership Consumption

**Migration `2026-06-11_prepaid_membership.sql`**
- New table `public.prepaid_pools` (one per active prepaid membership):
  - `id`, `member_id`, `plan_id`, `outlet_id`, `module_id`, `total_paid numeric`, `daily_rate numeric`, `start_date date`, `end_date date`, `used_amount numeric default 0`, `status text default 'active'`, timestamps.
- Add `used_amount numeric` + `attendance_id uuid` + `pool_id uuid REFERENCES prepaid_pools(id) ON DELETE SET NULL` to `charges`.
- Standard GRANTs + RLS using `user_has_outlet_access`.

**Service layer**
- `src/lib/prepaid.ts` (new): `createPrepaidPool`, `consumeForAttendance(memberId, date)` — idempotent per `(pool_id, attendance_date)`, writes one `charges` row with `meta.type='consumption'` and `used_amount = daily_rate`, updates pool.
- Hook into `markAttendance` in `firebase-services.ts`: after marking Present, look up active pool for member → call `consumeForAttendance`.

**Ledger / Quick Balance**
- Extend `LedgerSummary` with `prepaidPaid`, `prepaidUsed`, `prepaidRemaining`.
- `member-ledger.ts` sums consumption charges separately; treats the upfront prepaid transaction as a credit but excludes it from "Total Paid" double counting (tag via `meta.type='prepaid'`).
- `QuickBalanceModal.tsx`: new "Prepaid Membership" panel with the three numbers.
- `MemberProfile.tsx` summary cards: add the same trio.
- `LedgerReport.tsx`: add "Prepaid Used" column when any pool exists for the member.

**Attendance UI**
- `Attendance.tsx`: show a small "−NPR X consumed from prepaid pool" toast after marking Present when a pool exists.

---

## Files to be added/changed (high level)

Added:
- `db/migrations/2026-06-11_outlet_scoping_rls.sql`
- `db/migrations/2026-06-11_prepaid_membership.sql`
- `src/lib/tz.ts`
- `src/lib/prepaid.ts`

Edited:
- `src/pages/Settings.tsx`, `src/pages/Attendance.tsx`, `src/pages/Bookings.tsx`, `src/pages/Transactions.tsx`, `src/pages/Forecast.tsx`, `src/pages/Reports.tsx`, `src/pages/AuditLogs.tsx`, `src/pages/MemberProfile.tsx`
- `src/components/DateRangeFilter.tsx`, `src/components/RolesManager.tsx`, `src/components/QuickBalanceModal.tsx`, `src/components/LedgerReport.tsx`, `src/components/OutletPOSView.tsx`
- `src/lib/firebase-services.ts`, `src/lib/firebase-roles.ts`, `src/lib/member-ledger.ts`, `src/lib/audit-log.ts`
- `src/hooks/use-firestore.ts`, `src/hooks/use-charges.ts`

---

## Open clarifications

1. **Daily rate source** for prepaid pools — derive from `plan.price / plan.duration_days`, or store explicitly when the membership is sold? Default: store explicitly at sale time so plan edits don't change historical consumption.
2. **RLS for users with no outlet assignment** — treat as "no access" (strict) or "all outlets" (lenient, today's behavior)? Default: strict; admins must be assigned, with an `is_admin` short-circuit.
3. **Backfill** for existing rows without `outlet_id` — assign to first active outlet, or leave NULL (visible only to admins)? Default: leave NULL.

Confirm or override these and I'll execute the migrations and edits.
