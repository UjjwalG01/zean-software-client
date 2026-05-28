import { useMemo, useState, lazy, Suspense } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatNPR } from "@/lib/mock-data";
import { useMembers, useTransactions, useBookings, useCompanySettings } from "@/hooks/use-firestore";
import { PremiumReportFrame } from "@/components/PremiumReportFrame";
import { format, parseISO } from "date-fns";

const LedgerReport = lazy(() => import("@/components/LedgerReport"));

function inRange(date: string, from: string, to: string) {
  if (!date) return false;
  const d = date.split("T")[0];
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

const Reports = () => {
  const { data: members = [] } = useMembers();
  const { data: transactions = [] } = useTransactions();
  const { data: bookings = [] } = useBookings();
  const { data: settings = {} } = useCompanySettings();
  const propertyName = settings.companyName || "VitaFit Club";

  // Common date filter
  const today = format(new Date(), "yyyy-MM-dd");
  const monthAgo = format(new Date(Date.now() - 30 * 86400000), "yyyy-MM-dd");
  const [fromDate, setFromDate] = useState(monthAgo);
  const [toDate, setToDate] = useState(today);
  const [methodFilter, setMethodFilter] = useState("all");
  const [tierFilter, setTierFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");

  const subtitle = `${propertyName} · ${fromDate} → ${toDate}`;

  // Filtered datasets
  const filteredTx = useMemo(
    () => transactions
      .filter((t) => inRange(t.date, fromDate, toDate))
      .filter((t) => methodFilter === "all" || t.method === methodFilter),
    [transactions, fromDate, toDate, methodFilter]
  );
  const filteredBookings = useMemo(
    () => bookings
      .filter((b) => inRange(b.date, fromDate, toDate))
      .filter((b) => serviceFilter === "all" || b.service === serviceFilter),
    [bookings, fromDate, toDate, serviceFilter]
  );
  const filteredMembers = useMemo(
    () => members
      .filter((m) => tierFilter === "all" || m.tier === tierFilter)
      .filter((m) => statusFilter === "all" || m.status === statusFilter),
    [members, tierFilter, statusFilter]
  );

  const filterCommonDates = (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">From Date</Label>
        <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="bg-background" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">To Date</Label>
        <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="bg-background" />
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold font-display">Reports</h1>
        <p className="text-muted-foreground text-sm">Tabular reports with filters, print &amp; Excel export</p>
      </div>

      <Tabs defaultValue="daily-sales" className="space-y-4">
        <TabsList className="bg-muted/50 flex-wrap h-auto">
          <TabsTrigger value="daily-sales">Daily Sales</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="member-summary">Member Summary</TabsTrigger>
          <TabsTrigger value="bookings">Bookings</TabsTrigger>
          <TabsTrigger value="service-revenue">Service Revenue</TabsTrigger>
          <TabsTrigger value="ledger">Member Ledger</TabsTrigger>
        </TabsList>

        {/* DAILY SALES */}
        <TabsContent value="daily-sales">
          <DailySalesReport
            transactions={filteredTx}
            propertyName={propertyName}
            subtitle={subtitle}
            filters={
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">From Date</Label>
                  <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="bg-background" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">To Date</Label>
                  <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="bg-background" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Payment Method</Label>
                  <Select value={methodFilter} onValueChange={setMethodFilter}>
                    <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Methods</SelectItem>
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="Card">Card</SelectItem>
                      <SelectItem value="Esewa">Esewa</SelectItem>
                      <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                      <SelectItem value="Mobile Wallet">Mobile Wallet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            }
          />
        </TabsContent>

        {/* TRANSACTIONS */}
        <TabsContent value="transactions">
          <TransactionsReport
            transactions={filteredTx}
            propertyName={propertyName}
            subtitle={subtitle}
            filters={
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">From Date</Label>
                  <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="bg-background" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">To Date</Label>
                  <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="bg-background" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Method</Label>
                  <Select value={methodFilter} onValueChange={setMethodFilter}>
                    <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Methods</SelectItem>
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="Card">Card</SelectItem>
                      <SelectItem value="Esewa">Esewa</SelectItem>
                      <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                      <SelectItem value="Mobile Wallet">Mobile Wallet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            }
          />
        </TabsContent>

        {/* MEMBER SUMMARY */}
        <TabsContent value="member-summary">
          <MemberSummaryReport
            members={filteredMembers}
            propertyName={propertyName}
            subtitle={`${propertyName} · ${filteredMembers.length} members`}
            filters={
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Tier</Label>
                  <Select value={tierFilter} onValueChange={setTierFilter}>
                    <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Tiers</SelectItem>
                      <SelectItem value="Basic">Basic</SelectItem>
                      <SelectItem value="Silver">Silver</SelectItem>
                      <SelectItem value="Gold">Gold</SelectItem>
                      <SelectItem value="Platinum">Platinum</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Expiring">Expiring</SelectItem>
                      <SelectItem value="Expired">Expired</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            }
          />
        </TabsContent>

        {/* BOOKINGS */}
        <TabsContent value="bookings">
          <BookingsReport
            bookings={filteredBookings}
            propertyName={propertyName}
            subtitle={subtitle}
            filters={
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">From Date</Label>
                  <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="bg-background" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">To Date</Label>
                  <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="bg-background" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Service</Label>
                  <Select value={serviceFilter} onValueChange={setServiceFilter}>
                    <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Services</SelectItem>
                      <SelectItem value="Gym">Gym</SelectItem>
                      <SelectItem value="Spa">Spa</SelectItem>
                      <SelectItem value="Sauna">Sauna</SelectItem>
                      <SelectItem value="Swimming">Swimming</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            }
          />
        </TabsContent>

        {/* SERVICE REVENUE */}
        <TabsContent value="service-revenue">
          <ServiceRevenueReport
            transactions={filteredTx}
            propertyName={propertyName}
            subtitle={subtitle}
            filters={filterCommonDates}
          />
        </TabsContent>

        {/* LEDGER */}
        <TabsContent value="ledger">
          <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
            <LedgerReport />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
};

// ─── Daily Sales Report ────────────────────────────────────────────
function DailySalesReport({ transactions, propertyName, subtitle, filters }: any) {
  const rows = useMemo(() => {
    const map: Record<string, { date: string; method: string; count: number; net: number; vat: number; total: number }> = {};
    transactions.forEach((t: any) => {
      const k = `${t.date}-${t.method}`;
      if (!map[k]) map[k] = { date: t.date, method: t.method, count: 0, net: 0, vat: 0, total: 0 };
      map[k].count += 1;
      map[k].net += t.amount || 0;
      map[k].vat += t.vat || 0;
      map[k].total += t.total || 0;
    });
    return Object.values(map).sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions]);

  const totals = rows.reduce((s, r) => ({ count: s.count + r.count, net: s.net + r.net, vat: s.vat + r.vat, total: s.total + r.total }), { count: 0, net: 0, vat: 0, total: 0 });

  return (
    <PremiumReportFrame
      title="Daily Sales Report"
      subtitle={subtitle}
      propertyName={propertyName}
      filters={filters}
      exportFilename={`daily-sales-${format(new Date(), "yyyyMMdd")}.csv`}
      columns={[
        { key: "date", label: "Date" },
        { key: "method", label: "Payment Mode" },
        { key: "count", label: "Receipts", align: "right" },
        { key: "net", label: "Net Sales", align: "right", format: (r) => formatNPR(r.net), exportFormat: (r) => String(r.net.toFixed(2)) },
        { key: "vat", label: "VAT (incl.)", align: "right", format: (r) => formatNPR(r.vat), exportFormat: (r) => String(r.vat.toFixed(2)) },
        { key: "total", label: "Total Sales", align: "right", format: (r) => <span className="font-bold">{formatNPR(r.total)}</span>, exportFormat: (r) => String(r.total.toFixed(2)) },
      ]}
      rows={rows}
      groupBy={{ key: "date", label: "Day" }}
      footerTotals={{ label: "DAY TOTAL", cells: {
        count: <span className="font-bold">{totals.count}</span>,
        net: <span className="font-bold">{formatNPR(totals.net)}</span>,
        vat: <span className="font-bold">{formatNPR(totals.vat)}</span>,
        total: <span className="font-bold text-[hsl(220,70%,28%)] dark:text-primary">{formatNPR(totals.total)}</span>,
      }}}
      emptyMessage="No sales in the selected period."
    />
  );
}

// ─── Transactions Report ───────────────────────────────────────────
function TransactionsReport({ transactions, propertyName, subtitle, filters }: any) {
  const totals = transactions.reduce((s: any, t: any) => ({ net: s.net + (t.amount||0), vat: s.vat + (t.vat||0), total: s.total + (t.total||0) }), { net: 0, vat: 0, total: 0 });
  return (
    <PremiumReportFrame
      title="Transactions Report"
      subtitle={subtitle}
      propertyName={propertyName}
      filters={filters}
      exportFilename={`transactions-${format(new Date(), "yyyyMMdd")}.csv`}
      columns={[
        { key: "date", label: "Date" },
        { key: "receiptNo", label: "Receipt #" },
        { key: "memberName", label: "Member" },
        { key: "description", label: "Description" },
        { key: "method", label: "Method", format: (r) => <Badge variant="secondary" className="text-[10px]">{r.method}</Badge>, exportFormat: (r) => r.method },
        { key: "status", label: "Status", format: (r) => <Badge className={r.status === "Pending" ? "bg-warning/20 text-warning" : "bg-success/20 text-success"} variant="secondary">{r.status || "Settled"}</Badge>, exportFormat: (r) => r.status || "Settled" },
        { key: "amount", label: "Net", align: "right", format: (r) => formatNPR(r.amount), exportFormat: (r) => String(r.amount?.toFixed?.(2) || r.amount) },
        { key: "vat", label: "VAT", align: "right", format: (r) => formatNPR(r.vat), exportFormat: (r) => String(r.vat?.toFixed?.(2) || r.vat) },
        { key: "total", label: "Total", align: "right", format: (r) => <span className="font-bold">{formatNPR(r.total)}</span>, exportFormat: (r) => String(r.total?.toFixed?.(2) || r.total) },
      ]}
      rows={transactions}
      footerTotals={{ label: "TOTAL", cells: {
        amount: <span className="font-bold">{formatNPR(totals.net)}</span>,
        vat: <span className="font-bold">{formatNPR(totals.vat)}</span>,
        total: <span className="font-bold text-[hsl(220,70%,28%)] dark:text-primary">{formatNPR(totals.total)}</span>,
      }}}
      emptyMessage="No transactions in this period."
    />
  );
}

// ─── Member Summary ────────────────────────────────────────────────
function MemberSummaryReport({ members, propertyName, subtitle, filters }: any) {
  const totals = members.reduce((s: any, m: any) => ({ paid: s.paid + (m.totalPaid || 0), due: s.due + (m.dueAmount || 0) }), { paid: 0, due: 0 });
  return (
    <PremiumReportFrame
      title="Member Summary"
      subtitle={subtitle}
      propertyName={propertyName}
      filters={filters}
      exportFilename={`members-summary-${format(new Date(), "yyyyMMdd")}.csv`}
      columns={[
        { key: "name", label: "Member" },
        { key: "phone", label: "Phone" },
        { key: "tier", label: "Tier", format: (r) => <Badge variant="outline" className="text-[10px]">{r.tier}</Badge>, exportFormat: (r) => r.tier },
        { key: "plan", label: "Plan" },
        { key: "status", label: "Status", format: (r) => <Badge variant="secondary" className="text-[10px]">{r.status}</Badge>, exportFormat: (r) => r.status },
        { key: "joinDate", label: "Joined" },
        { key: "expiryDate", label: "Expires" },
        { key: "totalPaid", label: "Total Paid", align: "right", format: (r) => formatNPR(r.totalPaid), exportFormat: (r) => String(r.totalPaid) },
        { key: "dueAmount", label: "Due", align: "right", format: (r) => <span className={r.dueAmount > 0 ? "text-destructive font-medium" : ""}>{formatNPR(r.dueAmount)}</span>, exportFormat: (r) => String(r.dueAmount) },
      ]}
      rows={members}
      footerTotals={{ label: "TOTAL", cells: {
        totalPaid: <span className="font-bold">{formatNPR(totals.paid)}</span>,
        dueAmount: <span className="font-bold text-destructive">{formatNPR(totals.due)}</span>,
      }}}
      emptyMessage="No members match the filter."
    />
  );
}

// ─── Bookings Report ───────────────────────────────────────────────
function BookingsReport({ bookings, propertyName, subtitle, filters }: any) {
  return (
    <PremiumReportFrame
      title="Bookings Report"
      subtitle={subtitle}
      propertyName={propertyName}
      filters={filters}
      exportFilename={`bookings-${format(new Date(), "yyyyMMdd")}.csv`}
      columns={[
        { key: "date", label: "Date" },
        { key: "memberName", label: "Member" },
        { key: "service", label: "Service", format: (r) => <Badge variant="secondary" className="text-[10px]">{r.service}</Badge>, exportFormat: (r) => r.service },
        { key: "className", label: "Class / Session" },
        { key: "startTime", label: "Start", align: "center" },
        { key: "endTime", label: "End", align: "center" },
        { key: "status", label: "Status", format: (r) => <Badge variant={r.status === "Confirmed" ? "default" : "secondary"} className="text-[10px]">{r.status}</Badge>, exportFormat: (r) => r.status },
      ]}
      rows={bookings}
      groupBy={{ key: "date", label: "Day" }}
      emptyMessage="No bookings in this period."
    />
  );
}

// ─── Service Revenue ───────────────────────────────────────────────
function ServiceRevenueReport({ transactions, propertyName, subtitle, filters }: any) {
  const rows = useMemo(() => {
    const map: Record<string, { service: string; count: number; net: number; vat: number; total: number }> = {};
    transactions.forEach((t: any) => {
      let bucket: string = t.serviceType || "";
      if (!bucket) {
        const d = (t.description || "").toLowerCase();
        if (d.includes("spa")) bucket = "Spa";
        else if (d.includes("sauna")) bucket = "Sauna";
        else if (d.includes("swim")) bucket = "Swimming";
        else if (d.includes("member")) bucket = "Membership";
        else bucket = "Gym";
      }
      if (!map[bucket]) map[bucket] = { service: bucket, count: 0, net: 0, vat: 0, total: 0 };
      map[bucket].count += 1;
      map[bucket].net += t.amount || 0;
      map[bucket].vat += t.vat || 0;
      map[bucket].total += t.total || 0;
    });
    const grand = Object.values(map).reduce((s, r) => s + r.total, 0) || 1;
    return Object.values(map).map((r) => ({ ...r, share: (r.total / grand) * 100 })).sort((a, b) => b.total - a.total);
  }, [transactions]);

  const totals = rows.reduce((s, r) => ({ count: s.count + r.count, net: s.net + r.net, vat: s.vat + r.vat, total: s.total + r.total }), { count: 0, net: 0, vat: 0, total: 0 });

  return (
    <PremiumReportFrame
      title="Revenue by Service"
      subtitle={subtitle}
      propertyName={propertyName}
      filters={filters}
      exportFilename={`service-revenue-${format(new Date(), "yyyyMMdd")}.csv`}
      columns={[
        { key: "service", label: "Service" },
        { key: "count", label: "Transactions", align: "right" },
        { key: "net", label: "Net Revenue", align: "right", format: (r) => formatNPR(r.net), exportFormat: (r) => String(r.net.toFixed(2)) },
        { key: "vat", label: "VAT", align: "right", format: (r) => formatNPR(r.vat), exportFormat: (r) => String(r.vat.toFixed(2)) },
        { key: "total", label: "Total Revenue", align: "right", format: (r) => <span className="font-bold">{formatNPR(r.total)}</span>, exportFormat: (r) => String(r.total.toFixed(2)) },
        { key: "share", label: "Contribution", align: "right", format: (r) => `${r.share.toFixed(2)}%`, exportFormat: (r) => `${r.share.toFixed(2)}%` },
      ]}
      rows={rows}
      footerTotals={{ label: "GRAND TOTAL", cells: {
        count: <span className="font-bold">{totals.count}</span>,
        net: <span className="font-bold">{formatNPR(totals.net)}</span>,
        vat: <span className="font-bold">{formatNPR(totals.vat)}</span>,
        total: <span className="font-bold text-[hsl(220,70%,28%)] dark:text-primary">{formatNPR(totals.total)}</span>,
        share: <span className="font-bold">100.00%</span>,
      }}}
      emptyMessage="No revenue data in this period."
    />
  );
}

export default Reports;
