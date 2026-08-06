import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Coins,
  Boxes,
  AlertTriangle,
  PackageX,
  TrendingUp,
  Repeat,
} from "lucide-react";
import {
  useAllMovements,
  useInventoryItems,
  useItemGroups,
  useInventoryStores,
} from "@/hooks/use-inventory";
import { movementDirection, stockStatus } from "@/lib/inventory-store";
import { PremiumReportFrame } from "@/components/PremiumReportFrame";

const npr = (n: number) => `NPR ${Math.round(n).toLocaleString()}`;

const STATUS_COLORS = [
  "hsl(var(--success))",
  "hsl(var(--warning))",
  "hsl(var(--destructive))",
];

/**
 * Inventory analytics dashboard — KPI cards, category valuation, stock status
 * mix and turnover, all derived from live items plus the movement ledger.
 */
export function InventoryAnalytics() {
  const { data: items = [] } = useInventoryItems();
  const { data: groups = [] } = useItemGroups();
  const { data: stores = [] } = useInventoryStores();
  const { data: movements = [] } = useAllMovements();

  const groupName = (id: string) =>
    groups.find((g) => g.id === id)?.name || "Unassigned";
  const storeName = (id: string) =>
    stores.find((s) => s.id === id)?.name || "Unassigned";

  const kpis = useMemo(() => {
    const active = items.filter((i) => i.active);
    const totalValue = active.reduce((s, i) => s + i.quantity * i.rate, 0);
    const totalUnits = active.reduce((s, i) => s + i.quantity, 0);
    const low = active.filter((i) => stockStatus(i) === "low").length;
    const out = active.filter((i) => stockStatus(i) === "out").length;
    const issuedValue = movements
      .filter((m) => m.type === "issue")
      .reduce((s, m) => s + Math.abs(m.quantity) * m.rate, 0);
    const turnover = totalValue > 0 ? issuedValue / totalValue : 0;
    return {
      totalValue,
      totalUnits,
      skus: active.length,
      low,
      out,
      issuedValue,
      turnover,
      movements: movements.length,
    };
  }, [items, movements]);

  const byCategory = useMemo(() => {
    const map = new Map<
      string,
      { name: string; value: number; units: number }
    >();
    for (const i of items) {
      if (!i.active) continue;
      const name = groupName(i.groupId);
      const cur = map.get(name) || { name, value: 0, units: 0 };
      cur.value += i.quantity * i.rate;
      cur.units += i.quantity;
      map.set(name, cur);
    }
    return [...map.values()].sort((a, b) => b.value - a.value);
  }, [items, groups]);

  const statusMix = useMemo(() => {
    const active = items.filter((i) => i.active);
    return [
      {
        name: "In Stock",
        value: active.filter((i) => stockStatus(i) === "in").length,
      },
      {
        name: "Low Stock",
        value: active.filter((i) => stockStatus(i) === "low").length,
      },
      {
        name: "Out of Stock",
        value: active.filter((i) => stockStatus(i) === "out").length,
      },
    ].filter((d) => d.value > 0);
  }, [items]);

  const byStore = useMemo(() => {
    const map = new Map<string, { name: string; value: number }>();
    for (const i of items) {
      if (!i.active) continue;
      const name = storeName(i.storeId);
      const cur = map.get(name) || { name, value: 0 };
      cur.value += i.quantity * i.rate;
      map.set(name, cur);
    }
    return [...map.values()].sort((a, b) => b.value - a.value);
  }, [items, stores]);

  /** Turnover per item derived strictly from the movement ledger. */
  const turnoverRows = useMemo(() => {
    const agg = new Map<
      string,
      { received: number; issued: number; adjusted: number }
    >();
    for (const m of movements) {
      const cur = agg.get(m.itemId) || { received: 0, issued: 0, adjusted: 0 };
      if (m.type === "issue") cur.issued += Math.abs(m.quantity);
      else if (m.type === "adjustment") cur.adjusted += m.quantity;
      else if (m.type === "purchase" || m.type === "opening")
        cur.received += Math.abs(m.quantity);
      agg.set(m.itemId, cur);
    }
    return items
      .map((i) => {
        const a = agg.get(i.id) || { received: 0, issued: 0, adjusted: 0 };
        const onHandValue = i.quantity * i.rate;
        return {
          id: i.id,
          code: i.code,
          name: i.name,
          _group: groupName(i.groupId),
          received: a.received,
          issued: a.issued,
          adjusted: a.adjusted,
          quantity: i.quantity,
          _value: onHandValue,
          _turnover:
            i.quantity > 0
              ? Math.round((a.issued / i.quantity) * 100) / 100
              : a.issued > 0
                ? a.issued
                : 0,
        };
      })
      .sort((a, b) => b.issued - a.issued);
  }, [items, movements, groups]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi
          label="Total Stock Value"
          value={npr(kpis.totalValue)}
          sub={`${kpis.skus} active SKUs`}
          icon={<Coins className="h-5 w-5" />}
        />
        <Kpi
          label="Units On Hand"
          value={kpis.totalUnits.toLocaleString()}
          sub={`${kpis.movements} ledger entries`}
          icon={<Boxes className="h-5 w-5" />}
        />
        <Kpi
          label="At Reorder Point"
          value={String(kpis.low)}
          sub="Items at or below reorder level"
          icon={<AlertTriangle className="h-5 w-5" />}
        />
        <Kpi
          label="Out of Stock"
          value={String(kpis.out)}
          sub="Needs immediate purchase"
          icon={<PackageX className="h-5 w-5" />}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Kpi
          label="Issued Value (ledger)"
          value={npr(kpis.issuedValue)}
          sub="Total consumption recorded"
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <Kpi
          label="Turnover Ratio"
          value={kpis.turnover.toFixed(2)}
          sub="Issued value ÷ stock value"
          icon={<Repeat className="h-5 w-5" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="glass-card rounded-xl p-5 lg:col-span-2">
          <h3 className="font-display font-semibold mb-4">
            Stock Value by Category
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byCategory}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  stroke="hsl(var(--muted-foreground))"
                />
                <Tooltip
                  formatter={(v: number) => npr(v)}
                  cursor={false}
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar
                  dataKey="value"
                  name="Valuation"
                  fill="hsl(var(--primary))"
                  radius={[6, 6, 0, 0]}
                  barSize={45}
                  maxBarSize={45}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card rounded-xl p-5">
          <h3 className="font-display font-semibold mb-4">Stock Status Mix</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusMix}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={60}
                  outerRadius={95}
                  paddingAngle={3}
                >
                  {statusMix.map((entry, i) => (
                    <Cell
                      key={entry.name}
                      fill={STATUS_COLORS[i % STATUS_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Legend
                  verticalAlign="bottom"
                  iconType="circle"
                  wrapperStyle={{ fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="glass-card rounded-xl p-5">
        <h3 className="font-display font-semibold mb-4">
          Stock Value by Store
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byStore} layout="vertical">
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                horizontal={false}
              />
              <XAxis
                type="number"
                tick={{ fontSize: 11 }}
                stroke="hsl(var(--muted-foreground))"
              />
              <YAxis
                type="category"
                dataKey="name"
                width={130}
                tick={{ fontSize: 11 }}
                stroke="hsl(var(--muted-foreground))"
              />
              <Tooltip
                formatter={(v: number) => npr(v)}
                cursor={false}
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Bar
                dataKey="value"
                name="Valuation"
                fill="hsl(var(--primary))"
                radius={[0, 6, 6, 0]}
                barSize={45}
                maxBarSize={45}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <PremiumReportFrame
        title="Turnover Analysis"
        subtitle="Received / issued quantities computed from the stock movement ledger"
        propertyName="............."
        sortable
        defaultSortKey="issued"
        defaultSortDir="desc"
        columns={[
          { key: "code", label: "SKU", width: "110px" },
          { key: "name", label: "Item" },
          { key: "_group", label: "Category", width: "150px" },
          {
            key: "received",
            label: "Received",
            align: "right",
            width: "100px",
          },
          { key: "issued", label: "Issued", align: "right", width: "100px" },
          {
            key: "adjusted",
            label: "Adjusted",
            align: "right",
            width: "100px",
            format: (r) => (r.adjusted > 0 ? `+${r.adjusted}` : r.adjusted),
            exportFormat: (r) => String(r.adjusted),
          },
          { key: "quantity", label: "On Hand", align: "right", width: "100px" },
          {
            key: "_value",
            label: "Value (NPR)",
            align: "right",
            width: "130px",
            format: (r) => Math.round(r._value).toLocaleString(),
            exportFormat: (r) => String(Math.round(r._value)),
          },
          {
            key: "_turnover",
            label: "Turnover",
            align: "right",
            width: "100px",
            format: (r) => r._turnover.toFixed(2),
            exportFormat: (r) => String(r._turnover),
          },
        ]}
        rows={turnoverRows}
        exportFilename="inventory_turnover"
        emptyMessage="No inventory activity recorded yet."
      />
    </div>
  );
}

function Kpi({
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
    <div className="glass-card rounded-xl p-5 flex items-start justify-between">
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold font-display tracking-tight">
          {value}
        </p>
        <p className="text-xs text-muted-foreground mt-1">{sub}</p>
      </div>
      <div className="h-11 w-11 rounded-xl bg-muted flex items-center justify-center">
        {icon}
      </div>
    </div>
  );
}
