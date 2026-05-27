import { useState, useEffect } from "react";
import { Plus, Trash2, Save, Loader2, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useCompanySettings, useSaveCompanySettings } from "@/hooks/use-firestore";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

// Check if a setup value is referenced by other records. Calls SQL function
// is_config_value_in_use (db/schema.sql); falls back to false on legacy DBs.
async function checkInUse(category: string, value: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("is_config_value_in_use", { _category: category, _value: value });
    if (error) return false;
    return !!data;
  } catch { return false; }
}

// Each setup category is stored as JSON in companySettings
function useSetupList(key: string, fallback: string[]) {
  const { data: settings = {} } = useCompanySettings();
  const saveMutation = useSaveCompanySettings();
  const [items, setItems] = useState<string[]>(fallback);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (settings[key] && !loaded) {
      try { setItems(JSON.parse(settings[key])); } catch { /* keep fallback */ }
      setLoaded(true);
    }
  }, [settings, key, loaded]);

  const save = async (newItems: string[]) => {
    setItems(newItems);
    await saveMutation.mutateAsync({ [key]: JSON.stringify(newItems) });
  };

  return { items, save, isPending: saveMutation.isPending };
}

const GeneralSetup = () => {
  const classes = useSetupList("setup_classes", [
    "Morning Power Yoga", "HIIT Blast", "CrossFit WOD", "Strength Training",
    "Aqua Fitness", "Zumba", "Pilates", "Boxing Basics",
  ]);
  const planDurations = useSetupList("setup_planDurations", ["Monthly", "Quarterly", "Half-Yearly", "Yearly", "15-Year"]);
  const paymentModes = useSetupList("setup_paymentModes", ["Cash", "Card", "Esewa", "Bank Transfer", "Mobile Wallet"]);
  const paymentTypes = useSetupList("setup_paymentTypes", ["Payment", "Renewal", "Registration", "Advance", "Refund"]);
  const serviceTypes = useSetupList("setup_serviceTypes", ["Gym", "Spa", "Sauna", "Swimming"]);
  const preferences = useSetupList("setup_preferences", [
    "Yoga", "Cardio", "Weight Training", "Swimming Laps", "Steam Bath",
    "Personal Training", "Dance Fitness", "Meditation", "Boxing",
  ]);
  const timeSlots = useSetupList("setup_timeSlots", ["Morning", "Day", "Evening"]);
  const packages = useSetupList("setup_packages", [
    "Gym", "Cardio", "Swimming", "Spa",
    "Gym+Cardio", "Cardio+Spa", "Gym+Swimming", "Cardio+Swimming",
    "Gym+Cardio+Swimming", "Gym+Spa", "Gym+Cardio+Spa",
    "Gym-Swimming+Spa", "Cardio+Swimming+Spa", "Swimming+Spa", "Combo",
  ]);
  const bloodGroups = useSetupList("setup_bloodGroups", ["A+","A-","B+","B-","O+","O-","AB+","AB-"]);
  const grcRules = useSetupList("setup_grcFooterRules", [
    "Periodic check up (3, 6, 12 months) body analysis will be made.",
    "If you need to be informed or communicated.",
    "Membership expiration will be informed before 7 days.",
  ]);

  const sections = [
    { key: "classes",        cat: "setup_classes",        label: "Classes / Sessions",  hook: classes },
    { key: "serviceTypes",   cat: "setup_serviceTypes",   label: "Service Types",        hook: serviceTypes },
    { key: "planDurations",  cat: "setup_planDurations",  label: "Plan Durations",       hook: planDurations },
    { key: "timeSlots",      cat: "setup_timeSlots",      label: "Time Slots",           hook: timeSlots },
    { key: "packages",       cat: "setup_packages",       label: "Available Packages",   hook: packages },
    { key: "bloodGroups",    cat: "setup_bloodGroups",    label: "Blood Groups",         hook: bloodGroups },
    { key: "paymentModes",   cat: "setup_paymentModes",   label: "Payment Modes",        hook: paymentModes },
    { key: "paymentTypes",   cat: "setup_paymentTypes",   label: "Payment Types",        hook: paymentTypes },
    { key: "preferences",    cat: "setup_preferences",    label: "Member Preferences",   hook: preferences },
    { key: "grcFooterRules", cat: "setup_grcFooterRules", label: "GRC Footer Rules",     hook: grcRules },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold font-display">General Setup</h1>
        <p className="text-muted-foreground text-sm">Configure dropdown options used across bookings, members, and transactions</p>
      </div>

      <Tabs defaultValue="classes" className="space-y-4">
        <TabsList className="bg-muted/50 flex-wrap h-auto gap-1">
          {sections.map((s) => (
            <TabsTrigger key={s.key} value={s.key}>{s.label}</TabsTrigger>
          ))}
        </TabsList>

        {sections.map((section) => (
          <TabsContent key={section.key} value={section.key}>
            <SetupSection
              label={section.label}
              category={section.cat}
              items={section.hook.items}
              onSave={section.hook.save}
              isPending={section.hook.isPending}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

function SetupSection({ label, category, items, onSave, isPending }: { label: string; category: string; items: string[]; onSave: (items: string[]) => Promise<void>; isPending: boolean }) {
  const [localItems, setLocalItems] = useState(items);
  const [newItem, setNewItem] = useState("");
  const [dirty, setDirty] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [inUse, setInUse] = useState<Record<string, boolean>>({});

  useEffect(() => { setLocalItems(items); }, [items]);

  // Pre-check usage so disabled state appears without click
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: Record<string, boolean> = {};
      for (const it of items) next[it] = await checkInUse(category, it);
      if (!cancelled) setInUse(next);
    })();
    return () => { cancelled = true; };
  }, [items, category]);

  const addItem = () => {
    if (!newItem.trim()) return;
    if (localItems.includes(newItem.trim())) { toast.error("Already exists"); return; }
    setLocalItems([...localItems, newItem.trim()]);
    setNewItem("");
    setDirty(true);
  };

  const removeItem = async (index: number) => {
    const value = localItems[index];
    if (await checkInUse(category, value)) {
      toast.error(`"${value}" is used in existing records and cannot be deleted.`);
      setInUse((p) => ({ ...p, [value]: true }));
      return;
    }
    setLocalItems(localItems.filter((_, i) => i !== index));
    setDirty(true);
  };

  const startEdit = (i: number) => { setEditIndex(i); setEditValue(localItems[i]); };
  const cancelEdit = () => { setEditIndex(null); setEditValue(""); };
  const saveEdit = () => {
    const trimmed = editValue.trim();
    if (!trimmed) { toast.error("Cannot be empty"); return; }
    if (editIndex === null) return;
    if (localItems.some((v, i) => i !== editIndex && v === trimmed)) { toast.error("Already exists"); return; }
    setLocalItems(localItems.map((v, i) => (i === editIndex ? trimmed : v)));
    setEditIndex(null); setEditValue(""); setDirty(true);
  };

  const handleSave = async () => {
    try { await onSave(localItems); toast.success(`${label} saved!`); setDirty(false); }
    catch { toast.error("Failed to save"); }
  };

  return (
    <div className="glass-card rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold font-display">{label}</h3>
        <Badge variant="secondary" className="text-xs">{localItems.length} items</Badge>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder={`Add new ${label.toLowerCase().replace(/s$/, "")}...`}
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addItem()}
          className="bg-muted/50 border-0"
        />
        <Button size="sm" onClick={addItem}><Plus className="h-4 w-4 mr-1" />Add</Button>
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-12">#</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="w-28 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {localItems.map((item, i) => {
              const locked = !!inUse[item];
              return (
                <TableRow key={i}>
                  <TableCell className="text-muted-foreground text-sm">{i + 1}</TableCell>
                  <TableCell className="text-sm font-medium">
                    {editIndex === i ? (
                      <Input value={editValue} onChange={(e) => setEditValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") cancelEdit(); }} className="h-7" autoFocus />
                    ) : (
                      <span className="flex items-center gap-2">
                        {item}
                        {locked && <Badge variant="outline" className="text-[10px]">in use</Badge>}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {editIndex === i ? (
                      <>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-success" onClick={saveEdit}><Check className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={cancelEdit}><X className="h-3.5 w-3.5" /></Button>
                      </>
                    ) : (
                      <>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(i)} title="Edit">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:bg-destructive/10 disabled:opacity-40"
                          onClick={() => removeItem(i)}
                          disabled={locked}
                          title={locked ? "Used in existing records — cannot delete" : "Delete"}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {dirty && (
        <Button onClick={handleSave} disabled={isPending} className="gradient-gold text-primary-foreground">
          {isPending ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Saving...</> : <><Save className="h-4 w-4 mr-1" />Save Changes</>}
        </Button>
      )}
    </div>
  );
}

export default GeneralSetup;
