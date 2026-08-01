import { useState } from "react";
import { Plus, Pencil, Trash2, Truck, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useInventorySuppliers,
  useInventoryMutations,
} from "@/hooks/use-inventory";
import type { InventorySupplier } from "@/lib/inventory-store";
import { toast } from "sonner";

const EMPTY = {
  name: "",
  contactPerson: "",
  phone: "",
  email: "",
  address: "",
  active: true,
};

/** `/setup/suppliers` — suppliers master, referenced by items and receipts. */
export default function SuppliersPage() {
  const { data: suppliers = [] } = useInventorySuppliers();
  const { saveSupplier, removeSupplier } = useInventoryMutations();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<InventorySupplier | null>(null);
  const [form, setForm] = useState(EMPTY);

  const reset = () => {
    setEditing(null);
    setForm(EMPTY);
  };

  const save = async () => {
    if (!form.name) {
      toast.error("Name is required");
      return;
    }
    await saveSupplier.mutateAsync(
      editing ? { ...form, id: editing.id } : form,
    );
    toast.success("Saved");
    setOpen(false);
    reset();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" /> Suppliers
          </h1>
          <p className="text-sm text-muted-foreground">
            Vendors that supply inventory items and stock receipts.
          </p>
        </div>
        <Button
          onClick={() => {
            reset();
            setOpen(true);
          }}
          className="gradient-gold text-primary-foreground"
        >
          <Plus className="h-4 w-4 mr-1" /> Add Supplier
        </Button>
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Contact Person</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {suppliers.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-muted-foreground py-6"
                >
                  No suppliers yet.
                </TableCell>
              </TableRow>
            ) : (
              suppliers.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {s.contactPerson || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {s.phone || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {s.email || "—"}
                  </TableCell>
                  <TableCell>{s.active ? "Yes" : "No"}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditing(s);
                        setForm({
                          name: s.name,
                          contactPerson: s.contactPerson || "",
                          phone: s.phone || "",
                          email: s.email || "",
                          address: s.address || "",
                          active: s.active,
                        });
                        setOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={async () => {
                        if (!confirm(`Delete ${s.name}?`)) return;
                        try {
                          await removeSupplier.mutateAsync(s.id);
                          toast.success("Deleted");
                        } catch (err) {
                          toast.error(
                            err instanceof Error
                              ? err.message
                              : "Cannot delete",
                          );
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit" : "Add"} Supplier</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Contact Person</Label>
                <Input
                  value={form.contactPerson}
                  onChange={(e) =>
                    setForm({ ...form, contactPerson: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Address</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch
                checked={form.active}
                onCheckedChange={(v) => setForm({ ...form, active: v })}
              />
            </div>
            <Button
              onClick={save}
              className="w-full gradient-gold text-primary-foreground"
            >
              <Save className="h-4 w-4 mr-1" />
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
