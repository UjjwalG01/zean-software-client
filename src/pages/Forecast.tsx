import { useMemo, useState } from "react";
import { CalendarDays, TrendingUp, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useBookings } from "@/hooks/use-firestore";
import { format, parseISO, addDays, isAfter, isBefore, isSameDay } from "date-fns";
import { DateRangeFilter } from "@/components/DateRangeFilter";

const Forecast = () => {
  const { data: bookings = [], isLoading } = useBookings();

  const today = new Date();
  const defaultEnd = addDays(today, 30);
  const [dateFrom, setDateFrom] = useState(format(today, "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(defaultEnd, "yyyy-MM-dd"));

  const forecastData = useMemo(() => {
    const from = dateFrom ? parseISO(dateFrom) : today;
    const to = dateTo ? parseISO(dateTo) : defaultEnd;
    const upcoming = bookings
      .filter((b) => {
        try {
          const d = parseISO(b.date);
          return (isAfter(d, from) || isSameDay(d, from)) && (isBefore(d, to) || isSameDay(d, to)) && b.status !== "Cancelled";
        } catch { return false; }
      })
      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));

    const grouped: Record<string, typeof upcoming> = {};
    upcoming.forEach((b) => {
      if (!grouped[b.date]) grouped[b.date] = [];
      grouped[b.date].push(b);
    });

    return Object.entries(grouped)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, items]) => ({
        date,
        dateFormatted: format(parseISO(date), "EEE, dd MMM yyyy"),
        isToday: isSameDay(parseISO(date), today),
        bookings: items,
        totalBookings: items.length,
        services: [...new Set(items.map((i) => i.service))],
      }));
  }, [bookings, dateFrom, dateTo]);

  const totalUpcoming = forecastData.reduce((s, d) => s + d.totalBookings, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display">Booking Forecast</h1>
          <p className="text-muted-foreground text-sm">{dateFrom} → {dateTo} • {totalUpcoming} bookings</p>
        </div>
        <DateRangeFilter from={dateFrom} to={dateTo} onChange={({ from, to }) => { setDateFrom(from); setDateTo(to); }} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card rounded-xl p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
            <CalendarDays className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total in Range</p>
            <p className="text-xl font-bold font-display">{totalUpcoming}</p>
          </div>
        </div>
        <div className="glass-card rounded-xl p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-success/20 flex items-center justify-center">
            <TrendingUp className="h-5 w-5 text-success" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Days with Bookings</p>
            <p className="text-xl font-bold font-display">{forecastData.length}</p>
          </div>
        </div>
        <div className="glass-card rounded-xl p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-warning/20 flex items-center justify-center">
            <Clock className="h-5 w-5 text-warning" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Avg. per Day</p>
            <p className="text-xl font-bold font-display">{forecastData.length > 0 ? Math.round(totalUpcoming / forecastData.length) : 0}</p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      ) : forecastData.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center">
          <CalendarDays className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">No bookings in selected range</p>
        </div>
      ) : (
        forecastData.map((day) => (
          <div key={day.date} className="glass-card rounded-xl overflow-hidden">
            <div className={`px-5 py-3 border-b border-border flex items-center gap-3 ${day.isToday ? "bg-primary/10" : ""}`}>
              <CalendarDays className={`h-4 w-4 ${day.isToday ? "text-primary" : "text-muted-foreground"}`} />
              <span className="font-semibold text-sm font-display">{day.dateFormatted}</span>
              {day.isToday && <Badge className="text-[10px] bg-primary/20 text-primary border-0">Today</Badge>}
              <Badge variant="outline" className="ml-auto text-[10px]">{day.totalBookings} booking(s)</Badge>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Member</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {day.bookings.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium text-sm">{b.memberName}</TableCell>
                    <TableCell className="text-sm">{b.className}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-[10px]">{b.service}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{b.startTime} – {b.endTime}</TableCell>
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
        ))
      )}
    </div>
  );
};

export default Forecast;
