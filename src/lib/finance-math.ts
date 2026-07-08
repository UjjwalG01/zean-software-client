/**
 * Pure math helpers for ephemeral form-draft calculations only.
 *
 * These are NEVER a source of truth for persisted balances — for that,
 * consume `useMemberFinancials` / `useMemberLedger`, which read directly
 * from the `member_financial_summaries` / `vw_member_ledger` Postgres views.
 */

export function calculateTransactionNet(total: number, discount: number = 0): number {
  return Math.max(0, (Number(total) || 0) - (Number(discount) || 0));
}

export interface BillSummary {
  subtotal: number;
  grandTotal: number;
  netPayable: number;
  isRefund: boolean;
}

export function calculateBillSummary(
  itemsTotal: number,
  previousBalance: number,
  discount: number,
  advance: number,
): BillSummary {
  const subtotal = Number(itemsTotal) || 0;
  const prev = Number(previousBalance) || 0;
  const disc = Number(discount) || 0;
  const adv = Number(advance) || 0;

  const grandTotal = subtotal + prev;
  const netRaw = grandTotal - adv - disc;

  return {
    subtotal,
    grandTotal,
    netPayable: Math.max(0, netRaw),
    isRefund: netRaw < 0,
  };
}
