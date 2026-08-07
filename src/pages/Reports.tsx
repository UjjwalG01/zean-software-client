import { Download, Printer, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNPR } from "@/lib/mock-data";
import {
  useMembers,
  useTransactions,
  useCompanySettings,
} from "@/hooks/use-firestore";
import { useCharges } from "@/hooks/use-charges";
import { readSaleAmounts } from "@/lib/money";
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
import { useMemo, lazy, Suspense, useState, useRef, useEffect } from "react";
import { format, startOfMonth } from "date-fns";
import {
  PremiumReportFrame,
  type ReportFrameApi,
} from "@/components/PremiumReportFrame";
import { InventoryReports } from "@/components/inventory/InventoryReports";
import {
  ReconciliationDrawer,
  type ReconciliationSelection,
} from "@/components/ReconciliationDrawer";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { capitalizeFirstLetter } from "@/lib/string-case-change";
import { useOutlet } from "@/contexts/OutletContext";
import { formatInTz, formatMonthShort, toIsoDayInTz } from "@/lib/tz";
import { getSystemNowDate } from "@/lib/timeUtils";
import { tooltipStyle } from "@/lib/utils";
import { useAppUsers, useCurrentAppUser } from "@/hooks/use-app-users";
import { getAppUserById } from "@/lib/supabase-users";

const LedgerReport = lazy(() => import("@/components/LedgerReport"));

type CategoryKey = "finance" | "members" | "outlets" | "inventory";

interface ReportDef {
  key: string;
  label: string;
}

const CATEGORIES: { key: CategoryKey; label: string; reports: ReportDef[] }[] =
  [
    {
      key: "finance",
      label: "Sales & Finance",
      reports: [
        { key: "daily", label: "Daily Sales" },
        { key: "collection", label: "Cashier / Collection" },
        { key: "contribution", label: "Sales Contribution" },
        { key: "payments", label: "Payment Methods" },
      ],
    },
    {
      key: "members",
      label: "Members",
      reports: [
        { key: "ledger", label: "Member Ledger" },
        { key: "growth", label: "Member Growth" },
      ],
    },
    {
      key: "outlets",
      label: "Outlets",
      reports: [{ key: "revenue", label: "Revenue by Outlet" }],
    },
    {
      key: "inventory",
      label: "Inventory",
      reports: [
        { key: "stock-position", label: "Stock Position" },
        { key: "stock-register", label: "Stock Movement Register" },
      ],
    },
  ];

/** Compact KPI tile used above each report table. */
function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="glass-card rounded-xl px-4 py-3 border border-border/60">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="text-lg md:text-xl font-bold font-display mt-1 text-primary">
        {value}
      </p>
      {hint && (
        <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>
      )}
    </div>
  );
}

const Reports = () => {
  const { outlets, selected: activeOutlet } = useOutlet();
  const { data: members = [] } = useMembers({ outletId: activeOutlet?.id });
  const { data: transactions = [] } = useTransactions({
    outletId: activeOutlet?.id,
  });
  const { data: charges = [] } = useCharges();
  const { data: settings = {} } = useCompanySettings();
  const [showCashierDetails, setShowCashierDetails] = useState(false);
  const [reconSelection, setReconSelection] =
    useState<ReconciliationSelection | null>(null);

  // ── Navigation state ──
  const [category, setCategory] = useState<CategoryKey>("finance");
  const [report, setReport] = useState<string>("daily");
  const currentCategory =
    CATEGORIES.find((c) => c.key === category) || CATEGORIES[0];

  const selectCategory = (key: string) => {
    const cat = CATEGORIES.find((c) => c.key === key);
    if (!cat) return;
    setCategory(cat.key);
    setReport(cat.reports[0].key);
  };

  // ── Universal filters ──
  const today = format(getSystemNowDate(), "yyyy-MM-dd");
  const monthStart = format(startOfMonth(getSystemNowDate()), "yyyy-MM-dd");
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [outletFilter, setOutletFilter] = useState("all");
  const [includeVoided, setIncludeVoided] = useState<"exclude" | "include">(
    "exclude",
  );

  // ── Export/print bridge to the active report frame ──
  const frameApi = useRef<ReportFrameApi | null>(null);
  useEffect(() => {
    frameApi.current = null;
  }, [report]);

  const [invStats, setInvStats] = useState({
    items: 0,
    quantity: 0,
    valuation: 0,
    movements: 0,
    inQty: 0,
    outQty: 0,
    movementValue: 0,
  });

  // Map of charge.id → charge_head for cross-referencing payments settled via a charge.
  const chargeHeadById = useMemo(() => {
    const m = new Map<string, string>();
    charges.forEach((c) => m.set(c.id, c.charge_head || ""));
    return m;
  }, [charges]);

  const txOutletFiltered = useMemo(() => {
    if (outletFilter === "all") return transactions;
    return transactions.filter(
      (t) =>
        ((t as any).outletId || (t as any).outlet_id || "__unassigned__") ===
        outletFilter,
    );
  }, [transactions, outletFilter]);

  const txInRange = useMemo(() => {
    return txOutletFiltered.filter((t) => {
      if (!t.date) return false;
      const d = t.date;
      if (from && d < from) return false;
      if (to && d > to) return false;
      if (includeVoided === "exclude" && (t as any).voided) return false;
      return true;
    });
  }, [txOutletFiltered, from, to, includeVoided]);

  /**
   * Sales side (debits): charge rows raised by bookings, POS orders and manual
   * charges. These represent revenue billed, whether or not it is collected.
   */
  const chargeTx = useMemo(
    () => txInRange.filter((t) => String(t.type) === "Charge"),
    [txInRange],
  );

  /** Collection side (credits): actual money received — payments/advances. */
  const paymentTx = useMemo(
    () => txInRange.filter((t) => String(t.type) !== "Charge"),
    [txInRange],
  );

  // ── 1. Daily Sales Report (grouped by date → department/service) ──
  // Sales are charges (debits), settled or not. Math: Total − Discount = Net.
  const dailySalesRows = useMemo(() => {
    const acc: Record<
      string,
      {
        date: string;
        department: string;
        sales: number;
        vat: number;
        total: number;
        discount: number;
        net: number;
        createdBy?: string;
        createdAt?: string;
      }
    > = {};
    chargeTx.forEach((t) => {
      const linkedHead =
        (t as any).chargeRowId && chargeHeadById.get((t as any).chargeRowId);
      const department =
        (t as any).chargeHead ||
        linkedHead ||
        t.serviceType ||
        (t.type === "Charge" ? "Misc Charges" : "Membership");
      const key = `${t.date}::${department}`;
      if (!acc[key])
        acc[key] = {
          date: t.date,
          department,
          sales: 0,
          vat: 0,
          total: 0,
          discount: 0,
          net: 0,
        };
      const sign = (t as any).voided ? -1 : 1;
      // Sales side of the money model: amount + VAT = amt_after_vat (billed).
      // Collection = billed − discount. Never recompute VAT here.
      const { amount, vatAmount, amtAfterVat, discount, total } = readSaleAmounts(t);
      acc[key].sales += sign * amount;
      acc[key].vat += sign * vatAmount;
      acc[key].total += sign * amtAfterVat;
      acc[key].discount += sign * discount;
      acc[key].net += sign * total;
    });
    return Object.values(acc).sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.department.localeCompare(b.department),
    );
  }, [chargeTx, chargeHeadById]);

  const dailySalesTotals = useMemo(() => {
    return dailySalesRows.reduce(
      (a, r) => ({
        sales: a.sales + r.sales,
        vat: a.vat + r.vat,
        total: a.total + r.total,
        discount: a.discount + r.discount,
        net: a.net + r.net,
      }),
      { sales: 0, vat: 0, total: 0, discount: 0, net: 0 },
    );
  }, [dailySalesRows]);

  // ── 2. Cashier / Collection Report (one row per settled transaction) ──
  const collectionRows = useMemo(() => {
    const rows = paymentTx
      .filter((t) => t.status !== "pending" && t.status !== "unpaid")
      .map((t) => {
        const voided = (t as any).voided === true;
        const { amtAfterVat: billed, discount, total: collected } = readSaleAmounts(t);
        const userId =
          (t as any).createdBy || (t as any).created_by || (t as any).cashier;
        const time =
          (t as any).created_at || (t as any).paid_at || (t as any).paidAt;

        return {
          date: toIsoDayInTz(t.date),
          memberName: capitalizeFirstLetter(t.memberName),
          receiptNo: t.receiptNo,
          method: capitalizeFirstLetter((t.method || "").replace(/_/g, " ")),
          description: t.description,
          billed,
          discount,
          collected: voided ? -collected : collected,
          user:
            (t as any).createdBy ||
            (t as any).created_by ||
            (t as any).cashier ||
            "—",
          settledAt: time,
          voided,
          rowClass: voided ? "line-through text-red-500/80" : "",
          status:
            t.status === "paid"
              ? "Settled"
              : capitalizeFirstLetter(t.status || ""),
        };
      });
    return rows.sort(
      (a, b) =>
        a.date.localeCompare(b.date) || a.method.localeCompare(b.method),
    );
  }, [paymentTx]);

  const collectionTotals = useMemo(() => {
    return collectionRows.reduce(
      (a, r) => ({
        count: a.count + 1,
        collected: a.collected + r.collected,
        billed: a.billed + r.billed,
        discount: a.discount + r.discount,
      }),
      { count: 0, collected: 0, billed: 0, discount: 0 },
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
    chargeTx.forEach((t) => {
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
  }, [chargeTx]);

  const contributionTotals = useMemo(() => {
    return contributionRows.reduce(
      (a, r) => ({ txns: a.txns + r.txns, total: a.total + r.total }),
      { txns: 0, total: 0 },
    );
  }, [contributionRows]);

  // ── Revenue by Outlet ──
  const outletNameById = useMemo(() => {
    const m = new Map<string, string>();
    outlets.forEach((o) => m.set(o.id, o.name));
    return m;
  }, [outlets]);

  const outletPalette = [
    "hsl(38,92%,50%)",
    "hsl(280,60%,55%)",
    "hsl(200,80%,50%)",
    "hsl(142,71%,45%)",
    "hsl(15,80%,55%)",
    "hsl(220,10%,55%)",
  ];

  const revenueByOutlet = useMemo(() => {
    const acc: Record<
      string,
      { outletId: string; outlet: string; revenue: number; txns: number }
    > = {};
    chargeTx.forEach((t) => {
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
    const list = Object.values(acc).sort((a, b) => b.revenue - a.revenue);
    const grand = list.reduce((s, r) => s + r.revenue, 0) || 1;
    return list.map((r, i) => ({
      ...r,
      share: (r.revenue / grand) * 100,
      color: outletPalette[i % outletPalette.length],
    }));
  }, [chargeTx, outletNameById]);

  const revenueTotals = useMemo(
    () => ({
      revenue: revenueByOutlet.reduce((s, r) => s + r.revenue, 0),
      txns: revenueByOutlet.reduce((s, r) => s + r.txns, 0),
    }),
    [revenueByOutlet],
  );

  // ── Member Growth ──
  const memberGrowth = useMemo(() => {
    const monthMap: Record<string, { newMembers: number; total: number }> = {};
    const sorted = [...members].sort((a, b) =>
      (a.joinDate || "").localeCompare(b.joinDate || ""),
    );
    sorted.forEach((m, i) => {
      const month = m.joinDate ? formatMonthShort(m.joinDate) : "Unknown";
      if (!monthMap[month]) monthMap[month] = { newMembers: 0, total: 0 };
      monthMap[month].newMembers++;
      monthMap[month].total = i + 1;
    });
    return Object.entries(monthMap).map(([month, data]) => ({
      month,
      ...data,
    }));
  }, [members]);

  const activeMembers = members.filter((m) => m.status === "Active").length;
  const newInRange = members.filter(
    (m) => m.joinDate && m.joinDate >= from && m.joinDate <= to,
  ).length;

  // ── Payment Methods ──
  const paymentMethodRows = useMemo(() => {
    const fills: Record<string, string> = {
      cash: "hsl(38, 92%, 50%)",
      card: "hsl(200, 80%, 50%)",
      esewa: "hsl(142, 71%, 45%)",
      bank_transfer: "hsl(220, 10%, 55%)",
      fonepay: "hsl(280, 60%, 55%)",
      credit: "hsl(15, 80%, 55%)",
    };
    const acc: Record<string, { method: string; txns: number; total: number }> =
      {};
    paymentTx.forEach((t) => {
      const k = t.method || "other";
      if (!acc[k]) acc[k] = { method: k, txns: 0, total: 0 };
      acc[k].txns += 1;
      acc[k].total += t.total || 0;
    });
    const list = Object.values(acc);
    const grandTotal = list.reduce((s, r) => s + r.total, 0) || 1;
    const grandTxns = list.reduce((s, r) => s + r.txns, 0) || 1;
    return list
      .map((r) => ({
        ...r,
        label: capitalizeFirstLetter(r.method.replace(/_/g, " ")),
        share: (r.total / grandTotal) * 100,
        countShare: Math.round((r.txns / grandTxns) * 100),
        fill: fills[r.method] || "hsl(220, 10%, 55%)",
      }))
      .sort((a, b) => b.total - a.total);
  }, [paymentTx]);

  const paymentTotals = useMemo(
    () => ({
      txns: paymentMethodRows.reduce((s, r) => s + r.txns, 0),
      total: paymentMethodRows.reduce((s, r) => s + r.total, 0),
    }),
    [paymentMethodRows],
  );

  const propertyName = settings.companyName || ".............";

  const filterSummary = (
    <>
      Range: <b>{from}</b> → <b>{to}</b> · Outlet:{" "}
      <b>
        {outletFilter === "all"
          ? "All Outlets"
          : outletNameById.get(outletFilter) || outletFilter}
      </b>{" "}
      · Voided: <b>{includeVoided}</b>
    </>
  );

  const extraFilters = (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div className="space-y-1.5">
        <Label className="text-xs">Voided Transactions</Label>
        <Select
          value={includeVoided}
          onValueChange={(v) => setIncludeVoided(v as "exclude" | "include")}
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
      <div className="space-y-1.5 sm:col-span-2">
        <Label className="text-xs">&nbsp;</Label>
        <div className="text-xs text-muted-foreground py-2">
          {txInRange.length} transactions in range
        </div>
      </div>
    </div>
  );

  const kpis: { label: string; value: string; hint?: string }[] = (() => {
    switch (report) {
      case "daily":
        return [
          { label: "Net Sales", value: formatNPR(dailySalesTotals.sales) },
          { label: "VAT Payable", value: formatNPR(dailySalesTotals.vat) },
          { label: "Total Sales", value: formatNPR(dailySalesTotals.total) },
          { label: "Discount", value: formatNPR(dailySalesTotals.discount) },
          {
            label: "Net Collection",
            value: formatNPR(dailySalesTotals.net),
            hint: "Total Sales − Discount",
          },
        ];
      case "collection":
        return [
          { label: "Settled Txns", value: String(collectionTotals.count) },
          { label: "Billed", value: formatNPR(collectionTotals.billed) },
          { label: "Discount", value: formatNPR(collectionTotals.discount) },
          { label: "Collected", value: formatNPR(collectionTotals.collected) },
        ];
      case "contribution":
        return [
          { label: "Members Billed", value: String(contributionRows.length) },
          { label: "Transactions", value: String(contributionTotals.txns) },
          {
            label: "Total Revenue",
            value: formatNPR(contributionTotals.total),
          },
          {
            label: "Top Member",
            value: contributionRows[0]?.member || "—",
            hint: contributionRows[0]
              ? `${contributionRows[0].share.toFixed(1)}% share`
              : undefined,
          },
        ];
      case "payments":
        return [
          { label: "Methods Used", value: String(paymentMethodRows.length) },
          { label: "Transactions", value: String(paymentTotals.txns) },
          { label: "Total Value", value: formatNPR(paymentTotals.total) },
          {
            label: "Top Method",
            value: paymentMethodRows[0]?.label || "—",
            hint: paymentMethodRows[0]
              ? `${paymentMethodRows[0].share.toFixed(1)}% of value`
              : undefined,
          },
        ];
      case "growth":
        return [
          { label: "Total Members", value: String(members.length) },
          { label: "Active", value: String(activeMembers) },
          { label: "Joined in Range", value: String(newInRange) },
          { label: "Months Tracked", value: String(memberGrowth.length) },
        ];
      case "revenue":
        return [
          { label: "Outlets", value: String(revenueByOutlet.length) },
          { label: "Transactions", value: String(revenueTotals.txns) },
          { label: "Total Revenue", value: formatNPR(revenueTotals.revenue) },
          {
            label: "Top Outlet",
            value: revenueByOutlet[0]?.outlet || "—",
            hint: revenueByOutlet[0]
              ? `${revenueByOutlet[0].share.toFixed(1)}% share`
              : undefined,
          },
        ];
      case "stock-position":
        return [
          { label: "Items", value: String(invStats.items) },
          { label: "Total Quantity", value: String(invStats.quantity) },
          {
            label: "Stock Valuation",
            value: formatNPR(Math.round(invStats.valuation)),
          },
        ];
      case "stock-register":
        return [
          { label: "Movements", value: String(invStats.movements) },
          { label: "Units In", value: String(invStats.inQty) },
          { label: "Units Out", value: String(invStats.outQty) },
          {
            label: "Movement Value",
            value: formatNPR(Math.round(invStats.movementValue)),
          },
        ];
      default:
        return [];
    }
  })();

  const supportsActions = report !== "ledger";

  return (
    <div className="animate-fade-in space-y-4">
      <div>
        <h1 className="text-2xl font-bold font-display">Reports</h1>
        <p className="text-sm text-muted-foreground">
          Category-based reporting across sales, members, outlets and stock.
        </p>
      </div>

      {/* Category tabs */}
      <Tabs value={category} onValueChange={selectCategory}>
        <TabsList className="bg-muted/50 flex-wrap h-auto">
          {CATEGORIES.map((c) => (
            <TabsTrigger key={c.key} value={c.key}>
              {c.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Report pill selector */}
      <div className="flex flex-wrap gap-2">
        {currentCategory.reports.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => setReport(r.key)}
            className={cn(
              "px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors",
              report === r.key
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted/30 border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/60",
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Universal filter + action bar */}
      <div className="glass-card rounded-xl border border-border/60 px-4 py-3 flex flex-col lg:flex-row lg:items-end gap-3 justify-between">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Date Range
            </Label>
            <DateRangeFilter
              from={from}
              to={to}
              onChange={(r) => {
                setFrom(r.from);
                setTo(r.to);
              }}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Outlet
            </Label>
            <Select value={outletFilter} onValueChange={setOutletFilter}>
              <SelectTrigger className="h-9 w-[190px] bg-muted/50 border-0 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Outlets</SelectItem>
                {outlets.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
                <SelectItem value="__unassigned__">Unassigned</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {report === "collection" && (
            <div className="flex items-center gap-2 pb-2">
              <Label
                htmlFor="cashier-details"
                className="text-xs text-muted-foreground"
              >
                Show Details
              </Label>
              <Switch
                id="cashier-details"
                checked={showCashierDetails}
                onCheckedChange={setShowCashierDetails}
              />
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!supportsActions}
            onClick={() => frameApi.current?.print()}
          >
            <Printer className="h-4 w-4 mr-1.5" />
            Print / PDF
          </Button>
          <Button
            size="sm"
            disabled={!supportsActions}
            onClick={() => frameApi.current?.exportCSV()}
            className="bg-success hover:bg-success/90 text-white"
          >
            <Download className="h-4 w-4 mr-1.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      {kpis.length > 0 && (
        <div
          className={cn(
            "grid gap-3",
            kpis.length === 3
              ? "grid-cols-1 sm:grid-cols-3"
              : "grid-cols-2 lg:grid-cols-4",
          )}
        >
          {kpis.map((k) => (
            <KpiCard key={k.label} {...k} />
          ))}
        </div>
      )}

      {/* Report body */}
      {report === "daily" && (
        <PremiumReportFrame
          title="Daily Sales Report"
          subtitle="Sales by date and department"
          propertyName={propertyName}
          filters={extraFilters}
          filterSummary={filterSummary}
          hideActions
          apiRef={frameApi}
          sortable
          exportFilename={`daily-sales-${from}_to_${to}.csv`}
          exportMeta={{
            dateRange: `${from} → ${to}`,
            filters: { Voided: includeVoided },
          }}
          groupBy={{ key: "department", label: "Department" }}
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
            {
              key: "discount",
              label: "Discount",
              align: "right",
              format: (r) => formatNPR(r.discount),
              exportFormat: (r) => String(r.discount),
            },
            {
              key: "net",
              label: "Net (Collectible)",
              align: "right",
              format: (r) => formatNPR(r.net),
              exportFormat: (r) => String(r.net),
            },
          ]}
          rows={dailySalesRows}
          footerTotals={{
            label: "Grand Total",
            cells: {
              sales: formatNPR(dailySalesTotals.sales),
              vat: formatNPR(dailySalesTotals.vat),
              total: formatNPR(dailySalesTotals.total),
              discount: formatNPR(dailySalesTotals.discount),
              net: formatNPR(dailySalesTotals.net),
            },
          }}
          onRowClick={(r) =>
            setReconSelection({ date: r.date, department: r.department })
          }
        />
      )}

      {report === "collection" && (
        <PremiumReportFrame
          title="Cashier / Collection Report"
          subtitle="One row per settled transaction"
          propertyName={propertyName}
          filters={extraFilters}
          filterSummary={filterSummary}
          hideActions
          apiRef={frameApi}
          sortable
          paginated
          exportFilename={`collection-${from}_to_${to}.csv`}
          exportMeta={{ dateRange: `${from} → ${to}` }}
          columns={[
            { key: "date", label: "Date" },
            { key: "memberName", label: "Member" },
            { key: "receiptNo", label: "Receipt No" },
            { key: "method", label: "Method" },
            ...(showCashierDetails
              ? [
                  {
                    key: "billed",
                    label: "Billed Amount",
                    align: "right" as const,
                    format: (r: any) => formatNPR(r.billed),
                    exportFormat: (r: any) => String(r.billed),
                  },
                  {
                    key: "discount",
                    label: "Discount",
                    align: "right" as const,
                    format: (r: any) => formatNPR(r.discount),
                    exportFormat: (r: any) => String(r.discount),
                  },
                  {
                    key: "collected",
                    label: "Collected",
                    align: "right" as const,
                    format: (r: any) => formatNPR(r.collected),
                    exportFormat: (r: any) => String(r.collected),
                  },
                  { key: "user", label: "User" },
                ]
              : [
                  {
                    key: "collected",
                    label: "Net Amount",
                    align: "right" as const,
                    format: (r: any) => formatNPR(r.collected),
                    exportFormat: (r: any) => String(r.collected),
                  },
                ]),
            {
              key: "settledAt",
              label: "Settled At",
              align: "right" as const,
            },
          ]}
          rows={collectionRows}
          footerTotals={{
            label: "Grand Total",
            cells: showCashierDetails
              ? {
                  billed: formatNPR(collectionTotals.billed),
                  discount: formatNPR(collectionTotals.discount),
                  collected: formatNPR(collectionTotals.collected),
                }
              : {
                  collected: formatNPR(collectionTotals.collected),
                },
          }}
        />
      )}

      {report === "contribution" && (
        <PremiumReportFrame
          title="Sales Contribution"
          subtitle="Revenue per member with contribution share"
          propertyName={propertyName}
          filters={extraFilters}
          filterSummary={filterSummary}
          hideActions
          apiRef={frameApi}
          sortable
          paginated
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
      )}

      {report === "payments" && (
        <div className="space-y-4">
          <div className="glass-card rounded-xl p-5">
            <h3 className="font-semibold font-display mb-4">
              Payment Methods Distribution
            </h3>
            {paymentMethodRows.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">
                No payment data in this range
              </p>
            ) : (
              <div className="flex flex-col lg:flex-row items-center justify-center gap-8">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={paymentMethodRows}
                      innerRadius={75}
                      outerRadius={120}
                      paddingAngle={3}
                      dataKey="total"
                      nameKey="label"
                      stroke="none"
                    >
                      {paymentMethodRows.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(v: number) => [formatNPR(v)]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-3 min-w-[200px]">
                  {paymentMethodRows.map((item) => (
                    <div key={item.method} className="flex items-center gap-3">
                      <span
                        className="h-3 w-3 rounded-full shrink-0"
                        style={{ background: item.fill }}
                      />
                      <span className="text-sm text-muted-foreground">
                        {item.label}
                      </span>
                      <span className="ml-auto font-bold text-sm">
                        {item.share.toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <PremiumReportFrame
            title="Payment Methods Breakdown"
            propertyName={propertyName}
            filterSummary={filterSummary}
            hideActions
            apiRef={frameApi}
            sortable
            defaultSortKey="total"
            defaultSortDir="desc"
            exportFilename={`payment-methods-${from}_to_${to}.csv`}
            exportMeta={{ dateRange: `${from} → ${to}` }}
            columns={[
              { key: "label", label: "Method" },
              { key: "txns", label: "Transactions", align: "right" },
              {
                key: "total",
                label: "Value (NPR)",
                align: "right",
                format: (r) => formatNPR(r.total),
                exportFormat: (r) => String(Math.round(r.total)),
              },
              {
                key: "share",
                label: "Share",
                align: "right",
                format: (r) => `${r.share.toFixed(1)}%`,
                exportFormat: (r) => r.share.toFixed(1),
              },
            ]}
            rows={paymentMethodRows}
            footerTotals={{
              label: "Grand Total",
              cells: {
                txns: String(paymentTotals.txns),
                total: formatNPR(paymentTotals.total),
                share: "100.0%",
              },
            }}
            emptyMessage="No payments recorded in this period."
          />
        </div>
      )}

      {report === "ledger" && (
        <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
          <LedgerReport />
        </Suspense>
      )}

      {report === "growth" && (
        <div className="space-y-4">
          <div className="glass-card rounded-xl p-5">
            <h3 className="font-semibold font-display mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Member Growth
            </h3>
            {memberGrowth.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">
                No member data yet
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={340}>
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
          <PremiumReportFrame
            title="Member Growth by Month"
            propertyName={propertyName}
            hideActions
            apiRef={frameApi}
            sortable
            paginated
            defaultSortKey="month"
            exportFilename="member-growth.csv"
            columns={[
              { key: "month", label: "Month" },
              { key: "newMembers", label: "New Members", align: "right" },
              { key: "total", label: "Cumulative Members", align: "right" },
            ]}
            rows={memberGrowth}
            emptyMessage="No member data yet."
          />
        </div>
      )}

      {report === "revenue" && (
        <div className="space-y-4">
          <div className="glass-card rounded-xl p-5">
            <h3 className="font-semibold font-display mb-4">
              Revenue by Outlet
            </h3>
            {revenueByOutlet.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">
                No transaction data in this range
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
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
                    cursor={false}
                    formatter={(v: number) => [formatNPR(v), "Revenue"]}
                  />
                  <Bar
                    dataKey="revenue"
                    barSize={95}
                    maxBarSize={95}
                    radius={[4, 4, 0, 0]}
                  >
                    {revenueByOutlet.map((r, i) => (
                      <Cell key={i} fill={r.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <PremiumReportFrame
            title="Revenue by Outlet"
            propertyName={propertyName}
            filterSummary={filterSummary}
            hideActions
            apiRef={frameApi}
            sortable
            paginated
            defaultSortKey="revenue"
            defaultSortDir="desc"
            exportFilename={`revenue-by-outlet-${from}_to_${to}.csv`}
            exportMeta={{ dateRange: `${from} → ${to}` }}
            columns={[
              {
                key: "outlet",
                label: "Outlet",
                format: (r) => (
                  <span className="flex items-center gap-2 font-medium">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: r.color }}
                    />
                    {r.outlet}
                  </span>
                ),
                exportFormat: (r) => r.outlet,
              },
              { key: "txns", label: "Transactions", align: "right" },
              {
                key: "revenue",
                label: "Revenue (NPR)",
                align: "right",
                format: (r) => formatNPR(r.revenue),
                exportFormat: (r) => String(Math.round(r.revenue)),
              },
              {
                key: "share",
                label: "Share",
                align: "right",
                format: (r) => `${r.share.toFixed(1)}%`,
                exportFormat: (r) => r.share.toFixed(1),
              },
            ]}
            rows={revenueByOutlet}
            footerTotals={{
              label: "Grand Total",
              cells: {
                txns: String(revenueTotals.txns),
                revenue: formatNPR(revenueTotals.revenue),
                share: "100.0%",
              },
            }}
            emptyMessage="No outlet revenue in this period."
          />
        </div>
      )}

      {(report === "stock-position" || report === "stock-register") && (
        <InventoryReports
          propertyName={propertyName}
          report={report === "stock-position" ? "position" : "register"}
          dateFrom={from}
          dateTo={to}
          hideActions
          apiRef={frameApi}
          onStats={setInvStats}
        />
      )}

      <ReconciliationDrawer
        open={reconSelection !== null}
        onOpenChange={(o) => !o && setReconSelection(null)}
        selection={reconSelection}
        transactions={txInRange}
        chargeHeadById={chargeHeadById}
      />
    </div>
  );
};

export default Reports;
