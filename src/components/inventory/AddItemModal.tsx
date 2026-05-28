import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useInventoryStores, useItemGroups, useInventoryMutations } from "@/hooks/use-inventory";
import { toast } from "sonner";
import type { InventoryItem } from "@/lib/inventory-store";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing?: InventoryItem | null;
}

const UNITS = ["pcs", "kg", "ltr", "box", "pack"];

export function AddItemModal({ open, onOpenChange, editing }: Props) {
  const { data: stores = [] } = useInventoryStores();
  const { data: groups = [] } = useItemGroups();
  const { createItem, updateItem } = useInventoryMutations();

  const [form, setForm] = useState({
    code: "", name: "", groupId: "", storeId: "", unit: "pcs",
    quantity: 0, rate: 0, reorderLevel: 0, active: true,
  });

  useEffect(() => {
    if (editing) {
      setForm({
        code: editing.code, name: editing.name, groupId: editing.groupId,
        storeId: editing.storeId, unit: editing.unit, quantity: editing.quantity,
        rate: editing.rate, reorderLevel: editing.reorderLevel, active: editing.active,
      });
    } else if (open) {
      setForm({ code: "", name: "", groupId: groups[0]?.id || "", storeId: stores[0]?.id || "", unit: "pcs", quantity: 0, rate: 0, reorderLevel: 0, active: true });
    }
  }, [editing, open, groups, stores]);

  const handleSave = async () => {
    if (!form.code || !form.name || !form.groupId || !form.storeId) {
      toast.error("Code, name, group and store are required");
      return;
    }
    if (editing) {
      await updateItem.mutateAsync({ id: editing.id, patch: form });
      toast.success("Item updated");
    } else {
      await createItem.mutateAsync(form);
      toast.success("Item added");
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{editing ? "Edit Item" : "Add Inventory Item"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Code</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Unit</Label>
            <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-1.5"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Group</Label>
            <Select value={form.groupId} onValueChange={(v) => setForm({ ...form, groupId: v })}>
              <SelectTrigger><SelectValue placeholder="Select group" /></SelectTrigger>
              <SelectContent>{groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Store</Label>
            <Select value={form.storeId} onValueChange={(v) => setForm({ ...form, storeId: v })}>
              <SelectTrigger><SelectValue placeholder="Select store" /></SelectTrigger>
              <SelectContent>{stores.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>{editing ? "Quantity" : "Opening Qty"}</Label>
            <Input type="number" min={0} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} disabled={!!editing} />
          </div>
          <div className="space-y-1.5"><Label>Rate (NPR, VAT incl.)</Label>
            <Input type="number" min={0} value={form.rate} onChange={(e) => setForm({ ...form, rate: Number(e.target.value) })} />
          </div>
          <div className="space-y-1.5"><Label>Reorder Level</Label>
            <Input type="number" min={0} value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: Number(e.target.value) })} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} className="gradient-gold text-primary-foreground">{editing ? "Update" : "Add Item"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
