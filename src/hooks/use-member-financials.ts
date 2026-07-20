import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { MemberFinancialSummary } from "@/types/finance";

export type { MemberFinancialSummary } from "@/types/finance";

/**
 * Server-side aggregate totals per member from `member_financial_summaries`.
 * SSOT for balance/paid/advance figures rendered anywhere in the UI.
 */
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
