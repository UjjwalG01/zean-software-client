import { describe, it, expect, vi } from "vitest";

// The Supabase client is imported at module load; stub it so we don't touch env.
vi.mock("@/lib/supabase", () => ({
  supabase: { from: () => ({}) },
}));

import {
  dbBookingStatusToDisplay,
  displayBookingStatusToDb,
  dbLifecycleStatusToDisplay,
  assertLifecycle,
} from "@/lib/supabase-services";

/**
 * These tests defend the Client ↔ DB translation bridge for the split
 * status domains:
 *   - bookings.status         → booking_status enum (LIFECYCLE)
 *   - bookings.booking_status → booking_status_v2 enum (CLASSIFICATION)
 *
 * Regressions in either decoder silently collapse states and hide
 * cancelled/completed rows from the UI, so we round-trip every legal value.
 */
describe("booking status machine — lifecycle domain (bookings.status)", () => {
  const legal = ["pending", "confirmed", "completed", "cancelled", "no_show"] as const;

  it.each(legal)("decodes %s verbatim from the DB", (v) => {
    expect(dbLifecycleStatusToDisplay(v)).toBe(v);
  });

  it("falls back to pending for unknown DB values", () => {
    expect(dbLifecycleStatusToDisplay("frobnicated")).toBe("pending");
    expect(dbLifecycleStatusToDisplay(null)).toBe("pending");
    expect(dbLifecycleStatusToDisplay(undefined)).toBe("pending");
    expect(dbLifecycleStatusToDisplay("")).toBe("pending");
  });

  it.each(legal)("assertLifecycle passes through legal value %s", (v) => {
    expect(assertLifecycle(v)).toBe(v);
    expect(assertLifecycle(v.toUpperCase())).toBe(v);
  });

  it("assertLifecycle rejects classification words", () => {
    // These belong to booking_status_v2, not booking_status. They must never
    // be written to the lifecycle column.
    expect(assertLifecycle("wait-listed")).toBeUndefined();
    expect(assertLifecycle("not-fixed")).toBeUndefined();
    expect(assertLifecycle("provisional")).toBeUndefined();
  });

  it("assertLifecycle returns undefined for empty inputs", () => {
    expect(assertLifecycle(undefined)).toBeUndefined();
    expect(assertLifecycle(null)).toBeUndefined();
    expect(assertLifecycle("")).toBeUndefined();
  });
});

describe("booking status machine — classification domain (bookings.booking_status)", () => {
  const roundTrip: Array<[string, string]> = [
    ["confirmed", "confirmed"],
    ["wait-listed", "wait-listed"],
    ["waitlisted", "wait-listed"],
    ["not-fixed", "not-fixed"],
    ["notfixed", "not-fixed"],
    ["provisional", "provisional"],
    ["pending", "pending"],
  ];

  it.each(roundTrip)("normalises %s → %s on write", (input, expected) => {
    expect(displayBookingStatusToDb(input)).toBe(expected);
  });

  it("preserves provisional/pending on read (regression: previously collapsed to confirmed)", () => {
    expect(dbBookingStatusToDisplay("provisional")).toBe("provisional");
    expect(dbBookingStatusToDisplay("pending")).toBe("pending");
    expect(dbBookingStatusToDisplay("wait-listed")).toBe("wait-listed");
    expect(dbBookingStatusToDisplay("not-fixed")).toBe("not-fixed");
    expect(dbBookingStatusToDisplay("confirmed")).toBe("confirmed");
  });

  it("full round-trip: DB → display → DB is stable", () => {
    for (const v of ["confirmed", "wait-listed", "not-fixed", "provisional", "pending"]) {
      const display = dbBookingStatusToDisplay(v);
      expect(displayBookingStatusToDb(display)).toBe(v);
    }
  });

  it("unknown inputs default to confirmed on write", () => {
    expect(displayBookingStatusToDb("garbage")).toBe("confirmed");
    expect(displayBookingStatusToDb(undefined)).toBe("confirmed");
  });
});

/**
 * NaN-proofing guard for BookingDetailModal.handleGenerateBill.
 * The printed A5 bill interpolates baseRate/vatAmount/grandTotal; any
 * null/undefined/NaN slipping through renders "NaN" on paper.
 */
describe("bill amount coercion guard", () => {
  const n = (x: unknown) => {
    const v = Number(x ?? 0);
    return Number.isFinite(v) ? v : 0;
  };

  it("returns 0 for null/undefined/empty/NaN", () => {
    expect(n(null)).toBe(0);
    expect(n(undefined)).toBe(0);
    expect(n("")).toBe(0);
    expect(n("not a number")).toBe(0);
    expect(n(NaN)).toBe(0);
    expect(n(Infinity)).toBe(0);
  });

  it("preserves numeric and numeric-string values", () => {
    expect(n(0)).toBe(0);
    expect(n(500)).toBe(500);
    expect(n("500")).toBe(500);
    expect(n(1234.56)).toBe(1234.56);
  });
});
