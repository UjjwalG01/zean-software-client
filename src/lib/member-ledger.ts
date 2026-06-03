import type { Transaction } from "./mock-data";

export interface LedgerRow {
  date: string;
  description: string;
  kind: "Charge" | "Payment" | "Advance" | "Refund" | "Void";
  debit: number;   // increases what member owes
  credit: number;  // decreases what member owes (payment / advance)
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

const isVoided = (t: Transaction) => (t as any).voided || t.status === "voided";

/**
 * Build a chronological ledger for one member by combining transaction rows
 * (charges, payments, advances, refunds). Voided rows are shown but excluded
 * from the running totals so the balance reflects reality.
 */
export function buildMemberLedger(
  memberId: string,
  transactions: Transaction[],
  openingBalance = 0,
): { rows: LedgerRow[]; summary: LedgerSummary } {
  const txs = transactions
    .filter((t) => t.memberId === memberId)
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  let balance = openingBalance;
  let totalCharged = openingBalance > 0 ? openingBalance : 0;
  let totalPaid = 0;
  let advance = 0;

  const rows: LedgerRow[] = txs.map((t) => {
    let kind: LedgerRow["kind"] = "Payment";
    let debit = 0;
    let credit = 0;

    if (t.type === "Charge") {
      kind = "Charge";
      debit = t.total;
      if (!isVoided(t)) totalCharged += t.total;
    } else if (t.type === "Advance") {
      kind = "Advance";
      credit = t.total;
      if (!isVoided(t)) advance += t.total;
    } else if (t.type === "Payment" || t.type === "Renewal" || t.type === "Registration") {
      kind = "Payment";
      credit = t.total;
      if (!isVoided(t)) totalPaid += t.total;
    } else {
      kind = "Payment";
      credit = t.total;
      if (!isVoided(t)) totalPaid += t.total;
    }

    if (!isVoided(t)) {
      balance += debit - credit;
    }

    return {
      date: t.date,
      description: t.description || t.type,
      kind,
      debit,
      credit,
      balance,
      receiptNo: t.receiptNo,
      method: t.method,
      voided: isVoided(t),
    };
  });

  const netPayable = Math.max(0, totalCharged - totalPaid - advance);

  return {
    rows,
    summary: { totalCharged, totalPaid, advance, netPayable, dueBalance: netPayable, isSettled: netPayable <= 0 },
  };
}
