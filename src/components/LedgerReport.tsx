import { useMemo, useState, lazy, Suspense } from "react";
import { ChevronDown, ChevronRight, Filter, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useMembers, useTransactions, useCompanySettings } from "@/hooks/use-firestore";
import { formatNPR } from "@/lib/mock-data";
import { exportTableToCSV } from "@/lib/print-utils";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface MemberLedger {
  memberId: string;
  memberName: string;
  tier: string;
  status: string;
  totalBilled: number;
  totalPaid: number;
  balance: number;
  txCount: number;
  payments: Array<{ date: string; receiptNo: string; method: string; description: string; amount: number }>;
}

export default function LedgerReport() {
  const { data: members = [], isLoading: mLoading } = useMembers();
  const { data: transactions = [], isLoading: txLoading } = useTransactions();
  const { data: settings = {} } = useCompanySettings();
  const isLoading = mLoading || txLoading;

  const [showFilters, setShowFilters] = useState(true);
  const [asOfDate, setAsOfDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [tierFilter, setTierFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"name-asc" | "name-desc" | "balance-desc" | "paid-desc">("name-asc");
  const [searchQ, setSearchQ] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const propertyName = settings.companyName || ".............";
  const todayLabel = format(new Date(asOfDate), "yyyy-MM-dd");

  const ledger: MemberLedger[] = useMemo(() => {
    if (!loaded) return [];
    const cutoff = new Date(asOfDate);
    cutoff.setHours(23, 59, 59, 999);

    let list = members;
    if (tierFilter !== "all") list = list.filter((m) => m.tier === tierFilter);
    if (statusFilter !== "all") list = list.filter((m) => m.status === statusFilter);
    if (searchQ) {
      const q = searchQ.toLowerCase();
      list = list.filter((m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q));
    }

    const result = list.map<MemberLedger>((m) => {
      const memberTx = transactions.filter((t) => t.memberId === m.id && new Date(t.date) <= cutoff);
      const totalPaid = memberTx.reduce((s, t) => s + t.total, 0);
      const totalBilled = m.totalPaid + m.dueAmount;
      const balance = m.dueAmount;
      return {
        memberId: m.id,
        memberName: m.name,
        tier: m.tier,
        status: m.status,
        totalBilled,
        totalPaid,
        balance,
        txCount: memberTx.length,
        payments: memberTx.map((t) => ({
          date: t.date,
          receiptNo: t.receiptNo,
          method: t.method,
          description: t.description,
          amount: t.total,
        })),
      };
    });

    switch (sortBy) {
      case "name-asc":
        result.sort((a, b) => a.memberName.localeCompare(b.memberName));
        break;
      case "name-desc":
        result.sort((a, b) => b.memberName.localeCompare(a.memberName));
        break;
      case "balance-desc":
        result.sort((a, b) => b.balance - a.balance);
        break;
      case "paid-desc":
        result.sort((a, b) => b.totalPaid - a.totalPaid);
        break;
    }
    return result;
  }, [members, transactions, loaded, asOfDate, tierFilter, statusFilter, searchQ, sortBy]);

  const totalBilled = ledger.reduce((s, m) => s + m.totalBilled, 0);
  const totalPaid = ledger.reduce((s, m) => s + m.totalPaid, 0);
  const totalBalance = ledger.reduce((s, m) => s + m.balance, 0);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleLoad = () => {
    setLoaded(true);
    setShowFilters(false);
    toast.success("Report loaded");
  };

  const handleExport = () => {
    const headers = [
      "Member",
      "Tier",
      "Status",
      "Total Billed (NPR)",
      "Total Paid (NPR)",
      "Balance (NPR)",
      "Payment Count",
    ];
    const rows = ledger.map((m) => [
      m.memberName,
      m.tier,
      m.status,
      String(m.totalBilled),
      String(m.totalPaid),
      String(m.balance),
      String(m.txCount),
    ]);
    exportTableToCSV(headers, rows, `member-ledger-${asOfDate}.csv`, {
      propertyName,
      reportTitle: "Member Ledger Report",
      dateRange: `As on ${asOfDate}`,
      filters: {
        Tier: tierFilter === "all" ? "All" : tierFilter,
        Status: statusFilter === "all" ? "All" : statusFilter,
        Search: searchQ || "—",
        "Sort By": sortBy,
        "Total Members": String(ledger.length),
        "Total Billed (NPR)": String(totalBilled),
        "Total Paid (NPR)": String(totalPaid),
        "Total Balance (NPR)": String(totalBalance),
      },
    });
    toast.success(`Exported ${ledger.length} member ledgers`);
  };

  return (
    <div className="rounded-xl overflow-hidden border border-border/60 bg-card">
      {/* Premium dark-blue header banner */}
      <div className="bg-gradient-to-r from-[hsl(220,70%,28%)] via-[hsl(220,70%,32%)] to-[hsl(220,70%,28%)] text-white px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display font-bold text-lg leading-tight">Member Ledger Report</h2>
          <p className="text-white/80 text-xs">
            As on: <span className="font-medium">{todayLabel}</span> · {propertyName}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowFilters((p) => !p)}
            className="bg-white/10 hover:bg-white/20 text-white border-white/20"
          >
            <Filter className="h-4 w-4 mr-1.5" />
            {showFilters ? "Hide Filters" : "Show Filters"}
          </Button>
          <Button
            size="sm"
            onClick={handleExport}
            disabled={!loaded || ledger.length === 0}
            className="bg-success hover:bg-success/90 text-white"
          >
            <Download className="h-4 w-4 mr-1.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Filters strip */}
      {showFilters && (
        <div className="bg-[hsl(214,100%,97%)] dark:bg-muted/20 px-5 py-4 border-b border-border/50">
          <p className="text-[11px] tracking-wider font-bold text-[hsl(220,70%,28%)] dark:text-primary mb-3">
            FILTER — MEMBER LEDGER
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">As On Date</Label>
              <Input
                type="date"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                className="bg-background"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Tier</Label>
              <Select value={tierFilter} onValueChange={setTierFilter}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
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
              <Label className="text-xs text-muted-foreground">Member Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Expiring">Expiring</SelectItem>
                  <SelectItem value="Expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Sort By</Label>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name-asc">Name (A-Z)</SelectItem>
                  <SelectItem value="name-desc">Name (Z-A)</SelectItem>
                  <SelectItem value="balance-desc">Highest Balance</SelectItem>
                  <SelectItem value="paid-desc">Highest Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 lg:col-span-3">
              <Label className="text-xs text-muted-foreground">Search Member</Label>
              <Input
                placeholder="Name or email..."
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                className="bg-background"
              />
            </div>
            <div className="flex items-end justify-end">
              <Button
                onClick={handleLoad}
                disabled={isLoading}
                className="bg-[hsl(220,70%,28%)] hover:bg-[hsl(220,70%,32%)] text-white"
              >
                {isLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                Load Report
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Filter summary line */}
      {loaded && (
        <div className="px-5 py-3 border-b border-border/50 bg-muted/20 text-xs text-muted-foreground flex flex-wrap gap-x-4">
          <span>
            As on Date: <strong className="text-foreground">{asOfDate}</strong>
          </span>
          <span>/</span>
          <span>
            Tier: <strong className="text-foreground">{tierFilter === "all" ? "ALL" : tierFilter}</strong>
          </span>
          <span>/</span>
          <span>
            Status: <strong className="text-foreground">{statusFilter === "all" ? "ALL" : statusFilter}</strong>
          </span>
          <span>/</span>
          <span>
            Sort By: <strong className="text-foreground">{sortBy}</strong>
          </span>
        </div>
      )}

      {/* Summary cards */}
      {loaded && (
        <div className="grid grid-cols-1 sm:grid-cols-3 border-b border-border/50">
          <SummaryCard
            color="hsl(220,70%,28%)"
            label="Total Billed"
            sub={`${ledger.length} members`}
            value={formatNPR(totalBilled)}
          />
          <SummaryCard
            color="hsl(142,71%,38%)"
            label="Total Paid"
            sub={`${ledger.length} members`}
            value={formatNPR(totalPaid)}
          />
          <SummaryCard
            color={totalBalance > 0 ? "hsl(0,84%,55%)" : "hsl(142,71%,38%)"}
            label="Total Balance"
            sub={`${ledger.length} members`}
            value={formatNPR(totalBalance)}
          />
        </div>
      )}

      {/* Body */}
      {!loaded ? (
        <div className="p-12 text-center text-muted-foreground">
          <p className="text-sm">
            Set your filters and click <strong className="text-foreground">Load Report</strong> to view the member
            ledger.
          </p>
        </div>
      ) : isLoading ? (
        <div className="p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded" />
          ))}
        </div>
      ) : ledger.length === 0 ? (
        <div className="p-12 text-center text-muted-foreground text-sm">No members match the current filters.</div>
      ) : (
        <div className="overflow-x-auto">
          {/* Header row */}
          <div className="grid grid-cols-12 gap-2 bg-[hsl(220,70%,28%)] text-white text-xs font-semibold px-5 py-3">
            <div className="col-span-5">Member / Month</div>
            <div className="col-span-1 text-right">Bills</div>
            <div className="col-span-2 text-right">Total Billed</div>
            <div className="col-span-2 text-right">Total Paid</div>
            <div className="col-span-2 text-right">Balance</div>
          </div>
          {ledger.map((m) => {
            const isOpen = expanded.has(m.memberId);
            const balanceColor = m.balance > 0 ? "text-destructive" : "text-success";
            return (
              <div key={m.memberId} className="border-b border-border/40 last:border-b-0">
                <button
                  className="w-full grid grid-cols-12 gap-2 px-5 py-3 items-center text-sm hover:bg-muted/30 transition-colors text-left"
                  onClick={() => toggleExpand(m.memberId)}
                >
                  <div className="col-span-5 flex items-center gap-2">
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <div>
                      <span className="font-semibold text-[hsl(220,70%,28%)] dark:text-primary">{m.memberName}</span>
                      <Badge variant="outline" className="text-[10px] ml-2">
                        {m.tier}
                      </Badge>
                      <span className="text-xs text-muted-foreground ml-2">· {m.status}</span>
                    </div>
                  </div>
                  <div className="col-span-1 text-right text-xs text-muted-foreground">{m.txCount} bills</div>
                  <div className="col-span-2 text-right font-medium">{formatNPR(m.totalBilled)}</div>
                  <div className="col-span-2 text-right font-medium text-success">{formatNPR(m.totalPaid)}</div>
                  <div className={cn("col-span-2 text-right font-semibold", balanceColor)}>
                    {m.balance === 0 ? "Cleared" : formatNPR(m.balance)}
                  </div>
                </button>

                {isOpen && (
                  <div className="bg-muted/10 px-5 pb-3">
                    {m.payments.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-3">No payment records in this period.</p>
                    ) : (
                      <>
                        <div className="text-[10px] uppercase tracking-wider text-success font-bold py-2 border-b border-border/30">
                          Payment Receipts ({m.payments.length})
                        </div>
                        {m.payments.map((p, i) => (
                          <div
                            key={i}
                            className="grid grid-cols-12 gap-2 py-2 text-xs border-b border-border/20 last:border-b-0"
                          >
                            <div className="col-span-5 text-muted-foreground pl-6">{p.date}</div>
                            <div className="col-span-1"></div>
                            <div className="col-span-2 text-right">
                              <span className="text-primary">{p.receiptNo}</span> —{" "}
                              <span className="text-muted-foreground">{p.method}</span>
                            </div>
                            <div className="col-span-2 text-right text-muted-foreground">{p.description}</div>
                            <div className="col-span-2 text-right font-medium text-success">{formatNPR(p.amount)}</div>
                          </div>
                        ))}
                        <div className="grid grid-cols-12 gap-2 py-3 mt-1 bg-[hsl(220,70%,28%)]/10 dark:bg-primary/10 -mx-5 px-5 text-sm font-bold rounded">
                          <div className="col-span-5">Subtotal — {m.memberName}</div>
                          <div className="col-span-1"></div>
                          <div className="col-span-2 text-right">{formatNPR(m.totalBilled)}</div>
                          <div className="col-span-2 text-right text-success">{formatNPR(m.totalPaid)}</div>
                          <div className={cn("col-span-2 text-right", balanceColor)}>
                            {m.balance === 0 ? "Cleared" : formatNPR(m.balance)}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ color, label, sub, value }: { color: string; label: string; sub: string; value: string }) {
  return (
    <div
      className="px-5 py-4 border-r border-border/40 last:border-r-0"
      style={{ background: `linear-gradient(180deg, ${color}10, transparent)` }}
    >
      <div className="font-bold text-lg" style={{ color }}>
        {value}
      </div>
      <div className="text-xs text-muted-foreground mt-0.5">
        <span className="font-medium" style={{ color }}>
          {label}
        </span>{" "}
        · {sub}
      </div>
    </div>
  );
}
