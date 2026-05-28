import { useState } from "react";
import { Plus, Pencil, Trash2, Warehouse, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useInventoryStores, useInventoryMutations } from "@/hooks/use-inventory";
import type { InventoryStore } from "@/lib/inventory-store";
import { toast } from "sonner";

export default function StoresPage() {
  const { data: stores = [] } = useInventoryStores();
  const { saveStore, removeStore } = useInventoryMutations();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryStore | null>(null);
  const [form, setForm] = useState({ name: "", location: "", active: true });

  const reset = () => { setEditing(null); setForm({ name: "", location: "", active: true }); };

  const save = async () => {
    if (!form.name) { toast.error("Name is required"); return; }
    await saveStore.mutateAsync(editing ? { ...form, id: editing.id } : form);
    toast.success("Saved"); setOpen(false); reset();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display flex items-center gap-2"><Warehouse className="h-5 w-5 text-primary" /> Stores</h1>
          <p className="text-sm text-muted-foreground">Physical locations where inventory items are stocked.</p>
        </div>
        <Button onClick={() => { reset(); setOpen(true); }} className="gradient-gold text-primary-foreground">
          <Plus className="h-4 w-4 mr-1" /> Add Store
        </Button>
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow><TableHead>Name</TableHead><TableHead>Location</TableHead><TableHead>Active</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {stores.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">No stores yet.</TableCell></TableRow>
            ) : stores.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{s.location || "—"}</TableCell>
                <TableCell>{s.active ? "Yes" : "No"}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => { setEditing(s); setForm({ name: s.name, location: s.location || "", active: s.active }); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => { if (confirm(`Delete ${s.name}?`)) { removeStore.mutate(s.id); toast.success("Deleted"); } }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit" : "Add"} Store</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Location</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
            <div className="flex items-center justify-between"><Label>Active</Label><Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} /></div>
            <Button onClick={save} className="w-full gradient-gold text-primary-foreground"><Save className="h-4 w-4 mr-1" />Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
