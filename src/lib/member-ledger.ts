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
}

export interface LedgerSummary {
  /** Sum of net (pre-VAT) charge amounts. */
  totalChargedNet: number;
  /** Sum of VAT collected on charges. */
  totalVat: number;
  /** Gross charges (net + VAT) = what was billed. */
  totalCharged: number;
  /** Sum of settlements + standalone payments. */
  totalPaid: number;
  /** Sum of advances applied. */
  advance: number;
  /** Sum of discounts granted at settlement time. */
  totalDiscount: number;
  /** totalCharged - totalPaid - advance - totalDiscount, floored at 0. */
  netPayable: number;
  /** Alias for netPayable. */
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
  net?: number;
  vat?: number;
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
    if (t.type === "Charge" && (t as any).chargeRowId && knownChargeIds.has((t as any).chargeRowId)) {
      return false;
    }
    return true;
  });

  const unified: UnifiedRow[] = [];

  // Charges (source of truth from the dedicated table).
  for (const c of memberCharges) {
    const voided = !!c.meta?.voided;
    const total = Number(c.total) || 0;
    const vat = Number(c.vat_amount) || 0;
    const net = Number(c.amount) || total - vat;
    unified.push({
      date: (c.created_at || "").slice(0, 10),
      description:
        c.description ||
        (c.meta?.type === "booking" ? `Booking — ${c.charge_head}` : c.charge_head),
      kind: "Charge",
      debit: total,
      credit: 0,
      net,
      vat,
      voided,
    });
    if (!voided && c.status === "paid" && c.paid_at) {
      const discount = Number((c.meta as any)?.discount) || 0;
      const paidCash = Math.max(0, total - discount);
      if (paidCash > 0) {
        unified.push({
          date: c.paid_at.slice(0, 10),
          description: `Settlement — ${c.charge_head}`,
          kind: "Settlement",
          debit: 0,
          credit: paidCash,
          method: (c.meta as any)?.settlementMethod,
          voided: false,
        });
      }
      if (discount > 0) {
        unified.push({
          date: c.paid_at.slice(0, 10),
          description: `Discount — ${c.charge_head}`,
          kind: "Discount",
          debit: 0,
          credit: discount,
          voided: false,
        });
      }
    }
  }

  // Transactions (payments, advances, mirror charges without canonical row).
  for (const t of memberTx) {
    const voided = isVoidedTx(t);
    if (t.type === "Charge") {
      const discount = Number((t as any).discount) || 0;
      unified.push({
        date: t.date,
        description: t.description || "Charge",
        kind: "Charge",
        debit: t.total,
        credit: 0,
        net: t.amount,
        vat: t.vat,
        receiptNo: t.receiptNo,
        method: t.method,
        voided,
      });
      // If the mirror is paid (no canonical row), surface settlement/discount lines.
      if (!voided && (t.status === "paid" || t.status === "settled")) {
        const cash = Math.max(0, t.total - discount);
        if (cash > 0) {
          unified.push({
            date: t.date,
            description: `Settlement — ${t.description || "Charge"}`,
            kind: "Settlement",
            debit: 0,
            credit: cash,
            receiptNo: t.receiptNo,
            method: t.method,
            voided: false,
          });
        }
        if (discount > 0) {
          unified.push({
            date: t.date,
            description: `Discount — ${t.description || "Charge"}`,
            kind: "Discount",
            debit: 0,
            credit: discount,
            voided: false,
          });
        }
      }
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
  let totalChargedNet = 0;
  let totalVat = 0;
  let totalCharged = openingBalance > 0 ? openingBalance : 0;
  let totalPaid = 0;
  let advance = 0;
  let totalDiscount = 0;

  const rows: LedgerRow[] = unified.map((r) => {
    if (!r.voided) {
      if (r.kind === "Charge") {
        totalCharged += r.debit;
        totalChargedNet += r.net || 0;
        totalVat += r.vat || 0;
      } else if (r.kind === "Advance") advance += r.credit;
      else if (r.kind === "Discount") totalDiscount += r.credit;
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

  const netPayable = Math.max(0, totalCharged - totalPaid - advance - totalDiscount);

  return {
    rows,
    summary: {
      totalChargedNet,
      totalVat,
      totalCharged,
      totalPaid,
      advance,
      totalDiscount,
      netPayable,
      dueBalance: netPayable,
      isSettled: netPayable <= 0,
    },
  };
}
