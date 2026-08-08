/**
 * Zean Software license client — contract version 1.0.0.
 *
 * Reads the singleton `public.system_license` row deployed by the Master Admin
 * Panel. The client app never writes license_key / tier / expires_at.
 */

import { supabase } from "./supabase";
import { getSystemTodayStr } from "./timeUtils";

export const LICENSE_CONTRACT_VERSION = "1.0.0";
export const LICENSE_ROW_ID = "00000000-0000-0000-0000-000000000001";
const STORAGE_KEY = "zean.license.key";
const CACHE_KEY = "zean.license.cache";

export type LicenseState =
  | { status: "unlicensed" }
  | { status: "invalid_key" }
  | { status: "suspended" }
  | { status: "expired"; expiresAt: string | null }
  | { status: "error"; message: string }
  | {
      status: "active";
      tier: string;
      maxOutlets: number;
      clientName: string | null;
      expiresAt: string | null;
      daysLeft: number;
    };

export interface LicenseRow {
  license_key: string;
  client_name: string | null;
  duration_days: number | null;
  expires_at: string | null;
  tier: string | null;
  max_outlets: number | null;
  is_active: boolean | null;
  updated_at: string | null;
}

/** Locally stored key entered by the user on this installation. */
export function getStoredLicenseKey(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function storeLicenseKey(key: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, key.trim());
  } catch {
    /* storage unavailable — validation still works per session */
  }
}

export function clearStoredLicenseKey(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(CACHE_KEY);
  } catch {
    /* noop */
  }
}

/** Cached last-known-good window so brief offline periods do not lock the app. */
function readCache(): { expiresAt: string | null; key: string } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCache(key: string, expiresAt: string | null): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ key, expiresAt }));
  } catch {
    /* noop */
  }
}

/** Reads the singleton license row. Returns null when no row exists. */
export async function fetchLicenseRow(): Promise<LicenseRow | null> {
  const { data, error } = await supabase
    .from("system_license")
    .select(
      "license_key, client_name, duration_days, expires_at, tier, max_outlets, is_active, updated_at",
    )
    .eq("id", LICENSE_ROW_ID)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as LicenseRow | null) ?? null;
}

function daysUntil(expiresAt: string | null): number {
  if (!expiresAt) return Number.POSITIVE_INFINITY;
  return Math.max(
    0,
    Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000),
  );
}

function activeStateFromRow(row: LicenseRow, key: string): LicenseState {
  writeCache(key, row.expires_at);
  return {
    status: "active",
    tier: row.tier ?? "standard",
    maxOutlets: row.max_outlets ?? 1,
    clientName: row.client_name,
    expiresAt: row.expires_at,
    daysLeft: daysUntil(row.expires_at),
  };
}

/**
 * Evaluates a key against the deployed license row.
 * Enforces all five matching rules from the integration contract.
 *
 * @param options.ignoreInactive - activation path only: a key entered by the
 * client re-arms `is_active`, so a suspended row is not a hard failure.
 */
export async function checkLicense(
  enteredKey: string | null,
  options: { ignoreInactive?: boolean } = {},
): Promise<LicenseState> {
  const key = (enteredKey || "").trim();
  if (!key) return { status: "unlicensed" };

  let row: LicenseRow | null;
  try {
    row = await fetchLicenseRow();
  } catch (e) {
    // Offline / unreachable — fall back to the cached window if it still holds.
    const cache = readCache();
    if (cache && cache.key === key) {
      if (!cache.expiresAt || new Date(cache.expiresAt).getTime() > Date.now()) {
        return {
          status: "active",
          tier: "standard",
          maxOutlets: 1,
          clientName: null,
          expiresAt: cache.expiresAt,
          daysLeft: daysUntil(cache.expiresAt),
        };
      }
      return { status: "expired", expiresAt: cache.expiresAt };
    }
    return { status: "error", message: (e as Error).message };
  }

  if (!row) return { status: "unlicensed" };
  // Exact, case-sensitive comparison — includes the VFCM- prefix.
  if (key !== row.license_key) return { status: "invalid_key" };
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) {
    return { status: "expired", expiresAt: row.expires_at };
  }
  if (row.is_active === false && !options.ignoreInactive) {
    return { status: "suspended" };
  }

  return activeStateFromRow(row, key);
}

/** Validates the currently stored key for this installation. */
export function checkStoredLicense(): Promise<LicenseState> {
  return checkLicense(getStoredLicenseKey());
}

/**
 * Called by the Renew License form. Persists the key and re-arms `is_active`
 * when the key matches a license whose window is still open.
 */
export async function activateLicense(
  enteredKey: string,
): Promise<LicenseState> {
  const state = await checkLicense(enteredKey, { ignoreInactive: true });
  if (state.status !== "active") return state;

  storeLicenseKey(enteredKey);
  // Client-side activation flips the master switch back on (contract v1.0.0
  // allows the client app to update its own license row).
  const { error } = await supabase
    .from("system_license")
    .update({ is_active: true, updated_at: new Date().toISOString() })
    .eq("id", LICENSE_ROW_ID);
  if (error) return { status: "error", message: error.message };
  markExpiryCheckRan();
  return state;
}

/* ------------------------------------------------------------------ */
/* Daily expiry enforcement                                            */
/* ------------------------------------------------------------------ */

const EXPIRY_CHECK_KEY = "zean.license.lastExpiryCheck";

function markExpiryCheckRan(): void {
  try {
    localStorage.setItem(EXPIRY_CHECK_KEY, getSystemTodayStr());
  } catch {
    /* noop */
  }
}

function expiryCheckRanToday(): boolean {
  try {
    return localStorage.getItem(EXPIRY_CHECK_KEY) === getSystemTodayStr();
  } catch {
    return false;
  }
}

/**
 * Runs at most once per (Kathmandu) calendar day: if the license window has
 * closed, `is_active` is flipped to false so every surface — including the
 * master panel — sees a consistent lapsed state.
 */
export async function runDailyExpiryCheck(): Promise<void> {
  if (expiryCheckRanToday()) return;
  try {
    const row = await fetchLicenseRow();
    markExpiryCheckRan();
    if (!row || row.is_active === false) return;
    const lapsed =
      !!row.expires_at && new Date(row.expires_at).getTime() <= Date.now();
    if (!lapsed) return;
    await supabase
      .from("system_license")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", LICENSE_ROW_ID);
  } catch {
    /* offline — retry on the next app load */
  }
}

/** Human-readable message for a non-active state. */
export function licenseMessage(state: LicenseState): string {
  switch (state.status) {
    case "unlicensed":
      return "No license found for this installation. Enter the license key provided by administration.";
    case "invalid_key":
      return "Invalid license key for this installation.";
    case "suspended":
      return "This installation has been suspended. Please contact support.";
    case "expired":
      return "Your license has expired. Enter a renewal key to continue.";
    case "error":
      return state.message || "Unable to verify the license.";
    default:
      return "License active.";
  }
}
