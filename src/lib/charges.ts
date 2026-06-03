// Charging-first helpers.
//
// Business rule:
//   1. Bookings + manual "Record Charge" entries create a Transaction of
//      type="Charge" and status="pending" → adds to the member's due balance.
//   2. Advances / Payments create credit-side rows that reduce that balance.
//   3. When applying an advance, we automatically settle the oldest still-
//      pending charges FIFO until the advance is exhausted.
//
// All writes go through useAddTransaction / useUpdateTransaction so we stay
// consistent with the existing Firestore/Supabase storage layer.
import type { Transaction, PaymentMethod, ServiceType } from "./mock-data";

type AddFn = (data: Partial<Transaction>) => Promise<string>;
type UpdateFn = (args: { id: string; data: Partial<Transaction> }) => Promise<unknown>;

const today = () => new Date().toISOString().split("T")[0];
const receipt = (prefix: string) => `${prefix}-${Date.now()}`;

export interface ChargeForBookingInput {
  memberId: string;
  memberName: string;
  bookingId: string;
  service: ServiceType | string;
  className: string;
  amount: number;          // VAT-inclusive
  chargeHead?: string;     // service head name (defaults to the service)
}

/** Create one pending charge row for a freshly-created booking. */
export async function createChargeForBooking(
  add: AddFn,
  input: ChargeForBookingInput,
): Promise<string> {
  return add({
    memberId: input.memberId,
    memberName: input.memberName,
    amount: input.amount,
    method: "Cash" as PaymentMethod, // placeholder — not collected until settlement
    type: "Charge",
    date: today(),
    description: `${input.service} — ${input.className}`,
    receiptNo: receipt("CHG"),
    status: "pending",
    bookingId: input.bookingId,
    chargeHead: input.chargeHead || String(input.service),
  });
}

export interface ManualChargeInput {
  memberId: string;
  memberName: string;
  chargeHead: string;
  amount: number;
  note?: string;
}

export async function createManualCharge(add: AddFn, input: ManualChargeInput): Promise<string> {
  return add({
    memberId: input.memberId,
    memberName: input.memberName,
    amount: input.amount,
    method: "Cash" as PaymentMethod,
    type: "Charge",
    date: today(),
    description: `${input.chargeHead}${input.note ? ` — ${input.note}` : ""}`,
    receiptNo: receipt("CHG"),
    status: "pending",
    chargeHead: input.chargeHead,
  });
}

/**
 * Record an advance payment. Returns the id of the advance row.
 * Caller is responsible for re-fetching transactions and running
 * `settleOldestCharges` if they want auto-settlement.
 */
export async function applyAdvance(
  add: AddFn,
  input: { memberId: string; memberName: string; amount: number; method: PaymentMethod; note?: string },
): Promise<string> {
  return add({
    memberId: input.memberId,
    memberName: input.memberName,
    amount: input.amount,
    method: input.method,
    type: "Advance",
    date: today(),
    description: input.note ? `Advance — ${input.note}` : "Advance Payment",
    receiptNo: receipt("ADV"),
    status: "paid",
  });
}

/**
 * Walk a member's outstanding charges in date order and mark them as settled
 * until `creditAmount` is exhausted. Returns the amount of credit left over
 * (which becomes a member-side advance balance).
 */
export async function settleOldestCharges(
  update: UpdateFn,
  transactions: Transaction[],
  memberId: string,
  creditAmount: number,
): Promise<number> {
  let credit = creditAmount;
  const pending = transactions
    .filter((t) => t.memberId === memberId && t.type === "Charge" && t.status === "pending")
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  for (const c of pending) {
    if (credit <= 0) break;
    if (credit >= c.total) {
      await update({ id: c.id, data: { status: "paid" } });
      credit -= c.total;
    } else {
      // Partial — leave the charge open; treat the credit as fully applied for now.
      // (A future enhancement could split the charge.)
      break;
    }
  }
  return credit;
}
