import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { chargeHeadsStore, type ChargeHead } from "@/lib/charge-heads-store";
import { formatNPR } from "@/lib/mock-data";

export default function ChargeHeadsPage() {
  const [rows, setRows] = useState<ChargeHead[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ChargeHead | null>(null);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [active, setActive] = useState(true);

  const refresh = () => setRows(chargeHeadsStore.list());

  useEffect(() => {
    refresh();
    const h = () => refresh();
    window.addEventListener("charge-heads-changed", h);
    return () => window.removeEventListener("charge-heads-changed", h);
  }, []);

  const reset = () => {
    setEditing(null);
    setName("");
    setAmount("");
    setActive(true);
  };

  const openEdit = (row: ChargeHead) => {
    setEditing(row);
    setName(row.name);
    setAmount(row.defaultAmount ? String(row.defaultAmount) : "");
    setActive(row.active);
    setOpen(true);
  };

  const save = () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    const payload = {
      name: name.trim(),
      defaultAmount: amount ? Number(amount) : 0,
      active,
    };
    if (editing) {
      chargeHeadsStore.update(editing.id, payload);
      toast.success("Charge head updated");
    } else {
      chargeHeadsStore.add(payload);
      toast.success("Charge head added");
    }
    setOpen(false);
    reset();
  };

  const remove = (row: ChargeHead) => {
    if (!confirm(`Delete "${row.name}"?`)) return;
    chargeHeadsStore.remove(row.id);
    toast.success("Removed");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display flex items-center gap-2">
            <Tag className="h-6 w-6 text-primary" />
            Charge Heads
          </h1>
          <p className="text-muted-foreground text-sm">
            Define miscellaneous chargeable heads used when recording one-off charges to a member.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            reset();
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Charge Head
        </Button>
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Default Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-28 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-10">
                  No charge heads yet
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-right text-sm">
                    {r.defaultAmount ? formatNPR(r.defaultAmount) : "—"}
                  </TableCell>
                  <TableCell>
                    {r.active ? (
                      <Badge className="bg-success/20 text-success border-0">Active</Badge>
                    ) : (
                      <Badge variant="outline">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(r)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(r)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">
              {editing ? "Edit Charge Head" : "New Charge Head"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Equipment Damage" />
            </div>
            <div className="space-y-2">
              <Label>Default Amount (NPR, optional)</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-xs text-muted-foreground">Inactive heads are hidden from the charge picker</p>
              </div>
              <Switch checked={active} onCheckedChange={setActive} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>{editing ? "Save Changes" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
