import { useMemo, useState, useEffect } from "react";
import { CalendarDays, TrendingUp, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useBookings } from "@/hooks/use-firestore";
import { format, parseISO, addDays } from "date-fns";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
// Fix 1: Import centralized time manager
import { getSystemTodayStr } from "@/lib/timeUtils";

const Forecast = () => {
  const { data: bookings = [], isLoading } = useBookings();

  // Fix 1 Continued: Establish root system date tracking
  const todayStr = getSystemTodayStr();
  const defaultEndStr = format(addDays(parseISO(todayStr), 30), "yyyy-MM-dd");

  const [dateFrom, setDateFrom] = useState(todayStr);
  const [dateTo, setDateTo] = useState(defaultEndStr);

  const forecastData = useMemo(() => {
    const upcoming = bookings
      .filter((b) => {
        try {
          if (!b.date) return false;

          // Fix 2 & 3: Direct string matching for date values + case-insensitive status fallbacks
          const isWithinRange = b.date >= dateFrom && b.date <= dateTo;
          const normalizedStatus = String(b.bookingStatus || b.status || "")
            .toLowerCase()
            .trim();

          return isWithinRange && normalizedStatus !== "cancelled";
        } catch {
          return false;
        }
      })
      .sort(
        (a, b) =>
          (a.date || "").localeCompare(b.date || "") ||
          (a.startTime || "").localeCompare(b.startTime || ""),
      );

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
        isToday: date === todayStr, // Fix 2 Continued: Reliable timezone-safe comparison
        bookings: items,
        totalBookings: items.length,
        services: [...new Set(items.map((i) => i.service).filter(Boolean))],
      }));
  }, [bookings, dateFrom, dateTo, todayStr]);

  const totalUpcoming = forecastData.reduce((s, d) => s + d.totalBookings, 0);

  const PAGE_SIZE = 10;
  const [page, setPage] = useState(1);
  useEffect(() => {
    setPage(1);
  }, [dateFrom, dateTo]);
  const totalPages = Math.max(1, Math.ceil(forecastData.length / PAGE_SIZE));
  const pagedForecast = forecastData.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display">Booking Forecast</h1>
          <p className="text-muted-foreground text-sm">
            {dateFrom} → {dateTo} • {totalUpcoming} bookings
          </p>
        </div>
        <DateRangeFilter
          from={dateFrom}
          to={dateTo}
          onChange={({ from, to }) => {
            setDateFrom(from);
            setDateTo(to);
          }}
        />
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
            <p className="text-xl font-bold font-display">
              {forecastData.length}
            </p>
          </div>
        </div>
        <div className="glass-card rounded-xl p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-warning/20 flex items-center justify-center">
            <Clock className="h-5 w-5 text-warning" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Avg. per Day</p>
            <p className="text-xl font-bold font-display">
              {forecastData.length > 0
                ? Math.round(totalUpcoming / forecastData.length)
                : 0}
            </p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : forecastData.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center">
          <CalendarDays className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">No bookings in selected range</p>
        </div>
      ) : (
        <>
          {pagedForecast.map((day) => (
            <div
              key={day.date}
              className="glass-card rounded-xl overflow-hidden"
            >
              <div
                className={`px-5 py-3 border-b border-border flex items-center gap-3 ${day.isToday ? "bg-primary/10" : ""}`}
              >
                <CalendarDays
                  className={`h-4 w-4 ${day.isToday ? "text-primary" : "text-muted-foreground"}`}
                />
                <span className="font-semibold text-sm font-display">
                  {day.dateFormatted}
                </span>
                {day.isToday && (
                  <Badge className="text-[10px] bg-primary/20 text-primary border-0">
                    Today
                  </Badge>
                )}
                <Badge variant="outline" className="ml-auto text-[10px]">
                  {day.totalBookings} booking(s)
                </Badge>
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
                  {day.bookings.map((b) => {
                    // Fix 4: Case-insensitive layout and coloring evaluation
                    const displayStatus =
                      b.status === "voided" || b.status === "cancelled"
                        ? "Cancelled"
                        : b.bookingStatus || b.status || "Unknown";
                    const normalizedStatus = String(displayStatus)
                      .toLowerCase()
                      .trim();
                    const badgeVariant =
                      normalizedStatus === "confirmed"
                        ? "default"
                        : normalizedStatus === "waitlisted"
                          ? "secondary"
                          : "destructive";

                    return (
                      <TableRow key={b.id}>
                        <TableCell className="font-medium text-sm">
                          {b.memberName || "Guest"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {b.className || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[10px]">
                            {b.service}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {b.startTime || "--:--"} – {b.endTime || "--:--"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={badgeVariant}
                            className="text-[10px] capitalize"
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
          ))}
          {totalPages > 1 && (
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setPage((p) => Math.max(1, p - 1));
                    }}
                  />
                </PaginationItem>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(
                    (p) =>
                      Math.abs(p - page) < 3 || p === 1 || p === totalPages,
                  )
                  .map((p) => (
                    <PaginationItem key={p}>
                      <PaginationLink
                        href="#"
                        isActive={p === page}
                        onClick={(e) => {
                          e.preventDefault();
                          setPage(p);
                        }}
                      >
                        {p}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setPage((p) => Math.min(totalPages, p + 1));
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </>
      )}
    </div>
  );
};

export default Forecast;
