import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CalendarDays, Clock, User, Dumbbell } from "lucide-react";
import type { Booking } from "@/lib/mock-data";

interface BookingDetailModalProps {
  booking: Booking | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const serviceColors: Record<string, string> = {
  Gym: "bg-primary/20 text-primary",
  Spa: "bg-spa/20 text-spa",
  Sauna: "bg-sauna/20 text-sauna",
  Swimming: "bg-swimming/20 text-swimming",
};

export function BookingDetailModal({ booking: b, open, onOpenChange }: BookingDetailModalProps) {
  if (!b) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            Booking Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-border/50 bg-muted/30 p-4 text-center">
            <p className="font-semibold text-lg">{b.className}</p>
            <Badge className={`text-xs mt-2 border-0 ${serviceColors[b.service] || ""}`}>{b.service}</Badge>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Member</span>
              <span className="ml-auto font-medium">{b.memberName}</span>
            </div>
            <Separator />
            <div className="flex items-center gap-3 text-sm">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Date</span>
              <span className="ml-auto font-medium">{b.date}</span>
            </div>
            <Separator />
            <div className="flex items-center gap-3 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Time</span>
              <span className="ml-auto font-medium">{b.startTime} – {b.endTime}</span>
            </div>
            <Separator />
            <div className="flex items-center gap-3 text-sm">
              <Dumbbell className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Instructor</span>
              <span className="ml-auto font-medium">{b.instructor || "—"}</span>
            </div>
            <Separator />
            <div className="flex items-center gap-3 text-sm">
              <span className="text-muted-foreground ml-7">Status</span>
              <Badge
                variant={b.status === "Confirmed" ? "default" : b.status === "Pending" ? "secondary" : "destructive"}
                className="ml-auto text-xs"
              >
                {b.status}
              </Badge>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
