import { useMemo, useState } from "react";
import { Filter, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useMembers, useTransactions, useCompanySettings } from "@/hooks/use-firestore";
import { useCharges } from "@/hooks/use-charges";
import { formatNPR } from "@/lib/mock-data";
import { buildMemberLedger } from "@/lib/member-ledger";
import { exportTableToCSV } from "@/lib/print-utils";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface MemberLedgerRow {
  memberId: string;
  memberName: string;
  tier: string;
  services: string;
  totalBilled: number;
  totalPaid: number;
  netBalance: number;
  status: "Settled" | "Partial" | "Unpaid";
}

export default function LedgerReport() {
  const { data: members = [], isLoading: mLoading } = useMembers();
  const { data: transactions = [], isLoading: txLoading } = useTransactions();
  const { data: charges = [] } = useCharges();
  const { data: settings = {} } = useCompanySettings();
  const isLoading = mLoading || txLoading;

  const [showFilters, setShowFilters] = useState(true);
  const [tierFilter, setTierFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"name-asc" | "name-desc" | "balance-desc" | "paid-desc">("name-asc");
  const [searchQ, setSearchQ] = useState("");
  const [loaded, setLoaded] = useState(false);

  const propertyName = settings.companyName || ".............";

  const ledger: MemberLedgerRow[] = useMemo(() => {
    if (!loaded) return [];
    let list = members;
    if (tierFilter !== "all") list = list.filter((m) => m.tier === tierFilter);
    if (searchQ) {
      const q = searchQ.toLowerCase();
      list = list.filter((m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q));
    }

    const result = list.map<MemberLedgerRow>((m) => {
      const { summary } = buildMemberLedger(m.id, transactions, m.openingBalance || 0, charges);
      const memberCharges = charges.filter((c) => c.member_id === m.id);
      const services = Array.from(
        new Set([
          ...memberCharges.map((c) => c.charge_head).filter(Boolean),
          ...transactions
            .filter((t) => t.memberId === m.id && t.chargeHead)
            .map((t) => t.chargeHead as string),
        ]),
      ).join(", ") || (m.services || []).join(", ") || "—";
      return {
        memberId: m.id,
        memberName: m.name,
        tier: m.tier,
        services,
        totalBilled: summary.totalCharged,
        totalPaid: summary.totalPaid + summary.advance + summary.discountTotal,
        netBalance: summary.netPayable,
        status: summary.status,
      };
    });

    const filtered = statusFilter === "all" ? result : result.filter((r) => r.status.toLowerCase() === statusFilter);

    switch (sortBy) {
      case "name-asc": filtered.sort((a, b) => a.memberName.localeCompare(b.memberName)); break;
      case "name-desc": filtered.sort((a, b) => b.memberName.localeCompare(a.memberName)); break;
      case "balance-desc": filtered.sort((a, b) => b.netBalance - a.netBalance); break;
      case "paid-desc": filtered.sort((a, b) => b.totalPaid - a.totalPaid); break;
    }
    return filtered;
  }, [members, transactions, charges, loaded, tierFilter, statusFilter, searchQ, sortBy]);

  const totalBilled = ledger.reduce((s, m) => s + m.totalBilled, 0);
  const totalPaid = ledger.reduce((s, m) => s + m.totalPaid, 0);
  const totalBalance = ledger.reduce((s, m) => s + m.netBalance, 0);

  const handleLoad = () => {
    setLoaded(true);
    setShowFilters(false);
    toast.success("Report loaded");
  };

  const handleExport = () => {
    const headers = ["Member", "Services", "Total Billed (NPR)", "Total Paid (NPR)", "Net Balance (NPR)", "Status"];
    const rows = ledger.map((m) => [m.memberName, m.services, String(m.totalBilled), String(m.totalPaid), String(m.netBalance), m.status]);
    exportTableToCSV(headers, rows, `member-ledger-${format(new Date(), "yyyyMMdd")}.csv`, {
      propertyName,
      reportTitle: "Member Ledger Report",
      dateRange: format(new Date(), "PPP"),
      filters: {
        Tier: tierFilter === "all" ? "All" : tierFilter,
        Status: statusFilter === "all" ? "All" : statusFilter,
        Search: searchQ || "—",
        "Total Members": String(ledger.length),
        "Total Billed (NPR)": String(totalBilled),
        "Total Paid (NPR)": String(totalPaid),
        "Total Balance (NPR)": String(totalBalance),
      },
    });
    toast.success(`Exported ${ledger.length} member ledgers`);
  };

  const statusChip = (s: MemberLedgerRow["status"]) => {
    const cls =
      s === "Settled" ? "bg-success/20 text-success" :
      s === "Partial" ? "bg-amber-500/20 text-amber-500" :
      "bg-destructive/20 text-destructive";
    return <Badge className={cn("text-[10px] border-0", cls)}>{s}</Badge>;
  };

  return (
    <div className="rounded-xl overflow-hidden border border-border/60 bg-card">
      <div className="bg-gradient-to-r from-[hsl(220,70%,28%)] via-[hsl(220,70%,32%)] to-[hsl(220,70%,28%)] text-white px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display font-bold text-lg leading-tight">Member Ledger Report</h2>
          <p className="text-white/80 text-xs">{propertyName}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setShowFilters((p) => !p)} className="bg-white/10 hover:bg-white/20 text-white border-white/20">
            <Filter className="h-4 w-4 mr-1.5" />{showFilters ? "Hide Filters" : "Show Filters"}
          </Button>
          <Button size="sm" onClick={handleExport} disabled={!loaded || ledger.length === 0} className="bg-success hover:bg-success/90 text-white">
            <Download className="h-4 w-4 mr-1.5" />Export CSV
          </Button>
        </div>
      </div>

      {showFilters && (
        <div className="bg-[hsl(214,100%,97%)] dark:bg-muted/20 px-5 py-4 border-b border-border/50">
          <p className="text-[11px] tracking-wider font-bold text-[hsl(220,70%,28%)] dark:text-primary mb-3">FILTER — MEMBER LEDGER</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
                  <SelectItem value="settled">Settled</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Sort By</Label>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="name-asc">Name (A-Z)</SelectItem>
                  <SelectItem value="name-desc">Name (Z-A)</SelectItem>
                  <SelectItem value="balance-desc">Highest Balance</SelectItem>
                  <SelectItem value="paid-desc">Highest Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Search Member</Label>
              <Input placeholder="Name or email..." value={searchQ} onChange={(e) => setSearchQ(e.target.value)} className="bg-background" />
            </div>
            <div className="lg:col-span-4 flex justify-end">
              <Button onClick={handleLoad} disabled={isLoading} className="bg-[hsl(220,70%,28%)] hover:bg-[hsl(220,70%,32%)] text-white">
                {isLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                Load Report
              </Button>
            </div>
          </div>
        </div>
      )}

      {loaded && (
        <div className="grid grid-cols-1 sm:grid-cols-3 border-b border-border/50">
          <SummaryCard color="hsl(220,70%,28%)" label="Total Billed" sub={`${ledger.length} members`} value={formatNPR(totalBilled)} />
          <SummaryCard color="hsl(142,71%,38%)" label="Total Paid" sub={`${ledger.length} members`} value={formatNPR(totalPaid)} />
          <SummaryCard color={totalBalance > 0 ? "hsl(0,84%,55%)" : "hsl(142,71%,38%)"} label="Total Balance" sub={`${ledger.length} members`} value={formatNPR(totalBalance)} />
        </div>
      )}

      {!loaded ? (
        <div className="p-12 text-center text-muted-foreground">
          <p className="text-sm">Set your filters and click <strong className="text-foreground">Load Report</strong> to view the member ledger.</p>
        </div>
      ) : isLoading ? (
        <div className="p-4 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded" />)}</div>
      ) : ledger.length === 0 ? (
        <div className="p-12 text-center text-muted-foreground text-sm">No members match the current filters.</div>
      ) : (
        <div className="overflow-x-auto">
          <div className="grid grid-cols-12 gap-2 bg-[hsl(220,70%,28%)] text-white text-xs font-semibold px-5 py-3">
            <div className="col-span-3">Member Name</div>
            <div className="col-span-3">Services</div>
            <div className="col-span-2 text-right">Total Billed (+)</div>
            <div className="col-span-2 text-right">Total Paid (−)</div>
            <div className="col-span-1 text-right">Net Balance</div>
            <div className="col-span-1 text-right">Status</div>
          </div>
          <Accordion type="multiple" className="w-full">
            {ledger.map((m) => (
              <AccordionItem key={m.memberId} value={m.memberId} className="border-b border-border/40 last:border-b-0">
                <AccordionTrigger className="px-5 py-3 hover:no-underline hover:bg-muted/30 [&>svg]:ml-2">
                  <div className="grid grid-cols-12 gap-2 items-center text-sm w-full pr-2">
                    <div className="col-span-3 text-left">
                      <span className="font-semibold text-[hsl(220,70%,28%)] dark:text-primary">{m.memberName}</span>
                      <Badge variant="outline" className="text-[10px] ml-2">{m.tier}</Badge>
                    </div>
                    <div className="col-span-3 text-xs text-muted-foreground text-left truncate">{m.services}</div>
                    <div className="col-span-2 text-right font-medium">{formatNPR(m.totalBilled)}</div>
                    <div className="col-span-2 text-right font-medium text-success">{formatNPR(m.totalPaid)}</div>
                    <div className={cn("col-span-1 text-right font-semibold", m.netBalance > 0 ? "text-destructive" : "text-success")}>
                      {formatNPR(m.netBalance)}
                    </div>
                    <div className="col-span-1 text-right">{statusChip(m.status)}</div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="bg-muted/20 px-5 py-3">
                  <MemberBillsAccordion memberId={m.memberId} transactions={transactions} charges={charges} openingBalance={(members.find(x=>x.id===m.memberId) as any)?.openingBalance || 0} />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ color, label, sub, value }: { color: string; label: string; sub: string; value: string }) {
  return (
    <div className="px-5 py-4 border-r border-border/40 last:border-r-0" style={{ background: `linear-gradient(180deg, ${color}10, transparent)` }}>
      <div className="font-bold text-lg" style={{ color }}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-[10px] text-muted-foreground/70">{sub}</div>
    </div>
  );
}
