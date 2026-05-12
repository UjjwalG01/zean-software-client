import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Building2, Save, Loader2, Upload, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  getOutlets, addOutlet, updateOutlet, deleteOutlet, uploadOutletImage,
  getServiceTypes, type Outlet,
} from "@/lib/firebase-outlets";
import { useCompanySettings } from "@/hooks/use-firestore";

export default function OutletsPage() {
  const qc = useQueryClient();
  const { data: outlets = [], isLoading } = useQuery({ queryKey: ["outlets"], queryFn: getOutlets });
  const { data: serviceTypes = [] } = useQuery({ queryKey: ["serviceTypes"], queryFn: getServiceTypes });
  const { data: settings = {} } = useCompanySettings();

  const maxOutletsRaw = settings.maxOutlets || "unlimited";
  const maxOutlets = maxOutletsRaw === "unlimited" ? Infinity : Number(maxOutletsRaw) || Infinity;

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Outlet | null>(null);
  const [form, setForm] = useState<Partial<Outlet>>({
    name: "", description: "", serviceTypes: [], color: "#f5b300", address: "", phone: "", email: "", active: true,
  });
  const [imageFile, setImageFile] = useState<File | null>(null);

  const reset = () => {
    setEditing(null); setImageFile(null);
    setForm({ name: "", description: "", serviceTypes: [], color: "#f5b300", address: "", phone: "", email: "", active: true });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      let imageUrl = form.imageUrl || "";
      if (editing) {
        await updateOutlet(editing.id, form);
        if (imageFile) {
          imageUrl = await uploadOutletImage(editing.id, imageFile);
          await updateOutlet(editing.id, { imageUrl });
        }
      } else {
        if (outlets.length >= maxOutlets) throw new Error("Outlet limit reached");
        const id = await addOutlet(form);
        if (imageFile) {
          imageUrl = await uploadOutletImage(id, imageFile);
          await updateOutlet(id, { imageUrl });
        }
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["outlets"] }); toast.success("Outlet saved"); setOpen(false); reset(); },
    onError: (e: any) => toast.error(e?.message || "Save failed"),
  });

  const delMutation = useMutation({
    mutationFn: deleteOutlet,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["outlets"] }); toast.success("Deleted"); },
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => updateOutlet(id, { active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["outlets"] }),
  });

  const startEdit = (o: Outlet) => {
    setEditing(o);
    setForm({ ...o });
    setImageFile(null);
    setOpen(true);
  };

  const toggleServiceType = (slug: string) => {
    const cur = form.serviceTypes || [];
    setForm({ ...form, serviceTypes: cur.includes(slug) ? cur.filter((s) => s !== slug) : [...cur, slug] });
  };

  const stMap = Object.fromEntries(serviceTypes.map((s) => [s.slug, s]));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold font-display flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" /> Outlets
          </h1>
          <p className="text-sm text-muted-foreground">
            {outlets.length} of {maxOutlets === Infinity ? "unlimited" : maxOutlets} outlets
          </p>
        </div>
        <Button onClick={() => { reset(); setOpen(true); }} className="gradient-gold text-primary-foreground" disabled={outlets.length >= maxOutlets}>
          <Plus className="h-4 w-4 mr-1" /> Add Outlet
        </Button>
      </div>

      {isLoading ? <Skeleton className="h-64 rounded-xl" /> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {outlets.map((o) => {
            const img = o.imageUrl || stMap[o.serviceTypes[0]]?.defaultImage;
            return (
              <div key={o.id} className="glass-card rounded-xl overflow-hidden flex flex-col">
                <div className="h-32 bg-muted relative">
                  {img && <img src={img} alt={o.name} className="h-full w-full object-cover" />}
                  <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, transparent 50%, ${o.color}cc)` }} />
                  {!o.active && <Badge variant="secondary" className="absolute top-2 left-2">Inactive</Badge>}
                </div>
                <div className="p-4 space-y-2 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold font-display">{o.name}</h3>
                    <div className="flex">
                      <Button variant="ghost" size="icon" onClick={() => toggleActive.mutate({ id: o.id, active: !o.active })} title="Toggle active">
                        <Power className={`h-3.5 w-3.5 ${o.active ? "text-success" : "text-muted-foreground"}`} />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => startEdit(o)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => { if (confirm(`Delete ${o.name}?`)) delMutation.mutate(o.id); }}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  {o.description && <p className="text-xs text-muted-foreground line-clamp-2">{o.description}</p>}
                  <div className="flex flex-wrap gap-1">
                    {o.serviceTypes.map((s) => {
                      const sd = stMap[s];
                      return <Badge key={s} variant="outline" className="text-[10px]" style={sd?.color ? { color: sd.color, borderColor: `${sd.color}66` } : undefined}>{sd?.name || s}</Badge>;
                    })}
                  </div>
                </div>
              </div>
            );
          })}
          {outlets.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted-foreground">No outlets yet — add your first one.</div>
          )}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display">{editing ? "Edit" : "Add"} Outlet</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2 col-span-2"><Label>Outlet Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="space-y-2 col-span-2"><Label>Description</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="space-y-2"><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
              <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div className="space-y-2 col-span-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div className="space-y-2"><Label>Accent Color</Label><Input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="h-10 w-20 p-1" /></div>
              <div className="space-y-2">
                <Label>Cover Image</Label>
                <div className="flex items-center gap-2">
                  <Input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
                  <Upload className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Service Types *</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 rounded-lg border border-border/50 bg-muted/20">
                {serviceTypes.filter((s) => s.active).map((s) => (
                  <label key={s.slug} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={form.serviceTypes?.includes(s.slug)} onCheckedChange={() => toggleServiceType(s.slug)} />
                    <span className="text-sm flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                      {s.name}
                    </span>
                  </label>
                ))}
                {serviceTypes.length === 0 && <p className="text-xs text-muted-foreground col-span-full">No service types yet. Create some in Setup → Service Types.</p>}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch checked={form.active !== false} onCheckedChange={(v) => setForm({ ...form, active: v })} />
            </div>

            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!form.name || !form.serviceTypes?.length || saveMutation.isPending}
              className="w-full gradient-gold text-primary-foreground"
            >
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              {editing ? "Save Changes" : "Create Outlet"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
