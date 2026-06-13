import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNPR } from "@/lib/mock-data";
import {
  useMembers,
  useTransactions,
  useBookings,
  useCompanySettings,
} from "@/hooks/use-firestore";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts";
import { toast } from "sonner";
import { useMemo, lazy, Suspense, useState } from "react";
import { format, parseISO, startOfMonth, isValid } from "date-fns";
import { PremiumReportFrame } from "@/components/PremiumReportFrame";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { capitalizeFirstLetter } from "@/lib/string-case-change";
import { useOutlet } from "@/contexts/OutletContext";
import { formatInTz, toIsoDayInTz } from "@/lib/tz";

const LedgerReport = lazy(() => import("@/components/LedgerReport"));

const tooltipStyle = {
  background: "hsl(45, 100%, 97%)", // soft warm ivory
  border: "1px solid hsl(45, 80%, 85%)", // subtle golden border
  borderRadius: 8,
  color: "hsl(220, 25%, 20%)", // deep slate text for contrast
  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)", // premium soft shadow
  padding: "8px 12px",
};

const Reports = () => {
  const { outlets, selected: activeOutlet } = useOutlet();
  const { data: members = [] } = useMembers({ outletId: activeOutlet?.id });
  const { data: transactions = [] } = useTransactions({ outletId: activeOutlet?.id });
  const { data: bookings = [] } = useBookings({ outletId: activeOutlet?.id });
  const { data: settings = {} } = useCompanySettings();
  const [showCashierDetails, setShowCashierDetails] = useState(false);

  const activeMembers = members.filter((m) => m.status === "Active").length;
  const totalRevenue = transactions.reduce(
    (sum, t) => sum + ((t as any).voided ? 0 : t.total),
    0,
  );

  // Lazy-load: each sub-tab renders an empty placeholder with a "Load Report" button
  // until the user clicks it. This keeps the page fast and avoids heavy upfront work.
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});
  const loadTab = (k: string) => setLoaded((p) => ({ ...p, [k]: true }));
  const LoadGate = ({
    k,
    children,
  }: {
    k: string;
    children: React.ReactNode;
  }) =>
    loaded[k] ? (
      <>{children}</>
    ) : (
      <div className="glass-card rounded-xl p-10 text-center space-y-3">
        <p className="text-sm text-muted-foreground">
          Click <strong>Load Report</strong> to fetch and render this report.
        </p>
        <Button
          onClick={() => loadTab(k)}
          className="gradient-gold text-primary-foreground"
        >
          <Download className="h-4 w-4 mr-1.5" />
          Load Report
        </Button>
      </div>
    );

  // ── Daily Sales / Collection / Contribution shared filters ──
  const today = format(new Date(), "yyyy-MM-dd");
  const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [includeVoided, setIncludeVoided] = useState<"exclude" | "include">(
    "exclude",
  );

  const txInRange = useMemo(() => {
    return transactions.filter((t) => {
      if (!t.date) return false;
      const d = t.date;
      if (d < from || d > to) return false;
      if (includeVoided === "exclude" && (t as any).voided) return false;
      return true;
    });
  }, [transactions, from, to, includeVoided]);

  // // console.log("Transactions in range:", txInRange);

  // ── 1. Daily Sales Report (grouped by date → department/service) ──
  const dailySalesRows = useMemo(() => {
    const acc: Record<
      string,
      {
        date: string;
        department: string;
        sales: number;
        vat: number;
        total: number;
      }
    > = {};
    txInRange.forEach((t) => {
      const department =
        t.serviceType || (t.type === "Charge" ? "Misc Charges" : "Membership");
      const key = `${t.date}::${department}`;
      if (!acc[key])
        acc[key] = { date: t.date, department, sales: 0, vat: 0, total: 0 };
      const sign = (t as any).voided ? -1 : 1;
      acc[key].sales += sign * (t.amount || 0);
      acc[key].vat += sign * (t.vat || 0);
      acc[key].total += sign * (t.total || 0);
    });
    return Object.values(acc).sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.department.localeCompare(b.department),
    );
  }, [txInRange]);

  const dailySalesTotals = useMemo(() => {
    return dailySalesRows.reduce(
      (a, r) => ({
        sales: a.sales + r.sales,
        vat: a.vat + r.vat,
        total: a.total + r.total,
      }),
      { sales: 0, vat: 0, total: 0 },
    );
  }, [dailySalesRows]);

  // ── 2. Cashier / Collection Report (by date → method) ──
  const collectionRows = useMemo(() => {
    const acc: Record<
      string,
      {
        date: string;
        method: string;
        count: number;
        collected: number;
        receiptNo?: string;
        memberName?: string;
        description?: string;
        voided?: boolean;
        voidReason?: string;
        rowClass?: string;
        status?: string;
      }
    > = {};
    txInRange
      .filter((t) => t.status !== "pending" && t.status !== "unpaid")
      .forEach((t) => {
        const key = `${t.date}::${t.method}::${t.receiptNo}`;
        if (!acc[key])
          ((acc[key] = {
            date: t.date,
            method: capitalizeFirstLetter(t.method),
            count: 0,
            collected: 0,
            receiptNo: t.receiptNo,
            memberName: capitalizeFirstLetter(t.memberName),
            voided: (t as any).voided === true,
            rowClass: (t as any).voided ? "line-through text-red-500/80" : "",
            description: t.description,
            status:
              t.status === "paid"
                ? "Settled"
                : capitalizeFirstLetter(t.status || ""),
          }),
            (acc[key].count += 1));
        acc[key].collected += ((t as any).voided ? -1 : 1) * (t.total || 0);
      });
    return Object.values(acc).sort(
      (a, b) =>
        a.date.localeCompare(b.date) || a.method.localeCompare(b.method),
    );
  }, [txInRange]);

  const collectionTotals = useMemo(() => {
    return collectionRows.reduce(
      (a, r) => ({
        count: a.count + r.count,
        collected: a.collected + r.collected,
      }),
      {
        count: 0,
        collected: 0,
      },
    );
  }, [collectionRows]);

  // ── 3. Sales Contribution (by member → revenue + %) ──
  const contributionRows = useMemo(() => {
    const acc: Record<
      string,
      {
        member: string;
        txns: number;
        sales: number;
        vat: number;
        total: number;
      }
    > = {};
    txInRange.forEach((t) => {
      const k = t.memberName || "—";
      if (!acc[k]) acc[k] = { member: k, txns: 0, sales: 0, vat: 0, total: 0 };
      acc[k].txns += 1;
      const sign = (t as any).voided ? -1 : 1;
      acc[k].sales += sign * (t.amount || 0);
      acc[k].vat += sign * (t.vat || 0);
      acc[k].total += sign * (t.total || 0);
    });
    const grand = Object.values(acc).reduce((s, r) => s + r.total, 0) || 1;
    return Object.values(acc)
      .map((r) => ({ ...r, share: (r.total / grand) * 100 }))
      .sort((a, b) => b.total - a.total);
  }, [txInRange]);

  const contributionTotals = useMemo(() => {
    return contributionRows.reduce(
      (a, r) => ({ txns: a.txns + r.txns, total: a.total + r.total }),
      {
        txns: 0,
        total: 0,
      },
    );
  }, [contributionRows]);

  // ── Revenue by Outlet (replaces "Revenue by Service") ──
  const { outlets } = useOutlet();
  const outletNameById = useMemo(() => {
    const m = new Map<string, string>();
    outlets.forEach((o) => m.set(o.id, o.name));
    return m;
  }, [outlets]);

  const revenueByOutlet = useMemo(() => {
    const acc: Record<
      string,
      { outletId: string; outlet: string; revenue: number; txns: number }
    > = {};
    transactions.forEach((t) => {
      if ((t as any).voided) return;
      const id =
        (t as any).outletId || (t as any).outlet_id || "__unassigned__";
      const name =
        outletNameById.get(id) ||
        (id === "__unassigned__" ? "Unassigned" : `Outlet (${id})`);
      if (!acc[id])
        acc[id] = { outletId: id, outlet: name, revenue: 0, txns: 0 };
      acc[id].revenue += t.total || 0;
      acc[id].txns += 1;
    });
    return Object.values(acc).sort((a, b) => b.revenue - a.revenue);
  }, [transactions, outletNameById]);

  // console.log("Revenue by Outlet:", revenueByOutlet);
  // console.log(outletNameById);

  const outletPalette = [
    "hsl(38,92%,50%)",
    "hsl(280,60%,55%)",
    "hsl(200,80%,50%)",
    "hsl(142,71%,45%)",
    "hsl(15,80%,55%)",
    "hsl(220,10%,55%)",
  ];

  const memberGrowth = useMemo(() => {
    const monthMap: Record<string, { newMembers: number; total: number }> = {};
    const sorted = [...members].sort((a, b) =>
      a.joinDate.localeCompare(b.joinDate),
    );
    sorted.forEach((m, i) => {
      const month = m.joinDate
        ? new Date(m.joinDate).toLocaleString("en", { month: "short" })
        : "Unknown";
      if (!monthMap[month]) monthMap[month] = { newMembers: 0, total: 0 };
      monthMap[month].newMembers++;
      monthMap[month].total = i + 1;
    });
    return Object.entries(monthMap).map(([month, data]) => ({
      month,
      ...data,
    }));
  }, [members]);

  const paymentMethodsData = useMemo(() => {
    const counts: Record<string, number> = {};
    transactions.forEach((t) => {
      counts[t.method] = (counts[t.method] || 0) + 1;
    });
    const total = transactions.length || 1;
    const fills: Record<string, string> = {
      cash: "hsl(38, 92%, 50%)",
      card: "hsl(200, 80%, 50%)",
      esewa: "hsl(142, 71%, 45%)",
      bank_transfer: "hsl(220, 10%, 55%)",
      mobile_wallet: "hsl(280, 60%, 55%)",
    };
    return Object.entries(counts).map(([name, count]) => ({
      name,
      value: Math.round((count / total) * 100),
      fill: fills[name] || "hsl(220, 10%, 55%)",
    }));
  }, [transactions]);

  const filters = (
    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
      <div className="space-y-1.5">
        <Label className="text-xs">From Date</Label>
        <Input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">To Date</Label>
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Voided Transactions</Label>
        <Select
          value={includeVoided}
          onValueChange={(v) => setIncludeVoided(v as any)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="exclude">Exclude Voided</SelectItem>
            <SelectItem value="include">Include Voided</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">&nbsp;</Label>
        <div className="text-xs text-muted-foreground py-2">
          {txInRange.length} transactions in range
        </div>
      </div>
    </div>
  );

  const filterSummary = (
    <>
      Range: <b>{from}</b> → <b>{to}</b> · Voided: <b>{includeVoided}</b>
    </>
  );

  const propertyName = settings.companyName || ".............";

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl mb-4 font-bold font-display">Reports</h1>
          {/* <p className="text-muted-foreground text-sm">
            Financial analytics from live data
          </p> */}
        </div>
        {/* <Button
          variant="outline"
          size="sm"
          onClick={() => {
            import("@/lib/print-utils").then(({ exportTableToCSV }) => {
              const dateRange = format(new Date(), "PPP");
              const headers = ["Member", "Status", "Tier", "Total Paid", "Due"];
              const rows = members.map((m) => [m.name, m.status, m.tier, String(m.totalPaid), String(m.dueAmount)]);
              exportTableToCSV(headers, rows, `members-report-${format(new Date(), "yyyyMMdd")}.csv`, {
                propertyName,
                reportTitle: "Members Report",
                dateRange,
                filters: { "Total Members": String(members.length), "Active Members": String(activeMembers) },
              });
              toast.success("Members report exported");
            });
          }}
        >
          <Download className="h-4 w-4 mr-1" />
          Export Members
        </Button> */}
      </div>

      <Tabs
        defaultValue="daily"
        className="space-y-4"
        onValueChange={(v) => setLoaded((p) => ({ ...p, [v]: p[v] }))}
      >
        <TabsList className="bg-muted/50 flex-wrap h-auto">
          <TabsTrigger value="daily">Daily Sales</TabsTrigger>
          <TabsTrigger value="collection">Cashier / Collection</TabsTrigger>
          <TabsTrigger value="contribution">Sales Contribution</TabsTrigger>
          <TabsTrigger value="ledger">Member Ledger</TabsTrigger>
          <TabsTrigger value="revenue">Revenue by Outlet</TabsTrigger>
          <TabsTrigger value="growth">Member Growth</TabsTrigger>
          <TabsTrigger value="payments">Payment Methods</TabsTrigger>
        </TabsList>

        <TabsContent value="daily">
          <LoadGate k="daily">
            <PremiumReportFrame
              title="Daily Sales Report"
              subtitle="Sales by date and department"
              propertyName={propertyName}
              filters={filters}
              filterSummary={filterSummary}
              exportFilename={`daily-sales-${from}_to_${to}.csv`}
              exportMeta={{
                dateRange: `${from} → ${to}`,
                filters: { Voided: includeVoided },
              }}
              groupBy={{ key: "date", label: "Date" }}
              columns={[
                { key: "department", label: "Department" },
                {
                  key: "sales",
                  label: "Sales (Net)",
                  align: "right",
                  format: (r) => formatNPR(r.sales),
                  exportFormat: (r) => String(r.sales),
                },
                {
                  key: "vat",
                  label: "VAT Payable",
                  align: "right",
                  format: (r) => formatNPR(r.vat),
                  exportFormat: (r) => String(r.vat),
                },
                {
                  key: "total",
                  label: "Total Sales",
                  align: "right",
                  format: (r) => formatNPR(r.total),
                  exportFormat: (r) => String(r.total),
                },
              ]}
              rows={dailySalesRows}
              footerTotals={{
                label: "Grand Total",
                cells: {
                  sales: formatNPR(dailySalesTotals.sales),
                  vat: formatNPR(dailySalesTotals.vat),
                  total: formatNPR(dailySalesTotals.total),
                },
              }}
            />
          </LoadGate>
        </TabsContent>

        <TabsContent value="collection">
          <LoadGate k="collection">
            <PremiumReportFrame
              title="Cashier / Collection Report"
              subtitle="Settled payments grouped by date and method"
              propertyName={propertyName}
              filters={filters}
              filterSummary={filterSummary}
              exportFilename={`collection-${from}_to_${to}.csv`}
              exportMeta={{ dateRange: `${from} → ${to}` }}
              groupBy={{ key: "date", label: "Date" }}
              columns={[
                { key: "receiptNo", label: "Receipt No" },
                { key: "memberName", label: "Member Name" },
                { key: "method", label: "Payment Method" },
                {
                  key: "description",
                  label: "Description",
                },
                { key: "status", label: "Status", align: "right" },
                {
                  key: "collected",
                  label: "Collected",
                  align: "right",
                  format: (r) => formatNPR(r.collected),
                  exportFormat: (r) => String(r.collected),
                },
              ]}
              rows={collectionRows}
              footerTotals={{
                label: "Grand Total",
                cells: {
                  count: String(collectionTotals.count),
                  collected: formatNPR(collectionTotals.collected),
                },
              }}
            />
          </LoadGate>
        </TabsContent>

        <TabsContent value="contribution">
          <LoadGate k="contribution">
            <PremiumReportFrame
              title="Sales Contribution"
              subtitle="Revenue per member with contribution share"
              propertyName={propertyName}
              filters={filters}
              filterSummary={filterSummary}
              exportFilename={`contribution-${from}_to_${to}.csv`}
              exportMeta={{ dateRange: `${from} → ${to}` }}
              columns={[
                { key: "member", label: "Member" },
                { key: "txns", label: "Txns", align: "right" },
                {
                  key: "sales",
                  label: "Sales (Net)",
                  align: "right",
                  format: (r) => formatNPR(r.sales),
                  exportFormat: (r) => String(r.sales),
                },
                {
                  key: "vat",
                  label: "VAT",
                  align: "right",
                  format: (r) => formatNPR(r.vat),
                  exportFormat: (r) => String(r.vat),
                },
                {
                  key: "total",
                  label: "Total Revenue",
                  align: "right",
                  format: (r) => formatNPR(r.total),
                  exportFormat: (r) => String(r.total),
                },
                {
                  key: "share",
                  label: "Contribution %",
                  align: "right",
                  format: (r) => `${r.share.toFixed(2)}%`,
                  exportFormat: (r) => r.share.toFixed(2),
                },
              ]}
              rows={contributionRows}
              footerTotals={{
                label: "Grand Total",
                cells: {
                  txns: String(contributionTotals.txns),
                  total: formatNPR(contributionTotals.total),
                  share: "100.00%",
                },
              }}
            />
          </LoadGate>
        </TabsContent>

        <TabsContent value="ledger">
          <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
            <LedgerReport />
          </Suspense>
        </TabsContent>

        {/* Revenue By Outlet Report */}
        <TabsContent value="revenue">
          <LoadGate k="revenue">
            <div className="space-y-4">
              <div className="glass-card rounded-xl p-5">
                <h3 className="font-semibold font-display mb-4">
                  Revenue by Outlet
                </h3>
                {revenueByOutlet.length === 0 ? (
                  <p className="text-center text-muted-foreground py-12">
                    No transaction data yet
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={360}>
                    <BarChart data={revenueByOutlet}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="hsl(224, 15%, 18%)"
                      />
                      <XAxis
                        dataKey="outlet"
                        tick={{ fill: "hsl(220, 10%, 55%)", fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: "hsl(220, 10%, 55%)", fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(v: number) => [formatNPR(v), "Revenue"]}
                      />
                      <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                        {revenueByOutlet.map((_, i) => (
                          <Cell
                            key={i}
                            fill={outletPalette[i % outletPalette.length]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="glass-card rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <th className="text-left px-4 py-2">Outlet</th>
                      <th className="text-right px-4 py-2">Transactions</th>
                      <th className="text-right px-4 py-2">Revenue (NPR)</th>
                      <th className="text-right px-4 py-2">Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {revenueByOutlet.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-4 py-8 text-center text-muted-foreground"
                        >
                          No data
                        </td>
                      </tr>
                    ) : (
                      <>
                        {revenueByOutlet.map((r, i) => {
                          const grand =
                            revenueByOutlet.reduce(
                              (s, x) => s + x.revenue,
                              0,
                            ) || 1;
                          return (
                            <tr
                              key={r.outletId}
                              className="border-t border-border/40"
                            >
                              <td className="px-4 py-2 font-medium flex items-center gap-2">
                                <span
                                  className="h-2.5 w-2.5 rounded-full"
                                  style={{
                                    background:
                                      outletPalette[i % outletPalette.length],
                                  }}
                                />
                                {r.outlet}
                              </td>
                              <td className="px-4 py-2 text-right">{r.txns}</td>
                              <td className="px-4 py-2 text-right font-semibold">
                                {formatNPR(r.revenue)}
                              </td>
                              <td className="px-4 py-2 text-right text-muted-foreground">
                                {((r.revenue / grand) * 100).toFixed(1)}%
                              </td>
                            </tr>
                          );
                        })}
                        <tr className="border-t border-border/60 bg-muted/30 font-bold">
                          <td className="px-4 py-2">Grand Total</td>
                          <td className="px-4 py-2 text-right">
                            {revenueByOutlet.reduce((s, r) => s + r.txns, 0)}
                          </td>
                          <td className="px-4 py-2 text-right">
                            {formatNPR(
                              revenueByOutlet.reduce(
                                (s, r) => s + r.revenue,
                                0,
                              ),
                            )}
                          </td>
                          <td className="px-4 py-2 text-right">100%</td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </LoadGate>
        </TabsContent>

        <TabsContent value="growth">
          <div className="glass-card rounded-xl p-5">
            <h3 className="font-semibold font-display mb-4">Member Growth</h3>
            {memberGrowth.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">
                No member data yet
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={memberGrowth}>
                  <defs>
                    <linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor="hsl(38, 92%, 50%)"
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="95%"
                        stopColor="hsl(38, 92%, 50%)"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(224, 15%, 18%)"
                  />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: "hsl(220, 10%, 55%)", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "hsl(220, 10%, 55%)", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke="hsl(38, 92%, 50%)"
                    strokeWidth={2}
                    fill="url(#growthGrad)"
                    name="Total Members"
                  />
                  <Area
                    type="monotone"
                    dataKey="newMembers"
                    stroke="hsl(142, 71%, 45%)"
                    strokeWidth={2}
                    fill="transparent"
                    name="New Members"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </TabsContent>

        <TabsContent value="payments">
          <div className="glass-card rounded-xl p-5">
            <h3 className="font-semibold font-display mb-4">
              Payment Methods Distribution
            </h3>
            {paymentMethodsData.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">
                No payment data yet
              </p>
            ) : (
              <div className="flex flex-col lg:flex-row items-center justify-center gap-8">
                <ResponsiveContainer width="100%" height={350}>
                  <PieChart>
                    {/* {console.log(paymentMethodsData)} */}
                    <Pie
                      data={paymentMethodsData}
                      innerRadius={80}
                      outerRadius={130}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="none"
                    >
                      {paymentMethodsData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(v: number) => [`${v}%`]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-4 min-w-[180px]">
                  {paymentMethodsData.map((item) => (
                    <div key={item.name} className="flex items-center gap-3">
                      <span
                        className="h-3 w-3 rounded-full shrink-0"
                        style={{ background: item.fill }}
                      />
                      <span className="text-sm text-muted-foreground">
                        {capitalizeFirstLetter(item.name)}
                      </span>
                      <span className="ml-auto font-bold text-sm">
                        {item.value}%
                      </span>
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
