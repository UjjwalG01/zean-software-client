import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  isToday,
} from "date-fns";
import { toZonedTime, formatInTimeZone } from "date-fns-tz";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  List,
  CalendarDays as CalIcon,
  Settings,
  Search,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { BookingDetailModal } from "@/components/BookingDetailModal";
import { DayTimelineDialog } from "@/components/DayTimelineDialog";
import { DayScheduleDialog } from "@/components/DayScheduleDialog";
import { OutletPickerDialog } from "@/components/OutletPickerDialog";
import { OutletPOSView } from "@/components/OutletPOSView";
import { Switch } from "@/components/ui/switch";
import {
  useBookings,
  useAddBooking,
  useMembers,
  useServices,
  useCompanySettings,
  useMembershipPlans,
  useUpdateMember,
  useAddTransaction,
} from "@/hooks/use-firestore";
import { useOutlet } from "@/contexts/OutletContext";
import { Building2, ChevronDown } from "lucide-react";
import type { Booking, ServiceType } from "@/lib/mock-data";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { useUpdateBooking } from "@/hooks/use-firestore";

const SYSTEM_TZ = "Asia/Katmandu";

const SLOT_START: Record<string, string> = {
  Morning: "06:00",
  Day: "12:00",
  Evening: "18:00",
};

const defaultServiceColors: Record<string, { bg: string; dot: string }> = {
  Gym: { bg: "bg-primary/80 text-primary-foreground", dot: "bg-primary" },
  Spa: { bg: "bg-spa text-white", dot: "bg-spa" },
  Sauna: { bg: "bg-sauna text-white", dot: "bg-sauna" },
  Swimming: { bg: "bg-swimming text-white", dot: "bg-swimming" },
};

const colorOptions = [
  { label: "Gold", value: "hsl(38,92%,50%)", tw: "bg-primary" },
  { label: "Purple", value: "hsl(280,60%,55%)", tw: "bg-spa" },
  { label: "Orange", value: "hsl(15,80%,55%)", tw: "bg-sauna" },
  { label: "Blue", value: "hsl(200,80%,50%)", tw: "bg-swimming" },
  { label: "Green", value: "hsl(142,71%,45%)", tw: "bg-success" },
  { label: "Red", value: "hsl(0,84%,60%)", tw: "bg-destructive" },
];

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

const Bookings_Page = () => {
  const navigate = useNavigate();
  const {
    selected: selectedOutlet,
    outlets,
    setSelected,
    pickerOpen,
    setPickerOpen,
    isLoading: outletsLoading,
  } = useOutlet();
  const [pickerShown, setPickerShown] = useState(false);

  // Timezone-aware local variables
  const systemNow = useMemo(() => toZonedTime(new Date(), SYSTEM_TZ), []);

  useEffect(() => {
    if (!outletsLoading && !selectedOutlet && !pickerShown) {
      setPickerOpen(true);
      setPickerShown(true);
    }
  }, [outletsLoading, selectedOutlet, pickerShown, setPickerOpen]);

  const [currentMonth, setCurrentMonth] = useState(systemNow);
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBookingId, setEditingBookingId] = useState<string | null>(null);
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [listMonth, setListMonth] = useState<string>(
    formatInTimeZone(new Date(), SYSTEM_TZ, "yyyy-MM"),
  );
  const [listPage, setListPage] = useState(1);
  const PAGE_SIZE = 25;
  const [colorSettingsOpen, setColorSettingsOpen] = useState(false);
  const [serviceColors, setServiceColors] = useState<Record<string, string>>({
    Gym: colorOptions[0].value,
    Spa: colorOptions[1].value,
    Sauna: colorOptions[2].value,
    Swimming: colorOptions[3].value,
  });

  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [scheduleDay, setScheduleDay] = useState<Date | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const [bookDate, setBookDate] = useState("");
  const [bookMember, setBookMember] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [memberPopoverOpen, setMemberPopoverOpen] = useState(false);
  const [bookServiceId, setBookServiceId] = useState("");
  const [bookInstructor, setBookInstructor] = useState("");
  const [bookTimeSlot, setBookTimeSlot] = useState("");

  const [bookPlanId, setBookPlanId] = useState("");
  const [bookDuration, setBookDuration] = useState<
    "monthly" | "yearly" | "longTerm"
  >("monthly");
  const [useDiscountedRate, setUseDiscountedRate] = useState(false);
  const [discountedRate, setDiscountedRate] = useState<string>("");
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [bookStartTime, setBookStartTime] = useState<string>("");
  const [bookEndTime, setBookEndTime] = useState<string>("");
  const [bookStatus, setBookStatus] = useState<
    "Waitlisted" | "Confirmed" | "NotFixed"
  >("Confirmed");

  const [guestMode, setGuestMode] = useState(false);
  const [guestName, setGuestName] = useState("");

  const { data: bookings = [], isLoading } = useBookings();
  const { data: members = [] } = useMembers();
  const { data: services = [] } = useServices();
  const { data: plans = [] } = useMembershipPlans();
  const { data: settings = {} } = useCompanySettings();
  const addBookingMutation = useAddBooking();
  const updateMemberMutation = useUpdateMember();
  const addTransactionMutation = useAddTransaction();
  const updateBookingMutation = useUpdateBooking();

  const isMembershipOutlet =
    !!selectedOutlet &&
    (selectedOutlet.enableMembership === true ||
      (selectedOutlet.serviceTypes || []).some(
        (s) => s.toLowerCase() === "membership",
      ));

  const isPOSOutlet =
    !!selectedOutlet &&
    ((selectedOutlet.serviceTypes || []).some((s) => {
      const x = (s || "").toLowerCase();
      return x === "fitness" || x === "wellness" || x === "health";
    }) ||
      ["FITNESS", "WELLNESS", "HEALTH"].includes(
        (selectedOutlet.outletType || "").toUpperCase(),
      ));

  const isFitnessOrHealth =
    !!selectedOutlet &&
    ((selectedOutlet.serviceTypes || []).some((s) => {
      const x = (s || "").toLowerCase();
      return x === "fitness" || x === "health";
    }) ||
      ["FITNESS", "HEALTH"].includes(
        (selectedOutlet.outletType || "").toUpperCase(),
      ));

  const isSportsOutlet =
    !!selectedOutlet &&
    ((selectedOutlet.serviceTypes || []).some(
      (s) => (s || "").toLowerCase() === "sports",
    ) ||
      (selectedOutlet.outletType || "").toUpperCase() === "SPORTS");

  const setupInstructors = parseSetup(settings, "setup_instructors", [
    "Trainer Ravi",
    "Trainer Prakash",
    "Therapist Maya",
    "Coach Anil",
  ]);
  const setupTimeSlots = parseSetup(settings, "setup_timeSlots", [
    "Morning",
    "Day",
    "Evening",
  ]);

  const outletServices = useMemo(
    () =>
      services.filter(
        (s) => s.outletId === selectedOutlet?.id && s.isActive !== false,
      ),
    [services, selectedOutlet?.id],
  );

  const outletServiceTypes = useMemo(
    () => Array.from(new Set(outletServices.map((s) => s.type))),
    [outletServices],
  );

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const filtered = useMemo(() => {
    let list = bookings;
    if (selectedOutlet) {
      list = list.filter(
        (b: any) => !b.outletId || b.outletId === selectedOutlet.id,
      );
    }
    if (serviceFilter !== "all")
      list = list.filter((b) => b.service === serviceFilter);
    if (view === "list" && !isFitnessOrHealth && listMonth) {
      list = list.filter((b) => (b.date || "").startsWith(listMonth));
    }
    return [...list].sort((a, b) => {
      const ad = `${a.date || ""} ${a.startTime || ""}`;
      const bd = `${b.date || ""} ${b.startTime || ""}`;
      return bd.localeCompare(ad);
    });
  }, [
    bookings,
    serviceFilter,
    selectedOutlet,
    view,
    isFitnessOrHealth,
    listMonth,
  ]);

  useEffect(() => {
    setListPage(1);
  }, [listMonth, serviceFilter, view, selectedOutlet?.id]);

  const pagedList = useMemo(() => {
    const start = (listPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, listPage]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const getBookingsForDay = (day: Date) =>
    filtered.filter((b) =>
      isSameDay(toZonedTime(new Date(b.date), SYSTEM_TZ), day),
    );

  const isPastDateTime = (dateStr: string, startTime?: string): boolean => {
    if (!dateStr) return false;
    const now = toZonedTime(new Date(), SYSTEM_TZ);
    const todayStr = formatInTimeZone(new Date(), SYSTEM_TZ, "yyyy-MM-dd");
    if (dateStr < todayStr) return true;
    if (dateStr > todayStr) return false;
    if (!startTime) return false;
    const [h, m] = startTime.split(":").map(Number);
    if (Number.isNaN(h)) return false;
    const slot = new Date(now);
    slot.setHours(h, m || 0, 0, 0);
    return slot.getTime() <= now.getTime();
  };

  const openNewBookingDialog = (day?: Date, startTime?: string) => {
    if (!selectedOutlet) {
      setPickerOpen(true);
      return;
    }
    const d = day || toZonedTime(new Date(), SYSTEM_TZ);
    const today = toZonedTime(new Date(), SYSTEM_TZ);
    today.setHours(0, 0, 0, 0);
    if (d < today) {
      toast.error("Cannot add bookings for past dates");
      return;
    }
    const dStr = formatInTimeZone(d, SYSTEM_TZ, "yyyy-MM-dd");
    if (startTime && isPastDateTime(dStr, startTime)) {
      toast.error("Cannot create bookings in the past");
      return;
    }
    setEditingBookingId(null);
    setBookDate(dStr);
    if (startTime) {
      const [h, m] = startTime.split(":").map(Number);
      const endMin = h * 60 + m + 60;
      const eh = Math.floor(endMin / 60) % 24;
      const em = endMin % 60;
      setBookStartTime(startTime);
      setBookEndTime(
        `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`,
      );
      setBookTimeSlot("");
    }
    setDialogOpen(true);
  };

  const openAmendBookingDialog = (b: Booking) => {
    if (!selectedOutlet) {
      setPickerOpen(true);
      return;
    }
    setEditingBookingId(b.id);
    setBookDate(b.date);
    setBookStartTime(b.startTime || "");
    setBookEndTime(b.endTime || "");
    setBookTimeSlot((b as any).timeSlot || b.startTime || "");
    setBookMember(b.memberId);
    setBookInstructor(b.instructor || "");
    const svc =
      outletServices.find((s) => s.name === b.className) ||
      outletServices.find((s) => s.type === b.service);
    setBookServiceId(svc?.id || "");
    setUseDiscountedRate(false);
    setDiscountedRate("");
    setDialogOpen(true);
  };

  const handleDayClick = (day: Date) => {
    setScheduleDay(day);
    setScheduleOpen(true);
  };

  const handleDayDoubleClick = (day: Date) => {
    setScheduleDay(day);
    setScheduleOpen(true);
  };

  const handleBookingClick = (booking: Booking) => {
    setSelectedBooking(booking);
    setDetailOpen(true);
  };

  const selectedService = useMemo(
    () => outletServices.find((s) => s.id === bookServiceId) || null,
    [outletServices, bookServiceId],
  );

  useEffect(() => {
    if (selectedService?.instructor && !bookInstructor)
      setBookInstructor(selectedService.instructor);
  }, [selectedService]);

  const handleBook = async () => {
    if (!selectedOutlet?.id) {
      toast.error("Please select an outlet before creating a booking");
      setPickerOpen(true);
      return;
    }
    const isGuestBooking = isSportsOutlet && guestMode;
    if (isGuestBooking) {
      if (!guestName.trim() || !selectedService || !bookDate) {
        toast.error("Please fill guest name, service and date");
        return;
      }
    } else if (!bookMember || !selectedService || !bookDate) {
      toast.error("Please fill member, service and date");
      return;
    }

    if (!bookTimeSlot && !bookStartTime) {
      toast.error("Please pick a time slot (or use 24h timeline)");
      return;
    }
    const today = toZonedTime(new Date(), SYSTEM_TZ);
    today.setHours(0, 0, 0, 0);
    if (new Date(bookDate) < today) {
      toast.error("Cannot create bookings for past dates");
      return;
    }
    if (isPastDateTime(bookDate, bookStartTime)) {
      toast.error("Cannot create bookings in the past");
      return;
    }
    const start = bookStartTime || SLOT_START[bookTimeSlot] || "09:00";
    let end = bookEndTime;
    if (!end) {
      const [h, m] = start.split(":").map(Number);
      const total = h * 60 + m + Number(selectedService.duration || 60);
      const eh = Math.floor(total / 60) % 24;
      const em = total % 60;
      end = `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
    }

    const memberObj = members.find((m) => m.id === bookMember);
    const effectiveMemberId = isGuestBooking ? "" : bookMember;
    const effectiveMemberName = isGuestBooking
      ? `Guest · ${guestName.trim()}`
      : memberObj?.name || "";

    try {
      if (editingBookingId) {
        await updateBookingMutation.mutateAsync({
          id: editingBookingId,
          data: {
            memberId: bookMember,
            memberName: memberObj?.name || "",
            service: selectedService.type as ServiceType,
            className: selectedService.name,
            date: bookDate,
            startTime: start,
            start_time: start,
            endTime: end,
            end_time: end,
            outletId: selectedOutlet.id,
            instructor: bookInstructor || selectedService.instructor || "",
            timeSlot: bookTimeSlot || start,
          } as any,
        });
        toast.success("Booking updated");
        setDialogOpen(false);
        setEditingBookingId(null);
        setBookMember("");
        setMemberSearch("");
        setBookServiceId("");
        setBookInstructor("");
        setBookTimeSlot("");
        setBookStartTime("");
        setBookEndTime("");
        return;
      }

      const bookingId = await addBookingMutation.mutateAsync({
        memberId: effectiveMemberId,
        memberName: effectiveMemberName,
        service: selectedService.type as ServiceType,
        className: selectedService.name,
        date: bookDate,
        startTime: start,
        start_time: start,
        endTime: end,
        end_time: end,
        status: bookStatus,
        bookingStatus: bookStatus,
        outletId: selectedOutlet.id,
        instructor: bookInstructor || selectedService.instructor || "",
        timeSlot: bookTimeSlot || start,
      } as any);

      const basePrice = Number(selectedService.price || 0);
      const finalPrice =
        useDiscountedRate && discountedRate
          ? Number(discountedRate)
          : basePrice;
      let chargeId = "";
      if (finalPrice > 0 && !isGuestBooking) {
        try {
          const { createChargeForBooking } = await import("@/lib/charges");
          chargeId = await createChargeForBooking(
            (d) => addTransactionMutation.mutateAsync(d) as Promise<string>,
            {
              memberId: effectiveMemberId,
              memberName: effectiveMemberName,
              bookingId: String(bookingId || ""),
              service: selectedService.type,
              className: selectedService.name,
              amount: finalPrice,
              chargeHead: selectedService.type,
              outletId: selectedOutlet?.id,
            },
          );
        } catch (e) {
          console.warn("[bookings] failed to post charge", e);
        }
      }

      toast.success(
        isGuestBooking
          ? "Guest booking created — redirecting to payment"
          : "Booking created — redirecting to payment",
      );
      setDialogOpen(false);
      const params = new URLSearchParams({
        newPayment: "true",
        memberId: effectiveMemberId,
        memberName: effectiveMemberName,
        service: selectedService.type,
        className: selectedService.name,
        amount: String(finalPrice),
        bookingId: String(bookingId || ""),
        chargeId: chargeId,
        outletId: selectedOutlet.id,
        locked: "1",
        ...(isGuestBooking ? { guest: "1" } : {}),
      });
      setBookMember("");
      setMemberSearch("");
      setBookServiceId("");
      setBookInstructor("");
      setBookTimeSlot("");
      setBookStartTime("");
      setBookEndTime("");
      setUseDiscountedRate(false);
      setDiscountedRate("");
      setGuestMode(false);
      setGuestName("");

      navigate(`/transactions?${params.toString()}`);
    } catch {
      toast.error("Failed to create booking");
    }
  };

  const selectedPlan = useMemo(
    () => plans.find((p) => p.id === bookPlanId) || null,
    [plans, bookPlanId],
  );

  const membershipAmount = useMemo(() => {
    if (!selectedPlan) return 0;
    if (bookDuration === "yearly") return Number(selectedPlan.yearlyPrice || 0);
    if (bookDuration === "longTerm")
      return Number(selectedPlan.longTermPrice || 0);
    return Number(selectedPlan.price || 0);
  }, [selectedPlan, bookDuration]);

  const handleEnrollMembership = async () => {
    if (!bookMember || !selectedPlan) {
      toast.error("Select a member and a membership plan");
      return;
    }
    if (membershipAmount <= 0) {
      toast.error("Selected duration has no price configured");
      return;
    }
    const memberObj = members.find((m) => m.id === bookMember);
    const today = toZonedTime(new Date(), SYSTEM_TZ);
    const expiry = new Date(today);
    if (bookDuration === "monthly") expiry.setMonth(expiry.getMonth() + 1);
    if (bookDuration === "yearly") expiry.setFullYear(expiry.getFullYear() + 1);
    if (bookDuration === "longTerm")
      expiry.setFullYear(expiry.getFullYear() + 15);
    const durationLabel =
      bookDuration === "monthly"
        ? "Monthly"
        : bookDuration === "yearly"
          ? "Yearly"
          : "15-Year";
    try {
      await updateMemberMutation.mutateAsync({
        id: bookMember,
        data: {
          tier: selectedPlan.tier,
          plan: durationLabel,
          expiryDate: expiry.toISOString().split("T")[0],
          status: "Active",
        },
      });
      toast.success("Membership enrolled — proceed to payment");
      setDialogOpen(false);
      const finalAmount =
        useDiscountedRate && discountedRate
          ? Number(discountedRate)
          : membershipAmount;
      const params = new URLSearchParams({
        newPayment: "true",
        memberId: bookMember,
        memberName: memberObj?.name || "",
        service: "Membership",
        className: `${selectedPlan.tier} · ${durationLabel}`,
        amount: String(finalAmount),
        locked: "1",
      });
      setBookMember("");
      setMemberSearch("");
      setBookPlanId("");
      setBookDuration("monthly");
      navigate(`/transactions?${params.toString()}`);
    } catch {
      toast.error("Failed to enroll membership");
    }
  };

  const getServiceStyle = (service: string) => {
    const color = serviceColors[service] || colorOptions[0].value;
    return { backgroundColor: color, color: "#fff" };
  };

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

  const selectedMember = members.find((m) => m.id === bookMember);

  return (
    <div className="space-y-6 animate-fade-in">
      <OutletPickerDialog open={pickerOpen} onOpenChange={setPickerOpen} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold font-display">Bookings</h1>
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-muted-foreground text-sm">
              {filtered.length} bookings
            </p>
            {outlets.length > 0 && (
              <button
                onClick={() => setPickerOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border border-border/60 bg-muted/40 hover:bg-muted/70 transition-colors"
              >
                <Building2
                  className="h-3 w-3"
                  style={{ color: selectedOutlet?.color }}
                />
                <span className="font-medium">
                  {selectedOutlet ? selectedOutlet.name : "Choose outlet"}
                </span>
                <ChevronDown className="h-3 w-3 opacity-60" />
              </button>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex rounded-lg border border-border overflow-hidden">
            <Button
              variant={view === "calendar" ? "default" : "ghost"}
              size="sm"
              className="rounded-none"
              onClick={() => setView("calendar")}
            >
              <CalIcon className="h-4 w-4" />
            </Button>
            <Button
              variant={view === "list" ? "default" : "ghost"}
              size="sm"
              className="rounded-none"
              onClick={() => setView("list")}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
          <Select value={serviceFilter} onValueChange={setServiceFilter}>
            <SelectTrigger className="w-[130px] bg-muted/50 border-0">
              <SelectValue placeholder="Service" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Services</SelectItem>
              {outletServiceTypes.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!isFitnessOrHealth && view === "list" && (
            <Input
              type="month"
              value={listMonth}
              onChange={(e) => setListMonth(e.target.value)}
              className="h-9 w-[172px] bg-muted/50 border-0"
              title="Filter by month"
            />
          )}

          {!isFitnessOrHealth && (
            <Popover
              open={colorSettingsOpen}
              onOpenChange={setColorSettingsOpen}
            >
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon">
                  <Settings className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64" align="end">
                <p className="font-semibold text-sm mb-3">Calendar Colors</p>
                {outletServiceTypes.map((svc) => (
                  <div
                    key={svc}
                    className="flex items-center justify-between mb-2"
                  >
                    <span className="text-sm">{svc}</span>
                    <div className="flex gap-1">
                      {colorOptions.map((c) => (
                        <button
                          key={c.value}
                          className={cn(
                            "h-5 w-5 rounded-full border-2 transition-all",
                            serviceColors[svc] === c.value
                              ? "border-foreground scale-110"
                              : "border-transparent",
                          )}
                          style={{ backgroundColor: c.value }}
                          onClick={() =>
                            setServiceColors((prev) => ({
                              ...prev,
                              [svc]: c.value,
                            }))
                          }
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </PopoverContent>
            </Popover>
          )}

          <Button size="sm" onClick={() => openNewBookingDialog()}>
            <Plus className="h-4 w-4 mr-1" />
            New Booking
          </Button>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editingBookingId ? "Amend Booking" : "New Booking"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 flex items-center gap-2 text-sm">
              <Building2
                className="h-4 w-4"
                style={{ color: selectedOutlet?.color }}
              />
              <span className="text-muted-foreground">Outlet</span>
              <span className="font-medium">{selectedOutlet?.name || "—"}</span>
              {selectedService?.type && (
                <Badge variant="secondary" className="ml-auto text-[10px]">
                  {selectedService.type}
                </Badge>
              )}
            </div>

            {isSportsOutlet && !editingBookingId && (
              <div className="rounded-lg border border-border bg-muted/30 p-1 grid grid-cols-2 gap-1 text-xs">
                <button
                  type="button"
                  onClick={() => setGuestMode(false)}
                  className={cn(
                    "py-1.5 rounded-md font-medium transition-colors",
                    !guestMode
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted/60",
                  )}
                >
                  Member Mode
                </button>
                <button
                  type="button"
                  onClick={() => setGuestMode(true)}
                  className={cn(
                    "py-1.5 rounded-md font-medium transition-colors",
                    guestMode
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted/60",
                  )}
                >
                  FIT Guest Mode
                </button>
              </div>
            )}

            {!(isSportsOutlet && guestMode) ? (
              <div className="space-y-2">
                <Label>Member *</Label>
                <Popover
                  open={memberPopoverOpen}
                  onOpenChange={setMemberPopoverOpen}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between font-normal"
                    >
                      {selectedMember ? (
                        <span className="flex items-center gap-2 truncate">
                          <span className="truncate">
                            {selectedMember.name}
                          </span>
                          {selectedMember.phone && (
                            <span className="text-xs text-muted-foreground">
                              {selectedMember.phone}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          Search and select member…
                        </span>
                      )}
                      <ChevronDown className="h-4 w-4 opacity-60" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-[--radix-popover-trigger-width] p-0"
                    align="start"
                  >
                    <div className="p-2 border-b border-border">
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          value={memberSearch}
                          onChange={(e) => setMemberSearch(e.target.value)}
                          placeholder="Search by name, phone, email"
                          className="pl-7 h-8"
                          autoFocus
                        />
                      </div>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {filteredMembers.length === 0 ? (
                        <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                          No members found
                        </p>
                      ) : (
                        filteredMembers.map((m) => (
                          <button
                            key={m.id}
                            onClick={() => {
                              setBookMember(m.id);
                              setMemberPopoverOpen(false);
                            }}
                            className="flex items-center justify-between w-full px-3 py-2 text-sm text-left hover:bg-muted/50"
                          >
                            <div className="flex flex-col min-w-0">
                              <span className="truncate">{m.name}</span>
                              <span className="text-[11px] text-muted-foreground truncate">
                                {m.phone || m.email || "—"}
                              </span>
                            </div>
                            {bookMember === m.id && (
                              <Check className="h-3.5 w-3.5 text-primary" />
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Guest Name *</Label>
                <Input
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Walk-in guest full name"
                  autoFocus
                />
                <p className="text-[11px] text-muted-foreground">
                  Guest bookings skip member profile lookup — payment is
                  collected on the spot at the next step.
                </p>
              </div>
            )}

            {isMembershipOutlet ? (
              <>
                <div className="space-y-2">
                  <Label>Membership Plan *</Label>
                  <Select value={bookPlanId} onValueChange={setBookPlanId}>
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          plans.length === 0
                            ? "No plans configured"
                            : "Select plan"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {plans.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.tier} — {p.includes || p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedPlan && (
                  <div className="space-y-2">
                    <Label>Duration *</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {(
                        [
                          {
                            key: "monthly",
                            label: "Monthly",
                            price: selectedPlan.price,
                            baseline: selectedPlan.price,
                            months: 1,
                          },
                          {
                            key: "yearly",
                            label: "1 Year",
                            price: selectedPlan.yearlyPrice || 0,
                            baseline: selectedPlan.price * 12,
                            months: 12,
                          },
                          {
                            key: "longTerm",
                            label: "15 Years",
                            price: selectedPlan.longTermPrice || 0,
                            baseline: selectedPlan.price * 180,
                            months: 180,
                          },
                        ] as const
                      ).map((d) => {
                        const save =
                          d.baseline > 0 && d.price > 0
                            ? Math.max(0, d.baseline - d.price)
                            : 0;
                        const pct =
                          d.baseline > 0 && save > 0
                            ? Math.round((save / d.baseline) * 100)
                            : 0;
                        return (
                          <button
                            key={d.key}
                            type="button"
                            onClick={() => setBookDuration(d.key)}
                            disabled={!d.price}
                            className={cn(
                              "relative rounded-lg border p-3 text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
                              bookDuration === d.key
                                ? "border-primary bg-primary/10"
                                : "border-border bg-muted/30 hover:bg-muted/50",
                            )}
                          >
                            {pct > 0 && (
                              <span className="absolute -top-2 -right-2 text-[9px] font-bold bg-success text-white px-1.5 py-0.5 rounded-full shadow-md">
                                -{pct}%
                              </span>
                            )}
                            <p className="text-xs text-muted-foreground">
                              {d.label}
                            </p>
                            <p className="text-sm font-bold font-display mt-1">
                              NPR {Number(d.price || 0).toLocaleString()}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <Button
                  onClick={handleEnrollMembership}
                  disabled={updateMemberMutation.isPending || !selectedPlan}
                  className="w-full gradient-gold text-primary-foreground"
                >
                  {updateMemberMutation.isPending
                    ? "Enrolling..."
                    : `Enroll & Pay NPR ${(useDiscountedRate && discountedRate ? Number(discountedRate) : membershipAmount).toLocaleString()}`}
                </Button>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Service *</Label>
                  <Select
                    value={bookServiceId}
                    onValueChange={(v) => {
                      setBookServiceId(v);
                      setBookInstructor("");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          outletServices.length === 0
                            ? "No services for this outlet"
                            : "Select service"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {outletServices.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name} — {s.type} • {s.duration || 0}min
                          {s.price ? ` • NPR ${s.price}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedService && (
                  <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2 text-sm">
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <span className="text-muted-foreground text-xs block">
                          Duration
                        </span>
                        <span className="font-medium">
                          {selectedService.duration || 0} min
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs block">
                          Instructor
                        </span>
                        <span className="font-medium">
                          {selectedService.requiresInstructor
                            ? selectedService.instructor || "—"
                            : "Not required"}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs block">
                          Standard Rate
                        </span>
                        <span className="font-medium">
                          NPR {selectedService.price || 0}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between rounded-md border border-border/60 bg-background/50 px-3 py-2">
                      <Label className="text-xs">Apply Discounted Rate</Label>
                      <Switch
                        checked={useDiscountedRate}
                        onCheckedChange={(v) => {
                          setUseDiscountedRate(v);
                          if (!v) setDiscountedRate("");
                        }}
                      />
                    </div>
                    {useDiscountedRate && (
                      <div className="space-y-1.5">
                        <Label className="text-xs">
                          Discounted Rate (NPR, VAT incl.)
                        </Label>
                        <Input
                          type="number"
                          min={0}
                          max={Number(selectedService.price || 0)}
                          value={discountedRate}
                          placeholder={`Max ${selectedService.price || 0}`}
                          onChange={(e) => setDiscountedRate(e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                )}

                <div
                  className={cn(
                    "grid gap-3",
                    selectedService?.requiresInstructor
                      ? "grid-cols-1 sm:grid-cols-3"
                      : "grid-cols-1 sm:grid-cols-2",
                  )}
                >
                  <div className="space-y-2">
                    <Label>Date *</Label>
                    <Input
                      type="date"
                      value={bookDate}
                      onChange={(e) => setBookDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Time Slot *</Label>
                    <div className="flex gap-2">
                      <Select
                        value={bookTimeSlot}
                        onValueChange={(v) => {
                          setBookTimeSlot(v);
                          setBookStartTime("");
                          setBookEndTime("");
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              bookStartTime
                                ? `${bookStartTime}–${bookEndTime}`
                                : "Select slot"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {setupTimeSlots.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        disabled={!bookDate || !selectedService}
                        onClick={() => setTimelineOpen(true)}
                      >
                        24h
                      </Button>
                    </div>
                  </div>
                  {selectedService?.requiresInstructor && (
                    <div className="space-y-2">
                      <Label>Instructor *</Label>
                      <Select
                        value={bookInstructor}
                        onValueChange={setBookInstructor}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select instructor" />
                        </SelectTrigger>
                        <SelectContent>
                          {setupInstructors.map((i) => (
                            <SelectItem key={i} value={i}>
                              {i}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Booking Status *</Label>
                  <Select
                    value={bookStatus}
                    onValueChange={(v) => setBookStatus(v as typeof bookStatus)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Confirmed">Confirmed</SelectItem>
                      <SelectItem value="Waitlisted">Wait-listed</SelectItem>
                      <SelectItem value="NotFixed">Not-fixed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={handleBook}
                  disabled={
                    addBookingMutation.isPending ||
                    updateBookingMutation.isPending
                  }
                  className="w-full gradient-gold text-primary-foreground"
                >
                  {editingBookingId
                    ? updateBookingMutation.isPending
                      ? "Saving..."
                      : "Save Changes"
                    : addBookingMutation.isPending
                      ? "Creating..."
                      : "Create Booking"}
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <DayTimelineDialog
        open={timelineOpen}
        onOpenChange={setTimelineOpen}
        date={bookDate}
        bookings={filtered.filter((b) => b.date === bookDate)}
        durationMinutes={Number(selectedService?.duration || 60)}
        onPick={(s, e) => {
          setBookStartTime(s);
          setBookEndTime(e);
          setBookTimeSlot("");
        }}
      />

      <BookingDetailModal
        booking={selectedBooking}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onAmend={openAmendBookingDialog}
      />

      <DayScheduleDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        date={scheduleDay}
        bookings={scheduleDay ? getBookingsForDay(scheduleDay) : []}
        getServiceColor={(svc) => serviceColors[svc]}
        onAddBooking={(startTime) => {
          setScheduleOpen(false);
          openNewBookingDialog(scheduleDay || undefined, startTime);
        }}
        onBookingClick={(b) => {
          setSelectedBooking(b);
          setDetailOpen(true);
        }}
        onReschedule={async (b, newHour) => {
          if (!scheduleDay) return;
          if (b.status === "Completed" || b.bookingStatus === "Completed") {
            toast.error("Completed bookings cannot be rescheduled");
            return;
          }
          const dStr = formatInTimeZone(scheduleDay, SYSTEM_TZ, "yyyy-MM-dd");
          const newStart = `${String(newHour).padStart(2, "0")}:00`;

          if (isPastDateTime(dStr, newStart)) {
            toast.error("Cannot reschedule into a past time slot");
            return;
          }

          const [sh, sm] = (b.startTime || "00:00").split(":").map(Number);
          const [eh, em] = (b.endTime || b.startTime || "00:00")
            .split(":")
            .map(Number);
          const duration = Math.max(15, eh * 60 + em - (sh * 60 + sm) || 60);

          const endMin = newHour * 60 + duration;
          const newEnd = `${String(Math.floor(endMin / 60) % 24).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`;

          // Determine if target reschedule date falls on today's date within Asia/Katmandu
          const targetIsToday = isSameDay(
            toZonedTime(new Date(b.date || dStr), SYSTEM_TZ),
            toZonedTime(new Date(), SYSTEM_TZ),
          );
          const targetStatus = targetIsToday
            ? "Pending"
            : b.status || b.bookingStatus || "Confirmed";

          try {
            await updateBookingMutation.mutateAsync({
              id: b.id,
              data: {
                date: b.date || dStr,
                // Casing Bridge: Populate both camelCase and snake_case to keep UI & DB in sync
                startTime: newStart,
                start_time: newStart,
                endTime: newEnd,
                end_time: newEnd,
                timeSlot: newStart,
                status: targetStatus,
                bookingStatus: targetStatus,
              },
            });
            toast.success(`Rescheduled to ${newStart}`);
          } catch {
            toast.error("Failed to reschedule booking");
          }
        }}
      />

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : isPOSOutlet && selectedOutlet ? (
        <OutletPOSView outlet={selectedOutlet} />
      ) : view === "calendar" ? (
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-lg font-semibold font-display">
              {formatInTimeZone(currentMonth, SYSTEM_TZ, "MMMM yyyy")}
            </h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-7 gap-px mb-1">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div
                key={d}
                className="text-center text-xs font-medium text-muted-foreground py-2"
              >
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px">
            {days.map((day) => {
              const dayBookings = getBookingsForDay(day);
              const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
              const dayIsToday = isSameDay(
                day,
                toZonedTime(new Date(), SYSTEM_TZ),
              );
              return (
                <Tooltip key={day.toISOString()}>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        "min-h-[80px] lg:min-h-[100px] rounded-lg p-1.5 text-sm transition-colors cursor-pointer hover:ring-1 hover:ring-primary/50 flex flex-col",
                        isCurrentMonth ? "bg-card" : "bg-muted/20",
                        dayIsToday && "ring-1 ring-primary",
                        dayBookings.length > 0 && "bg-primary/5",
                      )}
                      onClick={() => handleDayClick(day)}
                      onDoubleClick={() => handleDayDoubleClick(day)}
                    >
                      <span
                        className={cn(
                          "text-xs",
                          !isCurrentMonth && "text-muted-foreground/40",
                          dayIsToday && "font-bold text-primary",
                        )}
                      >
                        {formatInTimeZone(day, SYSTEM_TZ, "d")}
                      </span>
                      {dayBookings.length > 0 && (
                        <div className="mt-auto self-end">
                          <span className="inline-flex items-center justify-center min-w-[26px] h-6 px-1.5 rounded-full bg-primary/15 text-primary text-[11px] font-semibold">
                            {dayBookings.length}
                          </span>
                        </div>
                      )}
                    </div>
                  </TooltipTrigger>
                  {dayBookings.length > 0 && (
                    <TooltipContent side="right" className="max-w-[220px]">
                      <p className="font-semibold text-xs mb-1">
                        {formatInTimeZone(day, SYSTEM_TZ, "MMM d, yyyy")} ·{" "}
                        {dayBookings.length} booking
                        {dayBookings.length === 1 ? "" : "s"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Click the day to view the full schedule.
                      </p>
                    </TooltipContent>
                  )}
                </Tooltip>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="glass-card rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedList.map((b) => {
                  const displayStatus =
                    b.status || b.bookingStatus || "Confirmed";
                  return (
                    <TableRow
                      key={b.id}
                      className="cursor-pointer"
                      onClick={() => handleBookingClick(b)}
                    >
                      <TableCell className="text-sm">{b.date}</TableCell>
                      <TableCell className="text-sm font-medium">
                        {b.memberName}
                      </TableCell>
                      <TableCell className="text-sm">{b.className}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px]">
                          {b.service}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {b.startTime}–{b.endTime}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            displayStatus === "Confirmed"
                              ? "default"
                              : displayStatus === "Pending"
                                ? "secondary"
                                : displayStatus === "Completed"
                                  ? "default"
                                  : "destructive"
                          }
                          className={`text-[10px] ${displayStatus === "Completed" ? "bg-success/20 text-success border-0" : ""}`}
                        >
                          {displayStatus}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Bookings_Page;
