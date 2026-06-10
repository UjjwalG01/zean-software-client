## Plan

A large multi-part change touching voids, settlements (with discount), date range filters, reports, and ledger. Breaking it into focused steps.

### 1. Void behavior — zero out amount + status `voided`
- Update void handlers (Transactions page void action, and any charge void path) to set `amount=0`, `vat=0`, `total=0`, `status='voided'` on the transactions row, and mark the linked `charges` row `meta.voided=true` with `total=0` (or keep total and rely on voided flag — confirm with user).
- Ledger already skips voided rows; ensure summary excludes them entirely.

### 2. Settlement Discount field
- Schema: add `discount numeric(12,2) default 0` to `payments` (or `transactions`) and to `charges` (to record settled discount). Migration with grants preserved.
- UI: Add Discount input in settlement form (RecordChargeModal / Transactions settle dialog). Net Payable = total − discount; store discount on payment row and reduce charge `total` settlement accordingly.
- Ledger: include a Discount column row in Quick Balance breakdown.

### 3. Quick Balance — detailed breakdown
- Expand summary card to show:
  - Booking Charges (net), VAT, Gross Charges
  - Manual Charges
  - Discounts applied
  - Advance, Settlements
  - Net Payable
- Per-row breakdown columns optional; keep existing ledger table but add tooltip/expand for VAT/discount on charge rows.

### 4. Date range filters
- Add a shared `DateRangePicker` (popover with two calendars or two date inputs) used by:
  - `Bookings.tsx` (filter `date` between from/to)
  - `Forecast.tsx` (booking forecast)
  - `Transactions.tsx` (filter `date`/`createdAt`)
- Persist range in component state; default = last 30 days.

### 5. Member Ledger Report (`LedgerReport.tsx`)
- Replace existing columns with: Member Name | Services | Total Billed (+) | Total Paid (−) | Net Balance | Status.
- Status logic mirrors Quick Balance: `Settled` when net=0, `Partial` when 0<paid<billed, `Unpaid` when paid=0.
- Services = comma-joined distinct charge_head values per member.

### 6. Revenue by Service → Revenue by Outlet report
- In `Reports.tsx`, change the "Revenue by Service" widget to group by `outletId` / outlet name.
- Update both the bar/pie chart and the numeric breakdown table.
- Source: `transactions` joined with outlets (already on transaction as `outletId`).

### Technical notes
- New migration file: `db/migrations/2026-06-10_settlement_discount_and_void.sql` adding `discount` columns + grants.
- Reuse shadcn `Popover + Calendar` for date range; new `src/components/DateRangePicker.tsx`.
- `buildMemberLedger` extended to return `{ vatTotal, discountTotal, bookingChargesTotal, manualChargesTotal }`.

### Clarifications
1. Discount on settlement — should it reduce Net Payable directly (treated like a write-off credit) and be stored per-payment, or per-charge? Default: stored on the payment row, applied as a credit in the ledger labeled "Discount".
2. Revenue by Outlet — keep the same chart type (bar) and add outlet color legend? Default: yes.
