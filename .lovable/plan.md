# Plan — 7-step Functional Update

Implementing the 7 tasks in order, with explicit verification after each.

## 1. Member Ledger — Balanced Sales vs Collection View
**Files:** `src/components/LedgerReport.tsx`, `src/pages/MemberProfile.tsx`, `src/lib/member-ledger.ts`

- Add a top "Membership Balance" panel showing **Initial Payment Done**, **Total Used (day-to-day)**, **Remaining**, sourced from `getMemberPoolsSummary` (already in `src/lib/prepaid.ts`).
- Below the panel, render a **collapsible per-member accordion** (using `@/components/ui/accordion`) where each item lists that member's bills/receipts: left column = charge amount, right column = paid amount, end column = running net balance.
- Reuse `buildMemberLedger` for the rows.

## 2. OutletPOSView "Ordered → Billing" flow
**Files:** `src/components/OutletPOSView.tsx`, `src/pages/Transactions.tsx`

- For service types `fitness` / `health`:
  - On placing an order, keep the line items in the cart visually flagged with an "Ordered" badge (do not clear cart).
  - Rename the primary action button "Pay Now" → "Billing".
  - "Billing" navigates to `/transactions?settle=<txnId>`; Transactions page reads the query param and auto-opens the existing settlement modal for that transaction.

## 3. Transactions Page — Net-After-Discount Totals + Clean Quick Balance
**Files:** `src/pages/Transactions.tsx`, `src/components/QuickBalanceModal.tsx`

- Header "Total" StatCard now sums `total - discount` (net received from guest, excluding voided).
- In `QuickBalanceModal`, remove individual rows of kind `Discount`, `Advance`, `Void` from the table — keep them only as the existing summary cards in the breakdown panel.

## 4. Bookings list — Current-month + Month-Picker; Hide for Fitness/Health
**Files:** `src/pages/Bookings.tsx`

- Remove `DateRangeFilter` from list view.
- Add a `<input type="month">` defaulting to current month; filter list to that month.
- When current outlet's service type is `fitness` or `health`, hide the month picker and any filter/settings icon entirely (no filter applied).

## 5. Amend Booking — same modal as Create
**Files:** `src/pages/Bookings.tsx`, `src/components/BookingDetailModal.tsx`

- "Amend" action opens the same Create Booking modal pre-filled with the existing booking's values (instead of the standalone detail/edit panel). Submit path updates the booking instead of inserting.

## 6. Cancel past-date bookings
**Files:** `src/components/BookingDetailModal.tsx`, `src/pages/Bookings.tsx`

- Remove the past-date guard on the Cancel action; allow cancel regardless of booking date.

## 7. Pagination + Default Date = Today
**Files:** `src/pages/Bookings.tsx`, `src/pages/Forecast.tsx`, `src/pages/Transactions.tsx`, `src/components/DateRangeFilter.tsx`

- Add page-size 25 pagination (using `@/components/ui/pagination`) on the three lists.
- Default `from`/`to` of all date-range filters to **today** (ISO in app timezone) instead of empty.

## Verification
- Run a typecheck-safe build (harness automatic).
- Click through preview: ledger accordion, POS "Billing" → Transactions modal opens, month picker on Bookings, pagination on all three pages.
