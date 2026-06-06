import type { Transaction } from "./mock-data";
import type { ChargeRow } from "@/hooks/use-charges";

export interface LedgerRow {
  date: string;
  description: string;
  kind: "Charge" | "Payment" | "Advance" | "Settlement" | "Refund" | "Void";
  debit: number;   // increases what member owes (charges)
  credit: number;  // decreases what member owes (payments / advances / settlements)
  balance: number; // running balance after this row
  receiptNo?: string;
  method?: string;
  voided?: boolean;
}

export interface LedgerSummary {
  totalCharged: number;
  totalPaid: number;
  advance: number;
  netPayable: number;
  /** Alias for netPayable — explicit "due balance" name used by Quick Balance + profile cards. */
  dueBalance: number;
  isSettled: boolean;
}

const isVoidedTx = (t: Transaction) => (t as any).voided || t.status === "voided";

interface UnifiedRow {
  date: string;
  description: string;
  kind: LedgerRow["kind"];
  debit: number;
  credit: number;
  receiptNo?: string;
  method?: string;
  voided: boolean;
}

/**
 * Build a chronological ledger for one member by combining:
 *   - rows from `charges` table  → Charge debits (booking + manual)
 *   - rows from `transactions`   → Payments / Advances / Settlements (credits)
 *
 * Legacy mirror transactions of type="Charge" that carry `chargeRowId`
 * are filtered out so booking charges are not double-counted.
 */
export function buildMemberLedger(
  memberId: string,
  transactions: Transaction[],
  openingBalance = 0,
  charges: ChargeRow[] = [],
): { rows: LedgerRow[]; summary: LedgerSummary } {
  const memberCharges = charges.filter((c) => c.member_id === memberId);
  const knownChargeIds = new Set(memberCharges.map((c) => c.id));

  const memberTx = transactions.filter((t) => {
    if (t.memberId !== memberId) return false;
    // Skip legacy mirrors whose canonical row already lives in `charges`.
    if (t.type === "Charge" && (t as any).chargeRowId && knownChargeIds.has((t as any).chargeRowId)) {
      return false;
    }
    return true;
  });

  const unified: UnifiedRow[] = [];

  // Charges from the dedicated table (source of truth for debits).
  for (const c of memberCharges) {
    const voided = !!c.meta?.voided;
    unified.push({
      date: (c.created_at || "").slice(0, 10),
      description:
        c.description ||
        (c.meta?.type === "booking" ? `Booking — ${c.charge_head}` : c.charge_head),
      kind: "Charge",
      debit: Number(c.total) || 0,
      credit: 0,
      voided,
    });
    // If the charge has been paid/settled, surface a matching credit row so
    // the ledger reflects the settlement explicitly.
    if (!voided && (c.status === "paid") && c.paid_at) {
      unified.push({
        date: c.paid_at.slice(0, 10),
        description: `Settlement — ${c.charge_head}`,
        kind: "Settlement",
        debit: 0,
        credit: Number(c.total) || 0,
        voided: false,
      });
    }
  }

  // Transactions: payments, advances, refunds, and manual Charge mirrors
  // that don't have a canonical `charges` row.
  for (const t of memberTx) {
    const voided = isVoidedTx(t);
    if (t.type === "Charge") {
      unified.push({
        date: t.date,
        description: t.description || "Charge",
        kind: "Charge",
        debit: t.total,
        credit: 0,
        receiptNo: t.receiptNo,
        method: t.method,
        voided,
      });
    } else if (t.type === "Advance") {
      unified.push({
        date: t.date,
        description: t.description || "Advance",
        kind: "Advance",
        debit: 0,
        credit: t.total,
        receiptNo: t.receiptNo,
        method: t.method,
        voided,
      });
    } else {
      // Payment / Renewal / Registration / Settlement etc.
      const isSettlement = /settle/i.test(t.description || "") || (t as any).isSettlement;
      unified.push({
        date: t.date,
        description: t.description || t.type,
        kind: isSettlement ? "Settlement" : "Payment",
        debit: 0,
        credit: t.total,
        receiptNo: t.receiptNo,
        method: t.method,
        voided,
      });
    }
  }

  unified.sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  let balance = openingBalance;
  let totalCharged = openingBalance > 0 ? openingBalance : 0;
  let totalPaid = 0;
  let advance = 0;

  const rows: LedgerRow[] = unified.map((r) => {
    if (!r.voided) {
      if (r.kind === "Charge") totalCharged += r.debit;
      else if (r.kind === "Advance") advance += r.credit;
      else if (r.kind === "Payment" || r.kind === "Settlement") totalPaid += r.credit;
      balance += r.debit - r.credit;
    }
    return {
      date: r.date,
      description: r.description,
      kind: r.kind,
      debit: r.debit,
      credit: r.credit,
      balance,
      receiptNo: r.receiptNo,
      method: r.method,
      voided: r.voided,
    };
  });

  const netPayable = Math.max(0, totalCharged - totalPaid - advance);

  return {
    rows,
    summary: { totalCharged, totalPaid, advance, netPayable, dueBalance: netPayable, isSettled: netPayable <= 0 },
  };
}
