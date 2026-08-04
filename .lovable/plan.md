# Audit: Double Settlement, Booking Status Sync & Sales vs Collection

## What the audit found

**A. Every booking shows up twice on the Transactions page**

The accounting model is already correct (charge = debit, payment = credit), but the
Transactions list renders the raw union of both tables. So one booking that has been
paid produces two visible rows of the same amount: the `charges` row (now "Settled")
and the `payments` settlement row. There is no duplicate write — it is a presentation
problem plus a missing "same bill = one line" rule.

**B. Nothing prevents a second settlement of the same booking / bill**

- `updateTransaction` guards with `wasPaid`, but that value is read from a separate
  query, so two fast clicks both read `unpaid` and both insert a payment row.
- The Settle button is not disabled while the mutation is in flight (only the label
  changes in one of the two modals).
- The database has no uniqueness on `settled_charge_id`, so two credits can point at
  one charge.
- `receipt_no` is unique on `payments` but the value is `Date.now()`-based, so two
  clicks in the same millisecond window are the only thing blocked.
- The POS "Billing" deep link can build a `TEMP-` charge when it cannot match the
  existing pending charge — that path inserts a *brand new* charge + payment, which is
  a real duplicate, not just a visual one.

**C. Sports outlet: booking stays "pending" after settlement**

- Settling updates the booking only when `settleTxn.bookingId` exists. For POS orders
  the charge carries `meta.bookingIds` (an array); only `bookingIds[0]` is mirrored to
  `bookingId`, so the remaining bookings in a multi-line order are never closed.
- The settle handler writes `status: "completed"` plus junk fields
  (`settledAt`, `paymentMethod`) that are not columns on `bookings`; the write can be
  rejected, leaving the booking pending.
- A pending-but-paid booking then also refuses to cancel, because the cancel path tries
  to void a charge that is already paid.

**D. Sales vs Collection maths**

Reports already split charges (sales) from payments (collection), but the sales figure
is `total` with no discount column beside it, so `Sales - Discount = Collection` cannot
be read off the report. Discount is stored on both `charges.discount` and
`payments.discount`, which allows the two to drift.

## Fix plan

### 1. Database migration (`db/migrations/2026-08-04_settlement_integrity.sql`)

- Unique partial index: one non-voided settlement per charge
  `unique (settled_charge_id) where settled_charge_id is not null and voided = false`.
- `settle_charge(charge_id, method, discount, paid_on, actor)` SECURITY DEFINER function
  that, in one transaction: locks the charge row (`for update`), rejects it when the
  status is already `paid` or the charge is voided, writes `status='paid' + paid_at`,
  inserts the matching `payments` row, and flips **all** bookings referenced by
  `meta.bookingId` / `meta.bookingIds` to `status='completed'`.
  A single round-trip means concurrent clicks cannot both win.
- `void_payment(payment_id, reason)` that reverses the above: marks the payment voided
  and returns the charge to `unpaid` so it may be settled again (void is the only way
  back — matching the requested rule).
- Discount becomes owned by `charges`; the payment row copies it for reporting only.
- Grants for `authenticated` / `service_role` on both functions.

### 2. Service layer (`src/lib/supabase-services.ts`)

- `settleCharge()` wrapper calling the new RPC; `updateTransaction` routes any
  `status: paid/completed` on a charge through it instead of the current read-then-write.
- Remove the ad-hoc booking update from the UI — booking closure now happens server side.
- `getTransactions` keeps returning both sides but tags settlement payments
  (`isSettlement: true`, `chargeRowId`) so the UI can collapse them.

### 3. Transactions page (`src/pages/Transactions.tsx`)

- Default list view shows **one row per bill**: the charge row, with status
  Pending / Settled / Voided, method and paid date pulled from its settlement payment.
  Standalone payments (advances, direct sales with no charge) still render as their own row.
- A "Show credit entries" toggle reveals the raw payment rows for auditors.
- Settle button disabled while pending, and hidden entirely when the row is already
  settled or voided; only **Void** remains available on a settled bill.
- Remove the `TEMP-` synthetic-charge fallback in the deep-link handler: if the charge
  cannot be found, show an error rather than inventing a second charge.

### 4. POS / Bookings

- `OutletPOSView`: billing link always carries the real `chargeId`; cancel is blocked
  once the linked charge is paid (void the transaction first).
- `Bookings.tsx`: same guard on Cancel Enrollment; the calendar reads the booking's
  `status` so it flips to Completed as soon as the RPC returns.

### 5. Reports

- Daily Sales report gains explicit `Sales`, `Discount`, `Net (Collectible)` columns
  sourced from `charges`; Collection report stays on `payments`, and a footer assertion
  shows `Sales - Discount - Outstanding = Collection` so drift is visible immediately.

## Technical notes

- No schema changes to `bookings`; only its `status` value is driven by the RPC.
- The unique index is the real duplicate guard; UI disabling is defence in depth.
- Existing duplicated data is not deleted by the migration — a one-off cleanup query is
  included, commented out, so it can be reviewed before running.
