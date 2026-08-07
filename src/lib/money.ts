/**
 * Global money value controller — the ONLY place amounts are computed.
 *
 * Canonical model for every sale (booking, POS order, membership, manual charge):
 *
 *   amount        = value excluding VAT
 *   vatAmount     = VAT on amount (rate from company_settings.vat_rate)
 *   amtAfterVat   = amount + vatAmount        → the "billed amount"
 *   discount      = reduction applied at settlement, on amtAfterVat only
 *   total         = amtAfterVat - discount    → the "net payable" / collected
 *
 * Reporting split (fixed, no exceptions):
 *   • Sales      → amount, vatAmount, amtAfterVat
 *   • Collection → amtAfterVat, discount, total
 *
 * No other module may compute VAT, discounts or totals.
 */

import { splitVatFromGross, getActiveVatRate } from "./vat";

export interface Amounts {
  /** Excluding VAT. */
  amount: number;
  /** VAT on `amount`. */
  vatAmount: number;
  /** amount + vatAmount — the billed (gross) amount. */
  amtAfterVat: number;
  /** Applied on `amtAfterVat` only. */
  discount: number;
  /** amtAfterVat - discount — net payable / collected. */
  total: number;
  /** VAT rate applied, in percent. */
  vatRate: number;
}

const round2 = (n: number): number => Math.round((Number(n) || 0) * 100) / 100;

export interface BuildAmountsInput {
  /** VAT-inclusive billed amount. */
  gross: number;
  /** Discount applied on the billed amount. Clamped to [0, gross]. */
  discount?: number;
  /** Set false for advances / wallet top-ups where VAT must not be broken out. */
  breakdownVat?: boolean;
}

/**
 * Build the canonical amount quintet from a VAT-inclusive gross value.
 * This is the single computation surface for the whole application.
 */
export function buildAmounts({ gross, discount = 0, breakdownVat = true }: BuildAmountsInput): Amounts {
  const amtAfterVat = round2(Math.max(0, Number(gross) || 0));
  const split = breakdownVat
    ? splitVatFromGross(amtAfterVat)
    : { net: amtAfterVat, vat: 0, rate: getActiveVatRate() };
  const disc = round2(Math.min(Math.max(0, Number(discount) || 0), amtAfterVat));

  return {
    amount: round2(split.net),
    vatAmount: round2(split.vat),
    amtAfterVat,
    discount: disc,
    total: round2(amtAfterVat - disc),
  vatRate: getActiveVatRate(),
  };
}

/** Column set written to `public.payments`. */
export interface MoneyColumns {
  amount: number;
  vat_amount: number;
  amt_after_vat: number;
  discount: number;
  total: number;
}

/** Map the canonical amounts onto the exact DB column names. */
export function toMoneyColumns(a: Amounts): MoneyColumns {
  return {
    amount: a.amount,
    vat_amount: a.vatAmount,
    amt_after_vat: a.amtAfterVat,
    discount: a.discount,
    total: a.total,
  };
}

/** Convenience: payment (credit-side) money columns from a gross + discount. */
export function toPaymentPayload(input: BuildAmountsInput): MoneyColumns {
  return toMoneyColumns(buildAmounts(input));
}

/**
 * Convenience: charge (debit-side) money columns. A charge is raised at full
 * billed value — discounts belong to settlement, so `total` equals
 * `amt_after_vat` unless an explicit charge-time discount is supplied.
 */
export function toChargePayload(input: BuildAmountsInput): MoneyColumns {
  return toMoneyColumns(buildAmounts(input));
}

// ─── Aggregation (the only helpers reports and charts may use) ──────

/** A row shaped like the money columns, tolerating camelCase UI shapes. */
export interface MoneyRowLike {
  amount?: number | null;
  vat_amount?: number | null;
  vat?: number | null;
  amt_after_vat?: number | null;
  amtAfterVat?: number | null;
  discount?: number | null;
  total?: number | null;
  voided?: boolean | null;
}

const num = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** Read the billed amount of a row, falling back to amount + vat, then total. */
export function readAmtAfterVat(r: MoneyRowLike): number {
  const direct = r.amt_after_vat ?? r.amtAfterVat;
  if (direct !== null && direct !== undefined) return num(direct);
  const base = num(r.amount) + num(r.vat_amount ?? r.vat);
  if (base > 0) return round2(base);
  return num(r.total) + num(r.discount);
}

export interface SalesTotals {
  /** Sum of `amount` (excl. VAT). */
  amount: number;
  /** Sum of `vat_amount`. */
  vat: number;
  /** Sum of `amt_after_vat` — gross sales. */
  amtAfterVat: number;
}

export interface CollectionTotals {
  /** Sum of `amt_after_vat` — billed. */
  billed: number;
  /** Sum of `discount`. */
  discount: number;
  /** Sum of `total` — actually collected. */
  collected: number;
}

/** Sales side: amount / vat / amt_after_vat. Voided rows are excluded. */
export function sumSales(rows: readonly MoneyRowLike[]): SalesTotals {
  return rows.reduce<SalesTotals>(
    (acc, r) => {
      if (r.voided) return acc;
      acc.amount = round2(acc.amount + num(r.amount));
      acc.vat = round2(acc.vat + num(r.vat_amount ?? r.vat));
      acc.amtAfterVat = round2(acc.amtAfterVat + readAmtAfterVat(r));
      return acc;
    },
    { amount: 0, vat: 0, amtAfterVat: 0 },
  );
}

/** Collection side: amt_after_vat / discount / total. Voided rows are excluded. */
export function sumCollection(rows: readonly MoneyRowLike[]): CollectionTotals {
  return rows.reduce<CollectionTotals>(
    (acc, r) => {
      if (r.voided) return acc;
      acc.billed = round2(acc.billed + readAmtAfterVat(r));
      acc.discount = round2(acc.discount + num(r.discount));
      acc.collected = round2(acc.collected + num(r.total));
      return acc;
    },
    { billed: 0, discount: 0, collected: 0 },
  );
}

/**
 * Booking rate split. POS (health/fitness) never discounts at booking time;
 * sports services may be booked at an allowed discounted price.
 */
export interface BookingRates {
  original_rate: number;
  rate: number;
  discount_amount: number;
}

export function buildBookingRates(listPrice: number, chargedPrice?: number | null): BookingRates {
  const original = round2(Math.max(0, Number(listPrice) || 0));
  const charged =
    chargedPrice === null || chargedPrice === undefined
      ? original
      : round2(Math.max(0, Number(chargedPrice) || 0));
  return {
    original_rate: original,
    rate: charged,
    discount_amount: round2(Math.max(0, original - charged)),
  };
}
