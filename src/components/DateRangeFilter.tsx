import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { getAppTimezone, startOfDayIsoInTz, endOfDayIsoInTz } from "@/lib/tz";

interface Props {
  from: string;
  to: string;
  onChange: (range: { from: string; to: string }) => void;
  className?: string;
}

/**
 * Compact "From → To" date range filter used across Bookings, Forecast and
 * Transactions pages. Date strings (YYYY-MM-DD) are interpreted in the
 * app-configured timezone.
 */
export function DateRangeFilter({ from, to, onChange, className = "" }: Props) {
  return (
    <div className={`flex flex-wrap items-end gap-2 ${className}`}>
      <div className="space-y-1">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">From</Label>
        <Input
          type="date"
          value={from}
          onChange={(e) => onChange({ from: e.target.value, to })}
          className="h-9 w-[150px] bg-muted/50 border-0"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">To</Label>
        <Input
          type="date"
          value={to}
          onChange={(e) => onChange({ from, to: e.target.value })}
          className="h-9 w-[150px] bg-muted/50 border-0"
        />
      </div>
      {(from || to) && (
        <Button
          variant="ghost"
          size="sm"
          className="h-9 px-2 text-muted-foreground"
          onClick={() => onChange({ from: "", to: "" })}
          title="Clear date range"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

/** Convert a YYYY-MM-DD range to TZ-aware UTC ISO bounds for query filters. */
export function rangeToUtcBounds(from: string, to: string) {
  const tz = getAppTimezone();
  return {
    fromIso: from ? startOfDayIsoInTz(from, tz) : null,
    toIso: to ? endOfDayIsoInTz(to, tz) : null,
  };
}
