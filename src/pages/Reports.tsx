import { TrendingUp, Users, DollarSign, ClipboardList, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatCard } from "@/components/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNPR } from "@/lib/mock-data";
import { useMembers } from "@/hooks/use-firestore";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
} from "recharts";
import { toast } from "sonner";

const revenueByService = [
  { month: "Jan", Gym: 150000, Spa: 45000, Sauna: 25000, Swimming: 35000 },
  { month: "Feb", Gym: 185000, Spa: 55000, Sauna: 30000, Swimming: 40000 },
  { month: "Mar", Gym: 195000, Spa: 60000, Sauna: 28000, Swimming: 45000 },
  { month: "Apr", Gym: 210000, Spa: 65000, Sauna: 32000, Swimming: 50000 },
  { month: "May", Gym: 200000, Spa: 58000, Sauna: 35000, Swimming: 48000 },
  { month: "Jun", Gym: 230000, Spa: 70000, Sauna: 38000, Swimming: 55000 },
];

const memberGrowth = [
  { month: "Jan", newMembers: 18, churned: 3, total: 1180 },
  { month: "Feb", newMembers: 22, churned: 5, total: 1197 },
  { month: "Mar", newMembers: 28, churned: 4, total: 1221 },
  { month: "Apr", newMembers: 15, churned: 2, total: 1234 },
  { month: "May", newMembers: 20, churned: 6, total: 1248 },
  { month: "Jun", newMembers: 25, churned: 3, total: 1270 },
];

const paymentMethodsData = [
  { name: "Card (Stripe)", value: 45, fill: "hsl(38, 92%, 50%)" },
  { name: "eSewa", value: 25, fill: "hsl(142, 71%, 45%)" },
  { name: "Cash", value: 18, fill: "hsl(200, 80%, 50%)" },
  { name: "Bank Transfer", value: 12, fill: "hsl(220, 10%, 55%)" },
];

const tooltipStyle = {
  background: "hsl(224, 20%, 12%)",
  border: "1px solid hsl(224, 15%, 18%)",
  borderRadius: 8,
  color: "hsl(40, 20%, 95%)",
};

const Reports = () => {
  const { data: members = [], isLoading } = useMembers();
  const activeMembers = members.filter((m) => m.status === "Active").length;
  const totalRevenue = 42500000;
  const avgRevenue = activeMembers > 0 ? Math.round(totalRevenue / activeMembers) : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display">Reports</h1>
          <p className="text-muted-foreground text-sm">Analytics & financial reports</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => toast.success("Reports exported successfully!")}>
          <Download className="h-4 w-4 mr-1" />Export All
        </Button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
        ) : (
          <>
            <StatCard title="Total Revenue (YTD)" value={formatNPR(totalRevenue)} change={15} icon={TrendingUp} />
            <StatCard title="Active Members" value={activeMembers.toLocaleString()} change={12} icon={Users} />
            <StatCard title="Avg. Revenue/Member" value={formatNPR(avgRevenue)} change={8} icon={DollarSign} />
            <StatCard title="Attendance Rate" value="78%" change={5} icon={ClipboardList} />
          </>
        )}
      </div>

      {/* Chart Tabs */}
      <Tabs defaultValue="revenue" className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="revenue">Revenue by Service</TabsTrigger>
          <TabsTrigger value="growth">Member Growth</TabsTrigger>
          <TabsTrigger value="payments">Payment Methods</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue">
          <div className="glass-card rounded-xl p-5">
            <h3 className="font-semibold font-display mb-4">Revenue by Service (Monthly)</h3>
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
          </div>
        </TabsContent>

        <TabsContent value="growth">
          <div className="glass-card rounded-xl p-5">
            <h3 className="font-semibold font-display mb-4">Member Growth Trend</h3>
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
          </div>
        </TabsContent>

        <TabsContent value="payments">
          <div className="glass-card rounded-xl p-5">
            <h3 className="font-semibold font-display mb-4">Payment Methods Distribution</h3>
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
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Reports;
