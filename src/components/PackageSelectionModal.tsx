import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useOutlet } from "@/contexts/OutletContext";
import { useMembershipPlans, useServices, useUpdateMember, useCompanySettings } from "@/hooks/use-firestore";
import { formatNPR } from "@/lib/mock-data";

function parseList(s: Record<string, string>, k: string, fb: string[]): string[] {
  try { return s[k] ? JSON.parse(s[k]) : fb; } catch { return fb; }
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  memberId: string;
  memberName: string;
  onDone?: () => void;
}

/**
 * Modal shown immediately after member creation/update. Lets the staff pick
 * one or more packages/plans/services for a selected outlet — package data is
 * stored on the member record (legacy compatible) until the dedicated
 * `member_packages` table (db/schema.sql) is rolled out.
 */
export default function PackageSelectionModal({ open, onOpenChange, memberId, memberName, onDone }: Props) {
  const { outlets, selected } = useOutlet();
  const { data: plans = [] } = useMembershipPlans();
  const { data: services = [] } = useServices();
  const { data: settings = {} } = useCompanySettings();
  const updateMember = useUpdateMember();

  const packageOptions = parseList(settings, "setup_packages", ["Gym","Cardio","Swimming","Spa","Combo"]);
  const timeSlots = parseList(settings, "setup_timeSlots", ["Morning","Day","Evening"]);

  const [outletId, setOutletId] = useState(selected?.id || "");
  const [planId, setPlanId] = useState<string>("");
  const [pkgs, setPkgs] = useState<string[]>([]);
  const [timeSlot, setTimeSlot] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open && selected?.id) setOutletId(selected.id); }, [open, selected]);
  useEffect(() => { if (!timeSlot && timeSlots.length) setTimeSlot(timeSlots[0]); }, [timeSlots, timeSlot]);

  const outletServices = useMemo(() => services, [services]);
  const toggle = (p: string) => setPkgs((cur) => cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]);

  const handleSave = async () => {
    if (!outletId) { toast.error("Select an outlet"); return; }
    if (!planId && pkgs.length === 0) { toast.error("Select a plan or at least one package"); return; }
    setSaving(true);
    try {
      const planRow: any = plans.find((p: any) => p.id === planId);
      await updateMember.mutateAsync({
        id: memberId,
        data: {
          outletId,
          packages: pkgs,
          plan: planRow?.name || planRow?.tier || undefined,
          tier: planRow?.tier || undefined,
          timeSlot,
        },
      });
      toast.success("Package assigned");
      onOpenChange(false);
      onDone?.();
    } catch (e: any) {
      toast.error(e.message || "Failed to assign package");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Assign Package</DialogTitle>
          <DialogDescription>
            Choose an outlet, plan and packages for <span className="font-medium text-foreground">{memberName}</span>.
            You can also skip and assign later from the member profile.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Outlet</Label>
              <Select value={outletId} onValueChange={setOutletId}>
                <SelectTrigger><SelectValue placeholder="Select outlet" /></SelectTrigger>
                <SelectContent>
                  {outlets.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}{o.outletCode ? ` [${o.outletCode}]` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Time Slot</Label>
              <Select value={timeSlot} onValueChange={setTimeSlot}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{timeSlots.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Membership Plan</Label>
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger><SelectValue placeholder="Choose plan (optional)" /></SelectTrigger>
              <SelectContent>
                {plans.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name || p.tier}{p.price ? ` — ${formatNPR(Number(p.price))}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="mb-2 block">Available Packages</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {packageOptions.map((p) => (
                <label key={p} className="flex items-center gap-2 rounded-lg border border-border p-2.5 cursor-pointer hover:bg-muted/30 text-sm">
                  <Checkbox checked={pkgs.includes(p)} onCheckedChange={() => toggle(p)} />
                  <span>{p}</span>
                </label>
              ))}
            </div>
          </div>

          {outletServices.length > 0 && (
            <div className="text-xs text-muted-foreground">
              <Badge variant="secondary" className="mr-2">{outletServices.length} services</Badge>
              available at this outlet for booking.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); onDone?.(); }}>Skip</Button>
          <Button onClick={handleSave} disabled={saving} className="gradient-gold text-primary-foreground">
            {saving ? "Saving..." : "Assign Package"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
