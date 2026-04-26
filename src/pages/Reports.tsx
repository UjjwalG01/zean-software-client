import { TrendingUp, Users, DollarSign, ClipboardList, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatCard } from "@/components/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNPR } from "@/lib/mock-data";
import { useMembers, useTransactions, useBookings, useCompanySettings } from "@/hooks/use-firestore";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
} from "recharts";
import { toast } from "sonner";
import { useMemo, lazy, Suspense } from "react";
import { format } from "date-fns";

// Lazy-load the heavier ledger view so the Reports route stays fast on first paint
const LedgerReport = lazy(() => import("@/components/LedgerReport"));

const tooltipStyle = {
  background: "hsl(224, 20%, 12%)",
  border: "1px solid hsl(224, 15%, 18%)",
  borderRadius: 8,
  color: "hsl(40, 20%, 95%)",
};

const Reports = () => {
  const { data: members = [], isLoading: membersLoading } = useMembers();
  const { data: transactions = [], isLoading: txLoading } = useTransactions();
  const { data: bookings = [] } = useBookings();
  const { data: settings = {} } = useCompanySettings();

  const isLoading = membersLoading || txLoading;
  const activeMembers = members.filter((m) => m.status === "Active").length;
  const totalRevenue = transactions.reduce((sum, t) => sum + t.total, 0);
  const avgRevenue = activeMembers > 0 ? Math.round(totalRevenue / activeMembers) : 0;
  const attendanceRate = members.length > 0 ? Math.round((activeMembers / members.length) * 100) : 0;

  // Build revenue by service from transactions
  const revenueByService = useMemo(() => {
    const monthMap: Record<string, Record<string, number>> = {};
    transactions.forEach((t) => {
      const month = t.date ? new Date(t.date).toLocaleString("en", { month: "short" }) : "Unknown";
      if (!monthMap[month]) monthMap[month] = { Gym: 0, Spa: 0, Sauna: 0, Swimming: 0 };
      // Distribute by description keywords
      const desc = t.description.toLowerCase();
      if (desc.includes("spa")) monthMap[month].Spa += t.total;
      else if (desc.includes("sauna")) monthMap[month].Sauna += t.total;
      else if (desc.includes("swim")) monthMap[month].Swimming += t.total;
      else monthMap[month].Gym += t.total;
    });
    return Object.entries(monthMap).map(([month, data]) => ({ month, ...data }));
  }, [transactions]);

  // Member growth from join dates
  const memberGrowth = useMemo(() => {
    const monthMap: Record<string, { newMembers: number; total: number }> = {};
    const sorted = [...members].sort((a, b) => a.joinDate.localeCompare(b.joinDate));
    sorted.forEach((m, i) => {
      const month = m.joinDate ? new Date(m.joinDate).toLocaleString("en", { month: "short" }) : "Unknown";
      if (!monthMap[month]) monthMap[month] = { newMembers: 0, total: 0 };
      monthMap[month].newMembers++;
      monthMap[month].total = i + 1;
    });
    return Object.entries(monthMap).map(([month, data]) => ({ month, ...data }));
  }, [members]);

  // Payment methods from transactions
  const paymentMethodsData = useMemo(() => {
    const counts: Record<string, number> = {};
    transactions.forEach((t) => {
      counts[t.method] = (counts[t.method] || 0) + 1;
    });
    const total = transactions.length || 1;
    const fills: Record<string, string> = {
      Card: "hsl(38, 92%, 50%)", Cash: "hsl(200, 80%, 50%)", Esewa: "hsl(142, 71%, 45%)",
      "Bank Transfer": "hsl(220, 10%, 55%)", "Mobile Wallet": "hsl(280, 60%, 55%)",
    };
    return Object.entries(counts).map(([name, count]) => ({
      name, value: Math.round((count / total) * 100), fill: fills[name] || "hsl(220, 10%, 55%)",
    }));
  }, [transactions]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display">Reports</h1>
          <p className="text-muted-foreground text-sm">Analytics & financial reports from live data</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => {
          import("@/lib/print-utils").then(({ exportTableToCSV }) => {
            const propertyName = settings.companyName || "VitaFit Club";
            const dateRange = format(new Date(), "PPP");
            const headers = ["Member", "Status", "Tier", "Total Paid", "Due"];
            const rows = members.map((m) => [m.name, m.status, m.tier, String(m.totalPaid), String(m.dueAmount)]);
            exportTableToCSV(headers, rows, `members-report-${format(new Date(), "yyyyMMdd")}.csv`, {
              propertyName, reportTitle: "Members Report", dateRange,
              filters: { "Total Members": String(members.length), "Active Members": String(activeMembers) },
            });
            const txHeaders = ["Receipt", "Date", "Member", "Method", "VAT", "Total"];
            const txRows = transactions.map((t) => [t.receiptNo, t.date, t.memberName, t.method, String(t.vat), String(t.total)]);
            exportTableToCSV(txHeaders, txRows, `transactions-report-${format(new Date(), "yyyyMMdd")}.csv`, {
              propertyName, reportTitle: "Transactions Report", dateRange,
              filters: { "Total Transactions": String(transactions.length), "Total Revenue (NPR)": String(totalRevenue) },
            });
            toast.success("Reports exported as CSV!");
          });
        }}>
          <Download className="h-4 w-4 mr-1" />Export All
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
        ) : (
          <>
            <StatCard title="Total Revenue" value={formatNPR(totalRevenue)} change={0} icon={TrendingUp} />
            <StatCard title="Active Members" value={activeMembers.toLocaleString()} change={0} icon={Users} />
            <StatCard title="Avg. Revenue/Member" value={formatNPR(avgRevenue)} change={0} icon={DollarSign} />
            <StatCard title="Active Rate" value={`${attendanceRate}%`} change={0} icon={ClipboardList} />
          </>
        )}
      </div>

      <Tabs defaultValue="revenue" className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="revenue">Revenue by Service</TabsTrigger>
          <TabsTrigger value="growth">Member Growth</TabsTrigger>
          <TabsTrigger value="payments">Payment Methods</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue">
          <div className="glass-card rounded-xl p-5">
            <h3 className="font-semibold font-display mb-4">Revenue by Service (from Transactions)</h3>
            {revenueByService.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">No transaction data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={revenueByService}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(224, 15%, 18%)" />
                  <XAxis dataKey="month" tick={{ fill: "hsl(220, 10%, 55%)", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "hsl(220, 10%, 55%)", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [formatNPR(v)]} />
                  <Bar dataKey="Gym" fill="hsl(38, 92%, 50%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Spa" fill="hsl(45, 93%, 65%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Sauna" fill="hsl(220, 10%, 55%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Swimming" fill="hsl(200, 80%, 50%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </TabsContent>

        <TabsContent value="growth">
          <div className="glass-card rounded-xl p-5">
            <h3 className="font-semibold font-display mb-4">Member Growth (from Join Dates)</h3>
            {memberGrowth.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">No member data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={memberGrowth}>
                  <defs>
                    <linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(38, 92%, 50%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(38, 92%, 50%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(224, 15%, 18%)" />
                  <XAxis dataKey="month" tick={{ fill: "hsl(220, 10%, 55%)", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "hsl(220, 10%, 55%)", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="total" stroke="hsl(38, 92%, 50%)" strokeWidth={2} fill="url(#growthGrad)" name="Total Members" />
                  <Area type="monotone" dataKey="newMembers" stroke="hsl(142, 71%, 45%)" strokeWidth={2} fill="transparent" name="New Members" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </TabsContent>

        <TabsContent value="payments">
          <div className="glass-card rounded-xl p-5">
            <h3 className="font-semibold font-display mb-4">Payment Methods Distribution</h3>
            {paymentMethodsData.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">No payment data yet</p>
            ) : (
              <div className="flex flex-col lg:flex-row items-center justify-center gap-8">
                <ResponsiveContainer width="100%" height={350}>
                  <PieChart>
                    <Pie data={paymentMethodsData} innerRadius={80} outerRadius={130} paddingAngle={3} dataKey="value" stroke="none">
                      {paymentMethodsData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v}%`]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-4 min-w-[180px]">
                  {paymentMethodsData.map((item) => (
                    <div key={item.name} className="flex items-center gap-3">
                      <span className="h-3 w-3 rounded-full shrink-0" style={{ background: item.fill }} />
                      <span className="text-sm text-muted-foreground">{item.name}</span>
                      <span className="ml-auto font-bold text-sm">{item.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Reports;
