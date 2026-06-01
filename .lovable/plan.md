# Implementation Plan — Bookings, Transactions, Members, GRC, Audit, QR & RBAC

A large, cross-cutting update. I'll group work into atomic milestones and ship them in order so each change is independently testable. Backend (Supabase) changes ship as one consolidated migration.

## 1. Bookings → Payment Flow (Item 1)
- After "Save Booking", **stay on Bookings page** and open the existing `BookingDetailModal` (no redirect to Transactions).
- In `BookingDetailModal`:
  - Keep **Amend**, **Cancel** actions.
  - **Remove Delete** button.
  - Add a **Bill / Record Payment** button → opens the existing record-payment dialog pre-filled (member, amount, type=payment locked).
- Cancelled bookings: filter out of the day calendar / `DayTimelineDialog` (already store `status='Cancelled'`; hide from timeline + day-list views).
- Clicking a date in the calendar opens a **Day Bookings List dialog** (new `DayBookingsDialog.tsx`) showing all bookings of that day; clicking a row opens `BookingDetailModal`.

## 2. Transaction & Invoice Rules (Item 2)
- Add unique DB constraint on `transactions.receipt_no` (= invoice number).
- Client-side: generate idempotent receipt number (`VFC-{memberId}-{bookingId}-{seq}`) and use Supabase `upsert` with `onConflict: 'receipt_no'` so the same bill can't be recorded twice.
- On insert failure (network/duplicate) → keep status `pending`, redirect back to Transactions with a toast.
- Every `pending` row gets a **Settle** action in the Transactions table; settled rows expose **Re-settle** (adjusts method/amount via record-payment modal, writes audit entry).

## 3. Automatic Transaction Fields (Item 3)
- `RecordPaymentModal` for the Payment flow: **member, amount, type=payment** are read-only/disabled (driven by the originating booking/bill).
- Mode (cash/card/split), reference, date remain editable.
- Charges/Advances/Refunds keep their own modals (`RecordChargeModal`, new `RecordAdvanceModal`, `RecordRefundModal` — small wrappers around existing transaction insert) where amount IS editable, but `type` is locked per modal.

## 4. Member Ledger & Quick Balance (Item 4)
- New `member-ledger.ts` selector that combines: bills (charges +), payments (−), advances (+ credit), refunds, voids. Returns chronological rows + running balance + summary {totalCharged, totalPaid, advance, netPayable}.
- `QuickBalanceModal.tsx` styled per the screenshot: header strip (Adm / Name / Class-Membership), grouped rows by month/date, summary card with Total Billed, Total Paid, Advance, **Net Payable Balance** highlighted.
- Add **Quick Balance** button to `MemberProfile` header.

## 5. Member Status (Item 5)
- Extend status enum to include `inactive`.
- `MembersList`: default filter chips → Active, Expiring, Expired (Inactive hidden). Add Inactive chip; selecting it shows only inactive.
- Booking member-picker and global search exclude `inactive`.
- Admin "Deactivate" toggle on member profile sets status=`inactive`.

## 6. GRC Form (Item 6)
- In `MemberGRC.tsx` rendering: replace `value || "N/A"` with `value || ""`. Same in PDF generator.

## 7. GRC PDF & Template Settings (Item 7)
- PDF: render booleans as ☑/☐ checkboxes; render time slot row.
- `GeneralSetup` → new **GRC Template** card with switches: `showMembershipDetails`, `showPhysicalDetails`, `showFooter`, `showEmergencyContact`, `showHealthDeclaration` persisted in `companySettings.grcTemplate`.
- PDF generator reads these flags and conditionally renders sections.

## 8. Phone Number Handling (Item 8)
- Store phone as `text` (already), but enforce input validation (`+\d{1,3}\d{6,14}`), default country `+977`. Prevent any numeric casting (was causing scientific notation when exported).
- Display via `formatPhone(raw)` helper.

## 9. Preferences Tab Fix (Item 9)
- `MemberProfile` Preferences tab currently no-ops on save. Wire it to `useUpdateMember` with fields {communicationChannel, language, marketingOptIn, trainerPref, dietaryNotes}. Persist to `members.preferences` (jsonb).

## 10. Blank GRC Print (Item 10)
- `print-utils.printBlankGRC()` — render same GRC template with empty data, **omit form/admission number row entirely**. Fix current bug (was printing last opened member due to stale ref).

## 11. Audit Log (Item 11)
- New table `audit_logs(id, ts, user_id, user_name, module, action, entity_id, old_value jsonb, new_value jsonb)`.
- Helper `logAudit({module, action, entityId, oldValue, newValue})` called from member/booking/transaction mutations.
- New page `/audit-logs` with filters (date range, user, module: Members|Bookings|Transactions, action) + search.

## 12. QR Check-in (Item 12)
- Existing `Attendance` page → add **QR Check-in** mode using `html5-qrcode`.
- DB: unique index `(member_id, date)` on `attendance`. Insert with `onConflict: do nothing`; if conflict → toast "Already checked in today".
- Stores `check_in_time` (timestamptz). Show member name + status toast on scan.

## 13. RBAC Enforcement (Item 13)
- Already have `useMyPermissions` / `canView`. Now also:
  - `AppLayout` route guard: if non-admin lacks `view` on the page key, redirect to first allowed page.
  - Sidebar already filters; verify every page registers a permission key in `PERMISSION_PAGES`.

## Backend — single consolidated migration
`db/migrations/2026-06-01_bookings_audit_qr.sql`:
- `ALTER TABLE transactions ADD CONSTRAINT transactions_receipt_no_unique UNIQUE (receipt_no);`
- `CREATE INDEX ON transactions(member_id, date);`
- `ALTER TABLE members ADD COLUMN IF NOT EXISTS preferences jsonb DEFAULT '{}'::jsonb;`
- Extend member status check to allow `inactive`.
- `CREATE TABLE attendance(... UNIQUE(member_id, date))` + RLS + GRANT.
- `CREATE TABLE audit_logs(...)` + RLS (admin read all, users read own) + GRANT.
- `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancelled_at timestamptz, cancel_reason text;`
- Indexes on `bookings(date)`, `audit_logs(ts, module)`.

## Technical risk & shortcomings to watch
- **Receipt uniqueness retro-fit**: if existing data has duplicate receipts, the constraint will fail. Migration will dedupe via `... WHERE NOT EXISTS` + suffix.
- **Audit log volume**: index on `(ts desc)` + page-level pagination.
- **QR camera permission** on iOS Safari requires HTTPS — preview is HTTPS, ok.
- **Cancelled booking calendar hiding**: ensure aggregation queries still count them for stats but filter for display.
- **Preferences jsonb migration** must be idempotent (`IF NOT EXISTS`).
- **Re-settle** must write an audit entry and never duplicate a receipt — implemented as UPDATE not INSERT.

## Files (new)
`src/components/DayBookingsDialog.tsx`, `src/components/QuickBalanceModal.tsx`, `src/components/RecordAdvanceModal.tsx`, `src/components/RecordRefundModal.tsx`, `src/components/QRCheckInScanner.tsx`, `src/lib/member-ledger.ts`, `src/lib/audit-log.ts`, `src/pages/AuditLogs.tsx`, `db/migrations/2026-06-01_bookings_audit_qr.sql`.

## Files (edited)
`src/pages/Bookings.tsx`, `src/components/BookingDetailModal.tsx`, `src/components/DayTimelineDialog.tsx`, `src/pages/Transactions.tsx`, `src/pages/MembersList.tsx`, `src/pages/MemberProfile.tsx`, `src/pages/MemberGRC.tsx`, `src/pages/Attendance.tsx`, `src/pages/GeneralSetup.tsx`, `src/lib/print-utils.ts`, `src/lib/firebase-services.ts`, `src/lib/mock-data.ts`, `src/components/AppLayout.tsx`, `src/components/AppSidebar.tsx`, `src/App.tsx`.

Once approved I'll implement in this order: migration → ledger/quick-balance → bookings flow → transactions rules → GRC fixes → audit log → QR check-in → RBAC guard → final smoke build.
