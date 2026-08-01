import { useMemo, useState } from "react";
import { PremiumReportFrame } from "@/components/PremiumReportFrame";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useAllMovements,
  useInventoryItems,
  useInventoryStores,
  useItemGroups,
  useInventorySuppliers,
} from "@/hooks/use-inventory";
import {
  MOVEMENT_LABEL,
  movementDirection,
  type MovementType,
} from "@/lib/inventory-store";
import { getSystemTodayStr } from "@/lib/timeUtils";
import { formatDateTime } from "@/lib/tz";

interface Props {
  propertyName?: string;
}

/**
 * Inventory reporting block for the Reports page:
 * 1. Stock Position — valuation by item / store / category (current snapshot).
 * 2. Stock Movement Register — date-ranged ledger, the audit source for stock.
 */
export function InventoryReports({ propertyName = "" }: Props) {
  const { data: items = [] } = useInventoryItems();
  const { data: movements = [] } = useAllMovements();
  const { data: stores = [] } = useInventoryStores();
  const { data: groups = [] } = useItemGroups();
  const { data: suppliers = [] } = useInventorySuppliers();

  const [storeFilter, setStoreFilter] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState(getSystemTodayStr());

  const storeName = (id?: string) =>
    (id && stores.find((s) => s.id === id)?.name) || "—";
  const groupName = (id?: string) =>
    (id && groups.find((g) => g.id === id)?.name) || "—";
  const supplierName = (id?: string) =>
    (id && suppliers.find((s) => s.id === id)?.name) || "—";

  const positionRows = useMemo(
    () =>
      items
        .filter((i) => storeFilter === "all" || i.storeId === storeFilter)
        .map((i) => ({
          ...i,
          _store: storeName(i.storeId),
          _group: groupName(i.groupId),
          _supplier: supplierName(i.supplierId),
          _valuation: i.quantity * i.rate,
        })),
    [items, storeFilter, stores, groups, suppliers],
  );

  const positionTotals = useMemo(
    () => ({
      qty: positionRows.reduce((s, r) => s + r.quantity, 0),
      val: positionRows.reduce((s, r) => s + r._valuation, 0),
    }),
    [positionRows],
  );

  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const registerRows = useMemo(() => {
    return movements
      .filter((m) => {
        const day = (m.createdAt || "").slice(0, 10);
        if (from && day < from) return false;
        if (to && day > to) return false;
        const item = itemById.get(m.itemId);
        if (storeFilter !== "all" && item && item.storeId !== storeFilter)
          return false;
        return true;
      })
      .map((m) => {
        const item = itemById.get(m.itemId);
        const dir = movementDirection(m);
        return {
          ...m,
          _date: formatDateTime(m.createdAt),
          _item: item ? `${item.code} — ${item.name}` : m.itemId,
          _type: MOVEMENT_LABEL[m.type as MovementType] ?? m.type,
          _dir: dir === "in" ? "In" : "Out",
          _qty: `${dir === "in" ? "+" : "−"}${Math.abs(m.quantity)}`,
          _value: Math.abs(m.quantity) * (m.rate || item?.rate || 0),
          _store: storeName(item?.storeId),
          _by: m.performedByName || "—",
        };
      });
  }, [movements, from, to, storeFilter, itemById, stores]);

  const registerTotals = useMemo(
    () => ({
      inQty: registerRows
        .filter((r) => r._dir === "In")
        .reduce((s, r) => s + Math.abs(r.quantity), 0),
      outQty: registerRows
        .filter((r) => r._dir === "Out")
        .reduce((s, r) => s + Math.abs(r.quantity), 0),
      value: registerRows.reduce((s, r) => s + r._value, 0),
    }),
    [registerRows],
  );

  const storeSelect = (
    <div>
      <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
        Store
      </label>
      <Select value={storeFilter} onValueChange={setStoreFilter}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All stores</SelectItem>
          {stores.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="space-y-6">
      <PremiumReportFrame
        title="Stock Position"
        subtitle="Current valuation by item, category and store (Quantity × Avg Rate, VAT inclusive)."
        propertyName={propertyName}
        sortable
        defaultSortKey="name"
        filters={
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {storeSelect}
          </div>
        }
        columns={[
          { key: "name", label: "Item" },
          { key: "code", label: "SKU", width: "120px" },
          { key: "_group", label: "Category", width: "150px" },
          { key: "_store", label: "Location", width: "150px" },
          { key: "_supplier", label: "Supplier", width: "150px" },
          {
            key: "quantity",
            label: "Qty",
            align: "right",
            width: "90px",
          },
          {
            key: "rate",
            label: "Rate (NPR)",
            align: "right",
            width: "110px",
            format: (r) => r.rate.toLocaleString(),
            exportFormat: (r) => String(r.rate),
          },
          {
            key: "_valuation",
            label: "Valuation (NPR)",
            align: "right",
            width: "140px",
            format: (r) => (
              <span className="font-semibold text-primary">
                {Math.round(r._valuation).toLocaleString()}
              </span>
            ),
            exportFormat: (r) => String(Math.round(r._valuation)),
          },
        ]}
        rows={positionRows}
        footerTotals={{
          label: "Totals",
          cells: {
            quantity: <span>{positionTotals.qty}</span>,
            _valuation: (
              <span className="text-primary">
                NPR {Math.round(positionTotals.val).toLocaleString()}
              </span>
            ),
          },
        }}
        exportFilename="stock_position"
        emptyMessage="No stock items for the selected store."
      />

      <PremiumReportFrame
        title="Stock Movement Register"
        subtitle="Every received, issued, adjusted and transferred unit in the selected period."
        propertyName={propertyName}
        sortable
        defaultSortKey="createdAt"
        defaultSortDir="desc"
        filters={
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            {storeSelect}
            <div className="md:col-span-2">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Date range
              </label>
              <DateRangeFilter
                from={from}
                to={to}
                onChange={(r) => {
                  setFrom(r.from);
                  setTo(r.to);
                }}
              />
            </div>
          </div>
        }
        columns={[
          { key: "_date", label: "Date / Time", width: "170px" },
          { key: "_type", label: "Type", width: "120px" },
          { key: "_item", label: "Item" },
          { key: "_store", label: "Location", width: "140px" },
          { key: "_dir", label: "Direction", align: "center", width: "100px" },
          {
            key: "_qty",
            label: "Qty",
            align: "right",
            width: "90px",
            format: (r) => (
              <span
                className={
                  r._dir === "In"
                    ? "text-success font-medium"
                    : "text-destructive font-medium"
                }
              >
                {r._qty}
              </span>
            ),
            exportFormat: (r) => r._qty,
          },
          {
            key: "_value",
            label: "Value (NPR)",
            align: "right",
            width: "120px",
            format: (r) => Math.round(r._value).toLocaleString(),
            exportFormat: (r) => String(Math.round(r._value)),
          },
          { key: "_by", label: "Performed By", width: "150px" },
          {
            key: "reference",
            label: "Reference",
            width: "150px",
            format: (r) => r.reference || "—",
            exportFormat: (r) => r.reference || "",
          },
        ]}
        rows={registerRows}
        footerTotals={{
          label: `In ${registerTotals.inQty} · Out ${registerTotals.outQty}`,
          cells: {
            _value: (
              <span className="text-primary">
                NPR {Math.round(registerTotals.value).toLocaleString()}
              </span>
            ),
          },
        }}
        exportFilename="stock_movement_register"
        emptyMessage="No stock movements recorded in this period."
      />
    </div>
  );
}
