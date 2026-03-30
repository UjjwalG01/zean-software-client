import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { CalendarDays, Clock, User, Dumbbell, CheckCircle, Printer } from "lucide-react";
import type { Booking } from "@/lib/mock-data";
import { useUpdateBooking, useCompanySettings } from "@/hooks/use-firestore";
import { generateA5BillHTML, printHTML } from "@/lib/print-utils";
import { toast } from "sonner";
import { format } from "date-fns";

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
  const updateBooking = useUpdateBooking();
  const { data: settings = {} } = useCompanySettings();
  const [localStatus, setLocalStatus] = useState<string | null>(null);

  if (!b) return null;

  const status = localStatus || b.status;

  const handleComplete = async () => {
    try {
      await updateBooking.mutateAsync({ id: b.id, data: { status: "Completed" } });
      setLocalStatus("Completed");
      toast.success("Booking marked as completed!");
    } catch {
      toast.error("Failed to update booking");
    }
  };

  const handleGenerateBill = () => {
    const companyName = settings.companyName || "VitaFit Club";
    const companyAddress = settings.companyAddress || "";
    const companyPhone = settings.companyPhone || "";
    const companyEmail = settings.companyEmail || "";
    const vatNo = settings.vatNo || "";

    // Estimate amount from service (can be refined with real pricing)
    const rate = 500; // default
    const amount = rate;
    const taxableAmount = amount;
    const vatAmount = Math.round(taxableAmount * 0.13);
    const grandTotal = taxableAmount + vatAmount;

    const html = generateA5BillHTML({
      companyName,
      companyAddress,
      companyPhone,
      companyEmail,
      vatNo,
      guestName: b.memberName,
      billNo: `BK-${b.id.slice(0, 8)}`,
      billDate: format(new Date(), "dd/MM/yyyy"),
      billForMonth: `${b.className} — ${format(new Date(b.date), "MMMM yyyy")}`,
      items: [{ description: `${b.service} — ${b.className}`, quantity: 1, rate, amount }],
      subtotal: amount,
      taxableAmount,
      vatAmount,
      grandTotal,
      attendant: "admin",
    });

    printHTML(html);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setLocalStatus(null); }}>
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
                variant={status === "Confirmed" ? "default" : status === "Completed" ? "default" : status === "Pending" ? "secondary" : "destructive"}
                className={`ml-auto text-xs ${status === "Completed" ? "bg-success/20 text-success border-0" : ""}`}
              >
                {status}
              </Badge>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 pt-2">
            {status !== "Completed" && status !== "Cancelled" && (
              <Button
                size="sm"
                className="flex-1 gradient-gold text-primary-foreground"
                onClick={handleComplete}
                disabled={updateBooking.isPending}
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                {updateBooking.isPending ? "Updating..." : "Mark Completed"}
              </Button>
            )}
            {status === "Completed" && (
              <Button size="sm" variant="outline" className="flex-1" onClick={handleGenerateBill}>
                <Printer className="h-4 w-4 mr-1" />Generate A5 Bill
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
