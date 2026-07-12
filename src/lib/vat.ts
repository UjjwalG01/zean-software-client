// src/lib/vat.ts
//
// Single source of truth for the app-wide VAT rate.
//
// The rate is stored in `company_settings.vat_rate` and fetched via the
// `useCompanySettings` React Query hook. A tiny sync component in App.tsx
// pushes the resolved rate into the module-level cache so non-hook call
// sites (e.g. `addTransaction`, `createChargeForBooking`) can consume it
// synchronously without another round-trip to Supabase.

import { useEffect, useState } from "react";
import { supabase } from "./supabase"; // Adjust this path to your actual supabase client init file

const DEFAULT_VAT_RATE = 0;
let activeVatRate = DEFAULT_VAT_RATE;


// Eagerly kick off a fetch (fire-and-forget) so the module cache is warm
// shortly after boot. Uses .then/.catch instead of top-level await so the
// bundle stays compatible with the configured browser targets.
supabase
  .from("company_settings")
  .select("vat_rate")
  .maybeSingle()
  .then(({ data, error }) => {
    if (!error && data && data.vat_rate !== null) {
      activeVatRate = Number(data.vat_rate);
    }
  })
  .catch((error) => {
    console.error("Failed to eagerly load default VAT rate from database during boot:", error);
  });


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

export function useVatCalculator() {
  // Use the cached activeVatRate as the starting initial state
  const [vatRate, setVatRate] = useState<number>(activeVatRate);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function fetchVatRate() {
      try {
        const { data, error } = await supabase
          .from("company_settings")
          .select("vat_rate")
          .maybeSingle();

        if (error) throw error;

        if (data && data.vat_rate !== null) {
          const rateNum = Number(data.vat_rate);
          setVatRate(rateNum);
          setActiveVatRate(rateNum); // 🔥 Automatically updates module cache for non-hook utilities
        }
      } catch (error) {
        console.error("Failed to fetch VAT rate from Supabase:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchVatRate();
  }, []);

  const calculateVat = (amount: number) => {
    // Converts whole number percentage (e.g., 13) back to a decimal fraction (0.13) for calculation
    return amount * (vatRate / 100);
  };

  return { calculateVat, vatRate, isLoading };
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
