import { useState, useMemo, useEffect } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, isToday, addHours } from "date-fns";
import { ChevronLeft, ChevronRight, Plus, List, CalendarDays as CalIcon, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BookingDetailModal } from "@/components/BookingDetailModal";
import { useBookings, useAddBooking, useMembers, useServices, useCompanySettings } from "@/hooks/use-firestore";
import type { Booking, ServiceType } from "@/lib/mock-data";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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

function getNowTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function getEndTime(): string {
  const end = addHours(new Date(), 1);
  return `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`;
}

function parseSetup(settings: Record<string, string>, key: string, fallback: string[]): string[] {
  try { return settings[key] ? JSON.parse(settings[key]) : fallback; } catch { return fallback; }
}

const Bookings_Page = () => {
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
  const [bookService, setBookService] = useState<ServiceType>("Gym");
  const [bookClass, setBookClass] = useState("");
  const [bookTime, setBookTime] = useState("");
  const [bookEndTime, setBookEndTime] = useState("");

  const { data: bookings = [], isLoading } = useBookings();
  const { data: members = [] } = useMembers();
  const { data: services = [] } = useServices();
  const { data: settings = {} } = useCompanySettings();
  const addBookingMutation = useAddBooking();

  const setupServiceTypes = parseSetup(settings, "setup_serviceTypes", ["Gym", "Spa", "Sauna", "Swimming"]);
  const setupClasses = parseSetup(settings, "setup_classes", []);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const filtered = useMemo(() => {
    if (serviceFilter === "all") return bookings;
    return bookings.filter((b) => b.service === serviceFilter);
  }, [bookings, serviceFilter]);

  const getBookingsForDay = (day: Date) => filtered.filter((b) => isSameDay(new Date(b.date), day));

  const openNewBookingDialog = (day?: Date) => {
    const d = day || new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (d < today) {
      toast.error("Cannot add bookings for past dates");
      return;
    }
    setBookDate(format(d, "yyyy-MM-dd"));
    setBookTime(getNowTime());
    setBookEndTime(getEndTime());
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

  const handleBook = async () => {
    if (!bookMember || !bookClass || !bookDate || !bookTime) {
      toast.error("Please fill in all required fields");
      return;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (new Date(bookDate) < today) {
      toast.error("Cannot create bookings for past dates");
      return;
    }
    const memberObj = members.find((m) => m.id === bookMember);
    try {
      await addBookingMutation.mutateAsync({
        memberId: bookMember,
        memberName: memberObj?.name || "",
        service: bookService,
        className: bookClass,
        date: bookDate,
        startTime: bookTime,
        endTime: bookEndTime || bookTime,
        status: "Pending",
      });
      toast.success("Booking created successfully!");
      setDialogOpen(false);
      setBookMember("");
      setBookClass("");
      setBookTime("");
      setBookEndTime("");
    } catch {
      toast.error("Failed to create booking");
    }
  };

  const getServiceStyle = (service: string) => {
    const color = serviceColors[service];
    return { backgroundColor: color, color: "#fff" };
  };

  // Merge classes from services collection and setup
  const classOptions = useMemo(() => {
    const fromServices = services.filter((s) => s.type === bookService).map((s) => s.name);
    const fromSetup = setupClasses;
    const merged = Array.from(new Set([...fromServices, ...fromSetup]));
    return merged.length > 0 ? merged : ["General Session"];
  }, [services, bookService, setupClasses]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display">Bookings</h1>
          <p className="text-muted-foreground text-sm">{filtered.length} bookings</p>
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
              {setupServiceTypes.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>

          <Popover open={colorSettingsOpen} onOpenChange={setColorSettingsOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon"><Settings className="h-4 w-4" /></Button>
            </PopoverTrigger>
            <PopoverContent className="w-64" align="end">
              <p className="font-semibold text-sm mb-3">Calendar Colors</p>
              {setupServiceTypes.map((svc) => (
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
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">New Booking</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Member</Label>
              <Select value={bookMember} onValueChange={setBookMember}>
                <SelectTrigger><SelectValue placeholder="Select member" /></SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Service</Label>
              <Select value={bookService} onValueChange={(v) => { setBookService(v as ServiceType); setBookClass(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {setupServiceTypes.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Class / Session</Label>
              <Select value={bookClass} onValueChange={setBookClass}>
                <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>
                  {classOptions.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2"><Label>Date</Label><Input type="date" value={bookDate} onChange={(e) => setBookDate(e.target.value)} /></div>
              <div className="space-y-2"><Label>Start</Label><Input type="time" value={bookTime} onChange={(e) => setBookTime(e.target.value)} /></div>
              <div className="space-y-2"><Label>End</Label><Input type="time" value={bookEndTime} onChange={(e) => setBookEndTime(e.target.value)} /></div>
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
            {setupServiceTypes.map((s) => (
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
