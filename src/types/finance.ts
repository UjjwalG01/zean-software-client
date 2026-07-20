/**
 * Single source of truth for finance-related types across the app.
 *
 * Server-side authoritative shapes come from Postgres views:
 *   - `vw_member_ledger`            → MemberLedgerRow (chronological entries)
 *   - `member_financial_summaries`  → MemberFinancialSummary (aggregates)
 *
 * Client-derived shapes (used by `buildMemberLedger` when the server view is
 * unavailable, e.g. mock mode) live here too so components import a single
 * definition instead of redeclaring their own.
 */

// ─── Server-view rows (SSOT) ────────────────────────────────────────
export interface MemberLedgerRow {
  id: string;
  member_id: string;
  receipt_no: string | null;
  occurred_at: string;
  occurred_on: string;
  type: "Charge" | "Payment" | "Advance" | "Settlement" | "Refund" | string;
  description: string;
  charge_head: string | null;
  method: string | null;
  gross_amount: number;
  vat_amount: number;
  discount_amount: number;
  net_amount: number;
  voided: boolean;
  computed_status: "Settled" | "Partial" | "Pending" | "Voided";
  debit: number;
  credit: number;
  source: "booking" | "manual" | "payment" | "advance" | "settlement" | string;
  running_balance: number;
}

export interface MemberFinancialSummary {
  member_id: string;
  total_invoiced: number;
  total_paid: number;
  total_discounts: number;
  total_advances: number;
  /** Signed. Positive = member owes; negative = member is owed (overpaid/refund). */
  net_outstanding: number;
}

// ─── Client-derived ledger shapes (buildMemberLedger fallback) ──────
export type LedgerStatus = "Settled" | "Partial" | "Unpaid" | "Overpaid";
export type LedgerKind =
  | "Charge"
  | "Payment"
  | "Advance"
  | "Settlement"
  | "Refund"
  | "Void"
  | "Discount";
export type LedgerSource =
  | "booking"
  | "manual"
  | "payment"
  | "advance"
  | "discount"
  | "settlement";

export interface LedgerRow {
  date: string;
  description: string;
  kind: LedgerKind;
  debit: number;
  credit: number;
  balance: number;
  receiptNo?: string;
  method?: string;
  voided?: boolean;
  net?: number;
  vat?: number;
  chargeHead?: string;
  source?: LedgerSource;
}

export interface LedgerSummary {
  totalCharged: number;
  bookingCharges: number;
  manualCharges: number;
  vatTotal: number;
  netCharges: number;
  totalPaid: number;
  advance: number;
  discountTotal: number;
  netPayable: number;
  dueBalance: number;
  isSettled: boolean;
  status: LedgerStatus;
}

/** Aggregated row rendered by the Ledger Report page (one per member). */
export interface MemberLedgerReportRow {
  memberId: string;
  memberName: string;
  tier: string;
  services: string;
  totalBilled: number;
  totalPaid: number;
  netBalance: number;
  status: LedgerStatus;
  memberStatus?: string;
}

// ─── Legacy aliases (kept so existing imports keep compiling) ───────
/** @deprecated Use `MemberLedgerRow` (server SSOT) or `LedgerRow` (client). */
export type MemberTransaction = MemberLedgerRow;
/** @deprecated Use `MemberLedgerRow` filtered to payment/advance/settlement. */
export type PaymentRecord = MemberLedgerRow;
