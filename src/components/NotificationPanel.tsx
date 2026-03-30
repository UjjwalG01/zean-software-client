import { Bell, CalendarDays, UserPlus, AlertTriangle, CheckCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useBookings, useMembers } from "@/hooks/use-firestore";
import { useMemo } from "react";
import { isToday, parseISO, differenceInDays } from "date-fns";
import { useNavigate } from "react-router-dom";

interface Notification {
  id: string;
  type: "booking" | "new_member" | "expiring" | "expired";
  title: string;
  message: string;
  icon: typeof Bell;
  color: string;
  route?: string;
}

export function NotificationPanel() {
  const { data: bookings = [] } = useBookings();
  const { data: members = [] } = useMembers();
  const navigate = useNavigate();

  const notifications = useMemo<Notification[]>(() => {
    const items: Notification[] = [];
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    // Today's bookings
    const todayBookings = bookings.filter((b) => b.date === todayStr);
    if (todayBookings.length > 0) {
      items.push({
        id: "today-bookings",
        type: "booking",
        title: "Today's Bookings",
        message: `${todayBookings.length} booking(s) scheduled for today`,
        icon: CalendarDays,
        color: "text-primary",
        route: "/bookings",
      });
    }

    // New members (joined in last 7 days)
    const newMembers = members.filter((m) => {
      try {
        return differenceInDays(today, parseISO(m.joinDate)) <= 7 && differenceInDays(today, parseISO(m.joinDate)) >= 0;
      } catch { return false; }
    });
    if (newMembers.length > 0) {
      items.push({
        id: "new-members",
        type: "new_member",
        title: "New Members",
        message: `${newMembers.length} new member(s) joined this week`,
        icon: UserPlus,
        color: "text-success",
        route: "/members",
      });
    }

    // Expiring memberships (within 30 days)
    const expiring = members.filter((m) => {
      try {
        const days = differenceInDays(parseISO(m.expiryDate), today);
        return days >= 0 && days <= 30 && m.status !== "Expired";
      } catch { return false; }
    });
    expiring.forEach((m) => {
      const days = differenceInDays(parseISO(m.expiryDate), today);
      items.push({
        id: `expiring-${m.id}`,
        type: "expiring",
        title: "Membership Expiring",
        message: `${m.name}'s membership expires in ${days} day(s)`,
        icon: AlertTriangle,
        color: days <= 7 ? "text-destructive" : "text-warning",
        route: `/members/${m.id}`,
      });
    });

    // Expired memberships
    const expired = members.filter((m) => m.status === "Expired");
    if (expired.length > 0) {
      items.push({
        id: "expired-members",
        type: "expired",
        title: "Expired Memberships",
        message: `${expired.length} member(s) have expired memberships`,
        icon: AlertTriangle,
        color: "text-destructive",
        route: "/members",
      });
    }

    return items;
  }, [bookings, members]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {notifications.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground">
              {notifications.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 border-b border-border">
          <p className="font-semibold text-sm font-display">Notifications</p>
          <p className="text-xs text-muted-foreground">{notifications.length} alert(s)</p>
        </div>
        <ScrollArea className="max-h-[360px]">
          {notifications.length === 0 ? (
            <div className="p-6 text-center">
              <CheckCircle className="h-8 w-8 text-success mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">All clear! No notifications.</p>
            </div>
          ) : (
            <div className="p-1">
              {notifications.map((n, i) => (
                <div key={n.id}>
                  <button
                    className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors text-left"
                    onClick={() => n.route && navigate(n.route)}
                  >
                    <n.icon className={`h-4 w-4 mt-0.5 shrink-0 ${n.color}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{n.title}</p>
                      <p className="text-xs text-muted-foreground">{n.message}</p>
                    </div>
                  </button>
                  {i < notifications.length - 1 && <Separator />}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
