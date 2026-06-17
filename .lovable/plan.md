## Task 1 — Rename `status_v2` → `booking_status`, new enum values

**Migration** `db/migrations/2026-06-17_booking_status_rename.sql`:
- Create new enum `public.booking_status_new` with values `('wait-listed','confirmed','not-fixed')`.
- `ALTER TABLE public.bookings RENAME COLUMN status_v2 TO booking_status;`
- Map old values → new (`pending`→`wait-listed`, `completed`/`confirmed`→`confirmed`, `cancelled`/`no_show`→`not-fixed`) via `USING` clause, set default `'confirmed'`.
- Update RLS/index references.

**Code**: replace every `status_v2` reference in `src/` (`use-firestore.ts`, `Bookings.tsx`, `DayScheduleDialog.tsx`, `DayTimelineDialog.tsx`, `BookingDetailModal.tsx`, `mock-data.ts` type) with `booking_status`. Add a `<Select>` "Booking Status" field in the new-booking form (default Confirmed).

> Note: actual transactional status (`completed`/`paid`/`pending`) is tracked separately on transactions, so renaming here doesn't break billing.

## Task 2 — Block future-date booking completion / billing

- In `BookingDetailModal.tsx` and `DayScheduleDialog.tsx`, disable "Mark Completed" / "Bill Now" buttons when `booking.date > today` (compare via `tz.ts` helpers). Show tooltip "Cannot bill a future-dated booking".
- In `Bookings.tsx` settlement flow + `use-charges.ts`, guard `createChargeForBooking` with the same check and `toast.error` early-return.

## Task 3 — Auto-open guest settlement modal after FIT Guest booking

- Extract existing settlement modal JSX from `Bookings.tsx`/`BookingDetailModal.tsx` into a reusable `<GuestSettlementModal />` (or reuse `SplitPaymentForm`) accepting `{ guestName, bookingId, baseAmount, serviceType }`.
- After `useAddBooking` resolves in guest mode, set `pendingGuestSettlement` state → opens modal with prefilled Guest Name, Base Amount (from service price), Type=`service`, Description=`<service> – Guest Booking`, default Payment Mode=Cash, Discount=0, Net Payable auto.
- On submit, call `createChargeForBooking` + `applyAdvance` with `guest=1` flag, member fields nulled, `guestName` stored on transaction row. Cleared/Partial/Refund status derived from amount vs net.

## Task 4 — A5 bill: head-wise rows + new summary card

Rewrite `generateA5BillHTML` in `src/lib/print-utils.ts`:

- Items table grouped by charge head (Services, Spa, FIT, Record Charges, etc.) with subtotals.
- Summary card:
```
Previous Balance      (sum of prior pending services + record-charge heads for member)
Current Total         (sum of current rows)
Grand Total           = Previous + Current
- Discount
- Advance
= Net Payable         (negative ⇒ show as "(Refund / Overpaid)")
Amount Paid
Status: Cleared | Partial | Refund/Overpaid
```
- Add `previousBalance` arg to `generateA5BillHTML` and `generateReceiptHTML`; compute it in caller using member ledger (`member-ledger.ts`).

## Task 5 — Drag-drop reschedule fix

In `DayScheduleDialog.tsx` `onDrop` handler:
- Build payload `{ id, date: booking.date, start_time, end_time }` — explicitly forward original `date`.

In `useUpdateBooking` (`src/hooks/use-firestore.ts`):
- Reschedule path: send **only** `{ start_time, end_time, date }` — do NOT touch `booking_status`, `payment_status`, ledger, or transaction rows.
- `onMutate`: snapshot `bookings` query, optimistically patch the moved booking's times, return rollback ctx.
- `onError`: restore snapshot. `onSettled`: invalidate.
- Calendar count badges in `Bookings.tsx` already derive from cache → will recompute automatically once optimistic update lands.

## Technical Notes

- Enum rename uses temporary column + swap to avoid `ALTER TYPE` lock issues:
  ```sql
  alter table bookings add column booking_status_tmp public.booking_status_new
    default 'confirmed' not null;
  update bookings set booking_status_tmp = case status_v2
    when 'pending' then 'wait-listed'::booking_status_new
    when 'cancelled' then 'not-fixed'::booking_status_new
    when 'no_show' then 'not-fixed'::booking_status_new
    else 'confirmed'::booking_status_new end;
  alter table bookings drop column status_v2;
  alter table bookings rename column booking_status_tmp to booking_status;
  drop type public.booking_status_v2;
  alter type public.booking_status_new rename to booking_status_v2;  -- avoid clash with legacy 'booking_status' enum at line 21
  ```
  (Final column name is `booking_status`, enum type stays `booking_status_v2` internally to avoid colliding with the pre-existing unused `booking_status` enum.)

- Optimistic cache key everywhere is `['bookings', outletId]` — verify before patching.

- Print bill previous-balance query: reuse `getMemberOpenCharges` from `member-ledger.ts`; guest bookings have no previous balance (skip).

## Execution Order

1 → 2 → 5 (low risk, isolated) → 3 (depends on 1's new status field) → 4 (touches multiple call sites)

Confirm and I'll execute sequentially, reporting completion after each task.
