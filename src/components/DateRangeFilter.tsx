import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface Props {
  from: string;
  to: string;
  onChange: (range: { from: string; to: string }) => void;
  className?: string;
}

/**
 * Compact "From → To" date range filter used across Bookings, Forecast and
 * Transactions pages. Both inputs are native date pickers — fast, accessible
 * and consistent with the rest of the app.
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
