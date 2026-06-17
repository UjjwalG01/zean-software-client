import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Pencil,
  Trash2,
  Building2,
  Save,
  Loader2,
  Power,
  MapPin,
  FileText,
  Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  getOutlets,
  addOutlet,
  updateOutlet,
  deleteOutlet,
  getServiceTypes,
  type Outlet,
} from "@/lib/supabase-outlets";
import { useCompanySettings } from "@/hooks/use-firestore";

const COUNTRIES = [
  "Nepal",
  "India",
  "Bhutan",
  "Bangladesh",
  "China",
  "United States",
  "United Kingdom",
  "Australia",
  "Other",
];

// Foreign-key relations the outlet participates in across the schema.
// These are informational toggles so admins know what links exist.
const FK_RELATIONS: {
  key: keyof Outlet | "members" | "bookings" | "services" | "transactions";
  label: string;
  help: string;
}[] = [
  {
    key: "services",
    label: "Services",
    help: "Services created under this outlet",
  },
  {
    key: "bookings",
    label: "Bookings",
    help: "Member bookings made against this outlet",
  },
  { key: "members", label: "Members", help: "Members assigned to this outlet" },
  {
    key: "transactions",
    label: "Transactions",
    help: "Payments collected for this outlet",
  },
];

const emptyForm: Partial<Outlet> = {
  name: "",
  serviceTypes: [],
  country: "Nepal",
  state: "",
  city: "",
  street: "",
  tel1: "",
  imageUrl: "",
  active: true,
};

export default function OutletsPage() {
  const qc = useQueryClient();
  const { data: outlets = [], isLoading } = useQuery({
    queryKey: ["outlets"],
    queryFn: getOutlets,
  });
  const { data: serviceTypes = [] } = useQuery({
    queryKey: ["serviceTypes"],
    queryFn: getServiceTypes,
  });
  const { data: settings = {} } = useCompanySettings();

  const maxOutletsRaw = settings.maxOutlets || "unlimited";
  const maxOutlets =
    maxOutletsRaw === "unlimited"
      ? Infinity
      : Number(maxOutletsRaw) || Infinity;

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Outlet | null>(null);
  const [form, setForm] = useState<Partial<Outlet>>(emptyForm);

  const reset = () => {
    setEditing(null);
    setForm(emptyForm);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.name?.trim()) throw new Error("Outlet name is required");
      if (!form.serviceTypes?.length)
        throw new Error("Select at least one service type");
      if (editing) {
        await updateOutlet(editing.id, form);
      } else {
        if (outlets.length >= maxOutlets)
          throw new Error("Outlet limit reached");
        await addOutlet(form);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["outlets"] });
      toast.success("Outlet saved");
      setOpen(false);
      reset();
    },
    onError: (e: any) => toast.error(e?.message || "Save failed"),
  });

  const delMutation = useMutation({
    mutationFn: deleteOutlet,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["outlets"] });
      toast.success("Deleted");
    },
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      updateOutlet(id, { active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["outlets"] }),
  });

  const startEdit = (o: Outlet) => {
    setEditing(o);
    setForm({ ...emptyForm, ...o });
    setOpen(true);
  };

  const toggleServiceType = (slug: string) => {
    const cur = form.serviceTypes || [];
    setForm({
      ...form,
      serviceTypes: cur.includes(slug)
        ? cur.filter((s) => s !== slug)
        : [...cur, slug],
    });
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
            {outlets.length} of{" "}
            {maxOutlets === Infinity ? "unlimited" : maxOutlets} outlets
          </p>
        </div>
        <Button
          onClick={() => {
            reset();
            setOpen(true);
          }}
          className="gradient-gold text-primary-foreground"
          disabled={outlets.length >= maxOutlets}
        >
          <Plus className="h-4 w-4 mr-1" /> Add Outlet
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {outlets.map((o) => {
            const addr = [o.street, o.city, o.state, o.country]
              .filter(Boolean)
              .join(", ");
            return (
              <div
                key={o.id}
                className="glass-card rounded-xl overflow-hidden flex flex-col"
              >
                {o.imageUrl && (
                  <img
                    src={o.imageUrl}
                    alt={o.name}
                    className="h-28 w-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display =
                        "none";
                    }}
                  />
                )}
                <div className="p-4 space-y-2 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold font-display">{o.name}</h3>
                      {!o.active && (
                        <Badge variant="secondary" className="mt-1">
                          Inactive
                        </Badge>
                      )}
                    </div>
                    <div className="flex">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          toggleActive.mutate({ id: o.id, active: !o.active })
                        }
                        title="Toggle active"
                      >
                        <Power
                          className={`h-3.5 w-3.5 ${o.active ? "text-success" : "text-muted-foreground"}`}
                        />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => startEdit(o)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm(`Delete ${o.name}?`))
                            delMutation.mutate(o.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  {addr && (
                    <p className="text-xs text-muted-foreground flex items-start gap-1">
                      <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                      {addr}
                    </p>
                  )}
                  {o.tel1 && (
                    <p className="text-xs text-muted-foreground">☎ {o.tel1}</p>
                  )}
                  <div className="flex flex-wrap gap-1 pt-1">
                    {o.serviceTypes.map((s) => {
                      const sd = stMap[s];
                      return (
                        <Badge
                          key={s}
                          variant="outline"
                          className="text-[10px]"
                          style={
                            sd?.color
                              ? {
                                  color: sd.color,
                                  borderColor: `${sd.color}66`,
                                }
                              : undefined
                          }
                        >
                          {sd?.name || s}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
          {outlets.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              No outlets yet — add your first one.
            </div>
          )}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editing ? "Edit" : "Add"} Outlet
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {/* ── Outlet name & image ─────────────────────────────────── */}
            <section className="rounded-xl border border-border/50 p-4 space-y-3">
              <div className="flex items-center gap-2 text-primary">
                <Building2 className="h-4 w-4" />
                <h3 className="font-semibold text-sm">Outlet</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-start">
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Outlet Name *</Label>
                    <Input
                      value={form.name || ""}
                      onChange={(e) =>
                        setForm({ ...form, name: e.target.value })
                      }
                      placeholder="SANCTUARY SPA"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Cover Image URL</Label>
                    <Input
                      value={form.imageUrl || ""}
                      onChange={(e) =>
                        setForm({ ...form, imageUrl: e.target.value })
                      }
                      placeholder="https://… (paste any public image URL)"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Shown on outlet cards and the picker dialog.
                    </p>
                  </div>
                </div>
                {form.imageUrl ? (
                  <img
                    src={form.imageUrl}
                    alt="Outlet preview"
                    className="h-28 w-28 rounded-lg object-cover border border-border/60"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display =
                        "none";
                    }}
                  />
                ) : (
                  <div className="h-28 w-28 rounded-lg border border-dashed border-border/60 flex items-center justify-center text-[10px] text-muted-foreground">
                    No image
                  </div>
                )}
              </div>
            </section>

            {/* ── Address ─────────────────────────────────────────────── */}
            <section className="rounded-xl border border-border/50 p-4 space-y-3">
              <div className="flex items-center gap-2 text-primary">
                <MapPin className="h-4 w-4" />
                <h3 className="font-semibold text-sm">Address</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Country *</Label>
                  <Select
                    value={form.country || "Nepal"}
                    onValueChange={(v) => setForm({ ...form, country: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">State</Label>
                  <Input
                    value={form.state || ""}
                    onChange={(e) =>
                      setForm({ ...form, state: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">City *</Label>
                  <Input
                    value={form.city || ""}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Street *</Label>
                  <Input
                    value={form.street || ""}
                    onChange={(e) =>
                      setForm({ ...form, street: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs">Tel 1 *</Label>
                  <Input
                    value={form.tel1 || ""}
                    onChange={(e) => setForm({ ...form, tel1: e.target.value })}
                  />
                </div>
              </div>
            </section>

            {/* ── Service Type linking ─────────────────────────────────── */}
            <section className="rounded-xl border border-border/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-primary">
                  <FileText className="h-4 w-4" />
                  <h3 className="font-semibold text-sm">Service Type Link *</h3>
                </div>
                {activeSt.length > 0 && (
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <Checkbox
                      checked={activeSt.every((s) =>
                        form.serviceTypes?.includes(s.slug),
                      )}
                      onCheckedChange={toggleAllServiceTypes}
                    />
                    SELECT ALL
                  </label>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 p-3 rounded-lg border border-border/40 bg-muted/20">
                {activeSt.map((s) => (
                  <label
                    key={s.slug}
                    className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-muted/40"
                  >
                    <Checkbox
                      checked={form.serviceTypes?.includes(s.slug)}
                      onCheckedChange={() => toggleServiceType(s.slug)}
                    />
                    <span className="text-sm flex items-center gap-1.5">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: s.color }}
                      />
                      {s.name}
                    </span>
                  </label>
                ))}
                {activeSt.length === 0 && (
                  <p className="text-xs text-muted-foreground col-span-full">
                    No service types yet. Create some in Setup → Service Types.
                  </p>
                )}
              </div>
            </section>

            {/* ── FK Relations ─────────────────────────────────────────── */}
            <section className="rounded-xl border border-border/50 p-4 space-y-3">
              <div className="flex items-center gap-2 text-primary">
                <Link2 className="h-4 w-4" />
                <h3 className="font-semibold text-sm">
                  Linked Tables (FK Relations)
                </h3>
              </div>
              <p className="text-[11px] text-muted-foreground">
                These tables reference this outlet automatically — no manual
                setup required.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {FK_RELATIONS.map((r) => (
                  <div
                    key={r.key as string}
                    className="rounded-md border border-border/40 px-3 py-2 bg-muted/10"
                  >
                    <p className="text-xs font-medium">{r.label}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {r.help}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <div className="flex gap-2 sticky bottom-0 bg-background pt-3 border-t border-border/40">
              <Button
                variant="outline"
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="flex-1 gradient-gold text-primary-foreground"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-1" />
                )}
                {editing ? "Save Changes" : "Create Outlet"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
