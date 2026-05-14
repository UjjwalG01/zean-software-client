import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Building2, Save, Loader2, Power, MapPin, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  getOutlets, addOutlet, updateOutlet, deleteOutlet,
  getServiceTypes, type Outlet,
} from "@/lib/firebase-outlets";
import { useCompanySettings } from "@/hooks/use-firestore";

const OUTLET_TYPES = ["REGULAR", "SPA", "GYM", "WELLNESS", "EVENT", "RETAIL"];

const emptyForm: Partial<Outlet> = {
  name: "", outletCode: "", costCenter: "", outletType: "REGULAR",
  effectiveFrom: new Date().toISOString().slice(0, 10),
  description: "", serviceTypes: [], color: "#f5b300", imageUrl: "",
  country: "Nepal", state: "", city: "", street: "", zip: "",
  tel1: "", tel2: "", mobile: "", email: "", website: "",
  active: true, showRoomGuest: true, realTimeSales: false,
  enableMembership: false, allowBillDateChange: false, isTicketing: false,
};

export default function OutletsPage() {
  const qc = useQueryClient();
  const { data: outlets = [], isLoading } = useQuery({ queryKey: ["outlets"], queryFn: getOutlets });
  const { data: serviceTypes = [] } = useQuery({ queryKey: ["serviceTypes"], queryFn: getServiceTypes });
  const { data: settings = {} } = useCompanySettings();

  const maxOutletsRaw = settings.maxOutlets || "unlimited";
  const maxOutlets = maxOutletsRaw === "unlimited" ? Infinity : Number(maxOutletsRaw) || Infinity;

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Outlet | null>(null);
  const [form, setForm] = useState<Partial<Outlet>>(emptyForm);

  const reset = () => { setEditing(null); setForm(emptyForm); };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.name?.trim()) throw new Error("Outlet name is required");
      if (!form.serviceTypes?.length) throw new Error("Select at least one service type");
      if (editing) {
        await updateOutlet(editing.id, form);
      } else {
        if (outlets.length >= maxOutlets) throw new Error("Outlet limit reached");
        await addOutlet(form);
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

  const startEdit = (o: Outlet) => { setEditing(o); setForm({ ...emptyForm, ...o }); setOpen(true); };

  const toggleServiceType = (slug: string) => {
    const cur = form.serviceTypes || [];
    setForm({ ...form, serviceTypes: cur.includes(slug) ? cur.filter((s) => s !== slug) : [...cur, slug] });
  };
  const toggleAllServiceTypes = () => {
    const all = serviceTypes.filter((s) => s.active).map((s) => s.slug);
    const allSelected = all.every((s) => form.serviceTypes?.includes(s));
    setForm({ ...form, serviceTypes: allSelected ? [] : all });
  };

  const stMap = Object.fromEntries(serviceTypes.map((s) => [s.slug, s]));
  const activeSt = serviceTypes.filter((s) => s.active);

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
                  {o.outletCode && <Badge className="absolute top-2 right-2 bg-background/80 text-foreground">{o.outletCode}</Badge>}
                </div>
                <div className="p-4 space-y-2 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold font-display">{o.name}</h3>
                      {o.outletType && <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{o.outletType}</p>}
                    </div>
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
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display">{editing ? "Edit" : "Add"} Outlet</DialogTitle></DialogHeader>
          <div className="space-y-6">

            {/* ── Outlet section ─────────────────────────────────────── */}
            <section className="rounded-xl border border-border/50 p-4 space-y-3">
              <div className="flex items-center gap-2 text-primary">
                <Building2 className="h-4 w-4" />
                <h3 className="font-semibold text-sm">Outlet</h3>
                <span className="text-xs text-muted-foreground">All fields marked with * are mandatory.</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Effective From *</Label>
                  <Input type="date" value={form.effectiveFrom || ""} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Outlet Code *</Label>
                  <Input value={form.outletCode || ""} onChange={(e) => setForm({ ...form, outletCode: e.target.value.toUpperCase() })} placeholder="e.g. SP" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Outlet Name *</Label>
                  <Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="SANCTUARY SPA" />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Cost Center *</Label>
                  <Input value={form.costCenter || ""} onChange={(e) => setForm({ ...form, costCenter: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Type *</Label>
                  <Select value={form.outletType || "REGULAR"} onValueChange={(v) => setForm({ ...form, outletType: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{OUTLET_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Accent Color</Label>
                  <Input type="color" value={form.color || "#f5b300"} onChange={(e) => setForm({ ...form, color: e.target.value })} className="h-10 w-20 p-1" />
                </div>

                <div className="md:col-span-3 space-y-1.5">
                  <Label className="text-xs">Description</Label>
                  <Textarea rows={2} value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                <div className="md:col-span-3 space-y-1.5">
                  <Label className="text-xs">Cover Image URL</Label>
                  <Input value={form.imageUrl || ""} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://..." />
                </div>
              </div>

              {/* Flags */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-2 border-t border-border/40">
                <FlagSwitch label="Active" v={form.active !== false} on={(v) => setForm({ ...form, active: v })} />
                <FlagSwitch label="Show Room Guest" v={!!form.showRoomGuest} on={(v) => setForm({ ...form, showRoomGuest: v })} />
                <FlagSwitch label="Real Time Sales" v={!!form.realTimeSales} on={(v) => setForm({ ...form, realTimeSales: v })} />
                <FlagSwitch label="Enable Membership" v={!!form.enableMembership} on={(v) => setForm({ ...form, enableMembership: v })} />
                <FlagSwitch label="Allow Bill Date Change" v={!!form.allowBillDateChange} on={(v) => setForm({ ...form, allowBillDateChange: v })} />
                <FlagSwitch label="Is Ticketing Outlet" v={!!form.isTicketing} on={(v) => setForm({ ...form, isTicketing: v })} />
              </div>
            </section>

            {/* ── Address section ────────────────────────────────────── */}
            <section className="rounded-xl border border-border/50 p-4 space-y-3">
              <div className="flex items-center gap-2 text-primary">
                <MapPin className="h-4 w-4" />
                <h3 className="font-semibold text-sm">Address</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="space-y-1.5"><Label className="text-xs">Country *</Label><Input value={form.country || ""} onChange={(e) => setForm({ ...form, country: e.target.value })} /></div>
                <div className="space-y-1.5"><Label className="text-xs">State</Label><Input value={form.state || ""} onChange={(e) => setForm({ ...form, state: e.target.value })} /></div>
                <div className="space-y-1.5"><Label className="text-xs">City *</Label><Input value={form.city || ""} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
                <div className="space-y-1.5"><Label className="text-xs">Street *</Label><Input value={form.street || ""} onChange={(e) => setForm({ ...form, street: e.target.value })} /></div>
                <div className="space-y-1.5"><Label className="text-xs">Zip</Label><Input value={form.zip || ""} onChange={(e) => setForm({ ...form, zip: e.target.value })} /></div>
                <div className="space-y-1.5"><Label className="text-xs">Tel 1 *</Label><Input value={form.tel1 || ""} onChange={(e) => setForm({ ...form, tel1: e.target.value })} /></div>
                <div className="space-y-1.5"><Label className="text-xs">Tel 2</Label><Input value={form.tel2 || ""} onChange={(e) => setForm({ ...form, tel2: e.target.value })} /></div>
                <div className="space-y-1.5"><Label className="text-xs">Mobile</Label><Input value={form.mobile || ""} onChange={(e) => setForm({ ...form, mobile: e.target.value })} /></div>
                <div className="space-y-1.5 md:col-span-2"><Label className="text-xs">Email</Label><Input type="email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div className="space-y-1.5 md:col-span-2"><Label className="text-xs">Website</Label><Input value={form.website || ""} onChange={(e) => setForm({ ...form, website: e.target.value })} /></div>
              </div>
            </section>

            {/* ── Service Type linking (Outlet ↔ Service Type) ───────── */}
            <section className="rounded-xl border border-border/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-primary">
                  <FileText className="h-4 w-4" />
                  <h3 className="font-semibold text-sm">Service Type Link *</h3>
                </div>
                {activeSt.length > 0 && (
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <Checkbox
                      checked={activeSt.every((s) => form.serviceTypes?.includes(s.slug))}
                      onCheckedChange={toggleAllServiceTypes}
                    />
                    SELECT ALL
                  </label>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 p-3 rounded-lg border border-border/40 bg-muted/20">
                {activeSt.map((s) => (
                  <label key={s.slug} className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-muted/40">
                    <Checkbox checked={form.serviceTypes?.includes(s.slug)} onCheckedChange={() => toggleServiceType(s.slug)} />
                    <span className="text-sm flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                      {s.name}
                    </span>
                  </label>
                ))}
                {activeSt.length === 0 && <p className="text-xs text-muted-foreground col-span-full">No service types yet. Create some in Setup → Service Types.</p>}
              </div>
              <p className="text-[11px] text-muted-foreground">Selected service types determine which categories this outlet appears under during bookings.</p>
            </section>

            <div className="flex gap-2 sticky bottom-0 bg-background pt-3 border-t border-border/40">
              <Button variant="outline" onClick={() => { setOpen(false); reset(); }} className="flex-1">Cancel</Button>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="flex-1 gradient-gold text-primary-foreground"
              >
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                {editing ? "Save Changes" : "Create Outlet"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FlagSwitch({ label, v, on }: { label: string; v: boolean; on: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border/40 px-3 py-2">
      <Label className="text-xs">{label}</Label>
      <Switch checked={v} onCheckedChange={on} />
    </div>
  );
}
