import { ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";
import { useLicense } from "@/hooks/use-license";
import { licenseMessage } from "@/lib/license";

interface LicenseStatusBadgeProps {
  className?: string;
}

/** Compact license state + expiry countdown for the sidebar footer. */
export function LicenseStatusBadge({ className = "" }: LicenseStatusBadgeProps) {
  const { state, loading } = useLicense();

  if (loading || !state) {
    return (
      <p className={`text-[10px] text-muted-foreground/60 ${className}`}>
        Checking license…
      </p>
    );
  }

  if (state.status !== "active") {
    return (
      <div
        className={`flex items-center gap-1.5 text-[10px] text-destructive ${className}`}
        title={licenseMessage(state)}
      >
        <ShieldX className="h-3 w-3 shrink-0" />
        <span className="truncate">License {state.status.replace("_", " ")}</span>
      </div>
    );
  }

  const unlimited = !Number.isFinite(state.daysLeft) || !state.expiresAt;
  const warning = !unlimited && state.daysLeft <= 14;
  const Icon = warning ? ShieldAlert : ShieldCheck;

  return (
    <div
      className={`flex items-center gap-1.5 text-[10px] ${warning ? "text-amber-500" : "text-muted-foreground/70"} ${className}`}
      title={
        state.expiresAt
          ? `Valid until ${new Date(state.expiresAt).toLocaleDateString()} · ${state.tier} · up to ${state.maxOutlets} outlet(s)`
          : "Perpetual license"
      }
    >
      <Icon className="h-3 w-3 shrink-0" />
      <span className="truncate">
        {unlimited
          ? "License active"
          : `License · ${state.daysLeft} day${state.daysLeft === 1 ? "" : "s"} left`}
      </span>
    </div>
  );
}
