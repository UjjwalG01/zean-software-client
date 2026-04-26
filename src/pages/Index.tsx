import { Users, DollarSign, CalendarDays, UserCheck, Plus, Activity, Clock } from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { StatCard } from "@/components/StatCard";
import { TierBadge } from "@/components/TierBadge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { formatNPR } from "@/lib/mock-data";
import { useDashboardStats, useMembers, useExpiryAlerts, useTransactions, useBookings } from "@/hooks/use-firestore";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useMemo } from "react";
import { format, isSameDay } from "date-fns";
import { useAuthContext } from "@/contexts/AuthContext";

const Dashboard = () => {
  const navigate = useNavigate();
  const { appUser } = useAuthContext();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: members = [], isLoading: membersLoading } = useMembers();
  const { data: expiryAlerts = [], isLoading: alertsLoading } = useExpiryAlerts();
  const { data: transactions = [] } = useTransactions();
  const { data: bookings = [] } = useBookings();

  const recentMembers = members.slice(0, 5);
  const dashboardStats = stats || { totalMembers: 0, activeMembers: 0, monthlyRevenue: 0, revenueChange: 0, activeBookings: 0, bookingsChange: 0, todayCheckins: 0, checkinsChange: 0 };
  const today = useMemo(() => new Date(), []);

  const todaysBookings = useMemo(
    () => bookings.filter((b) => b.date && isSameDay(new Date(b.date), today)).slice(0, 6),
    [bookings, today]
  );

  // Build revenue data from real transactions
  const revenueData = useMemo(() => {
    const monthMap: Record<string, number> = {};
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    months.forEach((m) => (monthMap[m] = 0));
    transactions.forEach((t) => {
      if (t.date) {
        const month = new Date(t.date).toLocaleString("en", { month: "short" });
        monthMap[month] = (monthMap[month] || 0) + t.total;
      }
    });
    return months.map((month) => ({ month, revenue: monthMap[month] }));
  }, [transactions]);

  // Build service breakdown from member services
  const serviceBreakdown = useMemo(() => {
    const counts: Record<string, number> = { Gym: 0, Spa: 0, Sauna: 0, Swimming: 0 };
    members.forEach((m) => m.services.forEach((s) => (counts[s] = (counts[s] || 0) + 1)));
    const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
    const fills: Record<string, string> = {
      Gym: "hsl(38, 92%, 50%)", Spa: "hsl(280, 60%, 55%)", Sauna: "hsl(15, 80%, 55%)", Swimming: "hsl(200, 80%, 50%)",
    };
    return Object.entries(counts).map(([name, count]) => ({ name, value: Math.round((count / total) * 100), fill: fills[name] }));
  }, [members]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-display">{greeting}, {appUser?.fullName?.split(" ")[0] || "Admin"} 👋</h1>
          <p className="text-muted-foreground text-sm mt-1">{format(today, "EEEE, MMMM d, yyyy")} · Here's what's happening at VitaFit Club today.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate("/attendance")}>
            <Activity className="h-4 w-4 mr-1" /> Check-in
          </Button>
          <Button size="sm" className="gradient-gold text-primary-foreground" onClick={() => navigate("/members/add")}>
            <Plus className="h-4 w-4 mr-1" /> New Member
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
        ) : (
          <>
            <button onClick={() => navigate("/members")} className="text-left transition-transform hover:-translate-y-0.5">
              <StatCard title="Total Members" value={dashboardStats.totalMembers.toString()} change={5.2} icon={Users} />
            </button>
            <button onClick={() => navigate("/transactions")} className="text-left transition-transform hover:-translate-y-0.5">
              <StatCard title="Monthly Revenue" value={formatNPR(dashboardStats.monthlyRevenue)} change={dashboardStats.revenueChange} icon={DollarSign} iconColor="gradient-gold" />
            </button>
            <button onClick={() => navigate("/bookings")} className="text-left transition-transform hover:-translate-y-0.5">
              <StatCard title="Active Bookings" value={dashboardStats.activeBookings.toString()} change={dashboardStats.bookingsChange} icon={CalendarDays} />
            </button>
            <button onClick={() => navigate("/attendance")} className="text-left transition-transform hover:-translate-y-0.5">
              <StatCard title="Today's Check-ins" value={dashboardStats.todayCheckins.toString()} change={dashboardStats.checkinsChange} icon={UserCheck} />
            </button>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-card rounded-xl p-5">
          <h3 className="font-semibold font-display mb-4">Revenue Overview</h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={revenueData}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(38, 92%, 50%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(38, 92%, 50%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} formatter={(v: number) => [formatNPR(v), "Revenue"]} />
              <Area type="monotone" dataKey="revenue" stroke="hsl(38, 92%, 50%)" strokeWidth={2} fill="url(#revenueGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card rounded-xl p-5">
          <h3 className="font-semibold font-display mb-4">Service Breakdown</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={serviceBreakdown} innerRadius={55} outerRadius={80} paddingAngle={4} dataKey="value" stroke="none">
                {serviceBreakdown.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} formatter={(v: number) => [`${v}%`]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {serviceBreakdown.map((s) => (
              <div key={s.name} className="flex items-center gap-2 text-xs">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.fill }} />
                <span className="text-muted-foreground">{s.name}</span>
                <span className="ml-auto font-medium">{s.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Today's Bookings */}
      <div className="glass-card rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            <h3 className="font-semibold font-display">Today's Bookings</h3>
            <Badge variant="secondary" className="text-[10px]">{todaysBookings.length}</Badge>
          </div>
          <Button variant="ghost" size="sm" className="text-primary text-xs" onClick={() => navigate("/bookings")}>View Calendar</Button>
        </div>
        {todaysBookings.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No bookings scheduled for today</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {todaysBookings.map((b) => (
              <div
                key={b.id}
                onClick={() => navigate("/bookings")}
                className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 p-3 cursor-pointer hover:bg-muted/40 transition-colors"
              >
                <div className="h-9 w-9 rounded-lg bg-primary/15 flex items-center justify-center text-primary text-xs font-semibold shrink-0">
                  {b.startTime}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{b.memberName}</p>
                  <p className="text-xs text-muted-foreground truncate">{b.className} · {b.service}</p>
                </div>
                <Badge variant="outline" className="text-[10px] whitespace-nowrap">{b.status}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold font-display">Recent Members</h3>
            <Button variant="ghost" size="sm" className="text-primary text-xs" onClick={() => navigate("/members")}>View All</Button>
          </div>
          {membersLoading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
          ) : (
            <div className="space-y-3">
              {recentMembers.map((m) => (
                <div key={m.id} className="flex items-center gap-3 cursor-pointer hover:bg-muted/30 rounded-lg p-2 -mx-2 transition-colors" onClick={() => navigate(`/members/${m.id}`)}>
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={m.avatar} alt={m.name} />
                    <AvatarFallback>{m.name.split(" ").map((n) => n[0]).join("")}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{m.name}</p>
                    <p className="text-xs text-muted-foreground">{m.services.join(", ")}</p>
                  </div>
                  <TierBadge tier={m.tier} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <h3 className="font-semibold font-display">Expiry Alerts</h3>
            <Badge variant="destructive" className="ml-auto text-[10px]">{expiryAlerts.length}</Badge>
          </div>
          {alertsLoading ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
          ) : expiryAlerts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No upcoming expirations</p>
          ) : (
            <div className="space-y-3">
              {expiryAlerts.map((a) => (
                <div key={a.memberId} className="flex items-center gap-3 rounded-lg border border-warning/20 bg-warning/5 p-3 cursor-pointer" onClick={() => navigate(`/members/${a.memberId}`)}>
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={a.avatar} alt={a.memberName} />
                    <AvatarFallback>{a.memberName.split(" ").map((n) => n[0]).join("")}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{a.memberName}</p>
                    <p className="text-xs text-muted-foreground">Expires {a.expiryDate}</p>
                  </div>
                  <Badge variant="outline" className="text-warning border-warning/30 text-[10px] whitespace-nowrap">
                    {a.daysLeft}d left
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
