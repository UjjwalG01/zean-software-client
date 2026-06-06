import { useMemo, useState } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/StatCard";
import { PremiumReportFrame } from "@/components/PremiumReportFrame";
import { useInventoryItems, useInventoryStores, useItemGroups, useInventoryMutations } from "@/hooks/use-inventory";
import { AddItemModal } from "@/components/inventory/AddItemModal";
import { AddStockModal } from "@/components/inventory/AddStockModal";
import { MovementsDrawer } from "@/components/inventory/MovementsDrawer";
import type { InventoryItem } from "@/lib/inventory-store";
import { toast } from "sonner";

export default function Inventory() {
  const qc = useQueryClient();
  const { data: items = [], isFetching } = useInventoryItems();
  const { data: stores = [] } = useInventoryStores();
  const { data: groups = [] } = useItemGroups();
  const { removeItem } = useInventoryMutations();

  const [storeFilter, setStoreFilter] = useState<string>("all");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const [addItemOpen, setAddItemOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [stockMode, setStockMode] = useState<"purchase" | "issue" | null>(null);
  const [stockDefaultItemId, setStockDefaultItemId] = useState<string | undefined>();
  const [movementsItemId, setMovementsItemId] = useState<string | null>(null);

  const storeName = (id: string) => stores.find((s) => s.id === id)?.name || "—";
  const groupName = (id: string) => groups.find((g) => g.id === id)?.name || "—";

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (storeFilter !== "all" && i.storeId !== storeFilter) return false;
      if (groupFilter !== "all" && i.groupId !== groupFilter) return false;
      if (statusFilter === "low" && !(i.quantity > 0 && i.quantity <= i.reorderLevel)) return false;
      if (statusFilter === "out" && i.quantity !== 0) return false;
      if (statusFilter === "in" && !(i.quantity > i.reorderLevel)) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!i.name.toLowerCase().includes(q) && !i.code.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [items, storeFilter, groupFilter, statusFilter, search]);

  const totals = useMemo(() => {
    const qty = filtered.reduce((s, i) => s + i.quantity, 0);
    const val = filtered.reduce((s, i) => s + i.quantity * i.rate, 0);
    return { qty, val };
  }, [filtered]);

  const allVal = items.reduce((s, i) => s + i.quantity * i.rate, 0);
  const lowCount = items.filter((i) => i.active && i.quantity <= i.reorderLevel).length;

  const statusBadge = (i: InventoryItem) => {
    if (i.quantity === 0) return <Badge variant="destructive">Out</Badge>;
    if (i.quantity <= i.reorderLevel) return <Badge className="bg-warning text-warning-foreground">Low</Badge>;
    return <Badge variant="secondary">In Stock</Badge>;
  };

  const rows = filtered.map((i) => ({
    ...i,
    _store: storeName(i.storeId),
    _group: groupName(i.groupId),
    _valuation: i.quantity * i.rate,
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-display flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" /> Inventory
          </h1>
          <p className="text-sm text-muted-foreground">Track stock, valuation, and movements across all stores.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => {
              qc.invalidateQueries({ queryKey: ["inv"] });
              toast.success("Stock reloaded");
            }}
            disabled={isFetching}
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${isFetching ? "animate-spin" : ""}`} /> Load
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setStockDefaultItemId(undefined);
              setStockMode("issue");
            }}
          >
            <PackageMinus className="h-4 w-4 mr-1.5" /> Issue Stock
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setStockDefaultItemId(undefined);
              setStockMode("purchase");
            }}
          >
            <PackagePlus className="h-4 w-4 mr-1.5" /> Add Stock
          </Button>
          <Button
            className="gradient-gold text-primary-foreground"
            onClick={() => {
              setEditing(null);
              setAddItemOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1.5" /> Add Item
          </Button>
        </div>
      </div>

      {/* <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total Items" value={String(items.length)} change={0} icon={Boxes} />
        <StatCard title="Total Valuation" value={`NPR ${Math.round(allVal).toLocaleString()}`} change={0} icon={Coins} iconColor="bg-primary" />
        <StatCard title="Low / Out of Stock" value={String(lowCount)} change={0} icon={AlertTriangle} />
        <StatCard title="Active Stores" value={String(stores.filter((s) => s.active).length)} change={0} icon={Warehouse} />
      </div> */}

      <PremiumReportFrame
        title="Current Stock Position"
        subtitle="Valuation = Quantity × Avg Rate (VAT inclusive)"
        propertyName="VitaFit Club"
        filters={
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Store</label>
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
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Group</label>
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
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Status</label>
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
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Search</label>
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
          { key: "code", label: "Code", width: "100px" },
          { key: "name", label: "Item" },
          { key: "_group", label: "Group" },
          { key: "_store", label: "Store" },
          { key: "unit", label: "Unit", align: "center", width: "70px" },
          {
            key: "quantity",
            label: "Qty",
            align: "right",
            width: "80px",
            format: (r) => <span className="font-medium">{r.quantity}</span>,
            exportFormat: (r) => String(r.quantity),
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
              <span className="font-semibold text-primary">{Math.round(r._valuation).toLocaleString()}</span>
            ),
            exportFormat: (r) => String(Math.round(r._valuation)),
          },
          {
            key: "status",
            label: "Status",
            align: "center",
            width: "100px",
            format: (r) => statusBadge(r),
            exportFormat: (r) => (r.quantity === 0 ? "Out" : r.quantity <= r.reorderLevel ? "Low" : "In Stock"),
          },
          {
            key: "actions",
            label: "Actions",
            align: "right",
            width: "150px",
            format: (r) => (
              <div className="flex justify-end gap-1">
                <Button variant="ghost" size="icon" title="Movements" onClick={() => setMovementsItemId(r.id)}>
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
        groupBy={{ key: "_store", label: "Store" }}
        footerTotals={{
          label: "Filtered Totals",
          cells: {
            quantity: <span>{totals.qty}</span>,
            _valuation: <span className="text-primary">NPR {Math.round(totals.val).toLocaleString()}</span>,
          },
        }}
        exportFilename="inventory_stock"
        emptyMessage="No inventory items match the current filters."
      />

      <AddItemModal open={addItemOpen} onOpenChange={setAddItemOpen} editing={editing} />
      <AddStockModal
        open={stockMode !== null}
        onOpenChange={(v) => !v && setStockMode(null)}
        mode={stockMode || "purchase"}
        defaultItemId={stockDefaultItemId}
      />
      <MovementsDrawer itemId={movementsItemId} onClose={() => setMovementsItemId(null)} />
    </div>
  );
}
