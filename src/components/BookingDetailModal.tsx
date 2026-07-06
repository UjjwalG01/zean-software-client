import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CalendarDays,
  Clock,
  User,
  Dumbbell,
  Printer,
  Pencil,
  Ban,
  Receipt,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

import type { Booking, ServiceType } from "@/lib/mock-data";
import {
  useUpdateBooking,
  useCompanySettings,
  useTransactions,
  useUpdateTransaction,
  useServices,
} from "@/hooks/use-firestore";
import { generateA5BillHTML, printHTML } from "@/lib/print-utils";
import { toast } from "sonner";
import { format } from "date-fns";
import { nowIso } from "@/lib/tz";
import { getSystemNowDate } from "@/lib/timeUtils";

import { serviceColors } from "@/lib/utils";

interface BookingDetailModalProps {
  booking: Booking | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided, the Amend button calls this with the booking so the parent can open the unified Create modal pre-filled. */
  onAmend?: (booking: Booking) => void;
  /**
   * When true, the modal renders as strictly read-only: Amend, Cancel and
   * Billing/Print actions are hidden. Used for Fitness/Wellness bookings
   * where mutations must flow through the POS pipeline instead.
   */
  readOnly?: boolean;
}


function parseSetup(
  settings: Record<string, string>,
  key: string,
  fallback: string[],
): string[] {
  try {
    return settings[key] ? JSON.parse(settings[key]) : fallback;
  } catch {
    return fallback;
  }
}

function isFutureBooking(b: Booking): boolean {
  const today = getSystemNowDate();
  today.setHours(0, 0, 0, 0);
  return new Date(b.date) >= today;
}

export function BookingDetailModal({
  booking: b,
  open,
  onOpenChange,
  onAmend,
}: BookingDetailModalProps) {
  const navigate = useNavigate();
  const updateBooking = useUpdateBooking();
  const updateTransaction = useUpdateTransaction();
  const { data: transactions = [] } = useTransactions();
  const { data: settings = {} } = useCompanySettings();
  const { data: services = [] } = useServices();
  const [localStatus, setLocalStatus] = useState<string | null>(null);

  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");


  if (!b) return null;

  // 🌟 FIX: Normalize status checks to lowercase to safeguard against database/local casing mismatches
  const rawStatus = localStatus || b.status || "";
  const displayStatus =
    rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1).toLowerCase();
  const currentStatusClean = rawStatus.toLowerCase();

  const canEdit =
    isFutureBooking(b) &&
    currentStatusClean !== "completed" &&
    currentStatusClean !== "cancelled";
  const canCancel =
    currentStatusClean !== "completed" && currentStatusClean !== "cancelled";

  const isStrictlyFuture = (() => {
    const today = getSystemNowDate();
    today.setHours(0, 0, 0, 0);
    const d = new Date(b.date);
    d.setHours(0, 0, 0, 0);
    return d.getTime() > today.getTime();
  })();

  const handleBillNow = async () => {
    if (isStrictlyFuture) {
      toast.error("Future-dated bookings cannot be billed yet.");
      return;
    }

    const linkedCharge = transactions.find(
      (t) =>
        t.bookingId === b.id && t.type === "Charge" && t.status === "pending",
    );

    const svc = services.find(
      (s) => s.name === b.className || s.type === b.service,
    );

    // 🔄 MODIFIED: Prioritize the recorded pending charge figure over default catalog price
    const amount = linkedCharge
      ? String(linkedCharge.total || linkedCharge.amount || 0)
      : svc
        ? String(svc.price || 0)
        : "0";

    onOpenChange(false);
    const params = new URLSearchParams({
      newPayment: "true",
      memberName: b.memberName,
      memberId: b.memberId,
      service: b.service,
      className: b.className,
      bookingId: b.id,
      amount,
      locked: "1",
    });
    if (linkedCharge) params.set("chargeId", linkedCharge.id);
    navigate(`/transactions?${params.toString()}`);
  };

  // Edit and Amend both delegate to the parent-owned unified booking dialog
  // via the `onAmend` prop — this modal is now strictly read-only + actions.



  const handleCancel = async () => {
    if (!cancelReason.trim()) {
      toast.error("Please provide a cancellation reason");
      return;
    }
    try {
      await updateBooking.mutateAsync({
        id: b.id,
        data: {
          status: "cancelled",
          cancelReason,
          cancelledAt: nowIso(),
        } as any,
      });
      const linkedCharges = transactions.filter(
        (t) =>
          t.bookingId === b.id && t.type === "Charge" && t.status === "pending",
      );
      for (const c of linkedCharges) {
        await updateTransaction.mutateAsync({
          id: c.id,
          data: { status: "voided" } as any,
        });
        const chargeRowId = (c as any).chargeRowId as string | undefined;
        if (chargeRowId) {
          try {
            const { supabase } = await import("@/lib/supabase");
            await supabase
              .from("charges")
              .update({
                status: "unpaid",
                meta: { voided: true, bookingId: b.id },
              })
              .eq("id", chargeRowId);
          } catch (err) {
            console.warn("[bookings] failed to void canonical charge row", err);
          }
        }
      }
      toast.success(
        linkedCharges.length
          ? `Booking cancelled — ${linkedCharges.length} linked charge(s) voided`
          : "Booking cancelled",
      );
      setConfirmCancel(false);
      setLocalStatus("Cancelled");
      onOpenChange(false);
    } catch {
      toast.error("Failed to cancel booking");
    }
  };
  // console.log(settings.company_name);

  const handleGenerateBill = () => {
    const companyName = settings.companyName || ".............";

    // 🔄 MODIFIED: Dynamically read ledger figures instead of hardcoding 500 NPR
    const linkedTxn = transactions.find(
      (t) => t.bookingId === b.id && !t.voided && t.status !== "voided",
    );
    const svc = services.find(
      (s) => s.name === b.className || s.type === b.service,
    );

    const baseRate = linkedTxn
      ? linkedTxn.amount || linkedTxn.total
      : svc?.price || 500;

    // 🌟 FIX: Read tax percent dynamically from company settings (supports 0 and positive numbers)
    const activeVatRate =
      settings.vatRate !== undefined && settings.vatRate !== null
        ? Number(settings.vatRate)
        : 13;

    const vatMultiplier = activeVatRate / 100;

    const grandTotal = linkedTxn
      ? linkedTxn.total
      : baseRate + Math.round(baseRate * vatMultiplier);
    const vatAmount = linkedTxn
      ? linkedTxn.vat
      : Math.round(baseRate * vatMultiplier);
    const taxableAmount = grandTotal - vatAmount;

    const html = generateA5BillHTML({
      companyName,
      companyAddress: settings.companyAddress || "",
      companyPhone: settings.companyPhone || "",
      companyEmail: settings.companyEmail || "",
      vatNo: settings.panNumber || settings.vatNo || "",
      guestName: b.memberName,
      billNo: linkedTxn?.receiptNo || `BK-${b.id.slice(0, 8)}`,
      billDate: linkedTxn?.date || format(getSystemNowDate(), "dd/MM/yyyy"),
      billForMonth: `${b.className} — ${format(new Date(b.date), "MMMM yyyy")}`,
      items: [
        {
          description: `${b.service} — ${b.className}`,
          quantity: 1,
          rate: baseRate,
          amount: baseRate,
        },
      ],
      subtotal: baseRate,
      taxableAmount,
      vatAmount,
      grandTotal,
      attendant: "admin",
      paperSize: (settings.bill_paperSize as "A4" | "A5" | "80mm") || "A5",
      kind: "payment",
    });
    printHTML(html);
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          onOpenChange(v);
          if (!v) {
            setLocalStatus(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              Booking Details
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">



              <div className="rounded-lg border border-border/50 bg-muted/30 p-4 text-center">
                <p className="font-semibold text-lg">{b.className}</p>
                <Badge
                  className={`text-xs mt-2 border-0 ${serviceColors[b.service] || ""}`}
                >
                  {b.service}
                </Badge>
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
                  <span className="ml-auto font-medium">
                    {b.startTime} – {b.endTime}
                  </span>
                </div>
                <Separator />
                <div className="flex items-center gap-3 text-sm">
                  <Dumbbell className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Instructor</span>
                  <span className="ml-auto font-medium">
                    {b.instructor || "-"}
                  </span>
                </div>
                <Separator />
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground ml-7">Status</span>
                  <Badge
                    variant={
                      status === "Confirmed"
                        ? "default"
                        : status === "Completed"
                          ? "default"
                          : status === "Pending"
                            ? "secondary"
                            : "destructive"
                    }
                    className={`ml-auto text-xs ${status === "Completed" ? "bg-success/20 text-success border-0" : ""}`}
                  >
                    {status}
                  </Badge>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                {canEdit && onAmend && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      onAmend(b);
                      onOpenChange(false);
                    }}
                  >
                    <Pencil className="h-4 w-4 mr-1" />
                    Amend
                  </Button>
                )}

                {canCancel && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-amber-500 hover:bg-amber-500/10"
                    onClick={() => setConfirmCancel(true)}
                  >
                    <Ban className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                )}
                {status === "Completed" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={handleGenerateBill}
                  >
                    <Printer className="h-4 w-4 mr-1" />
                    Print Bill
                  </Button>
                ) : (
                  status !== "Cancelled" && (
                    <Button
                      size="sm"
                      className="flex-1 gradient-gold text-primary-foreground disabled:opacity-50"
                      onClick={handleBillNow}
                      disabled={isStrictlyFuture}
                      title={
                        isStrictlyFuture
                          ? "Cannot bill a future-dated booking"
                          : undefined
                      }
                    >
                      <Receipt className="h-4 w-4 mr-1" />
                      {isStrictlyFuture
                        ? "Billing (Locked – Future)"
                        : "Billing / Record Payment"}
                    </Button>
                  )
                )}
              </div>
            </div>

        </DialogContent>
      </Dialog>

      <Dialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Ban className="h-4 w-4 text-amber-500" /> Cancel Booking?
            </DialogTitle>
            <DialogDescription>
              Cancel <strong>{b.memberName}</strong>'s booking on {b.date}. The
              slot will be freed up.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Reason *</Label>
            <Textarea
              rows={3}
              placeholder="e.g. member requested reschedule"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmCancel(false)}>
              Keep Booking
            </Button>
            <Button
              onClick={handleCancel}
              disabled={updateBooking.isPending}
              className="bg-amber-500 hover:bg-amber-500/90 text-white"
            >
              {updateBooking.isPending ? "Cancelling..." : "Confirm Cancel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
