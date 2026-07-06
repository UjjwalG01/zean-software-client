import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { formatDate, formatTime, nowIso, toIsoDayInTz } from "@/lib/tz";
import {
  Plus,
  Minus,
  Trash2,
  Search,
  Check,
  ShoppingCart,
  Pause,
  Loader2,
  Eye,
  X,
  CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  useMembers,
  useServices,
  useAddBooking,
  useAddTransaction,
  useCompanySettings,
  useBookings,
  useUpdateBooking,
  useTransactions,
  useUpdateTransaction,
} from "@/hooks/use-firestore";
import type { Outlet } from "@/lib/supabase-outlets";
import { formatNPR, type ServiceType, type Booking } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { BookingDetailModal } from "@/components/BookingDetailModal";
import {
  getSystemTimestamp,
  getSystemTimeStr,
  getSystemTodayStr,
} from "@/lib/timeUtils";

interface Props {
  outlet: Outlet;
}

interface CartLine {
  serviceId: string;
  name: string;
  type: string;
  price: number;
  qty: number;
  placed?: boolean;
  bookingId?: string;
  chargeId?: string;
}

function parseSetup(
  s: Record<string, string>,
  k: string,
  fb: string[],
): string[] {
  try {
    return s[k] ? JSON.parse(s[k]) : fb;
  } catch {
    return fb;
  }
}

/**
 * POS-style order screen used for outlets whose service type is
 * `fitness` or `wellness` (replaces the calendar view).
 * Reads/writes the same DB tables as the rest of the app:
 *   - services (filtered by outletId)
 *   - members (for guest selection)
 *   - bookings + charges (on Place Order / Pay Now)
 */
export function OutletPOSView({ outlet }: Props) {
  const navigate = useNavigate();
  const todayStr = getSystemTodayStr(); // Get standardized today string ("YYYY-MM-DD")
  const { data: members = [] } = useMembers();
  const { data: services = [] } = useServices();
  const { data: settings = {} } = useCompanySettings();
  const addBookingMutation = useAddBooking();
  const addTransactionMutation = useAddTransaction();
  // Pass todayStr to synchronize records with the top counter
  const { data: outletBookings = [] } = useBookings({
    outletId: outlet.id,
    date: todayStr,
  });
  const { data: transactions = [] } = useTransactions();
  const updateBookingMutation = useUpdateBooking();
  const updateTransactionMutation = useUpdateTransaction();

  const [detailBooking, setDetailBooking] = useState<Booking | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const attendants = parseSetup(settings, "setup_instructors", [
    "Reception",
    "Trainer",
    "Therapist",
  ]);

  const outletServices = useMemo(
    () =>
      services.filter((s) => s.outletId === outlet.id && s.isActive !== false),
    [services, outlet.id],
  );

  const [mode, setMode] = useState<"member" | "guest">("member");
  const [memberId, setMemberId] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [memberOpen, setMemberOpen] = useState(false);
  const [attendant, setAttendant] = useState("");
  const [cover, setCover] = useState(1);
  const [guestName, setGuestName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);


  const [pickerServiceId, setPickerServiceId] = useState("");
  const [pickerQty, setPickerQty] = useState(1);
  const [cart, setCart] = useState<CartLine[]>([]);

  const selectedMember = members.find((m) => m.id === memberId);
  const filteredMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    const list = q
      ? members.filter(
          (m) =>
            (m.name || "").toLowerCase().includes(q) ||
            (m.phone || "").includes(q) ||
            (m.email || "").toLowerCase().includes(q),
        )
      : members;
    return list.slice(0, 50);
  }, [members, memberSearch]);

  const grandTotal = cart.reduce((sum, l) => sum + l.price * l.qty, 0);

  const addToCart = () => {
    const svc = outletServices.find((s) => s.id === pickerServiceId);
    if (!svc) {
      toast.error("Pick a service first");
      return;
    }
    setCart((prev) => {
      const i = prev.findIndex((l) => l.serviceId === svc.id);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], qty: next[i].qty + pickerQty };
        return next;
      }
      return [
        ...prev,
        {
          serviceId: svc.id,
          name: svc.name,
          type: svc.type,
          price: Number(svc.price || 0),
          qty: pickerQty,
        },
      ];
    });
    setPickerServiceId("");
    setPickerQty(1);
  };

  const updateQty = (id: string, delta: number) =>
    setCart((prev) =>
      prev
        .map((l) =>
          l.serviceId === id ? { ...l, qty: Math.max(0, l.qty + delta) } : l,
        )
        .filter((l) => l.qty > 0),
    );
  const removeLine = (id: string) =>
    setCart((prev) => prev.filter((l) => l.serviceId !== id));

  /**
   * Create one booking+charge per cart line that hasn't been placed yet.
   * Mutates the cart in-place to flag placed lines with their bookingId / chargeId.
   * Returns the most-recent chargeId so the caller can pass it to the settlement page.
   */
  const buildBookingsAndCharges = async () => {
    if (!memberId && !guestName.trim())
      throw new Error("Select a member or enter a guest name");
    if (cart.length === 0) throw new Error("Cart is empty");

    const today = getSystemTodayStr();
    const now = getSystemTimeStr();
    const memberObj = members.find((m) => m.id === memberId);

    const updated: CartLine[] = [...cart];
    const allBookingIds: string[] = [];
    const itemDescriptions: string[] = [];

    // Step 1: Create all bookings first
    for (let idx = 0; idx < updated.length; idx++) {
      const line = updated[idx];
      if (line.placed) continue;

      itemDescriptions.push(`${line.name} × ${line.qty}`);

      for (let i = 0; i < line.qty; i++) {
        // POS orders (fitness/wellness) always land as pending + confirmed —
        // the operator does not pick these on this screen. Sports outlets use
        // the calendar view (Bookings.tsx) which still exposes booking_status.
        const bookingId = await addBookingMutation.mutateAsync({
          memberId,
          memberName: memberObj?.name || guestName || "",
          service: line.type as ServiceType,
          className: line.name,
          date: today,
          startTime: now,
          endTime: now,
          status: "pending",
          bookingStatus: "confirmed",
          booking_status: "confirmed",
          original_rate: line.price,
          rate: line.price,
          service_id: line.serviceId,
          outletId: outlet.id,
          instructor: attendant || "",
        } as any);

        if (bookingId) allBookingIds.push(String(bookingId));
      }

    }

    if (allBookingIds.length === 0) {
      throw new Error("No new items to place.");
    }

    // Step 2: Create ONE unified Charge Transaction record for the entire group
    let consolidatedChargeId = "";
    if (grandTotal > 0) {
      consolidatedChargeId = (await addTransactionMutation.mutateAsync({
        memberId,
        memberName: memberObj?.name || guestName || "",
        type: "Charge",
        status: "pending",
        amount: grandTotal,
        total: grandTotal,
        chargeHead: outlet.serviceTypes[0] || "POS Order",
        outletId: outlet.id,
        className: itemDescriptions.join(", "),
        createdAt: getSystemTimestamp(),
        // Custom arrays/meta fields to keep them grouped in queries:
        bookingId: allBookingIds[0], // Primary reference fallback
        bookingIds: allBookingIds, // Array of all sub-bookings
        isBundledOrder: true,
      } as any)) as any;
    }

    // Step 3: Flag all items in the cart UI state as placed under this unified charge
    const finalizedCart = updated.map((line) => ({
      ...line,
      placed: true,
      bookingId: allBookingIds[0],
      chargeId: consolidatedChargeId,
    }));

    setCart(finalizedCart);

    return {
      lastBookingId: allBookingIds[0],
      lastChargeId: consolidatedChargeId,
      memberObj,
      itemDescriptions: itemDescriptions.join(", "),
    };
  };

  const handlePlace = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await buildBookingsAndCharges();
      toast.success("Order placed — items flagged as Ordered");
    } catch (e: any) {
      toast.error(e.message || "Failed to place order");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBilling = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const { lastBookingId, lastChargeId, memberObj, itemDescriptions } =
        await buildBookingsAndCharges();
      toast.success("Order ready — opening billing");

      const params = new URLSearchParams({
        newPayment: "true",
        memberId,
        memberName: memberObj?.name || guestName || "",
        service: outlet.serviceTypes[0] || "",
        className: itemDescriptions,
        amount: String(grandTotal),
        bookingId: lastBookingId,
        chargeId: lastChargeId,
        locked: "1",
        ...(memberId ? {} : { guest: "1" }),
      });
      setCart([]);
      navigate(`/transactions?${params.toString()}`);
    } catch (e: any) {
      toast.error(e.message || "Failed to start billing");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="glass-card rounded-xl overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/30">
        <div className="text-xs text-muted-foreground">
          <span className="font-mono">{formatDate(nowIso())}</span>
        </div>
        <div className="font-display font-semibold tracking-wide text-sm uppercase">
          {outlet.name}
          <span className="ml-2 text-xs text-muted-foreground">
            [{outlet.outletType || outlet.serviceTypes.join(", ").toUpperCase()}
            ]
          </span>
        </div>
        <Badge variant="outline" className="text-[10px] uppercase">
          {outlet.outletCode || "POS"}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 p-5">
        {/* LEFT — General Information */}
        <div className="lg:col-span-2 space-y-4">
          <div>
            <h3 className="font-semibold font-display flex items-center gap-2 mb-1">
              <span className="h-2 w-2 rounded-full bg-primary" /> General
              Information
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Fields marked with <span className="text-destructive">*</span> are
              mandatory.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Cover *</Label>
              <Input
                type="number"
                min={1}
                value={cover}
                onChange={(e) =>
                  setCover(Math.max(1, Number(e.target.value) || 1))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Attendant *</Label>
              <Select value={attendant} onValueChange={setAttendant}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {attendants.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Member / Guest *</Label>
            <Popover open={memberOpen} onOpenChange={setMemberOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-between font-normal"
                >
                  {selectedMember ? (
                    <span className="truncate">{selectedMember.name}</span>
                  ) : (
                    <span className="text-muted-foreground">
                      Search member…
                    </span>
                  )}
                  <Search className="h-3.5 w-3.5 opacity-60" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[--radix-popover-trigger-width] p-0"
                align="start"
              >
                <div className="p-2 border-b border-border">
                  <Input
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    placeholder="Search name / phone / email"
                    className="h-8"
                    autoFocus
                  />
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {filteredMembers.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => {
                        setMemberId(m.id);
                        setMemberOpen(false);
                      }}
                      className="flex items-center justify-between w-full px-3 py-2 text-sm text-left hover:bg-muted/50"
                    >
                      <div className="flex flex-col min-w-0">
                        <span className="truncate">{m.name}</span>
                        <span className="text-[11px] text-muted-foreground truncate">
                          {m.phone || m.email || "—"}
                        </span>
                      </div>
                      {memberId === m.id && (
                        <Check className="h-3.5 w-3.5 text-primary" />
                      )}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Guest Name (walk-in)</Label>
            <Input
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Optional"
            />
          </div>
        </div>

        {/* RIGHT — Item selection + cart */}
        <div className="lg:col-span-3 space-y-3">
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-8">
              <Select
                value={pickerServiceId}
                onValueChange={setPickerServiceId}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      outletServices.length === 0
                        ? "No services configured for this outlet"
                        : "Choose service"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {outletServices.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} — {s.type}
                      {s.price ? ` • ${formatNPR(Number(s.price))}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Input
                type="number"
                min={1}
                value={pickerQty}
                onChange={(e) =>
                  setPickerQty(Math.max(1, Number(e.target.value) || 1))
                }
              />
            </div>
            <div className="col-span-2">
              <Button
                onClick={addToCart}
                className="w-full gradient-gold text-primary-foreground"
              >
                Add
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-border overflow-hidden">
            <div className="grid grid-cols-12 px-3 py-2 text-[11px] uppercase tracking-wider bg-muted/30 text-muted-foreground">
              <div className="col-span-6">Item Name</div>
              <div className="col-span-2 text-center">Qty</div>
              <div className="col-span-2 text-right">Rate</div>
              <div className="col-span-2 text-right">Total</div>
            </div>
            {cart.length === 0 ? (
              <div className="py-10 text-center text-xs text-muted-foreground">
                Cart is empty
              </div>
            ) : (
              cart.map((l) => (
                <div
                  key={l.serviceId}
                  className={cn(
                    "grid grid-cols-12 items-center px-3 py-2 border-t border-border/60 text-sm",
                    l.placed && "bg-success/5",
                  )}
                >
                  <div className="col-span-6">
                    <div className="font-medium truncate flex items-center gap-2">
                      {l.name}
                      {l.placed && (
                        <Badge className="bg-success/20 text-success border-0 text-[9px] uppercase">
                          Ordered
                        </Badge>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground uppercase">
                      {l.type}
                    </p>
                  </div>
                  <div className="col-span-2 flex items-center justify-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      disabled={l.placed}
                      onClick={() => updateQty(l.serviceId, -1)}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-6 text-center text-xs">{l.qty}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      disabled={l.placed}
                      onClick={() => updateQty(l.serviceId, 1)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="col-span-2 text-right text-xs">
                    {l.price.toFixed(2)}
                  </div>
                  <div className="col-span-2 flex items-center justify-end gap-2">
                    <span className="text-xs font-medium">
                      {(l.price * l.qty).toFixed(2)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive"
                      disabled={l.placed}
                      onClick={() => removeLine(l.serviceId)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Grand total + actions */}
          <div
            className={cn(
              "rounded-lg border border-border bg-muted/30 p-3 flex items-center justify-between",
            )}
          >
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              Grand Total
            </span>
            <span className="text-xl font-bold font-display text-primary">
              {formatNPR(grandTotal)}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Button
              variant="outline"
              disabled={cart.length === 0 || isSubmitting}
              onClick={handleBilling}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />{" "}
                  Processing...
                </>
              ) : (
                <>
                  <ShoppingCart className="h-4 w-4 mr-1" /> Billing
                </>
              )}
            </Button>
            <Button
              variant="outline"
              disabled={cart.length === 0 || isSubmitting}
              onClick={() => toast.info("Order held")}
            >
              <Pause className="h-4 w-4 mr-1" /> Hold Order
            </Button>
            <Button
              disabled={
                cart.length === 0 || isSubmitting || cart.every((l) => l.placed)
              }
              onClick={handlePlace}
              className="gradient-gold text-primary-foreground"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />{" "}
                  Processing...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-1" /> Place Order
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Current Bookings panel */}
      <CurrentBookingsPanel
        outlet={outlet}
        bookings={outletBookings}
        transactions={transactions}
        onView={(b) => {
          setDetailBooking(b);
          setDetailOpen(true);
        }}
        onBilling={(b) => {
          const linkedCharge = transactions.find(
            (t: any) =>
              String(t.bookingId) === String(b.id) &&
              t.type === "Charge" &&
              t.status === "pending",
          );
          const amount = Number(
            (linkedCharge as any)?.total ??
              (linkedCharge as any)?.amount ??
              (b as any).original_rate ??
              (b as any).rate ??
              0,
          );
          const params = new URLSearchParams({
            newPayment: "true",
            bookingId: b.id,
            memberId: b.memberId || "",
            memberName: b.memberName || "",
            service: b.service || "",
            className: b.className || "",
            amount: String(amount),
            outletId: outlet.id,
            ...(b.memberId ? {} : { guest: "1" }),
            ...(linkedCharge ? { chargeId: linkedCharge.id } : {}),
          });
          navigate(`/transactions?${params.toString()}`);
        }}
        onCancel={async (b) => {
          try {
            await updateBookingMutation.mutateAsync({
              id: b.id,
              data: {
                status: "cancelled",
                cancelledAt: getSystemTimestamp(),
              } as any,
            });
            const linkedCharges = transactions.filter(
              (t: any) =>
                t.bookingId === b.id &&
                t.type === "Charge" &&
                t.status === "pending",
            );
            for (const c of linkedCharges) {
              await updateTransactionMutation.mutateAsync({
                id: c.id,
                data: { status: "voided" } as any,
              });
            }
            toast.success("Order cancelled");
          } catch {
            toast.error("Failed to cancel order");
          }
        }}
      />

      <BookingDetailModal
        booking={detailBooking}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
}

interface CurrentBookingsPanelProps {
  outlet: Outlet;
  bookings: Booking[];
  transactions: any[];
  onView: (b: Booking) => void;
  onBilling: (b: Booking) => void;
  onCancel: (b: Booking) => void;
}

function CurrentBookingsPanel({
  outlet,
  bookings,
  transactions,
  onView,
  onBilling,
  onCancel,
}: CurrentBookingsPanelProps) {
  const active = useMemo(() => {
    return bookings
      .filter((b) => {
        // 1. Validate Outlet Assignment
        const matchesOutlet = b.outletId === outlet.id || !b.outletId;
        if (!matchesOutlet) return false;

        // 2. Extract and Normalize Booking Status (Handles case variations and alternative keys)
        const rawStatus = (b as any).status || (b as any).bookingStatus || "";
        const normalizedStatus = String(rawStatus).toLowerCase().trim();

        // Filter out inactive states
        if (
          normalizedStatus === "cancelled" ||
          normalizedStatus === "completed" ||
          normalizedStatus === "billed"
        ) {
          return false;
        }

        return true;
      })
      .filter((b) => {
        // 3. Normalize Linked Transaction Lookups
        const linked = transactions.find(
          (t: any) =>
            String(t.bookingId) === String(b.id) &&
            String(t.type).toLowerCase() === "charge",
        );

        // If no charge is found, keep the booking visible
        if (!linked) return true;

        // Hide bookings where the linked charge is no longer pending (e.g., paid, settled, voided)
        const chargeStatus = String(linked.status).toLowerCase().trim();
        return chargeStatus === "pending";
      })
      .slice(0, 30);
  }, [bookings, transactions, outlet.id]);

  return (
    <div className="border-t border-border px-5 py-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold font-display text-sm uppercase tracking-wider flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-primary" /> Current Bookings
        </h3>
        <Badge variant="outline" className="text-[10px]">
          {active.length} active
        </Badge>
      </div>
      {active.length === 0 ? (
        <div className="text-xs text-muted-foreground text-center py-6 border border-dashed border-border rounded-lg">
          No active bookings for this outlet
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {active.map((b) => (
            <div
              key={b.id}
              className="rounded-lg border border-border bg-muted/20 p-3 flex flex-col gap-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">
                    {b.memberName || "Guest"}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {b.className || b.service}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="text-[10px] font-mono shrink-0"
                >
                  {b.startTime || "--:--"}
                </Badge>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[11px]"
                  onClick={() => onView(b)}
                >
                  <Eye className="h-3 w-3 mr-1" /> View
                </Button>
                <Button
                  size="sm"
                  className="h-7 text-[11px] gradient-gold text-primary-foreground"
                  onClick={() => onBilling(b)}
                >
                  <CreditCard className="h-3 w-3 mr-1" /> Billing
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[11px] text-destructive hover:text-destructive"
                  onClick={() => onCancel(b)}
                >
                  <X className="h-3 w-3 mr-1" /> Cancel
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
