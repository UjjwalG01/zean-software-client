import { useMemo } from "react";
import { Activity, Calendar as CalIcon, CreditCard, TrendingUp, Award, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatNPR, type Member, type Booking, type Transaction } from "@/lib/mock-data";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from "recharts";
import { format, parseISO, startOfMonth, subMonths, isAfter } from "date-fns";
import { printHTML } from "@/lib/print-utils";
import { toast } from "sonner";

const tooltipStyle = {
  background: "hsl(224, 20%, 12%)",
  border: "1px solid hsl(224, 15%, 18%)",
  borderRadius: 8,
  color: "hsl(40, 20%, 95%)",
};

const COLORS = ["hsl(38, 92%, 50%)", "hsl(280, 60%, 55%)", "hsl(15, 80%, 55%)", "hsl(200, 80%, 50%)", "hsl(142, 71%, 45%)"];

interface Props {
  member: Member;
  bookings: Booking[];
  transactions: Transaction[];
  propertyName?: string;
}

function safeDate(s: string): Date | null {
  try { const d = parseISO(s); return Number.isNaN(d.getTime()) ? null : d; } catch { return null; }
}

export function MemberProgress({ member, bookings, transactions, propertyName = "VitaFit Club" }: Props) {
  const stats = useMemo(() => {
    const total = bookings.length;
    const completed = bookings.filter((b) => b.status === "Completed").length;
    const upcoming = bookings.filter((b) => {
      const d = safeDate(b.date); return d && isAfter(d, new Date());
    }).length;
    const totalSpent = transactions.reduce((s, t) => s + (t.total || 0), 0);
    const txCount = transactions.length;
    const attendance = total > 0 ? Math.round((completed / total) * 100) : 0;
    const avgSpend = txCount > 0 ? totalSpent / txCount : 0;
    return { total, completed, upcoming, totalSpent, txCount, attendance, avgSpend };
  }, [bookings, transactions]);

  const monthlyTrend = useMemo(() => {
    const map: Record<string, { month: string; visits: number; spend: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const d = startOfMonth(subMonths(new Date(), i));
      const key = format(d, "MMM");
      map[key] = { month: key, visits: 0, spend: 0 };
    }
    bookings.forEach((b) => {
      const d = safeDate(b.date); if (!d) return;
      const key = format(d, "MMM");
      if (map[key]) map[key].visits += 1;
    });
    transactions.forEach((t) => {
      const d = safeDate(t.date); if (!d) return;
      const key = format(d, "MMM");
      if (map[key]) map[key].spend += t.total || 0;
    });
    return Object.values(map);
  }, [bookings, transactions]);

  const serviceMix = useMemo(() => {
    const counts: Record<string, number> = {};
    bookings.forEach((b) => { counts[b.service] = (counts[b.service] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [bookings]);

  const generateReportCard = () => {
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Progress Report — ${member.name}</title>
<style>
@page { size: A4 portrait; margin: 16mm; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: 'Helvetica', Arial, sans-serif; color: #0f172a; margin: 0; padding: 0; }
.header { background: linear-gradient(135deg, #1e3a8a, #3b82f6); color: #fff; padding: 28px 32px; border-radius: 12px; margin-bottom: 24px; }
.header h1 { font-size: 24px; margin: 0 0 6px; }
.header p { margin: 2px 0; opacity: .9; font-size: 12px; }
.section { margin-bottom: 24px; }
.section-title { font-size: 13px; text-transform: uppercase; letter-spacing: 1.5px; color: #1e3a8a; font-weight: 800; border-bottom: 2px solid #1e3a8a; padding-bottom: 6px; margin-bottom: 14px; }
.grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; }
.card .label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }
.card .value { font-size: 22px; font-weight: 800; color: #0f172a; margin-top: 4px; }
.card .sub { font-size: 11px; color: #64748b; margin-top: 4px; }
table { width: 100%; border-collapse: collapse; font-size: 12px; }
th { background: #1e3a8a; color: #fff; text-align: left; padding: 8px 10px; font-weight: 600; }
td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; }
.bar-row { display: flex; align-items: center; gap: 12px; padding: 6px 0; font-size: 12px; }
.bar-row .label { width: 100px; color: #475569; }
.bar-row .bar { flex: 1; background: #e2e8f0; height: 10px; border-radius: 6px; overflow: hidden; }
.bar-row .bar > div { height: 100%; background: linear-gradient(90deg, #3b82f6, #1e3a8a); }
.bar-row .val { width: 60px; text-align: right; font-weight: 600; }
.footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 10px; text-align: center; }
</style></head><body>
  <div class="header">
    <h1>${member.name} — Member Progress Report</h1>
    <p>${propertyName} · Tier: ${member.tier} · Status: ${member.status}</p>
    <p>Plan: ${member.plan || "—"} · Joined: ${member.joinDate} · Report date: ${format(new Date(), "PPP")}</p>
  </div>

  <div class="section">
    <div class="section-title">Key Metrics</div>
    <div class="grid">
      <div class="card"><div class="label">Total Sessions</div><div class="value">${stats.total}</div><div class="sub">All-time bookings</div></div>
      <div class="card"><div class="label">Completed</div><div class="value">${stats.completed}</div><div class="sub">Attendance ${stats.attendance}%</div></div>
      <div class="card"><div class="label">Upcoming</div><div class="value">${stats.upcoming}</div><div class="sub">Future bookings</div></div>
      <div class="card"><div class="label">Total Spend</div><div class="value">${formatNPR(stats.totalSpent)}</div><div class="sub">${stats.txCount} transactions</div></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Last 6 Months — Visits</div>
    ${monthlyTrend.map((m) => {
      const max = Math.max(1, ...monthlyTrend.map((x) => x.visits));
      const w = Math.round((m.visits / max) * 100);
      return `<div class="bar-row"><div class="label">${m.month}</div><div class="bar"><div style="width:${w}%"></div></div><div class="val">${m.visits}</div></div>`;
    }).join("")}
  </div>

  <div class="section">
    <div class="section-title">Service Mix</div>
    <table>
      <thead><tr><th>Service</th><th style="text-align:right">Sessions</th><th style="text-align:right">Share</th></tr></thead>
      <tbody>
        ${serviceMix.length === 0 ? `<tr><td colspan="3" style="text-align:center;color:#94a3b8">No sessions yet</td></tr>` :
          serviceMix.map((s) => `<tr><td>${s.name}</td><td style="text-align:right">${s.value}</td><td style="text-align:right">${Math.round((s.value/stats.total)*100)}%</td></tr>`).join("")}
      </tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Recent Payments</div>
    <table>
      <thead><tr><th>Date</th><th>Receipt</th><th>Description</th><th>Method</th><th style="text-align:right">Amount</th></tr></thead>
      <tbody>
        ${transactions.slice(0, 10).map((t) => `<tr><td>${t.date}</td><td>${t.receiptNo}</td><td>${t.description}</td><td>${t.method}</td><td style="text-align:right">${formatNPR(t.total)}</td></tr>`).join("") || `<tr><td colspan="5" style="text-align:center;color:#94a3b8">No payments</td></tr>`}
      </tbody>
    </table>
  </div>

  <div class="footer">Generated ${new Date().toLocaleString()} · ${propertyName}</div>
  <script>window.onload=()=>{setTimeout(()=>window.print(),200)}</script>
</body></html>`;
    printHTML(html);
    toast.success("Report ready — choose Save as PDF in the print dialog");
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display font-bold flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> Progress Overview</h3>
          <p className="text-xs text-muted-foreground">Track sessions, attendance and spend over time.</p>
        </div>
        <Button onClick={generateReportCard} size="sm" className="gradient-gold text-primary-foreground">
          <Download className="h-4 w-4 mr-1" /> Download Report Card (PDF)
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Sessions", value: stats.total, sub: "All-time", icon: CalIcon, color: "text-primary" },
          { label: "Completed", value: stats.completed, sub: `${stats.attendance}% attendance`, icon: Award, color: "text-success" },
          { label: "Upcoming", value: stats.upcoming, sub: "Future bookings", icon: Activity, color: "text-blue-400" },
          { label: "Total Spend", value: formatNPR(stats.totalSpent), sub: `${stats.txCount} payments`, icon: CreditCard, color: "text-amber-400" },
        ].map((s) => (
          <div key={s.label} className="glass-card rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className={`h-8 w-8 rounded-lg bg-muted/40 flex items-center justify-center ${s.color}`}>
                <s.icon className="h-4 w-4" />
              </span>
              <span className="text-[10px] uppercase text-muted-foreground tracking-wider">{s.label}</span>
            </div>
            <p className="text-xl font-bold font-display">{s.value}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="glass-card rounded-xl p-4 lg:col-span-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Visits &amp; Spend — Last 6 Months</p>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(224, 15%, 18%)" />
              <XAxis dataKey="month" tick={{ fill: "hsl(220, 10%, 55%)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="left" tick={{ fill: "hsl(220, 10%, 55%)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: "hsl(220, 10%, 55%)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line yAxisId="left" type="monotone" dataKey="visits" stroke="hsl(38, 92%, 50%)" strokeWidth={2.5} name="Visits" />
              <Line yAxisId="right" type="monotone" dataKey="spend" stroke="hsl(200, 80%, 50%)" strokeWidth={2.5} name="Spend (NPR)" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card rounded-xl p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Service Mix</p>
          {serviceMix.length === 0 ? (
            <p className="text-xs text-muted-foreground py-12 text-center">No sessions yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={serviceMix} innerRadius={50} outerRadius={90} dataKey="value" paddingAngle={3} stroke="none">
                  {serviceMix.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
