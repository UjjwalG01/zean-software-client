# Implementation Plan

Large multi-area refactor. Will land in 6 phases, each shippable on its own.

## Phase 1 — Charging-first core (the foundation)

Establish a single source of truth: **charges raise due balance, advances/payments reduce it**. Everything else reads from this.

- Extend `Transaction` type with canonical `type`s: `Charge`, `Advance`, `Payment`, `Refund`, `Void`. Add `status: 'pending' | 'settled' | 'voided'` and `linkedBookingId?`, `linkedChargeIds?: string[]`.
- New helper `src/lib/charges.ts`:
  - `createChargeForBooking(booking, services[])` → writes one `Charge` row per service head (uses Charge Heads from setup, maps service → head, falls back to "Service Charge").
  - `createChargeManual(memberId, headId, amount, note)` (used by Record Charge modal).
  - `applyAdvance(memberId, amount, method, note)` → writes an `Advance` row, then runs `settleOldestCharges(memberId)` which marks charges `settled` FIFO until advance exhausted; leftover becomes a credit balance row.
- `buildMemberLedger` already supports Charge/Advance/Payment — extend its summary to include `dueBalance = totalCharged − totalPaid − advance` and expose per-charge settlement state.
- Hook into `useAddBooking` to call `createChargeForBooking` on create (only when `outletId` is present and status ≠ cancelled). On `cancel` → void linked charges. On `complete` → leave charges as-is.
- Member profile + Quick Balance modal + Members list "Due" column all read from `summary.dueBalance` (one helper, no per-page math).

## Phase 2 — Modules + RBAC + Audit module linking

- New Supabase migration:
  - `modules` table (`id, name, slug, description, parent_id, route, icon, order_index, active`).
  - Seed with existing app pages (Dashboard, Members, Bookings, Transactions, Inventory, Reports, Forecast, Audit Logs, Users, Roles, Email Templates, Setup → Outlets/Stores/Item Groups/Service Types/Charge Heads, Settings).
  - Add `module_id uuid references modules(id)` to `audit_logs`.
  - GRANT + RLS as per project rules.
- `src/lib/modules.ts` — fetch + cache modules; provides slug→id map.
- Update `logAudit()` to accept `moduleSlug` and resolve `module_id` server-side (lookup once, cached).
- Replace every existing `logAudit({ module: "..." })` callsite to use slug form. Keep `module` text column for backwards compat.
- `RolesManager.tsx` rebuilt to render permission rows from the `modules` table (instead of the hardcoded `PERMISSION_PAGES`). Each module row gets View / Create / Edit / Delete toggles.
- Update `firebase-roles.ts` permission shape to be keyed by module slug; `useMyPermissions` + `canView` unchanged (already slug-based).
- `RouteGuard` ROUTE_KEYS rebuilt from modules (route prefix → slug).
- Audit Logs page gets a Module dropdown sourced from `modules` (not hardcoded enum).

## Phase 3 — Booking restrictions & completed-state behavior

- `AddBooking` / Bookings page "New Booking" dialog: hard-block submission if `outletId` is empty. Disable submit button + show inline error. Validate again inside `useAddBooking` (throws with toast).
- `BookingDetailModal`:
  - If `status === "completed"`: hide "Billing / Record Payment" button, do NOT navigate to Transactions, only show "Print Bill" (renders existing receipt print).
  - Keep Amend + Cancel visible for non-completed bookings.

## Phase 4 — Transactions redesign

- Rename "Record Payment" → "Add Advance" everywhere (button labels, modal title, page header, toast strings). Modal collapses to: member, amount, method, note. On submit → `applyAdvance(...)`.
- New transactions table columns: **Receipt · Date · Member · Method · Type · Status · Total · Actions**.
  - Status badge: `pending` (amber) / `settled` (green) / `voided` (muted).
  - Actions:
    - `pending` → **Settle** button (opens SplitPaymentForm prefilled with outstanding amount; on success marks the charge settled).
    - `settled` → **Print** + **Resettle** (re-opens settle form to record an additional payment, e.g. refund/top-up adjustment, configurable).
- Drop legacy "Delete" action.

## Phase 5 — Audit Logs UI

- Default `from` and `to` filter to today's date on mount.
- Move the date range into a single visible "Date" row with Today / Yesterday / Last 7d quick chips.
- Add Module dropdown (from `modules` table) replacing the hardcoded MODULES const.

## Phase 6 — Email cleanup + Resend audit

- Remove `react-email-editor` from `package.json`, delete `src/components/UnlayerEditor.tsx`, strip all imports + usages from `EmailTemplates.tsx`.
- Keep the existing manual editor: subject + body textareas + variable chips ({{member_name}}, {{booking_id}}, {{plan_name}}, {{amount}}, {{due_date}}, {{outlet_name}}). Add an Edit/Preview tab switch — Preview renders the merged HTML with sample variables.
- Resend audit (read-only report, no code changes unless something is actually broken):
  - Verify `supabase/functions/send-email/index.ts` deploys (CORS, env, error envelope).
  - Confirm `RESEND_API_KEY` secret is set.
  - Confirm `email_reminders` table exists + has correct grants.
  - List any gaps in the final response.

## Technical notes

- All schema work in one migration: `db/migrations/2026-06-03_charging_modules_audit.sql`.
- Type changes consolidated in `src/lib/mock-data.ts` (`Transaction` type) and propagated.
- Mock data fallback: extend mock transactions to include a few `Charge` + `Advance` rows so the UI demos correctly when Firebase is offline.
- Tests: extend `src/test/example.test.ts` with a small ledger settlement test (charge 1000 → advance 600 → due 400; advance 500 more → settled).

## Out of scope for this pass (will be listed as pending)

- Per-charge partial-settle history view inside Member Profile (current pass shows aggregate due only).
- Twilio SMS verification (only Resend was requested).
- Backfilling audit_logs.module_id for historical rows (new rows only).
