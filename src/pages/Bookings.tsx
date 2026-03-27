import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, isToday } from "date-fns";
import { ChevronLeft, ChevronRight, Plus, List, CalendarDays as CalIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useBookings, useAddBooking } from "@/hooks/use-firestore";
import type { ServiceType } from "@/lib/mock-data";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const serviceColorMap: Record<ServiceType, string> = {
  Gym: "bg-primary/80 text-primary-foreground",
  Spa: "bg-spa text-white",
  Sauna: "bg-sauna text-white",
  Swimming: "bg-swimming text-white",
};

const serviceDotMap: Record<ServiceType, string> = {
  Gym: "bg-primary",
  Spa: "bg-spa",
  Sauna: "bg-sauna",
  Swimming: "bg-swimming",
};

const Bookings = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date(2026, 2, 1));
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [serviceFilter, setServiceFilter] = useState<string>("all");

  const { data: bookings = [], isLoading } = useBookings();
  const addBookingMutation = useAddBooking();

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

  const handleBook = async () => {
    try {
      await addBookingMutation.mutateAsync({});
      toast.success("Booking created successfully!");
      setDialogOpen(false);
    } catch {
      toast.error("Failed to create booking");
    }
  };

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
              <SelectItem value="Gym">Gym</SelectItem>
              <SelectItem value="Spa">Spa</SelectItem>
              <SelectItem value="Sauna">Sauna</SelectItem>
              <SelectItem value="Swimming">Swimming</SelectItem>
            </SelectContent>
          </Select>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />New Booking</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle className="font-display">New Booking</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2"><Label>Member</Label><Input placeholder="Search member..." /></div>
                <div className="space-y-2">
                  <Label>Service</Label>
                  <Select><SelectTrigger><SelectValue placeholder="Select service" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Gym">Gym Class</SelectItem>
                      <SelectItem value="Spa">Spa Session</SelectItem>
                      <SelectItem value="Sauna">Sauna Slot</SelectItem>
                      <SelectItem value="Swimming">Swimming Lane</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Date</Label><Input type="date" /></div>
                  <div className="space-y-2"><Label>Time</Label><Input type="time" /></div>
                </div>
                <Button onClick={handleBook} disabled={addBookingMutation.isPending} className="w-full gradient-gold text-primary-foreground">
                  {addBookingMutation.isPending ? "Creating..." : "Create Booking"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

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
                <div key={day.toISOString()} className={cn(
                  "min-h-[80px] lg:min-h-[100px] rounded-lg p-1.5 text-sm transition-colors",
                  isCurrentMonth ? "bg-card" : "bg-muted/20",
                  isToday(day) && "ring-1 ring-primary",
                )}>
                  <span className={cn("text-xs", !isCurrentMonth && "text-muted-foreground/40", isToday(day) && "font-bold text-primary")}>
                    {format(day, "d")}
                  </span>
                  <div className="mt-1 space-y-0.5">
                    {dayBookings.slice(0, 2).map((b) => (
                      <div key={b.id} className={cn("text-[10px] truncate rounded px-1 py-0.5", serviceColorMap[b.service])}>
                        {b.className}
                      </div>
                    ))}
                    {dayBookings.length > 2 && <span className="text-[10px] text-muted-foreground">+{dayBookings.length - 2} more</span>}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex gap-4 mt-4 pt-4 border-t border-border">
            {(["Gym", "Spa", "Sauna", "Swimming"] as ServiceType[]).map((s) => (
              <div key={s} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={cn("h-2.5 w-2.5 rounded-full", serviceDotMap[s])} />{s}
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
                <TableRow key={b.id}>
                  <TableCell className="text-sm">{b.date}</TableCell>
                  <TableCell className="text-sm font-medium">{b.memberName}</TableCell>
                  <TableCell className="text-sm">{b.className}</TableCell>
                  <TableCell><Badge variant="secondary" className="text-[10px]">{b.service}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{b.startTime}–{b.endTime}</TableCell>
                  <TableCell>
                    <Badge variant={b.status === "Confirmed" ? "default" : b.status === "Pending" ? "secondary" : "destructive"} className="text-[10px]">
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

export default Bookings;
