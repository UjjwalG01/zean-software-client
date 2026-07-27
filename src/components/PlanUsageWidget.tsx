import { Activity, CalendarCheck, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useMemberPlanUsage } from "@/hooks/use-member-plan-usage";
import type { Member } from "@/lib/mock-data";

interface Props {
  memberId: string;
  member: Pick<Member, "joinDate" | "expiryDate" | "plan">;
  compact?: boolean;
}

/**
 * Displays a member's plan-window utilization vs recorded check-ins.
 */
export function PlanUsageWidget({ memberId, member, compact }: Props) {
  const { data, isLoading } = useMemberPlanUsage(memberId, member);

  if (isLoading) {
    return (
      <div className="glass-card rounded-xl p-4 animate-pulse">
        <div className="h-4 w-40 bg-muted/40 rounded mb-3" />
        <div className="h-2 w-full bg-muted/40 rounded" />
      </div>
    );
  }

  if (!data || !data.isValid) {
    return (
      <div className="">
        {/* <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
          Plan Usage &amp; Attendance
        </p>
        <p className="text-sm text-muted-foreground">
          Assign a plan with join and expiry dates to see utilization.
        </p> */}
      </div>
    );
  }

  const {
    startDate,
    expiryDate,
    totalPlanDays,
    daysElapsed,
    daysRemaining,
    attendedDays,
    totalCheckIns,
    utilizationPercent,
    attendanceRatePercent,
  } = data;

  if (compact) {
    return (
      <Badge variant="outline" className="text-[10px]">
        {attendedDays}/{totalPlanDays}d · {utilizationPercent}%
      </Badge>
    );
  }

  return (
    <div className="glass-card rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm mt-1">
            <span className="font-semibold">{attendedDays}</span> days used out
            of <span className="font-semibold">{totalPlanDays}</span> plan days
            <span className="text-muted-foreground">
              {" "}
              ({totalCheckIns} check-ins recorded)
            </span>
          </p>
        </div>
        <Badge className="gradient-gold text-primary-foreground">
          {utilizationPercent}% utilized
        </Badge>
      </div>
      <Progress value={utilizationPercent} className="h-2" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
        <Stat
          icon={CalendarCheck}
          label="Plan Window"
          value={
            startDate && expiryDate
              ? `${format(startDate, "dd MMM yy")} → ${format(expiryDate, "dd MMM yy")}`
              : "—"
          }
        />
        <Stat
          icon={Activity}
          label="Days Elapsed"
          value={`${daysElapsed} / ${totalPlanDays}`}
        />
        <Stat
          icon={TrendingUp}
          label="Days Remaining"
          value={String(daysRemaining)}
        />
        <Stat
          icon={Activity}
          label="Attendance Rate"
          value={`${attendanceRatePercent}%`}
          sub="of days elapsed"
        />
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg bg-muted/20 p-2.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <p className="text-sm font-semibold mt-1">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
