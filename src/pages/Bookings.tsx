import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, isToday } from "date-fns";
import { ChevronLeft, ChevronRight, Plus, List, CalendarDays as CalIcon, Settings, Search, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BookingDetailModal } from "@/components/BookingDetailModal";
import { OutletPickerDialog } from "@/components/OutletPickerDialog";
import { useBookings, useAddBooking, useMembers, useServices, useCompanySettings } from "@/hooks/use-firestore";
import { useOutlet } from "@/contexts/OutletContext";
import { Building2, ChevronDown } from "lucide-react";
import type { Booking, ServiceType } from "@/lib/mock-data";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const SLOT_START: Record<string, string> = { Morning: "06:00", Day: "12:00", Evening: "18:00" };

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

function parseSetup(settings: Record<string, string>, key: string, fallback: string[]): string[] {
  try { return settings[key] ? JSON.parse(settings[key]) : fallback; } catch { return fallback; }
}

const Bookings_Page = () => {
  const navigate = useNavigate();
  const { selected: selectedOutlet, outlets, setSelected, pickerOpen, setPickerOpen, isLoading: outletsLoading } = useOutlet();
  const [pickerShown, setPickerShown] = useState(false);

  // Show outlet picker dialog on first entry to /bookings if no outlet selected
  useEffect(() => {
    if (!outletsLoading && !selectedOutlet && !pickerShown) {
      setPickerOpen(true);
      setPickerShown(true);
    }
  }, [outletsLoading, selectedOutlet, pickerShown, setPickerOpen]);

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [colorSettingsOpen, setColorSettingsOpen] = useState(false);
  const [serviceColors, setServiceColors] = useState<Record<string, string>>({
    Gym: colorOptions[0].value,
    Spa: colorOptions[1].value,
    Sauna: colorOptions[2].value,
    Swimming: colorOptions[3].value,
  });

  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [bookDate, setBookDate] = useState("");
  const [bookMember, setBookMember] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [memberPopoverOpen, setMemberPopoverOpen] = useState(false);
  const [bookServiceId, setBookServiceId] = useState("");
  const [bookInstructor, setBookInstructor] = useState("");
  const [bookTimeSlot, setBookTimeSlot] = useState("");

  const { data: bookings = [], isLoading } = useBookings();
  const { data: members = [] } = useMembers();
  const { data: services = [] } = useServices();
  const { data: settings = {} } = useCompanySettings();
  const addBookingMutation = useAddBooking();

  const setupInstructors = parseSetup(settings, "setup_instructors", ["Trainer Ravi","Trainer Prakash","Therapist Maya","Coach Anil"]);
  const setupTimeSlots = parseSetup(settings, "setup_timeSlots", ["Morning","Day","Evening"]);

  // Services scoped to the selected outlet only
  const outletServices = useMemo(
    () => services.filter((s) => s.outletId === selectedOutlet?.id && s.isActive !== false),
    [services, selectedOutlet?.id]
  );

  // Service types present in this outlet (for the calendar filter dropdown)
  const outletServiceTypes = useMemo(
    () => Array.from(new Set(outletServices.map((s) => s.type))),
    [outletServices]
  );


  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const filtered = useMemo(() => {
    let list = bookings;
    if (selectedOutlet) {
      list = list.filter((b: any) => !b.outletId || b.outletId === selectedOutlet.id);
    }
    if (serviceFilter !== "all") list = list.filter((b) => b.service === serviceFilter);
    return list;
  }, [bookings, serviceFilter, selectedOutlet]);

  const getBookingsForDay = (day: Date) => filtered.filter((b) => isSameDay(new Date(b.date), day));

  const openNewBookingDialog = (day?: Date) => {
    if (!selectedOutlet) { setPickerOpen(true); return; }
    const d = day || new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (d < today) {
      toast.error("Cannot add bookings for past dates");
      return;
    }
    setBookDate(format(d, "yyyy-MM-dd"));
    setDialogOpen(true);
  };

  const handleDayClick = (day: Date) => openNewBookingDialog(day);

  const handleDayDoubleClick = (day: Date) => {
    const dayBookings = getBookingsForDay(day);
    if (dayBookings.length > 0) {
      setSelectedBooking(dayBookings[0]);
      setDetailOpen(true);
    }
  };

  const handleBookingClick = (booking: Booking) => {
    setSelectedBooking(booking);
    setDetailOpen(true);
  };

  // Selected service info (drives type, rate, duration, default instructor)
  const selectedService = useMemo(
    () => outletServices.find((s) => s.id === bookServiceId) || null,
    [outletServices, bookServiceId]
  );

  // Default instructor to the service's instructor when chosen
  useEffect(() => {
    if (selectedService?.instructor && !bookInstructor) setBookInstructor(selectedService.instructor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedService]);

  const handleBook = async () => {
    if (!bookMember || !selectedService || !bookDate || !bookTimeSlot) {
      toast.error("Please fill member, service, date and time slot");
      return;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (new Date(bookDate) < today) {
      toast.error("Cannot create bookings for past dates");
      return;
    }
    const start = SLOT_START[bookTimeSlot] || "09:00";
    const [h, m] = start.split(":").map(Number);
    const total = h * 60 + m + Number(selectedService.duration || 60);
    const eh = Math.floor(total / 60) % 24;
    const em = total % 60;
    const end = `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;

    const memberObj = members.find((m) => m.id === bookMember);
    try {
      const bookingId = await addBookingMutation.mutateAsync({
        memberId: bookMember,
        memberName: memberObj?.name || "",
        service: selectedService.type as ServiceType,
        className: selectedService.name,
        date: bookDate,
        startTime: start,
        endTime: end,
        status: "Pending",
        outletId: selectedOutlet?.id,
        instructor: bookInstructor || selectedService.instructor || "",
        timeSlot: bookTimeSlot,
      } as any);
      toast.success("Booking created — proceed to payment");
      setDialogOpen(false);
      const price = Number(selectedService.price || 0);
      const params = new URLSearchParams({
        newPayment: "true",
        memberId: bookMember,
        memberName: memberObj?.name || "",
        service: String(selectedService.type),
        className: selectedService.name,
        amount: String(price),
        locked: "1",
        bookingId: String(bookingId || ""),
      });
      setBookMember(""); setMemberSearch(""); setBookServiceId("");
      setBookInstructor(""); setBookTimeSlot("");
      navigate(`/transactions?${params.toString()}`);
    } catch {
      toast.error("Failed to create booking");
    }
  };

  const getServiceStyle = (service: string) => {
    const color = serviceColors[service] || colorOptions[0].value;
    return { backgroundColor: color, color: "#fff" };
  };

  const filteredMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    const list = q ? members.filter((m) => (m.name || "").toLowerCase().includes(q) || (m.phone || "").includes(q) || (m.email || "").toLowerCase().includes(q)) : members;
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
            <p className="text-muted-foreground text-sm">{filtered.length} bookings</p>
            {outlets.length > 0 && (
              <button
                onClick={() => setPickerOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border border-border/60 bg-muted/40 hover:bg-muted/70 transition-colors"
              >
                <Building2 className="h-3 w-3" style={{ color: selectedOutlet?.color }} />
                <span className="font-medium">{selectedOutlet ? selectedOutlet.name : "Choose outlet"}</span>
                <ChevronDown className="h-3 w-3 opacity-60" />
              </button>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex rounded-lg border border-border overflow-hidden">
            <Button variant={view === "calendar" ? "default" : "ghost"} size="sm" className="rounded-none" onClick={() => setView("calendar")}><CalIcon className="h-4 w-4" /></Button>
            <Button variant={view === "list" ? "default" : "ghost"} size="sm" className="rounded-none" onClick={() => setView("list")}><List className="h-4 w-4" /></Button>
          </div>
          <Select value={serviceFilter} onValueChange={setServiceFilter}>
            <SelectTrigger className="w-[130px] bg-muted/50 border-0"><SelectValue placeholder="Service" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Services</SelectItem>
              {outletServiceTypes.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>

          <Popover open={colorSettingsOpen} onOpenChange={setColorSettingsOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon"><Settings className="h-4 w-4" /></Button>
            </PopoverTrigger>
            <PopoverContent className="w-64" align="end">
              <p className="font-semibold text-sm mb-3">Calendar Colors</p>
              {outletServiceTypes.map((svc) => (
                <div key={svc} className="flex items-center justify-between mb-2">
                  <span className="text-sm">{svc}</span>
                  <div className="flex gap-1">
                    {colorOptions.map((c) => (
                      <button
                        key={c.value}
                        className={cn(
                          "h-5 w-5 rounded-full border-2 transition-all",
                          serviceColors[svc] === c.value ? "border-foreground scale-110" : "border-transparent"
                        )}
                        style={{ backgroundColor: c.value }}
                        onClick={() => setServiceColors((prev) => ({ ...prev, [svc]: c.value }))}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </PopoverContent>
          </Popover>

          <Button size="sm" onClick={() => openNewBookingDialog()}>
            <Plus className="h-4 w-4 mr-1" />New Booking
          </Button>
        </div>
      </div>

      {/* New Booking Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">New Booking</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Outlet context (read-only) */}
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 flex items-center gap-2 text-sm">
              <Building2 className="h-4 w-4" style={{ color: selectedOutlet?.color }} />
              <span className="text-muted-foreground">Outlet</span>
              <span className="font-medium">{selectedOutlet?.name || "—"}</span>
              {selectedService?.type && (
                <Badge variant="secondary" className="ml-auto text-[10px]">{selectedService.type}</Badge>
              )}
            </div>

            {/* Member search */}
            <div className="space-y-2">
              <Label>Member *</Label>
              <Popover open={memberPopoverOpen} onOpenChange={setMemberPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                    {selectedMember ? (
                      <span className="flex items-center gap-2 truncate">
                        <span className="truncate">{selectedMember.name}</span>
                        {selectedMember.phone && <span className="text-xs text-muted-foreground">{selectedMember.phone}</span>}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Search and select member…</span>
                    )}
                    <ChevronDown className="h-4 w-4 opacity-60" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <div className="p-2 border-b border-border">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} placeholder="Search by name, phone, email" className="pl-7 h-8" autoFocus />
                    </div>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {filteredMembers.length === 0 ? (
                      <p className="px-3 py-6 text-center text-xs text-muted-foreground">No members found</p>
                    ) : filteredMembers.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => { setBookMember(m.id); setMemberPopoverOpen(false); }}
                        className="flex items-center justify-between w-full px-3 py-2 text-sm text-left hover:bg-muted/50"
                      >
                        <div className="flex flex-col min-w-0">
                          <span className="truncate">{m.name}</span>
                          <span className="text-[11px] text-muted-foreground truncate">{m.phone || m.email || "—"}</span>
                        </div>
                        {bookMember === m.id && <Check className="h-3.5 w-3.5 text-primary" />}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Service (from outlet) */}
            <div className="space-y-2">
              <Label>Service *</Label>
              <Select value={bookServiceId} onValueChange={(v) => { setBookServiceId(v); setBookInstructor(""); }}>
                <SelectTrigger>
                  <SelectValue placeholder={outletServices.length === 0 ? "No services for this outlet" : "Select service"} />
                </SelectTrigger>
                <SelectContent>
                  {outletServices.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} — {s.type} • {s.duration || 0}min{s.price ? ` • NPR ${s.price}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {outletServices.length === 0 && (
                <p className="text-[11px] text-muted-foreground">Add services for this outlet in Plans & Services → Services.</p>
              )}
            </div>

            {selectedService && (
              <div className="rounded-lg border border-border bg-muted/30 p-3 grid grid-cols-3 gap-2 text-sm">
                <div><span className="text-muted-foreground text-xs block">Duration</span><span className="font-medium">{selectedService.duration || 0} min</span></div>
                <div><span className="text-muted-foreground text-xs block">Rate</span><span className="font-medium">NPR {selectedService.price || 0}</span></div>
                <div><span className="text-muted-foreground text-xs block">Default Instructor</span><span className="font-medium">{selectedService.instructor || "—"}</span></div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input type="date" value={bookDate} onChange={(e) => setBookDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Time Slot *</Label>
                <Select value={bookTimeSlot} onValueChange={setBookTimeSlot}>
                  <SelectTrigger><SelectValue placeholder="Select slot" /></SelectTrigger>
                  <SelectContent>
                    {setupTimeSlots.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Instructor</Label>
                <Select value={bookInstructor} onValueChange={setBookInstructor}>
                  <SelectTrigger><SelectValue placeholder="Default" /></SelectTrigger>
                  <SelectContent>
                    {setupInstructors.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button onClick={handleBook} disabled={addBookingMutation.isPending} className="w-full gradient-gold text-primary-foreground">
              {addBookingMutation.isPending ? "Creating..." : "Create Booking"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>



      <BookingDetailModal booking={selectedBooking} open={detailOpen} onOpenChange={setDetailOpen} />

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      ) : view === "calendar" ? (
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}><ChevronLeft className="h-4 w-4" /></Button>
            <h2 className="text-lg font-semibold font-display">{format(currentMonth, "MMMM yyyy")}</h2>
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <div className="grid grid-cols-7 gap-px mb-1">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px">
            {days.map((day) => {
              const dayBookings = getBookingsForDay(day);
              const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
              return (
                <Tooltip key={day.toISOString()}>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        "min-h-[80px] lg:min-h-[100px] rounded-lg p-1.5 text-sm transition-colors cursor-pointer hover:ring-1 hover:ring-primary/50",
                        isCurrentMonth ? "bg-card" : "bg-muted/20",
                        isToday(day) && "ring-1 ring-primary",
                      )}
                      onClick={() => handleDayClick(day)}
                      onDoubleClick={() => handleDayDoubleClick(day)}
                    >
                      <span className={cn("text-xs", !isCurrentMonth && "text-muted-foreground/40", isToday(day) && "font-bold text-primary")}>
                        {format(day, "d")}
                      </span>
                      <div className="mt-1 space-y-0.5">
                        {dayBookings.slice(0, 2).map((b) => (
                          <div
                            key={b.id}
                            className="text-[10px] truncate rounded px-1 py-0.5 cursor-pointer"
                            style={getServiceStyle(b.service)}
                            onClick={(e) => { e.stopPropagation(); handleBookingClick(b); }}
                          >
                            {b.className}
                          </div>
                        ))}
                        {dayBookings.length > 2 && <span className="text-[10px] text-muted-foreground">+{dayBookings.length - 2} more</span>}
                      </div>
                    </div>
                  </TooltipTrigger>
                  {dayBookings.length > 0 && (
                    <TooltipContent side="right" className="max-w-[220px]">
                      <p className="font-semibold text-xs mb-1">{format(day, "MMM d, yyyy")}</p>
                      {dayBookings.map((b) => (
                        <p key={b.id} className="text-xs">
                          {b.startTime} — {b.className} ({b.service})
                        </p>
                      ))}
                    </TooltipContent>
                  )}
                </Tooltip>
              );
            })}
          </div>
          <div className="flex gap-4 mt-4 pt-4 border-t border-border">
            {outletServiceTypes.map((s) => (
              <div key={s} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: serviceColors[s] || colorOptions[0].value }} />{s}
              </div>
            ))}
          </div>
        </div>
      ) : (
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
              {filtered.map((b) => (
                <TableRow key={b.id} className="cursor-pointer" onClick={() => handleBookingClick(b)}>
                  <TableCell className="text-sm">{b.date}</TableCell>
                  <TableCell className="text-sm font-medium">{b.memberName}</TableCell>
                  <TableCell className="text-sm">{b.className}</TableCell>
                  <TableCell><Badge variant="secondary" className="text-[10px]">{b.service}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{b.startTime}–{b.endTime}</TableCell>
                  <TableCell>
                    <Badge variant={b.status === "Confirmed" ? "default" : b.status === "Pending" ? "secondary" : b.status === "Completed" ? "default" : "destructive"} className={`text-[10px] ${b.status === "Completed" ? "bg-success/20 text-success border-0" : ""}`}>
                      {b.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default Bookings_Page;
