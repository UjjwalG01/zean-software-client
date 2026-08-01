import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Package,
  Plus,
  PackagePlus,
  PackageMinus,
  Search,
  Pencil,
  Trash2,
  History,
  Boxes,
  AlertTriangle,
  Coins,
  Warehouse,
  RefreshCw,
  SlidersHorizontal,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/StatCard";
import { PremiumReportFrame } from "@/components/PremiumReportFrame";
import { InventoryTabsNav } from "@/components/inventory/InventoryTabsNav";
import {
  useInventoryItems,
  useInventoryStores,
  useItemGroups,
  useInventorySuppliers,
  useInventoryMutations,
} from "@/hooks/use-inventory";
import { AddItemModal } from "@/components/inventory/AddItemModal";
import { AddStockModal, type LogMovementMode } from "@/components/inventory/AddStockModal";
import { MovementsDrawer } from "@/components/inventory/MovementsDrawer";
import type { InventoryItem } from "@/lib/inventory-store";
import { toast } from "sonner";
import { parseItemsCsv } from "@/lib/inventory-csv";
import {
  underlineFirstChar,
  underlineSpecificChars,
} from "@/lib/string-case-change";



export default function Inventory() {
  const qc = useQueryClient();
  const { data: items = [], isFetching } = useInventoryItems();
  const { data: stores = [] } = useInventoryStores();
  const { data: groups = [] } = useItemGroups();
  const { data: suppliers = [] } = useInventorySuppliers();
  const { removeItem } = useInventoryMutations();

  const [supplierFilter, setSupplierFilter] = useState<string>("all");
  const [storeFilter, setStoreFilter] = useState<string>("all");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const [addItemOpen, setAddItemOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [stockMode, setStockMode] = useState<LogMovementMode | null>(null);
  const [stockDefaultItemId, setStockDefaultItemId] = useState<
    string | undefined
  >();
  const [movementsItemId, setMovementsItemId] = useState<string | null>(null);

  const storeName = (id: string) =>
    stores.find((s) => s.id === id)?.name || "—";
  const groupName = (id: string) =>
    groups.find((g) => g.id === id)?.name || "—";
  const supplierName = (id?: string) =>
    (id && suppliers.find((s) => s.id === id)?.name) || "—";


  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (storeFilter !== "all" && i.storeId !== storeFilter) return false;
      if (supplierFilter !== "all" && i.supplierId !== supplierFilter) return false;
      if (groupFilter !== "all" && i.groupId !== groupFilter) return false;
      if (
        statusFilter === "low" &&
        !(i.quantity > 0 && i.quantity <= i.reorderLevel)
      )
        return false;
      if (statusFilter === "out" && i.quantity !== 0) return false;
      if (statusFilter === "in" && !(i.quantity > i.reorderLevel)) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !i.name.toLowerCase().includes(q) &&
          !i.code.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [items, storeFilter, supplierFilter, groupFilter, statusFilter, search]);

  const totals = useMemo(() => {
    const qty = filtered.reduce((s, i) => s + i.quantity, 0);
    const val = filtered.reduce((s, i) => s + i.quantity * i.rate, 0);
    return { qty, val };
  }, [filtered]);

  const allVal = items.reduce((s, i) => s + i.quantity * i.rate, 0);
  const lowCount = items.filter(
    (i) => i.active && i.quantity <= i.reorderLevel,
  ).length;

  const statusLabel = (i: InventoryItem) =>
    i.quantity === 0
      ? "Out of Stock"
      : i.quantity <= i.reorderLevel
        ? "Low Stock"
        : "In Stock";

  const statusDot = (i: InventoryItem) =>
    i.quantity === 0
      ? "bg-destructive"
      : i.quantity <= i.reorderLevel
        ? "bg-warning"
        : "bg-success";

  const statusBadge = (i: InventoryItem) => {
    if (i.quantity === 0) return <Badge variant="destructive">Out</Badge>;
    if (i.quantity <= i.reorderLevel)
      return <Badge className="bg-warning text-warning-foreground">Low</Badge>;
    return <Badge variant="secondary">In Stock</Badge>;
  };

  const rows = filtered.map((i) => ({
    ...i,
    _store: storeName(i.storeId),
    _group: groupName(i.groupId),
    _supplier: supplierName(i.supplierId),
    _status: statusLabel(i),
    _valuation: i.quantity * i.rate,
  }));


  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-display flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" /> Inventory
          </h1>
          <p className="text-sm text-muted-foreground">
            Track stock, valuation, and movements across all stores.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            accessKey="l"
            onClick={() => {
              qc.invalidateQueries({ queryKey: ["inv"] });
              toast.success("Stock reloaded");
            }}
            disabled={isFetching}
          >
            <RefreshCw
              className={`h-4 w-4 mr-1.5 ${isFetching ? "animate-spin" : ""}`}
            />{" "}
            {underlineFirstChar("Load")}
          </Button>
          <Button
            variant="outline"
            accessKey="i"
            onClick={() => {
              setStockDefaultItemId(undefined);
              setStockMode("issue");
            }}
          >
            <PackageMinus className="h-4 w-4 mr-1.5" />{" "}
            {underlineFirstChar("Issue Stock")}
          </Button>
          <Button
            variant="outline"
            accessKey="s"
            onClick={() => {
              setStockDefaultItemId(undefined);
              setStockMode("purchase");
            }}
          >
            <PackagePlus className="h-4 w-4 mr-1" />{" "}
            {underlineSpecificChars("Add Stock", [4])}
          </Button>
          <Button
            className="gradient-gold text-primary-foreground"
            accessKey="a"
            onClick={() => {
              setEditing(null);
              setAddItemOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1.5" /> {underlineFirstChar("Add Item")}
          </Button>
        </div>
      </div>

      <InventoryTabsNav />


      <PremiumReportFrame
        title="Product Catalog"
        subtitle="Valuation = Quantity × Avg Rate (VAT inclusive). Click any column header to sort."
        propertyName="............."
        sortable
        defaultSortKey="name"
        filters={

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Supplier
              </label>
              <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All suppliers</SelectItem>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Group
              </label>
              <Select value={groupFilter} onValueChange={setGroupFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All groups</SelectItem>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Status
              </label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="in">In Stock</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="out">Out of Stock</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Code or name"
                  className="pl-8"
                />
              </div>
            </div>
          </div>
        }
        columns={[
          {
            key: "name",
            label: "Name",
            format: (r) => (
              <div className="min-w-0">
                <p className="font-medium truncate">{r.name}</p>
                {r.description && (
                  <p className="text-xs text-muted-foreground truncate">
                    {r.description}
                  </p>
                )}
              </div>
            ),
            exportFormat: (r) => r.name,
          },
          {
            key: "code",
            label: "SKU",
            width: "120px",
            format: (r) => (
              <span className="font-mono text-xs">{r.code}</span>
            ),
            exportFormat: (r) => r.code,
          },
          { key: "_group", label: "Category", width: "150px" },
          {
            key: "quantity",
            label: "Qty",
            align: "right",
            width: "130px",
            format: (r) => (
              <span className="inline-flex items-center gap-2 justify-end">
                <span
                  className={`h-2 w-2 rounded-full ${statusDot(r)}`}
                  title={r._status}
                />
                <span className="font-medium">
                  {r.quantity} {r.unit}
                </span>
              </span>
            ),
            exportFormat: (r) => `${r.quantity} ${r.unit}`,
          },
          { key: "_store", label: "Location", width: "160px" },
          { key: "_supplier", label: "Supplier", width: "160px" },
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
          {
            key: "reorderLevel",
            label: "Reorder Lvl",
            align: "right",
            width: "110px",
          },
          {
            key: "_status",
            label: "Status",
            align: "center",
            width: "110px",
            format: (r) => statusBadge(r),
            exportFormat: (r) => r._status,
          },

          {
            key: "actions",
            label: "Actions",
            align: "right",
            width: "150px",
            format: (r) => (
              <div className="flex justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  title="Movements"
                  onClick={() => setMovementsItemId(r.id)}
                >
                  <History className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Add stock"
                  onClick={() => {
                    setStockDefaultItemId(r.id);
                    setStockMode("purchase");
                  }}
                >
                  <PackagePlus className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Issue stock"
                  onClick={() => {
                    setStockDefaultItemId(r.id);
                    setStockMode("issue");
                  }}
                >
                  <PackageMinus className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Adjust stock"
                  onClick={() => {
                    setStockDefaultItemId(r.id);
                    setStockMode("adjustment");
                  }}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Edit"
                  onClick={() => {
                    setEditing(r);
                    setAddItemOpen(true);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Delete"
                  onClick={async () => {
                    if (!confirm(`Delete ${r.name}?`)) return;
                    try {
                      await removeItem.mutateAsync(r.id);
                      toast.success("Item deleted");
                    } catch (e: any) {
                      toast.error(e?.message || "Cannot delete this item");
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ),
            exportFormat: () => "",
          },
        ]}
        rows={rows}
        footerTotals={{
          label: "Filtered Totals",
          cells: {
            quantity: <span>{totals.qty}</span>,
            _valuation: (
              <span className="text-primary">
                NPR {Math.round(totals.val).toLocaleString()}
              </span>
            ),
          },
        }}
        exportFilename="inventory_stock"
        emptyMessage="No inventory items match the current filters."
      />





      <AddItemModal
        open={addItemOpen}
        onOpenChange={setAddItemOpen}
        editing={editing}
      />
      <AddStockModal
        open={stockMode !== null}
        onOpenChange={(v) => !v && setStockMode(null)}
        mode={stockMode || "purchase"}
        defaultItemId={stockDefaultItemId}
      />
      <MovementsDrawer
        itemId={movementsItemId}
        onClose={() => setMovementsItemId(null)}
      />
    </div>
  );
}
