import { useMemo } from "react";
import { format } from "date-fns";
import { Plus, Calendar, Clock, User, Dumbbell, ArrowRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Booking } from "@/lib/mock-data";

interface DayBookingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date | null;
  bookings: Booking[];
  onAddBooking: () => void;
  onViewBookingDetail: (booking: Booking) => void;
}

const serviceColors: Record<string, string> = {
  Gym: "bg-primary/20 text-primary border-primary/20",
  Spa: "bg-spa/20 text-spa border-spa/20",
  Sauna: "bg-sauna/20 text-sauna border-sauna/20",
  Swimming: "bg-swimming/20 text-swimming border-swimming/20",
};

const statusColors: Record<string, string> = {
  Confirmed: "bg-success/20 text-success border-0",
  Completed: "bg-success/20 text-success border-0",
  Pending: "bg-amber-500/20 text-amber-500 border-0",
  Cancelled: "bg-destructive/20 text-destructive border-0",
};

export function DayBookingsDialog({
  open,
  onOpenChange,
  date,
  bookings,
  onAddBooking,
  onViewBookingDetail,
}: DayBookingsDialogProps) {
  const dateLabel = useMemo(() => {
    if (!date) return "";
    return format(date, "MMMM d, yyyy");
  }, [date]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader className="border-b pb-4 mb-4">
          <div className="flex items-center justify-between pr-8">
            <div className="space-y-1">
              <DialogTitle className="text-xl font-bold font-display flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Schedule
              </DialogTitle>
              <DialogDescription className="text-xs">
                {dateLabel} • {bookings.length} {bookings.length === 1 ? "booking" : "bookings"}
              </DialogDescription>
            </div>
            <Button
              size="sm"
              className="gradient-gold text-primary-foreground flex items-center gap-1.5 h-9 rounded-lg"
              onClick={onAddBooking}
            >
              <Plus className="h-4 w-4" /> Add Booking
            </Button>
          </div>
        </DialogHeader>

        {bookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 border border-dashed rounded-xl bg-muted/20">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4">
              <Calendar className="h-6 w-6" />
            </div>
            <h3 className="font-semibold text-base mb-1">No Bookings Scheduled</h3>
            <p className="text-sm text-muted-foreground text-center mb-6 max-w-sm">
              There are no service or class bookings scheduled for {dateLabel} yet.
            </p>
            <Button onClick={onAddBooking} variant="outline" className="flex items-center gap-1.5">
              <Plus className="h-4 w-4" /> Create First Booking
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {bookings.map((b) => (
              <div
                key={b.id}
                onClick={() => onViewBookingDetail(b)}
                className="group relative rounded-xl border border-border/80 bg-card p-4 hover:border-primary/50 transition-all duration-300 hover:shadow-md cursor-pointer flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-sm line-clamp-1 group-hover:text-primary transition-colors">
                      {b.className || b.service}
                    </p>
                    <Badge variant="secondary" className={statusColors[b.status] || ""}>
                      {b.status}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline" className={serviceColors[b.service] || "text-xs"}>
                      {b.service}
                    </Badge>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-border/50 space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <User className="h-3.5 w-3.5 text-primary/70" />
                    <span className="font-medium text-foreground">{b.memberName}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span>
                      {b.startTime} – {b.endTime || b.startTime}
                    </span>
                  </div>
                  {b.instructor && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Dumbbell className="h-3.5 w-3.5" />
                      <span>{b.instructor}</span>
                    </div>
                  )}
                </div>

                <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
