/**
 * Prepaid membership pools — "pay upfront, consume per attendance".
 *
 *   1. createPrepaidPool() — call when a member buys a prepaid plan.
 *      Stores the cash collected + daily rate + dates.
 *   2. consumeForAttendance() — called from the Attendance flow after a
 *      successful check-in. Writes one `charges` row (idempotent per
 *      pool×attendance pair) and increments `used_amount` on the pool.
 *   3. getActivePoolForMember() — looks up an open pool valid for `day`.
 */
import { supabase } from "./supabase";

export interface PrepaidPool {
  id: string;
  member_id: string;
  plan_id: string | null;
  outlet_id: string | null;
  module_id: string | null;
  total_paid: number;
  daily_rate: number;
  used_amount: number;
  start_date: string;
  end_date: string | null;
  status: "active" | "exhausted" | "closed";
}

export async function createPrepaidPool(input: {
  memberId: string;
  planId?: string | null;
  outletId?: string | null;
  moduleId?: string | null;
  sourcePaymentId?: string | null;
  totalPaid: number;
  dailyRate: number;
  startDate: string;
  endDate?: string | null;
}): Promise<string> {
  const { data, error } = await supabase
    .from("prepaid_pools")
    .insert({
      member_id: input.memberId,
      plan_id: input.planId || null,
      outlet_id: input.outletId || null,
      module_id: input.moduleId || null,
      source_payment_id: input.sourcePaymentId || null,
      total_paid: input.totalPaid,
      daily_rate: input.dailyRate,
      start_date: input.startDate,
      end_date: input.endDate || null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function getActivePoolForMember(
  memberId: string,
  day: string,
): Promise<PrepaidPool | null> {
  const { data, error } = await supabase
    .from("prepaid_pools")
    .select("*")
    .eq("member_id", memberId)
    .eq("status", "active")
    .lte("start_date", day)
    .or(`end_date.is.null,end_date.gte.${day}`)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) {
    // eslint-disable-next-line no-console
    console.warn("[prepaid] lookup failed:", error.message);
    return null;
  }
  return (data as PrepaidPool) || null;
}

export async function consumeForAttendance(input: {
  memberId: string;
  memberName: string;
  attendanceId: string;
  day: string;
}): Promise<{ consumed: number; remaining: number } | null> {
  const pool = await getActivePoolForMember(input.memberId, input.day);
  if (!pool || pool.daily_rate <= 0) return null;

  const amount = Number(pool.daily_rate) || 0;
  const remainingBefore = Math.max(0, Number(pool.total_paid) - Number(pool.used_amount));
  if (remainingBefore <= 0) return null;
  const consumed = Math.min(amount, remainingBefore);

  // Idempotent: pool_id + attendance_id is unique.
  const { error: insErr } = await supabase.from("charges").insert({
    member_id: input.memberId,
    member_name: input.memberName,
    charge_head: "Daily Membership",
    description: `Daily consumption — ${input.day}`,
    amount: consumed,
    vat_amount: 0,
    total: consumed,
    used_amount: consumed,
    status: "paid",
    paid_at: new Date().toISOString(),
    meta: { type: "consumption", attendanceDate: input.day },
    pool_id: pool.id,
    attendance_id: input.attendanceId,
    outlet_id: pool.outlet_id,
    module_id: pool.module_id,
  });
  if (insErr) {
    if (/duplicate key|charges_pool_attendance_uniq/i.test(insErr.message)) return null;
    // eslint-disable-next-line no-console
    console.warn("[prepaid] charge insert failed:", insErr.message);
    return null;
  }

  const newUsed = Number(pool.used_amount) + consumed;
  const newStatus = newUsed >= Number(pool.total_paid) ? "exhausted" : "active";
  await supabase
    .from("prepaid_pools")
    .update({ used_amount: newUsed, status: newStatus })
    .eq("id", pool.id);

  return { consumed, remaining: Number(pool.total_paid) - newUsed };
}

export async function getMemberPoolsSummary(memberId: string): Promise<{
  totalPaid: number;
  usedAmount: number;
  remaining: number;
  pools: PrepaidPool[];
}> {
  const { data, error } = await supabase
    .from("prepaid_pools")
    .select("*")
    .eq("member_id", memberId);
  if (error || !data) return { totalPaid: 0, usedAmount: 0, remaining: 0, pools: [] };
  const pools = data as PrepaidPool[];
  const totalPaid = pools.reduce((s, p) => s + Number(p.total_paid || 0), 0);
  const usedAmount = pools.reduce((s, p) => s + Number(p.used_amount || 0), 0);
  return { totalPaid, usedAmount, remaining: Math.max(0, totalPaid - usedAmount), pools };
}
