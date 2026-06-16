import { useMemo, useState } from "react";
import { format, isSameDay } from "date-fns";
import { Plus, Clock, User, Dumbbell, CalendarDays, GripVertical } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Booking } from "@/lib/mock-data";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  date: Date | null;
  bookings: Booking[];
  onAddBooking: (startTime?: string) => void;
  onBookingClick: (b: Booking) => void;
  /** Map service type -> hsl color string (matches Bookings calendar palette) */
  getServiceColor?: (service: string) => string;
  /** Hour range to show, defaults 6–23 */
  startHour?: number;
  endHour?: number;
  /** Called when the user drops a booking on a different hour slot. */
  onReschedule?: (booking: Booking, newStartHour: number) => Promise<void> | void;
}

const statusColors: Record<string, string> = {
  Confirmed: "bg-success/15 text-success border-success/30",
  Completed: "bg-success/15 text-success border-success/30",
  Pending: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  Cancelled: "bg-destructive/15 text-destructive border-destructive/30 line-through",
};

export function DayScheduleDialog({
  open,
  onOpenChange,
  date,
  bookings,
  onAddBooking,
  onBookingClick,
  getServiceColor,
  startHour = 6,
  endHour = 23,
  onReschedule,
}: Props) {
  const hours = useMemo(
    () => Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i),
    [startHour, endHour]
  );

  const byHour = useMemo(() => {
    const map = new Map<number, Booking[]>();
    for (const b of bookings) {
      const h = Number((b.startTime || "00:00").split(":")[0]);
      const arr = map.get(h) || [];
      arr.push(b);
      map.set(h, arr);
    }
    return map;
  }, [bookings]);

  const dateLabel = date ? format(date, "EEEE, MMMM d, yyyy") : "";
  const totalCount = bookings.length;

  // Disable past hours when the day being viewed is today (rule #6).
  const now = new Date();
  const isToday = !!date && isSameDay(date, now);
  const currentHour = now.getHours();
  const isPastHour = (h: number) => isToday && h < currentHour;

  // Track which hour is being dragged over so we can highlight it.
  const [dragOverHour, setDragOverHour] = useState<number | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const isReschedulable = (b: Booking) =>
    !!onReschedule && b.status !== "Completed" && b.status !== "Cancelled";

  const handleDragStart = (e: React.DragEvent, b: Booking) => {
    if (!isReschedulable(b)) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", b.id);
    setDraggingId(b.id);
  };

  const handleDrop = async (e: React.DragEvent, hour: number) => {
    e.preventDefault();
    setDragOverHour(null);
    setDraggingId(null);
    if (!onReschedule) return;
    if (isPastHour(hour)) return;
    const id = e.dataTransfer.getData("text/plain");
    const b = bookings.find((x) => x.id === id);
    if (!b || !isReschedulable(b)) return;
    const originalHour = Number((b.startTime || "00:00").split(":")[0]);
    if (originalHour === hour) return;
    await onReschedule(b, hour);
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[88vh] p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b border-border/60 bg-gradient-to-r from-background to-muted/30">
          <div className="flex items-start justify-between gap-3 pr-8">
            <div className="space-y-1">
              <DialogTitle className="text-xl font-bold font-display flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-primary" />
                Schedule for {date ? format(date, "MMMM d, yyyy") : ""}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {dateLabel} • {totalCount} {totalCount === 1 ? "booking" : "bookings"}
                {onReschedule && totalCount > 0 ? " • drag a card to another hour to reschedule" : ""}
              </DialogDescription>
            </div>
            <Button
              size="sm"
              onClick={() => onAddBooking()}
              className="gradient-gold text-primary-foreground h-9 rounded-lg shadow-md"
              aria-label="Add new booking"
            >
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh]">
          <div className="px-4 py-4">
            {totalCount === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 border border-dashed rounded-xl bg-muted/20 mx-2">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4">
                  <CalendarDays className="h-6 w-6" />
                </div>
                <h3 className="font-semibold text-base mb-1">No bookings scheduled</h3>
                <p className="text-sm text-muted-foreground text-center mb-5 max-w-sm">
                  This day is clear. Click + to add the first booking.
                </p>
                <Button onClick={() => onAddBooking()} variant="outline" className="gap-1.5">
                  <Plus className="h-4 w-4" /> Add New Booking
                </Button>
              </div>
            ) : (
              <div className="relative">
                {hours.map((h) => {
                  const slotBookings = byHour.get(h) || [];
                  const hourLabel = `${String(h).padStart(2, "0")}:00`;
                  const past = isPastHour(h);
                  const dropActive = dragOverHour === h && !past;
                  return (
                    <div
                      key={h}
                      className="flex gap-3 group"
                      onDragOver={(e) => {
                        if (!onReschedule || past) return;
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                        if (dragOverHour !== h) setDragOverHour(h);
                      }}
                      onDragLeave={() => { if (dragOverHour === h) setDragOverHour(null); }}
                      onDrop={(e) => handleDrop(e, h)}
                    >
                      <div className="w-14 shrink-0 pt-2 text-right">
                        <span className={cn("text-[11px] font-mono font-medium", past ? "text-muted-foreground/40" : "text-muted-foreground")}>
                          {hourLabel}
                        </span>
                      </div>
                      <div
                        className={cn(
                          "flex-1 min-h-[64px] border-l border-border/60 pl-3 py-1.5 relative transition-colors",
                          dropActive && "bg-primary/10 rounded-r-lg ring-1 ring-primary/40",
                        )}
                      >
                        <div className="absolute -left-1 top-3 h-2 w-2 rounded-full bg-border group-hover:bg-primary transition-colors" />
                        {slotBookings.length === 0 ? (
                          past ? (
                            <div className="w-full h-12 rounded-lg border border-dashed border-border/30 text-[11px] text-muted-foreground/40 flex items-center justify-center opacity-0 group-hover:opacity-100">
                              Past — cannot add
                            </div>
                          ) : (
                            <button
                              onClick={() => onAddBooking(hourLabel)}
                              className="w-full h-12 rounded-lg border border-dashed border-border/50 text-[11px] text-muted-foreground/70 hover:border-primary/50 hover:bg-primary/5 hover:text-primary transition-all flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100"
                            >
                              <Plus className="h-3 w-3" /> Add at {hourLabel}
                            </button>
                          )
                        ) : (
                          <div className="space-y-2">
                            {slotBookings.map((b) => {
                              const accent = getServiceColor?.(b.service);
                              const draggable = isReschedulable(b);
                              const lockedTitle =
                                onReschedule && !draggable
                                  ? `${b.status} bookings cannot be rescheduled`
                                  : undefined;
                              return (
                                <div
                                  key={b.id}
                                  draggable={draggable}
                                  onDragStart={(e) => handleDragStart(e, b)}
                                  onDragEnd={() => { setDraggingId(null); setDragOverHour(null); }}
                                  title={lockedTitle}
                                  className={cn(
                                    "w-full text-left rounded-lg border border-border/80 bg-card hover:border-primary/50 hover:shadow-md transition-all p-3 group/card relative overflow-hidden",
                                    draggable && "cursor-grab active:cursor-grabbing",
                                    onReschedule && !draggable && "cursor-not-allowed",
                                    draggingId === b.id && "opacity-50",
                                  )}
                                  role="button"
                                  tabIndex={0}
                                  onClick={() => onBookingClick(b)}
                                  onKeyDown={(e) => { if (e.key === "Enter") onBookingClick(b); }}
                                >
                                  <span
                                    className="absolute left-0 top-0 bottom-0 w-1"
                                    style={{ backgroundColor: accent || "hsl(var(--primary))" }}
                                  />
                                  <div className="flex items-start justify-between gap-2 mb-1.5 pl-2">
                                    <p className="font-semibold text-sm group-hover/card:text-primary transition-colors line-clamp-1 flex items-center gap-1.5">
                                      {draggable && <GripVertical className="h-3 w-3 text-muted-foreground/60" />}
                                      {b.className || b.service}
                                    </p>
                                    <Badge variant="outline" className={cn("text-[10px] shrink-0", statusColors[b.status] || "")}>
                                      {b.status}
                                    </Badge>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground pl-2">
                                    <span className="inline-flex items-center gap-1">
                                      <User className="h-3 w-3 text-primary/70" />
                                      <span className="text-foreground font-medium">{b.memberName}</span>
                                    </span>
                                    <span className="inline-flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      {b.startTime}{b.endTime ? ` – ${b.endTime}` : ""}
                                    </span>
                                    {b.instructor && (
                                      <span className="inline-flex items-center gap-1">
                                        <Dumbbell className="h-3 w-3" />
                                        {b.instructor}
                                      </span>
                                    )}
                                    <Badge variant="secondary" className="text-[10px] ml-auto">
                                      {b.service}
                                    </Badge>
                                  </div>
                                </div>
                              );
                            })}

                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
