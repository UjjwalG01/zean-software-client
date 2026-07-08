## Plan: SSOT views, unified print utility, dumb-frontend refactor

### Context found during exploration
- There is **no `transactions` table** in Postgres. The Transaction type is synthesized in `src/lib/supabase-services.ts` from three tables: `invoices`, `payments`, `charges` (see `db/schema.sql` L340–L455 and `db/migrations/2026-06-04_charges_table.sql`).
- Fields the requested SQL assumes (`t.type`, `t.paid_amount`, `t.discount`, `t.vat`, `t.status='voided'`, `t.receipt_no`, `t.date`) do not exist on any single table. They exist scattered across `charges` (debit side, has `discount`, `vat_amount`, `total`, `paid_at`, `meta.voided`) and `payments` (credit side, has `amount`, `vat_amount`, `status`, `method`, `paid_at`).
- Ledger math is currently done in `src/lib/member-ledger.ts` and mirrors this two-table reality.
- Print helpers found in 4 files: `src/lib/print-utils.ts` (source), `Transactions.tsx`, `BookingDetailModal.tsx`, `TransactionDetailModal.tsx` (callers of `generateReceiptHTML` / `generateA5BillHTML`).

Because of this schema mismatch, the SQL in the brief cannot run verbatim. I'll adapt it to our real schema while keeping the SSOT intent identical.

### Step 1 — SQL views (adapted to real schema)
New migration `db/migrations/2026-07-08_ssot_ledger_views.sql`:

- `vw_member_ledger` — UNION ALL of:
  - `charges` rows → `type='Charge'`, `debit = total`, `credit = 0`, `discount = discount`, `vat_amount = vat_amount`, voided derived from `meta->>'voided'`, computed_status from `status` (`paid`→Settled, `unpaid` w/ any partial payments allocated → Partial, else Pending), plus a Settlement credit row when `status='paid'`.
  - `payments` rows tagged Advance vs Payment via `meta->>'type'` / `notes` heuristic already used in `supabase-services.ts` → `debit=0`, `credit = total`.
  - `running_balance` via window `SUM(debit-credit) OVER (PARTITION BY member_id ORDER BY occurred_at, id)`.
- `member_financial_summaries` — aggregates over the same union: `total_invoiced`, `total_paid`, `total_discounts`, `total_advances`, `net_outstanding`.
- `GRANT SELECT` on both views to `authenticated` and `service_role`; RLS is enforced through the underlying tables.

### Step 2 — React Query hooks
- Add `src/hooks/use-member-ledger.ts` → `useMemberLedger(memberId)` selecting from `vw_member_ledger` ordered by `occurred_at desc`.
- Add `src/hooks/use-member-financials.ts` → `useMemberFinancials(memberId?)` selecting single row from `member_financial_summaries`.

### Step 3 — Pure math module
- Add `src/lib/finance-math.ts` with `calculateTransactionNet` and `calculateBillSummary` exactly as specified (used for ephemeral form drafts only).

### Step 4 — Unified print utility
Refactor `src/lib/print-utils.ts`:
- Introduce single canonical entry point `generateStandardReceiptHTML(input, company, opts)` producing the strict layout:
  ```
  Fee Description | Amount
  Subtotal
  Previous Balance   (only if > 0)
  Grand Total
  Advance Amount     (only if > 0)
  Discount           (only if > 0)
  Net Payable
  Amount Paid
  Payment Method + Status  (CLEARED | PARTIAL | OVERPAID | PENDING)
  ```
- Keep the existing `printHTML` / `downloadHTML` helpers.
- Remove/replace the old `generateReceiptHTML` and `generateA5BillHTML` with thin backward-compat wrappers that call `generateStandardReceiptHTML` (so we don't break the 3 caller files in one shot). Then update each caller to import `generateStandardReceiptHTML` directly and delete the wrappers.

### Step 5 — UI refactor
- Replace client-side `.reduce()` balance math in Advance/Settle/Ledger flows with `useMemberFinancials` + `useMemberLedger` (in `QuickBalanceModal`, `LedgerReport`, `MemberProfile`, `BookingDetailModal` bill dialog).
- Update the 3 print-call sites to `generateStandardReceiptHTML`.
- Add `queryClient.invalidateQueries` for `["member-ledger"]` and `["member-financials"]` in the transaction / charge / payment mutation hooks in `src/hooks/use-firestore.ts` and `src/hooks/use-charges.ts`.

### Risks / notes
- Views are read-only; RLS on `charges` / `payments` continues to guard access.
- Advance vs Payment detection in the view must match the frontend heuristic exactly, otherwise summaries will drift from `member-ledger.ts` results.
- Backward-compat wrappers avoid a big-bang break; I'll remove them once callers are migrated in the same PR.

Ready to execute Steps 1→5 in order. Shall I proceed?