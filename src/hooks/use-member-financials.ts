import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

/**
 * A row from `member_financial_summaries` — server-side aggregate totals per
 * member. Replaces the client-side .reduce() balance math previously done in
 * Advance / Settle / Ledger flows.
 */
export interface MemberFinancialSummary {
  member_id: string;
  total_invoiced: number;
  total_paid: number;
  total_discounts: number;
  total_advances: number;
  /** Signed. Positive = member owes, negative = member is owed (overpaid/refund). */
  net_outstanding: number;
}

export function useMemberFinancials(memberId?: string) {
  return useQuery({
    queryKey: ["member-financials", memberId],
    enabled: !!memberId,
    queryFn: async (): Promise<MemberFinancialSummary | null> => {
      const { data, error } = await supabase
        .from("member_financial_summaries")
        .select("*")
        .eq("member_id", memberId!)
        .maybeSingle();
      if (error) throw error;
      return (data as MemberFinancialSummary | null) ?? null;
    },
  });
}
