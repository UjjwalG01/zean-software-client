## Goal

Make VitaFit Club's data, permissions, billing and reporting consistent across every page by replacing the remaining mock layers with real Cloud-backed tables, hardening RBAC, and extending the booking/transaction/reports modules. Ship a single SQL migration the user can apply to the server.

## Scope & approach (14 items)

### 1. Admin-driven password reset
- Replace "Send reset link" in `Users.tsx` with **Reset Password** modal: admin types new password (+ confirm), calls a new edge function `admin-reset-password` (service-role `auth.admin.updateUserById`).
- Set `extras.mustChangePassword = true` on that user. Existing `ForcePasswordChangeModal` already triggers on next login — verify path end-to-end.

### 2. Split / multi-mode payments
- Update `TransactionDetailModal` settle flow + `firebase-services.recordPayment` to accept `payments: [{ mode, amount, reference, note }]`.
- New table `transaction_payments` (FK → `transactions.id`). UI: repeatable row list with running "Paid / Remaining / Bill" totals; submit blocked when `sum(payments) > bill` or `< bill` (configurable: partial allowed → keeps txn `partial`).
- Transactions list + Reports read totals via SUM of `transaction_payments`.

### 3. Outlet image URL
- Add `image_url text` to `outlets`; field in `setup/Outlets.tsx` modal (URL input + thumbnail preview). Display thumbnail in outlet picker & cards.

### 4. Rename "Record Payment" → "Record Charge"
- `Transactions.tsx`: rename CTA, open new `RecordChargeModal` with **member picker + charge head dropdown** (damage, license renewal, breakage, misc — sourced from new `charge_heads` table, admin-managed in Setup) + amount + note. No payment mode.
- Inserts a `transactions` row of `type='charge'`, `status='unpaid'`, `outlet_id` optional, increases member's ledger payable. Member Ledger report & Member Profile balance pick this up automatically.

### 5. Outlet-independent members
- Remove `outlet_id` requirement from `AddMember.tsx` / `MembersList`. Schema: make `members.outlet_id` nullable; drop "primary outlet" filter on member visibility (members list shows all regardless of selected outlet). Bookings/transactions keep their own `outlet_id`.

### 6. Real backend for inventory + remaining mock modules
- New tables: `stores`, `item_groups`, `inventory_items`, `stock_movements`, `charge_heads`, `booking_statuses` (enum), `transaction_payments`, plus the missing `custom_roles` / `role_permissions` (item 7).
- Rewrite `inventory-store.ts` → `firebase-inventory.ts` using Supabase; keep the existing hook surface (`use-inventory.ts`) unchanged. Seeding moves to a one-time SQL insert. Audit Log writes on every mutation.
- Audit any other `mock-data.ts` consumer still doing writes (charge heads, roles) and route through Supabase.

### 7. Enforce RBAC per assigned page
- `custom_roles(id, name, description)` + `role_permissions(role_id, page_key, can_view, can_create, can_edit, can_delete)`.
- `RolesManager` saves to DB (replaces localStorage). `useCurrentUserPermissions()` hook resolves `extras.customRoleId` → permission map.
- `AuthGuard` / `AppSidebar` / route wrapper hide unauthorized routes; per-page action buttons (Add/Edit/Delete) disabled when right missing. Admin role = wildcard.

### 8. Sports outlet → 24-hour timeline bookings
- `Bookings.tsx`: when selected outlet's service type = `sports`, day-click opens **DayTimelineDialog** showing 00–23 hourly rows with existing bookings as blocks.
- Slot creation form: member, service, start time, duration (hrs), status (`confirmed | provisional | waitlisted`). Server-side overlap check rejects collisions for the same outlet/resource on `confirmed` bookings; `waitlisted` allowed to overlap.
- Schema: add `start_time timestamptz`, `end_time timestamptz`, `status booking_status` enum to `bookings`; partial unique exclusion via `EXCLUDE USING gist` on `(outlet_id WITH =, tstzrange(start_time,end_time) WITH &&) WHERE status='confirmed'`.

### 9. Amend / cancel booking
- Booking detail modal gets **Amend Date** (date+time picker → updates `start_time/end_time`, re-runs overlap check) and **Cancel** (sets `status='cancelled'`, logs reason). Cancelled rows kept for audit, excluded from collection totals.

### 10. Void / reverse sale
- Add `voided boolean`, `voided_at`, `voided_by`, `void_reason` to `transactions`.
- Void action on settled txn: writes a reversing `transaction_payments` entry of equal negative amount, flips `voided=true`. Daily Sales / Cashier / Collection reports filter or net-out voided rows (toggle "Include Voided").

### 11. Discounted rate toggle in booking
- In booking service line: switch labeled "Discounted Rate" above the rate input. Off → rate locked to service master price. On → rate editable, persist `original_rate`, `discount_amount`, `discount_reason` on the booking line (extend bookings table accordingly).

### 12. New reports
- Add three sub-tabs in `Reports.tsx` reusing `PremiumReportFrame`:
  1. **Daily Sales Report** — grouped by date → sales department, Sales / VAT Payable / Total Sales rows + month roll-up (image 1).
  2. **Cashier / Collection Report** — receipt/advance + settlements, group by date, totals per day (image 2).
  3. **Sales Contribution** — by company/member, room nights, contribution %, ARR, room/other/total revenue (image 3).
- All filters above; all support Excel + Print; reflect split payments, charges, voids.

### 13. One attendance mark per member per day
- DB: `UNIQUE (member_id, date(check_in_at))` via generated column `check_in_date` + unique index.
- `Attendance.tsx`: check-in button records `check_in_at = now()`, disabled if already marked today; shows existing check-in time.

### 14. Consolidated SQL
- Produce `db/migrations/2026-05-29_full_update.sql` containing every schema change above with explicit `GRANT`s, RLS policies, enum creations, seed for default charge heads and booking statuses. Idempotent (`IF NOT EXISTS`).

## Technical details

### New / changed tables (summary)
```text
custom_roles(id, name, description, active, created_at)
role_permissions(role_id, page_key, can_view, can_create, can_edit, can_delete)
charge_heads(id, name, default_amount?, active)
transaction_payments(id, transaction_id, mode, amount, reference, note, created_at, created_by)
stores / item_groups / inventory_items / stock_movements        -- mirrors inventory-store.ts shape
booking_status enum('confirmed','provisional','waitlisted','cancelled','amended')
bookings + start_time, end_time, status, original_rate, discount_amount, discount_reason, amended_from
transactions + type('sale'|'charge'), voided, voided_at, voided_by, void_reason, charge_head_id
outlets + image_url
members.outlet_id  -> nullable
attendance + check_in_date generated, UNIQUE(member_id, check_in_date)
```

### Edge function
- `supabase/functions/admin-reset-password` — verifies caller is admin via `has_role`, then `auth.admin.updateUserById(targetId, { password })` + sets `mustChangePassword`.

### Front-end touchpoints
`Users.tsx`, `RolesManager.tsx`, `AuthGuard`, `AppSidebar`, `AppLayout`, `AddMember.tsx`, `MembersList.tsx`, `Bookings.tsx` (+ new `DayTimelineDialog`, `AmendBookingDialog`), `BookingDetailModal`, `Transactions.tsx` (+ `RecordChargeModal`, `VoidTransactionDialog`, `SplitPaymentForm`), `TransactionDetailModal`, `setup/Outlets.tsx`, new `setup/ChargeHeads.tsx`, `Reports.tsx` (3 new sub-tabs), `Attendance.tsx`, replace `inventory-store.ts` with `firebase-inventory.ts`.

### Data consistency safeguards
- Single source of truth for totals: views `v_transaction_totals` (bill, paid, balance, voided) consumed by Reports + Member Ledger + Member Profile.
- All mutations go through `firebase-*` services that also write to `audit_logs`.
- Currency stays NPR, 13% VAT inclusive (no change to setup prices).
- Mock fallback kept only for read-only demo when Supabase unreachable; writes always hit DB.

### Shortcomings to watch
- Overlap exclusion needs `btree_gist` extension — included in migration.
- Voiding a partially-paid txn must reverse only the paid portion; UI confirms before posting.
- Removing `members.outlet_id` requires backfilling existing rows (`SET NULL` if outlet deleted later — already cascades).
- RBAC changes can lock out the admin if `customRoleId` is mis-set; migration seeds an "Administrator" role with wildcard and forces existing admins to it.
- Split payments + voids change every report aggregation — all report queries refactored to use the new view in one pass.

### Deliverables
- All code changes above.
- One runnable SQL file at `db/migrations/2026-05-29_full_update.sql`.
- Updated `DATABASE.md` describing new tables.
