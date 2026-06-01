import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarDays, Clock, User, Dumbbell, Printer, Pencil, Save, X, Ban, Receipt } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import type { Booking, ServiceType } from "@/lib/mock-data";
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

function parseSetup(settings: Record<string, string>, key: string, fallback: string[]): string[] {
  try { return settings[key] ? JSON.parse(settings[key]) : fallback; } catch { return fallback; }
}

function isFutureBooking(b: Booking): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(b.date) >= today;
}

export function BookingDetailModal({ booking: b, open, onOpenChange }: BookingDetailModalProps) {
  const navigate = useNavigate();
  const updateBooking = useUpdateBooking();
  const { data: settings = {} } = useCompanySettings();
  const [localStatus, setLocalStatus] = useState<string | null>(null);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    date: "", startTime: "", endTime: "", service: "Gym" as ServiceType, className: "", instructor: "",
  });
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const setupServiceTypes = parseSetup(settings, "setup_serviceTypes", ["Gym", "Spa", "Sauna", "Swimming"]);

  useEffect(() => {
    if (b) {
      setEditForm({
        date: b.date, startTime: b.startTime, endTime: b.endTime,
        service: b.service, className: b.className, instructor: b.instructor || "",
      });
      setEditing(false);
    }
  }, [b]);

  if (!b) return null;

  const status = localStatus || b.status;
  const canEdit = isFutureBooking(b) && status !== "Completed" && status !== "Cancelled";

  // "Bill" — keep the booking on this page, send the user to record payment
  // for it; the booking stays in its current status until a real payment is settled.
  const handleBillNow = () => {
    onOpenChange(false);
    const params = new URLSearchParams({
      newPayment: "true",
      memberName: b.memberName,
      memberId: b.memberId,
      service: b.service,
      className: b.className,
      bookingId: b.id,
      locked: "1",
    });
    navigate(`/transactions?${params.toString()}`);
  };

  const handleSaveEdit = async () => {
    if (!editForm.date || !editForm.startTime || !editForm.className) {
      toast.error("Date, time and class are required");
      return;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (new Date(editForm.date) < today) {
      toast.error("Cannot move booking to a past date");
      return;
    }
    try {
      await updateBooking.mutateAsync({
        id: b.id,
        data: {
          bookingDate: editForm.date,
          startTime: editForm.startTime,
          endTime: editForm.endTime || editForm.startTime,
          service: editForm.service,
          className: editForm.className,
          instructor: editForm.instructor,
        },
      });
      toast.success("Booking updated");
      setEditing(false);
      onOpenChange(false);
    } catch {
      toast.error("Failed to update booking");
    }
  };

  // (Delete removed — bookings may only be cancelled, never hard-deleted.)

  const handleCancel = async () => {
    if (!cancelReason.trim()) {
      toast.error("Please provide a cancellation reason");
      return;
    }
    try {
      await updateBooking.mutateAsync({
        id: b.id,
        data: { status: "Cancelled", cancelReason, cancelledAt: new Date().toISOString() } as any,
      });
      toast.success("Booking cancelled");
      setConfirmCancel(false);
      setLocalStatus("Cancelled");
      onOpenChange(false);
    } catch {
      toast.error("Failed to cancel booking");
    }
  };

  const handleGenerateBill = () => {
    const companyName = settings.companyName || "VitaFit Club";
    const rate = 500;
    const amount = rate;
    const taxableAmount = amount;
    const vatAmount = Math.round(taxableAmount * 0.13);
    const grandTotal = taxableAmount + vatAmount;

    const html = generateA5BillHTML({
      companyName,
      companyAddress: settings.companyAddress || "",
      companyPhone: settings.companyPhone || "",
      companyEmail: settings.companyEmail || "",
      vatNo: settings.vatNo || "",
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
    <>
      <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setLocalStatus(null); setEditing(false); } }}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              {editing ? "Edit Booking" : "Booking Details"}
            </DialogTitle>
          </DialogHeader>

          {editing ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Class / Session</Label>
                <Input value={editForm.className} onChange={(e) => setEditForm((p) => ({ ...p, className: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Service</Label>
                <Select value={editForm.service} onValueChange={(v) => setEditForm((p) => ({ ...p, service: v as ServiceType }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {setupServiceTypes.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={editForm.date} onChange={(e) => setEditForm((p) => ({ ...p, date: e.target.value }))} /></div>
                <div className="space-y-1.5"><Label>Start</Label><Input type="time" value={editForm.startTime} onChange={(e) => setEditForm((p) => ({ ...p, startTime: e.target.value }))} /></div>
                <div className="space-y-1.5"><Label>End</Label><Input type="time" value={editForm.endTime} onChange={(e) => setEditForm((p) => ({ ...p, endTime: e.target.value }))} /></div>
              </div>
              <div className="space-y-1.5">
                <Label>Instructor</Label>
                <Input value={editForm.instructor} onChange={(e) => setEditForm((p) => ({ ...p, instructor: e.target.value }))} />
              </div>
              <DialogFooter className="pt-2">
                <Button variant="outline" onClick={() => setEditing(false)}><X className="h-4 w-4 mr-1" />Cancel</Button>
                <Button onClick={handleSaveEdit} disabled={updateBooking.isPending} className="gradient-gold text-primary-foreground">
                  <Save className="h-4 w-4 mr-1" />{updateBooking.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </div>
          ) : (
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

              <div className="flex flex-wrap gap-2 pt-2">
                {canEdit && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                      <Pencil className="h-4 w-4 mr-1" />Amend
                    </Button>
                    <Button size="sm" variant="outline" className="text-amber-500 hover:bg-amber-500/10" onClick={() => setConfirmCancel(true)}>
                      <Ban className="h-4 w-4 mr-1" />Cancel
                    </Button>
                  </>
                )}
                {status !== "Cancelled" && (
                  <Button
                    size="sm"
                    className="flex-1 gradient-gold text-primary-foreground"
                    onClick={handleBillNow}
                  >
                    <Receipt className="h-4 w-4 mr-1" />
                    Bill / Record Payment
                  </Button>
                )}
                {status === "Completed" && (
                  <Button size="sm" variant="outline" className="flex-1" onClick={handleGenerateBill}>
                    <Printer className="h-4 w-4 mr-1" />Generate A5 Bill
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* (Delete confirmation removed — bookings are cancelled, not deleted) */}


      {/* Cancel confirmation */}
      <Dialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Ban className="h-4 w-4 text-amber-500" /> Cancel Booking?
            </DialogTitle>
            <DialogDescription>
              Cancel <strong>{b.memberName}</strong>'s booking on {b.date}. The slot will be freed up.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Reason *</Label>
            <Textarea rows={3} placeholder="e.g. member requested reschedule" value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmCancel(false)}>Keep Booking</Button>
            <Button onClick={handleCancel} disabled={updateBooking.isPending}
              className="bg-amber-500 hover:bg-amber-500/90 text-white">
              {updateBooking.isPending ? "Cancelling..." : "Confirm Cancel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
