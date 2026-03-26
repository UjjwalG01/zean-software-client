import { cn } from "@/lib/utils";
import { type MemberStatus, statusColors } from "@/lib/mock-data";

export function StatusBadge({ status, className }: { status: MemberStatus; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", statusColors[status], className)}>
      {status}
    </span>
  );
}
