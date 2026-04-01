import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Users, CalendarDays, Receipt, Settings, UserCheck, TrendingUp, BarChart3 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useMembers, useBookings, useTransactions } from "@/hooks/use-firestore";
import { cn } from "@/lib/utils";

interface SearchResult {
  id: string;
  label: string;
  sublabel: string;
  type: "member" | "booking" | "transaction" | "page";
  url: string;
  icon: React.ElementType;
}

const staticPages: SearchResult[] = [
  { id: "p-dash", label: "Dashboard", sublabel: "Overview & stats", type: "page", url: "/", icon: BarChart3 },
  { id: "p-members", label: "Members", sublabel: "Member list", type: "page", url: "/members", icon: Users },
  { id: "p-bookings", label: "Bookings", sublabel: "Calendar & list", type: "page", url: "/bookings", icon: CalendarDays },
  { id: "p-transactions", label: "Transactions", sublabel: "Payments & receipts", type: "page", url: "/transactions", icon: Receipt },
  { id: "p-attendance", label: "Attendance", sublabel: "Daily check-in", type: "page", url: "/attendance", icon: UserCheck },
  { id: "p-forecast", label: "Forecast", sublabel: "Upcoming bookings", type: "page", url: "/forecast", icon: TrendingUp },
  { id: "p-setup", label: "General Setup", sublabel: "Classes, services, plans", type: "page", url: "/setup/general", icon: Settings },
  { id: "p-plans", label: "Plans & Services", sublabel: "Membership tiers", type: "page", url: "/setup/plans", icon: Settings },
  { id: "p-settings", label: "Settings", sublabel: "Company config", type: "page", url: "/setup/settings", icon: Settings },
];

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();

  const { data: members = [] } = useMembers();
  const { data: bookings = [] } = useBookings();
  const { data: transactions = [] } = useTransactions();

  // Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const results = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return staticPages.slice(0, 6);

    const items: SearchResult[] = [];

    // Pages
    staticPages.forEach((p) => {
      if (p.label.toLowerCase().includes(q) || p.sublabel.toLowerCase().includes(q)) items.push(p);
    });

    // Members
    members.forEach((m) => {
      if (m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q) || m.phone.includes(q)) {
        items.push({ id: `m-${m.id}`, label: m.name, sublabel: `${m.tier} • ${m.status}`, type: "member", url: `/members/${m.id}`, icon: Users });
      }
    });

    // Bookings
    bookings.forEach((b) => {
      if (b.memberName.toLowerCase().includes(q) || b.className.toLowerCase().includes(q) || b.service.toLowerCase().includes(q)) {
        items.push({ id: `b-${b.id}`, label: `${b.className} — ${b.memberName}`, sublabel: `${b.date} • ${b.service}`, type: "booking", url: "/bookings", icon: CalendarDays });
      }
    });

    // Transactions
    transactions.forEach((t) => {
      if (t.memberName.toLowerCase().includes(q) || t.receiptNo.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)) {
        items.push({ id: `t-${t.id}`, label: t.receiptNo, sublabel: `${t.memberName} • ${t.description}`, type: "transaction", url: "/transactions", icon: Receipt });
      }
    });

    return items.slice(0, 12);
  }, [query, members, bookings, transactions]);

  useEffect(() => { setSelectedIndex(0); }, [query]);

  const handleSelect = (result: SearchResult) => {
    setOpen(false);
    setQuery("");
    navigate(result.url);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIndex((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIndex((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && results[selectedIndex]) { handleSelect(results[selectedIndex]); }
  };

  const typeLabel: Record<string, string> = { member: "Member", booking: "Booking", transaction: "Transaction", page: "Page" };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery(""); }}>
      <DialogContent className="sm:max-w-[520px] p-0 gap-0 overflow-hidden">
        <div className="flex items-center border-b border-border px-4">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            placeholder="Search members, bookings, pages..."
            className="border-0 focus-visible:ring-0 h-12 text-sm"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          <kbd className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono shrink-0">ESC</kbd>
        </div>
        <div className="max-h-[320px] overflow-y-auto p-2">
          {results.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">No results found</p>
          ) : (
            results.map((r, i) => (
              <button
                key={r.id}
                className={cn(
                  "w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                  i === selectedIndex ? "bg-accent text-accent-foreground" : "hover:bg-muted/50"
                )}
                onClick={() => handleSelect(r)}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                <r.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{r.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{r.sublabel}</p>
                </div>
                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">{typeLabel[r.type]}</span>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
