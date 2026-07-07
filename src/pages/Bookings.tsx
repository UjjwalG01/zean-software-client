import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

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
import { formatInTimeZone } from "date-fns-tz";
import {
  getSystemNowDate,
  getSystemTodayStr,
  getSystemTimeStr,
  getSystemMonthStr,
} from "@/lib/timeUtils";
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
  usePlanDurations,
  useUpdateMember,
  useAddTransaction,
  useUpdateTransaction,
} from "@/hooks/use-firestore";
import { formatMonths } from "@/lib/duration";
import { useOutlet } from "@/contexts/OutletContext";
import { Building2, ChevronDown, Loader2 } from "lucide-react";
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
import { underlineFirstChar } from "@/lib/string-case-change";
import { colorOptions } from "@/lib/utils";
import { wallTimeToUtcIso, getAppTimezone } from "@/lib/tz";
import { useAuth } from "@/hooks/use-auth";

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
  const systemNow = useMemo(() => getSystemNowDate(), []);

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
  const [listMonth, setListMonth] = useState<string>(getSystemMonthStr());
  const [listPage, setListPage] = useState(1);
  const PAGE_SIZE = 25;
  const [colorSettingsOpen, setColorSettingsOpen] = useState(false);
  const [serviceColors, setServiceColors] = useState<Record<string, string>>({
    Events: colorOptions[0].value,
    Fitness: colorOptions[1].value,
    Health: colorOptions[2].value,
    Membership: colorOptions[3].value,
    Sports: colorOptions[4].value,
    Wellness: colorOptions[5].value,
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

  const [bookPlanId, setBookPlanId] = useState("");
  const [bookDurationId, setBookDurationId] = useState<string>("");
  const [useDiscountedRate, setUseDiscountedRate] = useState(false);
  const [discountedRate, setDiscountedRate] = useState<string>("");
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [bookStartTime, setBookStartTime] = useState<string>("");
  const [bookEndTime, setBookEndTime] = useState<string>("");
  const [bookStatus, setBookStatus] = useState<
    "confirmed" | "wait-listed" | "not-fixed"
  >("confirmed");

  const [guestMode, setGuestMode] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [membershipListOpen, setMembershipListOpen] = useState(false);

  const { data: bookings = [], isLoading } = useBookings();
  const [searchParams, setSearchParams] = useSearchParams();

  const { data: members = [] } = useMembers();
  const { data: services = [] } = useServices();
  const { data: plans = [] } = useMembershipPlans();
  const { data: planDurations = [] } = usePlanDurations();
  const { data: settings = {} } = useCompanySettings();
  const addBookingMutation = useAddBooking();
  const updateMemberMutation = useUpdateMember();
  const addTransactionMutation = useAddTransaction();
  const updateBookingMutation = useUpdateBooking();
  const updateTransactionMutation = useUpdateTransaction();

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
    ((selectedOutlet.serviceTypes || []).some((s) => {
      const v = (s || "").toLowerCase();
      return v === "sports" || v === "fitness";
    }) ||
      ["SPORTS", "FITNESS"].includes(
        (selectedOutlet.outletType || "").toUpperCase(),
      ));

  const setupInstructors = parseSetup(settings, "setup_instructors", [
    "Trainer Ravi",
    "Trainer Prakash",
    "Therapist Maya",
    "Coach Anil",
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

  // 🚀 FIX: Index bookings by date string upfront to avoid deep nested array looping
  const bookingsByDateCache = useMemo(() => {
    const map: Record<string, Booking[]> = {};

    filtered.forEach((b) => {
      if (!b.date || b.status === "cancelled") return;

      if (!map[b.date]) map[b.date] = [];
      map[b.date].push(b);
    });
    return map;
  }, [filtered]);

  const getBookingsForDay = (day: Date) => {
    // 1. Convert the calendar grid day into a clean string relative to Kathmandu
    const dayStr = formatInTimeZone(day, getAppTimezone(), "yyyy-MM-dd");

    // 2. Perform a bulletproof string-to-string comparison
    return bookingsByDateCache[dayStr] || [];
  };

  const isPastDateTime = (dateStr: string, startTime?: string): boolean => {
    if (!dateStr) return false;

    // 1. Get the current date in Kathmandu as a pure string
    const todayStr = getSystemTodayStr();

    // 2. Clear-cut date checks
    if (dateStr < todayStr) return true; // Definitely in the past
    if (dateStr > todayStr) return false; // Definitely in the future

    // 3. If dateStr === todayStr, evaluate the time slot
    if (!startTime) return false;
    const [slotH, slotM] = startTime.split(":").map(Number);
    if (Number.isNaN(slotH)) return false;

    // 4. Extract Kathmandu's exact current hours & minutes as standalone numbers
    const [curHStr, curMStr] = getSystemTimeStr().split(":");
    const currentHour = Number(curHStr);
    const currentMin = Number(curMStr);

    // 5. Convert both times to total minutes elapsed since midnight for a pure numeric comparison
    const slotTotalMinutes = slotH * 60 + (slotM || 0);
    const currentTotalMinutes = currentHour * 60 + currentMin;

    return slotTotalMinutes <= currentTotalMinutes;
  };

  const openNewBookingDialog = (day?: Date, startTime?: string) => {
    if (!selectedOutlet) {
      setPickerOpen(true);
      return;
    }
    const d = day || getSystemNowDate();
    const today = getSystemNowDate();
    today.setHours(0, 0, 0, 0);

    // 🔄 MODIFIED: Allow past dates ONLY for membership outlets
    if (d < today && !isMembershipOutlet) {
      toast.error("Cannot add bookings for past dates");
      return;
    }

    const dStr = formatInTimeZone(d, getAppTimezone(), "yyyy-MM-dd");

    // 🔄 MODIFIED: Allow past times slots ONLY for membership outlets
    if (startTime && isPastDateTime(dStr, startTime) && !isMembershipOutlet) {
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
    setBookMember(b.memberId);
    setBookInstructor(b.instructor || "");
    const svc =
      outletServices.find((s) => s.name === b.className) ||
      outletServices.find((s) => s.type === b.service);
    setBookServiceId(svc?.id || "");
    setUseDiscountedRate(false);
    setDiscountedRate("");

    // Safely map incoming database status to local lowercase form select state
    let currentStatus = (
      b.bookingStatus ||
      b.status ||
      "confirmed"
    ).toLowerCase();
    if (!["confirmed", "wait-listed", "not-fixed"].includes(currentStatus)) {
      currentStatus = "confirmed";
    }
    setBookStatus(currentStatus as any);

    setDialogOpen(true);
  };

  // Cross-page unified Amend entry point — POS view (and any other caller)
  // navigates here with ?amendBookingId=<id> so the unified booking dialog
  // opens pre-populated. Guarantees Add / Edit / Amend share one component.
  useEffect(() => {
    const amendId = searchParams.get("amendBookingId");
    if (!amendId || isLoading) return;
    const target = bookings.find((b) => String(b.id) === amendId);
    if (target) {
      openAmendBookingDialog(target);
      const next = new URLSearchParams(searchParams);
      next.delete("amendBookingId");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, bookings, isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDayClick = (day: Date) => {
    setScheduleDay(day);
    if (isMembershipOutlet) {
      setMembershipListOpen(true);
    } else {
      setScheduleOpen(true);
    }
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
    if (isSubmitting) return;
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

    if (!bookStartTime) {
      toast.error("Please pick a start time (use the 24h timeline)");
      return;
    }
    const today = getSystemNowDate();
    today.setHours(0, 0, 0, 0);
    if (bookDate < getSystemTodayStr() && !isMembershipOutlet) {
      toast.error("Cannot create bookings for past dates");
      return;
    }
    if (isPastDateTime(bookDate, bookStartTime) && !isMembershipOutlet) {
      toast.error("Cannot create bookings in the past");
      return;
    }
    const start = bookStartTime;
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

    setIsSubmitting(true);
    try {
      // 🚀 FIX: Prevent resetting lifecycle state back to "pending" on an edit
      const cleanBookStatus = bookStatus.toLowerCase();
      const existingBooking = bookings.find((b) => b.id === editingBookingId);
      const finalLifecycleStatus = editingBookingId
        ? existingBooking?.status || "pending"
        : "pending";

      // 🌟 1. Price, Rate, and Discount Calculations Upfront
      const basePrice = Number(selectedService.price || 0);
      const finalPrice =
        useDiscountedRate && discountedRate
          ? Number(discountedRate)
          : basePrice;
      const discountAmt = Math.max(0, basePrice - finalPrice);

      // 🌟 2. Bulletproof Date Range Synchronization (ISO and Fallbacks)
      // Use wallTimeToUtcIso to convert local wall-clock time to UTC ISO string
      // This prevents timezone-related day-flip bugs when storing timestamps
      const tz = getAppTimezone();
      const startIso = wallTimeToUtcIso(bookDate, start, tz);
      const endIso = wallTimeToUtcIso(bookDate, end, tz);

      if (editingBookingId) {
        await updateBookingMutation.mutateAsync({
          id: editingBookingId,
          data: {
            memberId: bookMember,
            memberName: memberObj?.name || "",
            service: selectedService.type as ServiceType,
            service_id: selectedService.id, // 🌟 Added
            module_id: selectedOutlet.outletType || "", // 🌟 Added

            rate: finalPrice, // 🌟 Added
            original_rate: basePrice, // 🌟 Added
            discount_amount: discountAmt, // 🌟 Added
            className: selectedService.name,

            // Core Date Formatting Parameters
            date: bookDate,
            bookingDate: bookDate,
            booking_date: bookDate,

            // Core 24h Daily Time Strings
            startTime: start,
            start_time: start,
            endTime: end,
            end_time: end,

            // ISO Calendar Timestamps
            start_at: startIso,
            end_at: endIso,
            startAt: startIso,
            endAt: endIso,

            outletId: selectedOutlet.id,
            instructor: bookInstructor || selectedService.instructor || "",

            status: finalLifecycleStatus, // Controls the lifecycle
            bookStatus: cleanBookStatus, // Retains classification type string
            bookingStatus: cleanBookStatus, // Type descriptor fallback
          } as any,
        });
        toast.success("Booking updated");
        setDialogOpen(false);
        setEditingBookingId(null);
        setBookMember("");
        setMemberSearch("");
        setBookServiceId("");
        setBookInstructor("");
        setBookStartTime("");
        setBookEndTime("");
        return;
      }

      // 🌟 3. Create Payload Configuration
      const bookingId = await addBookingMutation.mutateAsync({
        memberId: effectiveMemberId,
        memberName: effectiveMemberName,
        service: selectedService.type as ServiceType,
        service_id: selectedService.id, // 🌟 Added
        module_id: selectedOutlet.outletType || "", // 🌟 Added
        rate: finalPrice, // 🌟 Added
        original_rate: basePrice, // 🌟 Added
        discount_amount: discountAmt, // 🌟 Added
        className: selectedService.name,

        // Core Date Formatting Parameters
        date: bookDate,
        bookingDate: bookDate,
        booking_date: bookDate,

        // Core 24h Daily Time Strings
        startTime: start,
        start_time: start,
        endTime: end,
        end_time: end,

        // ISO Calendar Timestamps
        start_at: startIso,
        end_at: endIso,
        startAt: startIso,
        endAt: endIso,

        status: "pending",
        bookStatus: cleanBookStatus,
        outletId: selectedOutlet.id,
        instructor: bookInstructor || selectedService.instructor || "",
      } as any);

      // 🌟 4. Ledger Entries & Payments
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
          ? "Guest booking created!"
          : "Booking created! Charge added to account balance.",
      );
      setDialogOpen(false);
      setBookMember("");
      setMemberSearch("");
      setBookServiceId("");
      setBookInstructor("");
      setBookStartTime("");
      setBookEndTime("");
      setUseDiscountedRate(false);
      setDiscountedRate("");
      setGuestMode(false);
      setGuestName("");
    } catch {
      toast.error("Failed to process booking");
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedPlan = useMemo(
    () => plans.find((p) => p.id === bookPlanId) || null,
    [plans, bookPlanId],
  );

  const planPriceOptions = useMemo(() => {
    if (!selectedPlan || !Array.isArray((selectedPlan as any).prices))
      return [];
    return (selectedPlan as any).prices
      .map((pr: any) => {
        const d = planDurations.find((x) => x.id === pr.durationId);
        return {
          durationId: pr.durationId,
          months: d?.months ?? pr.months ?? 0,
          name: d?.name || pr.name || "",
          price: Number(pr.price || 0),
        };
      })
      .filter((p: any) => p.durationId && p.price > 0)
      .sort((a: any, b: any) => a.months - b.months);
  }, [selectedPlan, planDurations]);

  const selectedDuration = useMemo(
    () =>
      planPriceOptions.find((p: any) => p.durationId === bookDurationId) ||
      null,
    [planPriceOptions, bookDurationId],
  );

  const membershipAmount = selectedDuration ? selectedDuration.price : 0;

  // Auto-select first available duration when plan changes
  useEffect(() => {
    if (!selectedPlan) {
      setBookDurationId("");
      return;
    }
    if (
      !bookDurationId ||
      !planPriceOptions.find((p: any) => p.durationId === bookDurationId)
    ) {
      setBookDurationId(planPriceOptions[0]?.durationId || "");
    }
  }, [selectedPlan, planPriceOptions, bookDurationId]);

  const handleEnrollMembership = async () => {
    if (!bookMember || !selectedPlan) {
      toast.error("Select a member and a membership plan");
      return;
    }
    if (!selectedDuration) {
      toast.error("Select a duration");
      return;
    }
    if (membershipAmount <= 0) {
      toast.error("Selected duration has no price configured");
      return;
    }

    const memberObj = members.find((m) => m.id === bookMember);
    const enrollmentDate = bookDate || getSystemTodayStr();

    // 🛑 NEW: Check if the member already has an active enrollment on this specific date
    const isDuplicate = bookings.some(
      (b) =>
        b.memberId === bookMember &&
        b.date === enrollmentDate &&
        b.service === "Membership" &&
        (b.status || "").toLowerCase() !== "cancelled",
    );

    if (isDuplicate) {
      toast.error(
        `${memberObj?.name || "Member"} is already enrolled on ${enrollmentDate}`,
      );
      return;
    }

    const baseDate = bookDate ? new Date(bookDate) : getSystemNowDate();
    const expiry = new Date(baseDate);
    expiry.setMonth(expiry.getMonth() + (selectedDuration.months || 1));

    const durationLabel =
      selectedDuration.name || formatMonths(selectedDuration.months || 1);
    const finalAmount =
      useDiscountedRate && discountedRate
        ? Number(discountedRate)
        : membershipAmount;

    try {
      // 1. Write calendar entry
      await addBookingMutation.mutateAsync({
        memberId: bookMember,
        memberName: memberObj?.name || "",
        service: "Membership",
        className: `${selectedPlan.tier} · ${durationLabel}`,
        date: enrollmentDate,
        startTime: "00:00",
        endTime: "23:59",
        status: "pending",
        bookStatus: "confirmed",
        outletId: selectedOutlet.id,
        instructor: "",
      } as any);

      // 2. Update Member metadata
      await updateMemberMutation.mutateAsync({
        id: bookMember,
        data: {
          tier: selectedPlan.tier,
          plan: durationLabel,
          expiryDate: expiry.toISOString().split("T")[0],
          status: "Active",
        },
      });

      // 2. Synchronize with GRC Packages Context/Data Pipeline
      // (Invoke your synchronization hook or dispatch to update MemberGRC records)
      // if (typeof syncWithGRCPackages === "function") {
      //   await syncWithGRCPackages(bookMember, selectedPlan.tier);
      // }

      // 3. Post Ledger Charge Entry
      if (finalAmount > 0) {
        try {
          const { user } = useAuth();
          const { createChargeForBooking } = await import("@/lib/charges");
          await createChargeForBooking(
            (d) => addTransactionMutation.mutateAsync(d) as Promise<string>,
            {
              memberId: bookMember,
              memberName: memberObj?.name || "",
              bookingId: "",
              service: "Membership",
              className: `${selectedPlan.tier} · ${durationLabel}`,
              amount: finalAmount,
              chargeHead: "Membership",
              outletId: selectedOutlet?.id,
              createdBy: user?.id || null,
            },
          );
        } catch (e) {
          console.warn("[membership] failed to post debit charge", e);
        }
      }

      toast.success(`Membership enrolled successfully for ${enrollmentDate}!`);
      setDialogOpen(false);

      // Reset inputs
      setBookMember("");
      setMemberSearch("");
      setBookPlanId("");
      setBookDurationId("");
      setUseDiscountedRate(false);
      setDiscountedRate("");
    } catch {
      toast.error("Failed to enroll membership");
    }
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
          <h1 className="text-2xl font-bold font-display">
            {isPOSOutlet ? "Point of Sale" : "Bookings"}
          </h1>
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-muted-foreground text-sm">
              {filtered.length} {isPOSOutlet ? "orders" : "bookings"}
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
        <div className="flex gap-2 items-center justify-end">
          {!isPOSOutlet && (
            <div className="flex rounded-lg border border-border overflow-hidden">
              <Button
                variant={view === "calendar" ? "default" : "ghost"}
                size="sm"
                accessKey="1"
                className="rounded-none"
                onClick={() => setView("calendar")}
              >
                <CalIcon className="h-4 w-4" />
              </Button>
              <Button
                variant={view === "list" ? "default" : "ghost"}
                size="sm"
                accessKey="2"
                className="rounded-none"
                onClick={() => setView("list")}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          )}
          <Select value={serviceFilter} onValueChange={setServiceFilter}>
            <SelectTrigger className="w-[130px] bg-muted/50 border-0 hidden md:flex">
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
              className="h-9 w-[100px] md:w-[132px] bg-muted/50 border-0"
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

          <Button
            size="sm"
            accessKey="a"
            onClick={() => openNewBookingDialog()}
          >
            <Plus className="h-4 w-4 mr-1" />
            {underlineFirstChar("Add Booking")}
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
                  accessKey="1"
                  className={cn(
                    "py-1.5 rounded-md font-medium transition-colors",
                    !guestMode
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted/60",
                  )}
                >
                  <u>1.</u> Member Mode
                </button>
                <button
                  type="button"
                  onClick={() => setGuestMode(true)}
                  accessKey="2"
                  className={cn(
                    "py-1.5 rounded-md font-medium transition-colors",
                    guestMode
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted/60",
                  )}
                >
                  <u>2.</u> FIT Guest Mode
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
                      {plans.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.tier} — {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedPlan && (
                  <div className="space-y-2">
                    <Label>Select Booking Duration *</Label>
                    <Select
                      value={bookDurationId}
                      onValueChange={setBookDurationId}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue
                          placeholder={
                            planPriceOptions.length === 0
                              ? "No price tiers configured"
                              : "Choose duration"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {planPriceOptions.map((d: any) => {
                          const baseline =
                            planPriceOptions[0] &&
                            planPriceOptions[0].months > 0
                              ? (planPriceOptions[0].price /
                                  planPriceOptions[0].months) *
                                d.months
                              : 0;
                          const save =
                            baseline > d.price ? baseline - d.price : 0;
                          const pct =
                            baseline > 0 && save > 0
                              ? Math.round((save / baseline) * 100)
                              : 0;
                          return (
                            <SelectItem key={d.durationId} value={d.durationId}>
                              <div className="flex items-center justify-between w-full gap-4">
                                <span>
                                  {d.name} · {formatMonths(d.months)}
                                </span>
                                <span className="font-semibold text-muted-foreground">
                                  NPR {Number(d.price || 0).toLocaleString()}
                                  {pct > 0 && (
                                    <span className="ml-2 text-[10px] bg-success/20 text-success font-bold px-1.5 py-0.5 rounded">
                                      -{pct}%
                                    </span>
                                  )}
                                </span>
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>

                    {/* Selected plan details */}
                    <div className="mt-2 rounded-lg border border-border bg-muted/30 p-3 space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">
                          {selectedPlan.name || selectedPlan.tier}
                        </span>
                        <Badge variant="secondary" className="text-[10px]">
                          {selectedPlan.tier}
                        </Badge>
                      </div>
                      {selectedDuration && (
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span>
                            {selectedDuration.name} ·{" "}
                            {formatMonths(selectedDuration.months)}
                          </span>
                          <span className="font-semibold text-foreground">
                            NPR {selectedDuration.price.toLocaleString()}
                          </span>
                        </div>
                      )}
                      {Array.isArray((selectedPlan as any).includedServices) &&
                        (selectedPlan as any).includedServices.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {(selectedPlan as any).includedServices.map(
                              (s: string) => (
                                <Badge
                                  key={s}
                                  variant="outline"
                                  className="text-[10px]"
                                >
                                  {s}
                                </Badge>
                              ),
                            )}
                          </div>
                        )}
                      <div className="flex items-center gap-3 pt-1 text-[11px] text-muted-foreground">
                        {(selectedPlan as any).autoRenew && (
                          <span className="inline-flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-success" />
                            Auto-Renew
                          </span>
                        )}
                        {(selectedPlan as any).autoDiscount && (
                          <span className="inline-flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                            Auto-Discount
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                <div className="space-y-2 mb-4">
                  <Label>Enrollment Date *</Label>
                  <Input
                    type="date"
                    value={bookDate}
                    onChange={(e) => setBookDate(e.target.value)}
                  />
                </div>
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
                      <Input
                        readOnly
                        value={
                          bookStartTime && bookEndTime
                            ? `${bookStartTime} - ${bookEndTime}`
                            : bookStartTime || ""
                        }
                        placeholder="Use 24h to pick a slot"
                        className="bg-muted/30 cursor-default"
                      />
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
                      <SelectItem value="confirmed">Confirmed</SelectItem>
                      <SelectItem value="wait-listed">Wait-listed</SelectItem>
                      <SelectItem value="not-fixed">Not-fixed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={handleBook}
                  disabled={
                    isSubmitting ||
                    addBookingMutation.isPending ||
                    updateBookingMutation.isPending
                  }
                  className="w-full gradient-gold text-primary-foreground"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Processing...
                    </>
                  ) : editingBookingId ? (
                    "Save Changes"
                  ) : (
                    "Create Booking"
                  )}
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={membershipListOpen} onOpenChange={setMembershipListOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader className="flex flex-row items-center justify-between border-b border-border pb-3">
            <div className="space-y-0.5">
              <DialogTitle className="font-display text-base">
                Enrolled Members
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                {scheduleDay
                  ? formatInTimeZone(
                      scheduleDay,
                      getAppTimezone(),
                      "MMMM d, yyyy",
                    )
                  : ""}
              </p>
            </div>

            <Button
              size="sm"
              className="h-8 text-xs gradient-gold text-primary-foreground"
              onClick={() => {
                setMembershipListOpen(false);
                openNewBookingDialog(scheduleDay || undefined);
              }}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Enroll Member
            </Button>
          </DialogHeader>

          <div className="space-y-3 mt-4 max-h-[60vh] overflow-y-auto pr-1">
            {scheduleDay && getBookingsForDay(scheduleDay).length === 0 ? (
              // ✨ Cleaned Empty State: Text message only, no extra button here
              <div className="text-center py-10 border border-dashed border-border rounded-lg bg-muted/10">
                <p className="text-sm text-muted-foreground">
                  No member enrollments for this day.
                </p>
              </div>
            ) : (
              scheduleDay &&
              getBookingsForDay(scheduleDay).map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30"
                >
                  <div className="flex flex-col min-w-0 pr-2">
                    <span className="font-medium text-sm truncate">
                      {b.memberName}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">
                      {b.className}
                    </span>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-8 text-xs shrink-0"
                    onClick={async () => {
                      if (
                        confirm(
                          `Are you sure you want to cancel ${b.memberName}'s enrollment?`,
                        )
                      ) {
                        try {
                          // 1. Move lifecycle status to cancelled, but pass back the original classification type intact
                          await updateBookingMutation.mutateAsync({
                            id: b.id,
                            data: {
                              status: "cancelled",
                              bookStatus: b.bookingStatus || "confirmed",
                              bookingStatus: b.bookingStatus || "confirmed",
                            } as any,
                          });

                          // 2. Void or neutralize any un-billed transaction entries linked to this booking id
                          const linkedCharges =
                            (bookings as any).transactions?.filter(
                              (t: any) =>
                                t.bookingId === b.id && t.status === "pending",
                            ) || [];

                          for (const charge of linkedCharges) {
                            await updateTransactionMutation.mutateAsync({
                              id: charge.id,
                              data: { status: "voided" } as any,
                            });
                          }
                          toast.success(
                            "Enrollment successfully cancelled and slot freed.",
                          );
                        } catch {
                          toast.error("Failed to terminate enrollment entry");
                        }
                      }
                    }}
                  >
                    Cancel Enrollment
                  </Button>
                </div>
              ))
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
        }}
      />

      <BookingDetailModal
        booking={selectedBooking}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onAmend={openAmendBookingDialog}
        readOnly={
          selectedBooking
            ? ["fitness", "wellness"].includes(
                String(selectedBooking.service || "").toLowerCase(),
              )
            : false
        }
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
          if (b.status?.toLowerCase() === "completed") {
            toast.error("Completed bookings cannot be rescheduled");
            return;
          }

          const dStr = formatInTimeZone(
            scheduleDay,
            getAppTimezone(),
            "yyyy-MM-dd",
          );
          const newStart = `${String(newHour).padStart(2, "0")}:00`;
          const newEnd = `${String(newHour + 1).padStart(2, "0")}:00`;

          if (isPastDateTime(dStr, newStart)) {
            toast.error("Cannot reschedule into a past time slot");
            return;
          }

          // Flawless string-to-string date match bypassing new Date() bugs
          const targetIsToday = dStr === getSystemTodayStr();

          const targetLifecycle = targetIsToday
            ? "pending"
            : (b.status || "confirmed").toLowerCase();

          try {
            // Use wallTimeToUtcIso to properly convert local time to UTC
            const tz = getAppTimezone();
            const startIsoStr = wallTimeToUtcIso(dStr, newStart, tz);
            const endIsoStr = wallTimeToUtcIso(dStr, newEnd, tz);

            await updateBookingMutation.mutateAsync({
              id: b.id,
              data: {
                date: dStr,
                bookingDate: dStr,
                booking_date: dStr,
                startTime: newStart,
                start_time: newStart,
                endTime: newEnd,
                end_time: newEnd,
                start_at: startIsoStr,
                end_at: endIsoStr,
                startAt: startIsoStr,
                endAt: endIsoStr,
                status: targetLifecycle,
              },
            });
            toast.success(`Rescheduled to ${newStart}`);
          } catch (err) {
            console.error("Reschedule network error:", err);
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
              {formatInTimeZone(currentMonth, getAppTimezone(), "MMMM yyyy")}
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
              const dayIsToday = isSameDay(day, getSystemNowDate());
              return (
                <Tooltip key={day.toISOString()}>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        "min-h-[90px] lg:min-h-[115px] rounded-lg p-1.5 text-sm transition-colors cursor-pointer hover:ring-1 hover:ring-primary/50 flex flex-col justify-between",
                        isCurrentMonth ? "bg-card" : "bg-muted/20",
                        dayIsToday && "ring-1 ring-primary",
                        dayBookings.length > 0 && "bg-primary/5",
                      )}
                      onClick={() => handleDayClick(day)}
                      onDoubleClick={() => handleDayDoubleClick(day)}
                    >
                      {/* Top Row: Day Number and Total Bookings Count Badge */}
                      <div className="flex items-center justify-between w-full">
                        <span
                          className={cn(
                            "text-xs font-semibold",
                            !isCurrentMonth && "text-muted-foreground/40",
                            dayIsToday && "font-bold text-primary",
                          )}
                        >
                          {formatInTimeZone(day, getAppTimezone(), "d")}
                        </span>
                        {dayBookings.length > 0 && (
                          <span className="inline-flex items-center justify-center h-4 min-w-[18px] px-1 rounded bg-primary/15 text-primary text-[10px] font-bold">
                            {dayBookings.length}
                          </span>
                        )}
                      </div>

                      {/* Color-Coded Micro Rows for Each Active Booking */}
                      <div className="flex-1 flex flex-col gap-1 overflow-hidden mt-1.5 w-full">
                        {/* {dayBookings.slice(0, 3).map((b) => (
                          <div
                            key={b.id}
                            className="text-[10px] px-1.5 py-0.5 rounded text-white truncate font-medium tracking-wide shadow-sm flex items-center gap-1"
                            style={{
                              backgroundColor:
                                serviceColors[b.service] || "hsl(38,92%,50%)",
                            }}
                          >
                            <span className="text-[9px] font-mono opacity-80 shrink-0">
                              {b.startTime}
                            </span>
                            <span className="truncate">
                              {b.className || b.service}
                            </span>
                          </div>
                        ))} */}
                        {dayBookings.length > 3 && (
                          <div className="text-[9px] text-muted-foreground font-semibold px-1 mt-auto">
                            +{dayBookings.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  </TooltipTrigger>
                  {dayBookings.length > 0 && (
                    <TooltipContent side="right" className="max-w-[220px]">
                      <p className="font-semibold text-xs mb-1">
                        {formatInTimeZone(day, getAppTimezone(), "MMM d, yyyy")}{" "}
                        · {dayBookings.length} booking
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
                  const displayStatus = (
                    b.status ||
                    b.bookingStatus ||
                    "confirmed"
                  ).toLowerCase();
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
                            displayStatus === "confirmed"
                              ? "default"
                              : displayStatus === "pending"
                                ? "secondary"
                                : displayStatus === "completed"
                                  ? "default"
                                  : "destructive"
                          }
                          className={`text-[10px] ${displayStatus === "completed" ? "bg-success/20 text-success border-0" : ""}`}
                        >
                          {displayStatus}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {view === "list" && totalPages > 1 && (
              <Pagination className="mt-4">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setListPage((p) => Math.max(1, p - 1))}
                      aria-disabled={listPage === 1}
                    />
                  </PaginationItem>
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <PaginationItem key={i}>
                      <PaginationLink
                        isActive={listPage === i + 1}
                        onClick={() => setListPage(i + 1)}
                      >
                        {i + 1}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <PaginationNext
                      onClick={() =>
                        setListPage((p) => Math.min(totalPages, p + 1))
                      }
                      aria-disabled={listPage === totalPages}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Bookings_Page;
