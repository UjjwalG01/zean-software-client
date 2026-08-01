import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useInventoryStores,
  useItemGroups,
  useInventorySuppliers,
  useInventoryMutations,
  useInventoryItems,
} from "@/hooks/use-inventory";
import { nextItemCode } from "@/lib/inventory-store";
import { toast } from "sonner";
import type { InventoryItem } from "@/lib/inventory-store";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing?: InventoryItem | null;
}

const UNITS = ["pcs", "kg", "ltr", "box", "pack"];

const EMPTY = {
  code: "",
  name: "",
  description: "",
  groupId: "",
  storeId: "",
  supplierId: "none",
  unit: "pcs",
  quantity: 0,
  rate: 0,
  reorderLevel: 0,
  reorderQuantity: 0,
  active: true,
};

/** Section wrapper matching the reference "New Item" side sheet. */
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      {children}
    </div>
  );
}

/** Add / edit inventory item as a labelled side sheet. */
export function AddItemModal({ open, onOpenChange, editing }: Props) {
  const { data: stores = [] } = useInventoryStores();
  const { data: groups = [] } = useItemGroups();
  const { data: suppliers = [] } = useInventorySuppliers();
  useInventoryItems(); // keep cache warm so nextItemCode reads latest items
  const { createItem, updateItem } = useInventoryMutations();

  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        code: editing.code,
        name: editing.name,
        description: editing.description ?? "",
        groupId: editing.groupId,
        storeId: editing.storeId,
        supplierId: editing.supplierId ?? "none",
        unit: editing.unit,
        quantity: editing.quantity,
        rate: editing.rate,
        reorderLevel: editing.reorderLevel,
        reorderQuantity: editing.reorderQuantity ?? 0,
        active: editing.active,
      });
    } else {
      setForm({
        ...EMPTY,
        code: nextItemCode(),
        groupId: groups[0]?.id || "",
        storeId: stores[0]?.id || "",
      });
    }
  }, [editing, open, groups, stores]);

  const handleSave = async () => {
    if (!form.code || !form.name || !form.groupId || !form.storeId) {
      toast.error("Code, name, category and location are required");
      return;
    }
    const payload = {
      ...form,
      supplierId: form.supplierId === "none" ? undefined : form.supplierId,
    };
    setSaving(true);
    try {
      if (editing) {
        await updateItem.mutateAsync({ id: editing.id, patch: payload });
        toast.success("Item updated");
      } else {
        await createItem.mutateAsync(payload);
        toast.success("Item added");
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save item");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{editing ? "Edit Item" : "New Item"}</SheetTitle>
          <SheetDescription>
            Define the product, its classification, stock thresholds and
            pricing.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-5">
          <Section title="Basic Info">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Whey Protein 1kg"
                />
              </div>
              <div className="space-y-1.5">
                <Label>
                  SKU / Code
                  {!editing && (
                    <span className="text-[10px] text-muted-foreground ml-1">
                      (auto)
                    </span>
                  )}
                </Label>
                <Input value={form.code} readOnly disabled />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder="Optional details"
                />
              </div>
            </div>
          </Section>

          <Section title="Classification">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select
                  value={form.groupId}
                  onValueChange={(v) => setForm({ ...form, groupId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Unit of Measure</Label>
                <Select
                  value={form.unit}
                  onValueChange={(v) => setForm({ ...form, unit: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Section>

          <Section title="Stock Settings">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Current Stock</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.quantity}
                  disabled={!!editing}
                  onChange={(e) =>
                    setForm({ ...form, quantity: Number(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Reorder Point</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.reorderLevel}
                  onChange={(e) =>
                    setForm({ ...form, reorderLevel: Number(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Reorder Qty</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.reorderQuantity}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      reorderQuantity: Number(e.target.value),
                    })
                  }
                />
              </div>
            </div>
            {editing && (
              <p className="text-[11px] text-muted-foreground">
                Stock changes must be made through Log Movement so the ledger
                stays authoritative.
              </p>
            )}
          </Section>

          <Section title="Pricing">
            <div className="space-y-1.5">
              <Label>Rate (NPR, VAT inclusive)</Label>
              <Input
                type="number"
                min={0}
                value={form.rate}
                onChange={(e) =>
                  setForm({ ...form, rate: Number(e.target.value) })
                }
              />
            </div>
          </Section>

          <Section title="Assignment">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Supplier</Label>
                <Select
                  value={form.supplierId}
                  onValueChange={(v) => setForm({ ...form, supplierId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="No supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No supplier</SelectItem>
                    {suppliers
                      .filter((s) => s.active)
                      .map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Location / Store</Label>
                <Select
                  value={form.storeId}
                  onValueChange={(v) => setForm({ ...form, storeId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select store" />
                  </SelectTrigger>
                  <SelectContent>
                    {stores.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Section>

          <Section title="Status">
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-[11px] text-muted-foreground">
                  Inactive items are hidden from stock operations.
                </p>
              </div>
              <Switch
                checked={form.active}
                onCheckedChange={(v) => setForm({ ...form, active: v })}
              />
            </div>
          </Section>
        </div>

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="gradient-gold text-primary-foreground"
          >
            {editing ? "Save Changes" : "Create Item"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
