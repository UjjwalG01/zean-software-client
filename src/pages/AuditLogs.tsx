import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { listAuditLogs, type AuditRow } from "@/lib/audit-log";
import { getModules, type AppModule } from "@/lib/modules";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

const todayISO = () => format(new Date(), "yyyy-MM-dd");
const daysAgoISO = (n: number) => {
  const d = new Date(); d.setDate(d.getDate() - n);
  return format(d, "yyyy-MM-dd");
};

const AuditLogs = () => {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modules, setModules] = useState<AppModule[]>([]);
  const [moduleFilter, setModuleFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  // Default to today's date range
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());
  const [search, setSearch] = useState("");

  useEffect(() => {
    getModules().then(setModules).catch(() => setModules([]));
  }, []);

  const load = async () => {
    setLoading(true);
    const data = await listAuditLogs({
      module: moduleFilter,
      action: actionFilter,
      from: from ? new Date(from).toISOString() : undefined,
      to: to ? new Date(to + "T23:59:59").toISOString() : undefined,
      search,
    });
    setRows(data);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const actions = useMemo(() => {
    const s = new Set<string>(["all"]);
    rows.forEach((r) => r.action && s.add(r.action));
    return Array.from(s);
  }, [rows]);

  const applyQuickRange = (n: number) => {
    if (n === 0) { setFrom(todayISO()); setTo(todayISO()); }
    else { setFrom(daysAgoISO(n)); setTo(todayISO()); }
    setTimeout(load, 0);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold font-display">Audit Log</h1>
        <p className="text-muted-foreground text-sm">Track changes across the application. Default view: today.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
        <Input placeholder="Search user / id / action" value={search} onChange={(e) => setSearch(e.target.value)} className="sm:col-span-2 bg-muted/50 border-0" />
        <Select value={moduleFilter} onValueChange={setModuleFilter}>
          <SelectTrigger className="bg-muted/50 border-0"><SelectValue placeholder="Module" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Modules</SelectItem>
            {modules.map((m) => <SelectItem key={m.slug} value={m.name}>{m.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="bg-muted/50 border-0"><SelectValue placeholder="Action" /></SelectTrigger>
          <SelectContent>{actions.map((a) => <SelectItem key={a} value={a}>{a === "all" ? "All Actions" : a}</SelectItem>)}</SelectContent>
        </Select>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="bg-muted/50 border-0" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="bg-muted/50 border-0" />
        <div className="sm:col-span-6 flex items-center gap-2 flex-wrap">
          <Button size="sm" onClick={load}>Apply Filters</Button>
          <Button size="sm" variant="outline" onClick={() => applyQuickRange(0)}>Today</Button>
          <Button size="sm" variant="outline" onClick={() => { setFrom(daysAgoISO(1)); setTo(daysAgoISO(1)); setTimeout(load, 0); }}>Yesterday</Button>
          <Button size="sm" variant="outline" onClick={() => applyQuickRange(6)}>Last 7d</Button>
          <Button size="sm" variant="outline" onClick={() => applyQuickRange(29)}>Last 30d</Button>
        </div>
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 rounded" />)}</div>
        ) : rows.length === 0 ? (
          <p className="text-center text-muted-foreground py-10 text-sm">No audit entries match your filters.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[160px]">When</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Old → New</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs">{format(new Date(r.ts), "yyyy-MM-dd HH:mm:ss")}</TableCell>
                  <TableCell className="text-sm">{r.user_email || r.user_id || "—"}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{r.module}</Badge></TableCell>
                  <TableCell><Badge className="text-[10px] bg-primary/20 text-primary border-0">{r.action}</Badge></TableCell>
                  <TableCell className="font-mono text-[11px] text-muted-foreground">{r.entity_id || "—"}</TableCell>
                  <TableCell className="text-[11px] max-w-[420px]">
                    {r.old_value || r.new_value ? (
                      <details>
                        <summary className="cursor-pointer text-muted-foreground">view diff</summary>
                        <pre className="whitespace-pre-wrap break-all bg-muted/30 p-2 rounded mt-1">
{JSON.stringify({ old: r.old_value, new: r.new_value }, null, 2)}
                        </pre>
                      </details>
                    ) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
};

export default AuditLogs;
