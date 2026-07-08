import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

/**
 * A row from the `vw_member_ledger` Postgres view — the server-side SSOT for
 * chronological member ledger entries (charges + payments + advances + settlements).
 */
export interface MemberLedgerRow {
  id: string;
  member_id: string;
  receipt_no: string | null;
  occurred_at: string;
  occurred_on: string;
  type: "Charge" | "Payment" | "Advance" | "Settlement" | "Refund" | string;
  description: string;
  charge_head: string | null;
  method: string | null;
  gross_amount: number;
  vat_amount: number;
  discount_amount: number;
  net_amount: number;
  voided: boolean;
  computed_status: "Settled" | "Partial" | "Pending" | "Voided";
  debit: number;
  credit: number;
  source: "booking" | "manual" | "payment" | "advance" | "settlement" | string;
  running_balance: number;
}

/** Fetch the server-computed ledger rows for a member. */
export function useMemberLedger(memberId?: string) {
  return useQuery({
    queryKey: ["member-ledger", memberId],
    enabled: !!memberId,
    queryFn: async (): Promise<MemberLedgerRow[]> => {
      const { data, error } = await supabase
        .from("vw_member_ledger")
        .select("*")
        .eq("member_id", memberId!)
        .order("occurred_at", { ascending: false });
      if (error) throw error;
      return (data || []) as MemberLedgerRow[];
    },
  });
}
