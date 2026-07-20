import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { differenceInCalendarDays, parseISO, isValid } from "date-fns";
import { getSystemNowDate } from "@/lib/timeUtils";
import type { Member } from "@/lib/mock-data";

const isSupabaseEnabled = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);

export interface MemberPlanUsage {
  startDate: Date | null;
  expiryDate: Date | null;
  totalPlanDays: number;
  daysElapsed: number;
  daysRemaining: number;
  attendedDays: number;
  totalCheckIns: number;
  utilizationPercent: number;
  attendanceRatePercent: number;
  isValid: boolean;
}

const EMPTY: MemberPlanUsage = {
  startDate: null,
  expiryDate: null,
  totalPlanDays: 0,
  daysElapsed: 0,
  daysRemaining: 0,
  attendedDays: 0,
  totalCheckIns: 0,
  utilizationPercent: 0,
  attendanceRatePercent: 0,
  isValid: false,
};

function parseDate(v: unknown): Date | null {
  if (!v || typeof v !== "string") return null;
  const d = parseISO(v);
  return isValid(d) ? d : null;
}

/**
 * Compare a member's total plan window against distinct check-in days
 * recorded within that window. Falls back safely when dates are missing.
 */
export function useMemberPlanUsage(
  memberId: string | undefined,
  member?: Pick<Member, "joinDate" | "expiryDate"> | null,
) {
  return useQuery<MemberPlanUsage>({
    queryKey: ["member-plan-usage", memberId, member?.joinDate, member?.expiryDate],
    enabled: !!memberId,
    queryFn: async () => {
      const startDate = parseDate(member?.joinDate);
      const expiryDate = parseDate(member?.expiryDate);
      if (!startDate || !expiryDate || expiryDate < startDate) return EMPTY;

      const now = getSystemNowDate();
      const totalPlanDays = Math.max(1, differenceInCalendarDays(expiryDate, startDate));
      const daysElapsed = Math.max(
        0,
        Math.min(totalPlanDays, differenceInCalendarDays(now, startDate)),
      );
      const daysRemaining = Math.max(0, differenceInCalendarDays(expiryDate, now));

      let attendedDays = 0;
      let totalCheckIns = 0;

      if (isSupabaseEnabled && memberId) {
        const { data, error } = await supabase
          .from("check_ins")
          .select("check_in_date, check_in_at")
          .eq("member_id", memberId)
          .gte("check_in_at", startDate.toISOString())
          .lte("check_in_at", expiryDate.toISOString());
        if (!error && Array.isArray(data)) {
          totalCheckIns = data.length;
          const days = new Set<string>();
          for (const row of data as Array<{ check_in_date?: string; check_in_at?: string }>) {
            const key = row.check_in_date || (row.check_in_at ? row.check_in_at.slice(0, 10) : null);
            if (key) days.add(key);
          }
          attendedDays = days.size;
        }
      }

      const utilizationPercent = Math.min(
        100,
        Math.round((attendedDays / totalPlanDays) * 100),
      );
      const attendanceRatePercent = daysElapsed > 0
        ? Math.min(100, Math.round((attendedDays / daysElapsed) * 100))
        : 0;

      return {
        startDate,
        expiryDate,
        totalPlanDays,
        daysElapsed,
        daysRemaining,
        attendedDays,
        totalCheckIns,
        utilizationPercent,
        attendanceRatePercent,
        isValid: true,
      };
    },
  });
}
