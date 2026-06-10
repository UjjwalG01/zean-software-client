import type { Transaction } from "./mock-data";
import type { ChargeRow } from "@/hooks/use-charges";

export interface LedgerRow {
  date: string;
  description: string;
  kind: "Charge" | "Payment" | "Advance" | "Settlement" | "Refund" | "Void" | "Discount";
  debit: number;   // increases what member owes (charges)
  credit: number;  // decreases what member owes (payments / advances / settlements / discounts)
  balance: number; // running balance after this row
  receiptNo?: string;
  method?: string;
  voided?: boolean;
  /** Charge-row metadata for breakdown displays. */
  net?: number;
  vat?: number;
  chargeHead?: string;
  source?: "booking" | "manual" | "payment" | "advance" | "discount" | "settlement";
}

export interface LedgerSummary {
  totalCharged: number;        // gross billed (incl. VAT)
  bookingCharges: number;      // gross from booking-sourced charges
  manualCharges: number;       // gross from manual "Record Charge" entries
  vatTotal: number;            // total VAT embedded in charges
  netCharges: number;          // totalCharged − vatTotal
  totalPaid: number;           // settlements + plain payments
  advance: number;             // advance balance available
  discountTotal: number;       // total settlement discounts
  netPayable: number;          // max(0, totalCharged − totalPaid − advance − discountTotal)
  /** Alias for netPayable — explicit "due balance" name used by Quick Balance + profile cards. */
  dueBalance: number;
  isSettled: boolean;
  /** Settled | Partial | Unpaid — mirrors Quick Balance / Ledger Report status chip. */
  status: "Settled" | "Partial" | "Unpaid";
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
  net?: number;
  vat?: number;
  chargeHead?: string;
  source?: LedgerRow["source"];
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
    if (t.type === "Charge" && (t as any).chargeRowId && knownChargeIds.has((t as any).chargeRowId)) {
      return false;
    }
    return true;
  });

  const unified: UnifiedRow[] = [];

  for (const c of memberCharges) {
    const voided = !!c.meta?.voided;
    const isBooking = c.meta?.type === "booking";
    unified.push({
      date: (c.created_at || "").slice(0, 10),
      description: c.description || (isBooking ? `Booking — ${c.charge_head}` : c.charge_head),
      kind: "Charge",
      debit: Number(c.total) || 0,
      credit: 0,
      voided,
      net: Number(c.amount) || 0,
      vat: Number(c.vat_amount) || 0,
      chargeHead: c.charge_head,
      source: isBooking ? "booking" : "manual",
    });
    if (!voided && c.status === "paid" && c.paid_at) {
      unified.push({
        date: c.paid_at.slice(0, 10),
        description: `Settlement — ${c.charge_head}`,
        kind: "Settlement",
        debit: 0,
        credit: Number(c.total) || 0,
        voided: false,
        source: "settlement",
      });
    }
    const disc = Number((c as any).discount || 0);
    if (!voided && disc > 0) {
      unified.push({
        date: (c.paid_at || c.updated_at || c.created_at || "").slice(0, 10),
        description: `Discount — ${c.charge_head}`,
        kind: "Discount",
        debit: 0,
        credit: disc,
        voided: false,
        source: "discount",
      });
    }
  }

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
        net: t.amount,
        vat: t.vat,
        chargeHead: t.chargeHead,
        source: "manual",
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
        source: "advance",
      });
    } else {
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
        source: isSettlement ? "settlement" : "payment",
      });
    }
    const disc = Number((t as any).discount || 0);
    if (!voided && disc > 0) {
      unified.push({
        date: t.date,
        description: `Discount — ${t.description || t.type}`,
        kind: "Discount",
        debit: 0,
        credit: disc,
        receiptNo: t.receiptNo,
        voided: false,
        source: "discount",
      });
    }
  }

  unified.sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  let balance = openingBalance;
  let totalCharged = openingBalance > 0 ? openingBalance : 0;
  let bookingCharges = 0;
  let manualCharges = 0;
  let vatTotal = 0;
  let totalPaid = 0;
  let advance = 0;
  let discountTotal = 0;

  const rows: LedgerRow[] = unified.map((r) => {
    if (!r.voided) {
      if (r.kind === "Charge") {
        totalCharged += r.debit;
        vatTotal += r.vat || 0;
        if (r.source === "booking") bookingCharges += r.debit;
        else manualCharges += r.debit;
      } else if (r.kind === "Advance") advance += r.credit;
      else if (r.kind === "Discount") discountTotal += r.credit;
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
      net: r.net,
      vat: r.vat,
      chargeHead: r.chargeHead,
      source: r.source,
    };
  });

  const netPayable = Math.max(0, totalCharged - totalPaid - advance - discountTotal);
  const isSettled = netPayable <= 0;
  const status: LedgerSummary["status"] =
    totalCharged === 0 || isSettled
      ? "Settled"
      : totalPaid + advance + discountTotal > 0
      ? "Partial"
      : "Unpaid";

  return {
    rows,
    summary: {
      totalCharged,
      bookingCharges,
      manualCharges,
      vatTotal,
      netCharges: Math.max(0, totalCharged - vatTotal),
      totalPaid,
      advance,
      discountTotal,
      netPayable,
      dueBalance: netPayable,
      isSettled,
      status,
    },
  };
}
