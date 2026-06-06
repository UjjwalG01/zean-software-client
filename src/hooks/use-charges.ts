import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface ChargeRow {
  id: string;
  member_id: string;
  member_name: string;
  charge_head: string;
  description: string | null;
  amount: number;
  vat_amount: number;
  total: number;
  status: "unpaid" | "billed" | "paid";
  meta: { type?: string; bookingId?: string; voided?: boolean } | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Live charges from the dedicated `charges` table (manual + booking). */
export function useCharges() {
  return useQuery({
    queryKey: ["charges"],
    queryFn: async (): Promise<ChargeRow[]> => {
      const { data, error } = await supabase
        .from("charges")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) {
        // Table may not exist locally — degrade gracefully so ledger still renders.
        // eslint-disable-next-line no-console
        console.warn("[useCharges]", error.message);
        return [];
      }
      return (data || []) as ChargeRow[];
    },
  });
}
