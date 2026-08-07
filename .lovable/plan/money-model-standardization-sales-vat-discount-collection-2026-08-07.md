# Money Model Standardization: Sales, VAT, Discount, Collection

## Goal

Every amount in the system is computed once, in one place, stored under one fixed set of column names, and read back by every page, view, report and chart from that same place.

## The canonical amount model

For any sale (booking, POS order, membership, manual charge):

```text
amount         = value excluding VAT
vat_amount     = VAT on amount (currently 0%)
amt_after_vat  = amount + vat_amount        <- the "billed amount"
discount       = reduction applied at settlement, on amt_after_vat
total          = amt_after_vat - discount   <- the "net payable" / collected
```

Reporting split (fixed, no exceptions):
- Sales reports read `amount`, `vat_amount`, `amt_after_vat`
- Collection reports read `amt_after_vat`, `discount`, `total`

## 1. Global value controller

New `src/lib/money.ts` — the single computation surface. Nothing else in the app is allowed to compute VAT, discount or totals.

- `buildAmounts({ gross, discount })` returns `{ amount, vatAmount, amtAfterVat, discount, total }` using the live VAT rate from `src/lib/vat.ts`.
- `toPaymentPayload(...)` / `toChargePayload(...)` produce the exact DB column set, so no call site hand-writes `{ amount, vat_amount, total }` again.
- `sumSales(rows)` / `sumCollection(rows)` are the only aggregation helpers reports and charts may use.

`src/lib/finance-math.ts` becomes a thin re-export of the above (form-draft preview only), and ad-hoc arithmetic in `Transactions.tsx`, `OutletPOSView.tsx`, `Reports.tsx` and print templates is replaced by calls into it.

## 2. Database changes

New migration `db/migrations/2026-08-07_amount_model.sql` (idempotent):

- `payments.amt_after_vat` — add if missing, backfill `amount + vat_amount`, keep NOT NULL.
- `charges.amt_after_vat` — same column added to charges so the debit side mirrors the credit side.
- Rewrite `settle_charge(...)` so it writes the full quintet:
  `amount`, `vat_amount`, `amt_after_vat = amount + vat`, `discount`, `total = amt_after_vat - discount`.
  Discount is applied only to `amt_after_vat`, never to `amount`.
- Rewrite `vw_member_ledger` and `member_financial_summaries` to expose
  `gross_amount = amt_after_vat`, `discount_amount`, `net_amount = total`, so
  `total_charged` comes from charge `amt_after_vat` and `total_paid` from payment `total`.
- Keep the existing unique partial index on `payments(settled_charge_id) where voided = false` (double-settlement guard) and the `void_payment` reversal.

## 3. Bookings: rate vs original_rate

At creation time the amount is split and stored on the booking itself:

- Health/Fitness (POS) outlet: `original_rate = rate = service price`, `discount_amount = 0`. No live discount at booking time.
- Sports outlet: `original_rate = configured service price`. If the service has "allow discounted price" and a lower price is entered, `rate = entered price` and `discount_amount = original_rate - rate`.
- The charge posted for the booking is always built from `rate` through `buildAmounts`.

Touches `src/pages/Bookings.tsx`, `src/components/OutletPOSView.tsx`, `src/lib/charges.ts`, `mapBookingRow`/`buildBookingRow` in `src/lib/supabase-services.ts`.

## 4. Booking status machine

- Settlement: `bookings.status -> 'completed'`; `booking_status` untouched.
- Cancellation: `bookings.status -> 'cancelled'`; `booking_status` untouched.
- `completed` and `cancelled` bookings are terminal: no Settle, Amend, Cancel or Edit buttons render, and the service layer rejects writes to them.
- Void applies to the payment only (`void_payment`), which re-opens both the charge and its bookings.

Touches the calendar/day dialogs, `BookingDetailModal.tsx`, `OutletPOSView.tsx` bookings panel, `Transactions.tsx` action column.

## 5. Idempotency

- Settlement stays a single `settle_charge` RPC call — the row lock plus the unique index make a repeated submit a no-op error, not a second payment.
- Every submit button (settle, cancel, POS checkout, record charge, amend) gets a shared `useSubmitGuard` hook: disabled + in-flight ref, so a double click cannot fire two mutations.
- Charge creation for a booking is keyed on `meta.bookingId`; if a live charge already exists for that booking, the existing row is reused instead of inserting a second one.

## 6. Consumers to re-point

All of these switch to `money.ts` helpers and the rewritten views:
`Reports.tsx` (Daily Sales, Collection, Outlet, Payment-method chart), `MemberProfile.tsx`, `QuickBalanceModal.tsx`, `LedgerReport.tsx`, `ReconciliationDrawer.tsx`, `TransactionDetailModal.tsx`, `print-utils.ts` receipts, `Index.tsx` dashboard KPIs.

## 7. Verification

- Type-check and production build.
- Manual trace of one booking end to end: create (charge, pending) -> settle with discount (payment, booking completed) -> confirm Sales, Discount and Collection figures line up on Reports and the member ledger -> void and confirm reversal.

## Technical notes

- Migration is additive and idempotent; existing rows are backfilled rather than rewritten.
- No client-side clock use — all timestamps continue to route through `src/lib/timeUtils.ts`.
- VAT rate keeps coming from `company_settings.vat_rate` via the `vat.ts` cache; `money.ts` reads it, never hardcodes 13.
