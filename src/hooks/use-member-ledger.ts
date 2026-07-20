import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { MemberLedgerRow } from "@/types/finance";

export type { MemberLedgerRow } from "@/types/finance";

/** Fetch the server-computed ledger rows for a member from `vw_member_ledger`. */
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
