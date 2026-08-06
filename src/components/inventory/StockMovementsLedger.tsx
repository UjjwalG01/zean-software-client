import { useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  SlidersHorizontal,
  Repeat,
  Layers,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PremiumReportFrame } from "@/components/PremiumReportFrame";
import {
  useAllMovements,
  useInventoryItems,
  useInventoryStores,
} from "@/hooks/use-inventory";
import {
  MOVEMENT_LABEL,
  movementDirection,
  type MovementType,
} from "@/lib/inventory-store";
import { formatDateTime } from "@/lib/tz";
import { getSystemTodayStr } from "@/lib/timeUtils";

const TYPES: MovementType[] = [
  "opening",
  "purchase",
  "issue",
  "adjustment",
  "transfer",
];

const typeVariant = (t: MovementType) =>
  t === "issue"
    ? "destructive"
    : t === "purchase"
      ? "default"
      : t === "transfer"
        ? "outline"
        : "secondary";

/**
 * Stock Movements ledger — the single source of truth for every inventory
 * action (received, issued, adjusted, transferred, opening balance).
 */
export function StockMovementsLedger() {
  const { data: movements = [] } = useAllMovements();
  const { data: items = [] } = useInventoryItems();
  const { data: stores = [] } = useInventoryStores();

  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [itemFilter, setItemFilter] = useState<string>("all");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>(getSystemTodayStr());
  const [performedBy, setPerformedBy] = useState<string>("all");
  const [search, setSearch] = useState("");

  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const storeName = (id?: string) =>
    (id && stores.find((s) => s.id === id)?.name) || "—";

  const actors = useMemo(() => {
    const set = new Set<string>();
    movements.forEach((m) => m.performedByName && set.add(m.performedByName));
    return [...set].sort();
  }, [movements]);

  const filtered = useMemo(() => {
    return movements.filter((m) => {
      if (typeFilter !== "all" && m.type !== typeFilter) return false;
      if (itemFilter !== "all" && m.itemId !== itemFilter) return false;
      if (performedBy !== "all" && (m.performedByName || "") !== performedBy)
        return false;
      const day = (m.createdAt || "").slice(0, 10);
      if (from && day < from) return false;
      if (to && day > to) return false;
      if (search) {
        const q = search.toLowerCase();
        const it = itemById.get(m.itemId);
        const hay =
          `${it?.name || ""} ${it?.code || ""} ${m.reference || ""} ${m.note || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    movements,
    typeFilter,
    itemFilter,
    performedBy,
    from,
    to,
    search,
    itemById,
  ]);

  const summary = useMemo(() => {
    let inQty = 0;
    let outQty = 0;
    let inValue = 0;
    let outValue = 0;
    for (const m of filtered) {
      const qty = Math.abs(m.quantity);
      if (m.type === "transfer") continue;
      if (movementDirection(m) === "in") {
        inQty += qty;
        inValue += qty * m.rate;
      } else {
        outQty += qty;
        outValue += qty * m.rate;
      }
    }
    const transfers = filtered.filter((m) => m.type === "transfer").length;
    return {
      inQty,
      outQty,
      inValue,
      outValue,
      transfers,
      count: filtered.length,
    };
  }, [filtered]);

  const rows = filtered.map((m) => {
    const it = itemById.get(m.itemId);
    const dir = movementDirection(m);
    return {
      ...m,
      _date: m.createdAt,
      _item: it ? `${it.name}` : "—",
      _code: it?.code || "—",
      _unit: it?.unit || "",
      _type: MOVEMENT_LABEL[m.type],
      _signedQty: dir === "in" ? Math.abs(m.quantity) : -Math.abs(m.quantity),
      _value: Math.abs(m.quantity) * m.rate,
      _location:
        m.type === "transfer"
          ? `${storeName(m.fromStoreId)} → ${storeName(m.toStoreId)}`
          : storeName(m.toStoreId || m.fromStoreId || it?.storeId),
      _by: m.performedByName || "System",
      _ref: m.reference || m.note || "—",
    };
  });

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          label="Stock In"
          value={`${summary.inQty}`}
          sub={`NPR ${Math.round(summary.inValue).toLocaleString()}`}
          icon={<ArrowDownLeft className="h-5 w-5" />}
        />
        <SummaryCard
          label="Stock Out"
          value={`${summary.outQty}`}
          sub={`NPR ${Math.round(summary.outValue).toLocaleString()}`}
          icon={<ArrowUpRight className="h-5 w-5" />}
        />
        <SummaryCard
          label="Transfers"
          value={`${summary.transfers}`}
          sub="Between stores"
          icon={<Repeat className="h-5 w-5" />}
        />
        <SummaryCard
          label="Total Movements"
          value={`${summary.count}`}
          sub="Matching filters"
          icon={<Layers className="h-5 w-5" />}
        />
      </div>

      <PremiumReportFrame
        title="Stock Movements"
        subtitle="Every received, issued, adjusted and transferred quantity"
        propertyName="............."
        sortable
        defaultSortKey="_date"
        defaultSortDir="desc"
        filters={
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div>
              <FilterLabel>Type</FilterLabel>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {MOVEMENT_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <FilterLabel>Item</FilterLabel>
              <Select value={itemFilter} onValueChange={setItemFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All items</SelectItem>
                  {items.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.code} — {i.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <FilterLabel>From</FilterLabel>
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div>
              <FilterLabel>To</FilterLabel>
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            <div>
              <FilterLabel>Performed By</FilterLabel>
              <Select value={performedBy} onValueChange={setPerformedBy}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Anyone</SelectItem>
                  {actors.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <FilterLabel>Search</FilterLabel>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Item or reference"
                  className="pl-8"
                />
              </div>
            </div>
          </div>
        }
        columns={[
          {
            key: "_date",
            label: "Date & Time",
            width: "160px",
            format: (r) => (
              <span className="text-xs">{formatDateTime(r._date)}</span>
            ),
            exportFormat: (r) => formatDateTime(r._date),
          },
          {
            key: "_type",
            label: "Type",
            width: "120px",
            format: (r) => (
              <Badge variant={typeVariant(r.type)} className="capitalize">
                {r._type}
              </Badge>
            ),
            exportFormat: (r) => r._type,
          },
          { key: "_code", label: "SKU", width: "110px" },
          { key: "_item", label: "Item" },
          {
            key: "_signedQty",
            label: "Qty",
            align: "right",
            width: "90px",
            format: (r) => (
              <span
                className={
                  r._signedQty >= 0
                    ? "font-semibold text-success"
                    : "font-semibold text-destructive"
                }
              >
                {r._signedQty >= 0 ? "+" : ""}
                {r._signedQty} {r._unit}
              </span>
            ),
            exportFormat: (r) => String(r._signedQty),
          },
          {
            key: "balanceAfter",
            label: "Balance",
            align: "right",
            width: "90px",
            format: (r) =>
              r.balanceAfter === undefined ? "—" : r.balanceAfter,
            exportFormat: (r) =>
              r.balanceAfter === undefined ? "" : String(r.balanceAfter),
          },
          {
            key: "_value",
            label: "Value (NPR)",
            align: "right",
            width: "120px",
            format: (r) => Math.round(r._value).toLocaleString(),
            exportFormat: (r) => String(Math.round(r._value)),
          },
          { key: "_location", label: "Location", width: "180px" },
          { key: "_by", label: "Performed By", width: "140px" },
          {
            key: "_ref",
            label: "Reference / Note",
            format: (r) => (
              <span className="text-xs text-muted-foreground">{r._ref}</span>
            ),
          },
        ]}
        rows={rows}
        exportFilename="stock_movements"
        emptyMessage="No stock movements match the current filters."
      />
    </div>
  );
}

function FilterLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
      <SlidersHorizontal className="h-3 w-3 opacity-50" />
      {children}
    </label>
  );
}

function SummaryCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="glass-card rounded-xl p-4 flex items-start justify-between">
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold font-display">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
      </div>
      <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
        {icon}
      </div>
    </div>
  );
}
