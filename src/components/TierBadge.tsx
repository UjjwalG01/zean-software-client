import { cn } from "@/lib/utils";
import { type MemberTier, tierColors } from "@/lib/mock-data";

export function TierBadge({ tier, className }: { tier: MemberTier; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", tierColors[tier], className)}>
      {tier}
    </span>
  );
}
