import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Tag, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  getServiceTypes, addServiceType, updateServiceType, deleteServiceType,
  seedDefaultServiceTypes, type ServiceTypeDoc,
} from "@/lib/firebase-outlets";

export default function ServiceTypesPage() {
  const qc = useQueryClient();
  const { data: types = [], isLoading } = useQuery({ queryKey: ["serviceTypes"], queryFn: getServiceTypes });

  // Seed defaults once
  useEffect(() => {
    if (!isLoading && types.length === 0) {
      seedDefaultServiceTypes().then(() => qc.invalidateQueries({ queryKey: ["serviceTypes"] }));
    }
  }, [isLoading, types.length, qc]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceTypeDoc | null>(null);
  const [form, setForm] = useState({ name: "", color: "#f5b300", active: true });

  const reset = () => { setEditing(null); setForm({ name: "", color: "#f5b300", active: true }); };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing) {
        await updateServiceType(editing.id, { name: form.name, color: form.color, active: form.active });
      } else {
        await addServiceType({ name: form.name, color: form.color, active: form.active });
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["serviceTypes"] }); toast.success("Saved"); setOpen(false); reset(); },
    onError: () => toast.error("Save failed"),
  });

  const delMutation = useMutation({
    mutationFn: deleteServiceType,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["serviceTypes"] }); toast.success("Deleted"); },
    onError: () => toast.error("Delete failed"),
  });

  const startEdit = (t: ServiceTypeDoc) => {
    setEditing(t);
    setForm({ name: t.name, color: t.color || "#f5b300", active: t.active });
    setOpen(true);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display flex items-center gap-2">
            <Tag className="h-5 w-5 text-primary" /> Service Types
          </h1>
          <p className="text-sm text-muted-foreground">Categories used to classify outlets and bookings.</p>
        </div>
        <Button onClick={() => { reset(); setOpen(true); }} className="gradient-gold text-primary-foreground">
          <Plus className="h-4 w-4 mr-1" /> Add Service Type
        </Button>
      </div>

      {isLoading ? <Skeleton className="h-64 rounded-xl" /> : (
        <div className="glass-card rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Color</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {types.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{t.slug}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="h-4 w-4 rounded-full border" style={{ backgroundColor: t.color }} />
                      <span className="text-xs text-muted-foreground">{t.color}</span>
                    </div>
                  </TableCell>
                  <TableCell>{t.active ? "Yes" : "No"}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => startEdit(t)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => delMutation.mutate(t.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit" : "Add"} Service Type</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-2"><Label>Color</Label><Input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="h-10 w-20 p-1" /></div>
            <div className="flex items-center justify-between"><Label>Active</Label><Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} /></div>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.name || saveMutation.isPending} className="w-full gradient-gold text-primary-foreground">
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />} Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
