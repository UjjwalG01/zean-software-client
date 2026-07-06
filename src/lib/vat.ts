// src/lib/vat.ts
//
// Single source of truth for the app-wide VAT rate.
//
// The rate is stored in `company_settings.vat_rate` and fetched via the
// `useCompanySettings` React Query hook. A tiny sync component in App.tsx
// pushes the resolved rate into the module-level cache so non-hook call
// sites (e.g. `addTransaction`, `createChargeForBooking`) can consume it
// synchronously without another round-trip to Supabase.

const DEFAULT_VAT_RATE = 13;

let activeVatRate = DEFAULT_VAT_RATE;

/** Prime the module cache from a React component that consumes useCompanySettings. */
export function setActiveVatRate(rate: number | string | undefined | null): void {
  const parsed = Number(rate);
  if (Number.isFinite(parsed) && parsed >= 0) {
    activeVatRate = parsed;
  }
}

/** Current VAT rate (percent, e.g. 13). Never throws. */
export function getActiveVatRate(): number {
  return activeVatRate;
}

/** VAT multiplier, e.g. 1.13 for a 13% rate. */
export function getVatMultiplier(): number {
  return 1 + activeVatRate / 100;
}

export interface VatSplit {
  gross: number; // total incl. VAT (what the customer pays)
  net: number;   // subtotal excl. VAT
  vat: number;   // VAT amount
  rate: number;  // rate applied (percent)
}

/**
 * Split a gross (VAT-inclusive) amount into its net + VAT parts using
 * the currently configured VAT rate.
 */
export function splitVatFromGross(gross: number): VatSplit {
  const rate = activeVatRate;
  const mult = 1 + rate / 100;
  const safeGross = Number.isFinite(gross) ? Number(gross) : 0;
  const net = mult > 0 ? Math.round((safeGross / mult) * 100) / 100 : safeGross;
  const vat = Math.round((safeGross - net) * 100) / 100;
  return { gross: safeGross, net, vat, rate };
}

/**
 * Transaction types where the VAT MUST NOT be broken out — the gross
 * amount is stored as-is with vat_amount = 0. Applies to member wallet
 * deposits, advance payments, and bulk settlement receipts.
 */
const NON_BREAKDOWN_TYPES = new Set(["advance", "wallet", "deposit", "settlement", "bulk-settlement"]);

export function shouldBreakdownVat(type: string | undefined | null, isSettlement?: boolean): boolean {
  if (isSettlement) return false;
  if (!type) return true;
  return !NON_BREAKDOWN_TYPES.has(String(type).toLowerCase());
}
