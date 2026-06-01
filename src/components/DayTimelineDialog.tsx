import { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Booking } from "@/lib/mock-data";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  date: string;                          // YYYY-MM-DD
  bookings: Booking[];                   // bookings filtered to outlet+date
  durationMinutes: number;               // selected service duration
  onPick: (startTime: string, endTime: string) => void;
}

/**
 * Non-dismissible 24h hour-wise booking timeline.
 * - Cannot be closed by clicking outside or pressing Escape (only the X button or a slot pick closes it).
 * - Already-booked hours are disabled.
 */
export function DayTimelineDialog({ open, onOpenChange, date, bookings, durationMinutes, onPick }: Props) {
  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);

  // Cancelled bookings free up their slot — exclude from the busy list.
  const takenRanges = useMemo(() => bookings.filter((b) => b.status !== "Cancelled").map((b) => {
    const [sh, sm] = (b.startTime || "00:00").split(":").map(Number);
    const [eh, em] = (b.endTime || b.startTime || "00:00").split(":").map(Number);
    return { start: sh * 60 + sm, end: eh * 60 + em, label: `${b.memberName} · ${b.className}` };
  }), [bookings]);

  const isHourTaken = (h: number) => {
    const slotStart = h * 60;
    const slotEnd = slotStart + Math.max(15, durationMinutes);
    return takenRanges.some((r) => slotStart < r.end && r.start < slotEnd);
  };

  const pick = (h: number) => {
    const start = `${String(h).padStart(2, "0")}:00`;
    const end = h * 60 + durationMinutes;
    const eh = Math.floor(end / 60) % 24;
    const em = end % 60;
    onPick(start, `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={() => { /* non-dismissible */ }}>
      <DialogContent
        className="max-w-xl max-h-[85vh] overflow-y-auto"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Pick a Time Slot — {date}</DialogTitle>
          <DialogDescription>
            Tap any free hour to start. Slot duration: {durationMinutes} min. Booked slots are disabled.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-4 gap-2 py-2">
          {hours.map((h) => {
            const taken = isHourTaken(h);
            return (
              <Button
                key={h}
                type="button"
                variant={taken ? "secondary" : "outline"}
                disabled={taken}
                onClick={() => pick(h)}
                className={cn(
                  "h-12 flex-col gap-0 px-0",
                  taken && "opacity-60 cursor-not-allowed line-through"
                )}
              >
                <span className="text-sm font-semibold">{String(h).padStart(2, "0")}:00</span>
                <span className="text-[10px] text-muted-foreground">{taken ? "Booked" : "Free"}</span>
              </Button>
            );
          })}
        </div>

        {takenRanges.length > 0 && (
          <div className="border-t pt-3 text-xs space-y-1">
            <p className="font-medium">Existing bookings</p>
            {takenRanges.map((r, i) => (
              <div key={i} className="flex justify-between text-muted-foreground">
                <span>{r.label}</span>
                <span>
                  {String(Math.floor(r.start / 60)).padStart(2, "0")}:{String(r.start % 60).padStart(2, "0")}
                  {" – "}
                  {String(Math.floor(r.end / 60)).padStart(2, "0")}:{String(r.end % 60).padStart(2, "0")}
                </span>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
