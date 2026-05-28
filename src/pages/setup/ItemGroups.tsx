import { useState } from "react";
import { Plus, Pencil, Trash2, Layers, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useItemGroups, useInventoryMutations } from "@/hooks/use-inventory";
import type { ItemGroup } from "@/lib/inventory-store";
import { toast } from "sonner";

export default function ItemGroupsPage() {
  const { data: groups = [] } = useItemGroups();
  const { saveGroup, removeGroup } = useInventoryMutations();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ItemGroup | null>(null);
  const [form, setForm] = useState({ name: "", description: "", active: true });

  const reset = () => { setEditing(null); setForm({ name: "", description: "", active: true }); };

  const save = async () => {
    if (!form.name) { toast.error("Name is required"); return; }
    await saveGroup.mutateAsync(editing ? { ...form, id: editing.id } : form);
    toast.success("Saved"); setOpen(false); reset();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display flex items-center gap-2"><Layers className="h-5 w-5 text-primary" /> Item Groups</h1>
          <p className="text-sm text-muted-foreground">Categories for organizing inventory items.</p>
        </div>
        <Button onClick={() => { reset(); setOpen(true); }} className="gradient-gold text-primary-foreground">
          <Plus className="h-4 w-4 mr-1" /> Add Group
        </Button>
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow><TableHead>Name</TableHead><TableHead>Description</TableHead><TableHead>Active</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {groups.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">No groups yet.</TableCell></TableRow>
            ) : groups.map((g) => (
              <TableRow key={g.id}>
                <TableCell className="font-medium">{g.name}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{g.description || "—"}</TableCell>
                <TableCell>{g.active ? "Yes" : "No"}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => { setEditing(g); setForm({ name: g.name, description: g.description || "", active: g.active }); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => { if (confirm(`Delete ${g.name}?`)) { removeGroup.mutate(g.id); toast.success("Deleted"); } }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit" : "Add"} Item Group</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="flex items-center justify-between"><Label>Active</Label><Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} /></div>
            <Button onClick={save} className="w-full gradient-gold text-primary-foreground"><Save className="h-4 w-4 mr-1" />Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
