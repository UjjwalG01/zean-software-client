import { useMemo, useState } from "react";
import { Plus, Edit, Trash2, Crown, Save, Percent, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { TierBadge } from "@/components/TierBadge";
import { formatNPR } from "@/lib/mock-data";
import {
  useMembershipPlans, useAddMembershipPlan, useUpdateMembershipPlan, useDeleteMembershipPlan,
  useServices, useAddService, useUpdateService, useDeleteService,
  useDiscountRules, useSaveDiscountRules,
} from "@/hooks/use-firestore";
import { useOutlet } from "@/contexts/OutletContext";
import { useQuery } from "@tanstack/react-query";
import { getServiceTypes } from "@/lib/firebase-outlets";
import { toast } from "sonner";

const fallbackPlans = [
  { id: "1", tier: "Basic", price: 3000, yearlyPrice: 30000, longTermPrice: 350000, includes: "Gym Only", autoRenew: true, name: "Basic" },
  { id: "2", tier: "Silver", price: 5000, yearlyPrice: 50000, longTermPrice: 550000, includes: "Gym + Swimming", autoRenew: true, name: "Silver" },
  { id: "3", tier: "Gold", price: 8000, yearlyPrice: 80000, longTermPrice: 850000, includes: "Gym + Spa + Sauna", autoRenew: false, name: "Gold" },
  { id: "4", tier: "Platinum", price: 12000, yearlyPrice: 120000, longTermPrice: 1200000, includes: "Full Access + Personal Trainer", autoRenew: false, name: "Platinum" },
];

const fallbackServices = [
  { id: "1", name: "Morning Power Yoga", type: "Gym", duration: 60, price: 500, capacity: 20, instructor: "Trainer Ravi", isActive: true },
  { id: "2", name: "HIIT Blast", type: "Gym", duration: 45, price: 600, capacity: 15, instructor: "Trainer Ravi", isActive: true },
  { id: "3", name: "Deep Tissue Massage", type: "Spa", duration: 90, price: 2500, capacity: 1, instructor: "Therapist Maya", isActive: true },
  { id: "4", name: "Sauna Session", type: "Sauna", duration: 30, price: 500, capacity: 8, instructor: "Staff Binita", isActive: true },
  { id: "5", name: "Lap Swimming", type: "Swimming", duration: 60, price: 400, capacity: 6, instructor: "Coach Anil", isActive: true },
];

const PlansServices = () => {
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [editPlanId, setEditPlanId] = useState<string | null>(null);
  const [editServiceId, setEditServiceId] = useState<string | null>(null);
  const [newPlan, setNewPlan] = useState({ tier: "Basic", monthly: "", yearly: "", longTerm: "", includes: "" });
  const [newService, setNewService] = useState({ name: "", outletId: "", type: "", duration: "", price: "", capacity: "", instructor: "" });
  const [serviceOutletFilter, setServiceOutletFilter] = useState<string>("all");

  const { outlets } = useOutlet();
  const { data: serviceTypes = [] } = useQuery({ queryKey: ["serviceTypes"], queryFn: getServiceTypes });

  const { data: firestorePlans = [], isLoading: plansLoading } = useMembershipPlans();
  const { data: firestoreServices = [], isLoading: servicesLoading } = useServices();
  const { data: discountRules = [], isLoading: discountsLoading } = useDiscountRules();
  const addPlanMutation = useAddMembershipPlan();
  const updatePlanMutation = useUpdateMembershipPlan();
  const deletePlanMutation = useDeleteMembershipPlan();
  const addServiceMutation = useAddService();
  const updateServiceMutation = useUpdateService();
  const deleteServiceMutation = useDeleteService();
  const saveDiscountsMutation = useSaveDiscountRules();

  const plans = firestorePlans.length > 0 ? firestorePlans : fallbackPlans;
  const services = firestoreServices.length > 0 ? firestoreServices : fallbackServices;

  // Editable discount rules state
  const defaultDiscounts = [
    { years: 1, discount: 0 }, { years: 2, discount: 5 }, { years: 3, discount: 10 }, { years: 5, discount: 15 }, { years: 7, discount: 20 },
  ];
  const [editableDiscounts, setEditableDiscounts] = useState(
    discountRules.length > 0 ? discountRules : defaultDiscounts
  );
  const [discountsEdited, setDiscountsEdited] = useState(false);

  const handleCreatePlan = async () => {
    try {
      if (editPlanId) {
        await updatePlanMutation.mutateAsync({
          id: editPlanId,
          data: {
            name: newPlan.tier,
            tier: newPlan.tier,
            price: Number(newPlan.monthly) || 0,
            yearlyPrice: Number(newPlan.yearly) || 0,
            longTermPrice: Number(newPlan.longTerm) || 0,
            includes: newPlan.includes,
          },
        });
        toast.success("Plan updated!");
      } else {
        await addPlanMutation.mutateAsync({
          name: newPlan.tier,
          tier: newPlan.tier,
          price: Number(newPlan.monthly) || 0,
          yearlyPrice: Number(newPlan.yearly) || 0,
          longTermPrice: Number(newPlan.longTerm) || 0,
          includes: newPlan.includes,
        });
        toast.success("Plan created!");
      }
      setPlanDialogOpen(false);
      setEditPlanId(null);
      setNewPlan({ tier: "Basic", monthly: "", yearly: "", longTerm: "", includes: "" });
    } catch {
      toast.error("Failed to save plan");
    }
  };

  const openEditPlan = (plan: any) => {
    setEditPlanId(plan.id);
    setNewPlan({
      tier: plan.tier,
      monthly: String(plan.price),
      yearly: String(plan.yearlyPrice || 0),
      longTerm: String(plan.longTermPrice || 0),
      includes: plan.includes || "",
    });
    setPlanDialogOpen(true);
  };

  const handleDeletePlan = async (id: string) => {
    try { await deletePlanMutation.mutateAsync(id); toast.success("Plan deleted"); } catch { toast.error("Failed to delete"); }
  };

  const handleToggleAutoRenew = async (id: string, current: boolean) => {
    try { await updatePlanMutation.mutateAsync({ id, data: { autoRenew: !current } }); toast.success("Auto-renew updated"); } catch { toast.error("Failed"); }
  };

  const emptyService = { name: "", outletId: "", type: "", duration: "", price: "", capacity: "", instructor: "" };

  const handleCreateService = async () => {
    if (!newService.name.trim()) { toast.error("Service name required"); return; }
    if (!newService.outletId) { toast.error("Select the outlet this service belongs to"); return; }
    if (!newService.type) { toast.error("Select service type"); return; }
    try {
      const payload = {
        name: newService.name,
        type: newService.type,
        outletId: newService.outletId,
        duration: Number(newService.duration) || 60,
        price: Number(newService.price) || 0,
        capacity: Number(newService.capacity) || 1,
        instructor: newService.instructor,
      };
      if (editServiceId) {
        await updateServiceMutation.mutateAsync({ id: editServiceId, data: payload });
        toast.success("Service updated!");
      } else {
        await addServiceMutation.mutateAsync({ ...payload, isActive: true });
        toast.success("Service created!");
      }
      setServiceDialogOpen(false);
      setEditServiceId(null);
      setNewService(emptyService);
    } catch {
      toast.error("Failed to save service");
    }
  };

  const openEditService = (svc: any) => {
    setEditServiceId(svc.id);
    setNewService({
      name: svc.name, outletId: svc.outletId || "", type: svc.type || "",
      duration: String(svc.duration), price: String(svc.price),
      capacity: String(svc.capacity || ""), instructor: svc.instructor || "",
    });
    setServiceDialogOpen(true);
  };

  const handleDeleteService = async (id: string) => {
    try { await deleteServiceMutation.mutateAsync(id); toast.success("Service deleted"); } catch { toast.error("Failed"); }
  };

  const updateDiscount = (index: number, field: "years" | "discount", value: string) => {
    const updated = [...editableDiscounts];
    updated[index] = { ...updated[index], [field]: Number(value) || 0 };
    setEditableDiscounts(updated);
    setDiscountsEdited(true);
  };

  const addDiscountRule = () => {
    setEditableDiscounts([...editableDiscounts, { years: editableDiscounts.length + 1, discount: 0 }]);
    setDiscountsEdited(true);
  };

  const removeDiscountRule = (index: number) => {
    setEditableDiscounts(editableDiscounts.filter((_, i) => i !== index));
    setDiscountsEdited(true);
  };

  const handleSaveDiscounts = async () => {
    try {
      await saveDiscountsMutation.mutateAsync(editableDiscounts);
      toast.success("Discount rules saved!");
      setDiscountsEdited(false);
    } catch {
      toast.error("Failed to save");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display">Plans & Services</h1>
          <p className="text-muted-foreground text-sm">Configure membership tiers, services, and auto-discount rules</p>
        </div>
      </div>

      <Tabs defaultValue="plans" className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="plans">Membership Plans</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="discounts">Auto-Discounts</TabsTrigger>
        </TabsList>

        {/* ─── Plans ─── */}
        <TabsContent value="plans">
          <div className="flex justify-end mb-4">
            <Dialog open={planDialogOpen} onOpenChange={(o) => { setPlanDialogOpen(o); if (!o) { setEditPlanId(null); setNewPlan({ tier: "Basic", monthly: "", yearly: "", longTerm: "", includes: "" }); } }}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Add Plan</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle className="font-display">{editPlanId ? "Edit" : "Add"} Membership Plan</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Tier</Label>
                    <Select value={newPlan.tier} onValueChange={(v) => setNewPlan((p) => ({ ...p, tier: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["Basic", "Silver", "Gold", "Platinum", "Diamond"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2"><Label>Monthly (NPR)</Label><Input type="number" placeholder="0" value={newPlan.monthly} onChange={(e) => setNewPlan((p) => ({ ...p, monthly: e.target.value }))} /></div>
                    <div className="space-y-2"><Label>Yearly (NPR)</Label><Input type="number" placeholder="0" value={newPlan.yearly} onChange={(e) => setNewPlan((p) => ({ ...p, yearly: e.target.value }))} /></div>
                    <div className="space-y-2"><Label>15-Year (NPR)</Label><Input type="number" placeholder="0" value={newPlan.longTerm} onChange={(e) => setNewPlan((p) => ({ ...p, longTerm: e.target.value }))} /></div>
                  </div>
                  <div className="space-y-2"><Label>Included Services</Label><Input placeholder="e.g. Gym + Spa + Sauna" value={newPlan.includes} onChange={(e) => setNewPlan((p) => ({ ...p, includes: e.target.value }))} /></div>
                  <Button onClick={handleCreatePlan} disabled={addPlanMutation.isPending || updatePlanMutation.isPending} className="w-full gradient-gold text-primary-foreground">
                    {(addPlanMutation.isPending || updatePlanMutation.isPending) ? "Saving..." : editPlanId ? "Update Plan" : "Create Plan"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          {plansLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)}</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {plans.map((plan) => (
                <div key={plan.id} className="glass-card rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between"><TierBadge tier={plan.tier as any} /><Crown className="h-4 w-4 text-primary/60" /></div>
                  <div><p className="text-2xl font-bold font-display">{formatNPR(plan.price)}</p><p className="text-xs text-muted-foreground">per month</p></div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Yearly</span><span className="font-medium">{formatNPR(plan.yearlyPrice || 0)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">15-Year</span><span className="font-medium">{formatNPR(plan.longTermPrice || 0)}</span></div>
                  </div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Includes</span><span className="font-medium text-right text-xs">{plan.includes || "—"}</span></div>
                  <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Auto-Renew</span><Switch checked={plan.autoRenew || false} onCheckedChange={() => handleToggleAutoRenew(plan.id, plan.autoRenew || false)} /></div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => openEditPlan(plan)}><Edit className="h-3.5 w-3.5 mr-1" />Edit</Button>
                    <Button variant="outline" size="icon" className="h-9 w-9 text-destructive hover:bg-destructive/10" onClick={() => handleDeletePlan(plan.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ─── Services ─── */}
        <TabsContent value="services">
          <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <Label className="text-xs text-muted-foreground">Outlet</Label>
              <Select value={serviceOutletFilter} onValueChange={setServiceOutletFilter}>
                <SelectTrigger className="w-[220px] h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All outlets</SelectItem>
                  {outlets.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Dialog open={serviceDialogOpen} onOpenChange={(o) => { setServiceDialogOpen(o); if (!o) { setEditServiceId(null); setNewService(emptyService); } }}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Add Service</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle className="font-display">{editServiceId ? "Edit" : "Add"} Service</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Outlet *</Label>
                    <Select value={newService.outletId} onValueChange={(v) => setNewService((s) => ({ ...s, outletId: v, type: "" }))}>
                      <SelectTrigger><SelectValue placeholder="Select outlet" /></SelectTrigger>
                      <SelectContent>
                        {outlets.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Service Name *</Label><Input placeholder="e.g. Power Yoga" value={newService.name} onChange={(e) => setNewService((s) => ({ ...s, name: e.target.value }))} /></div>
                  <div className="space-y-2">
                    <Label>Service Type * <span className="text-xs text-muted-foreground">(inherited from outlet)</span></Label>
                    <Select value={newService.type} onValueChange={(v) => setNewService((s) => ({ ...s, type: v }))} disabled={!newService.outletId}>
                      <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                      <SelectContent>
                        {(() => {
                          const o = outlets.find((o) => o.id === newService.outletId);
                          const slugs = o?.serviceTypes || [];
                          const items = serviceTypes.filter((st) => slugs.includes(st.slug));
                          return items.length > 0
                            ? items.map((st) => <SelectItem key={st.slug} value={st.name}>{st.name}</SelectItem>)
                            : slugs.map((sl) => <SelectItem key={sl} value={sl}>{sl}</SelectItem>);
                        })()}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2"><Label>Duration (min)</Label><Input type="number" placeholder="60" value={newService.duration} onChange={(e) => setNewService((s) => ({ ...s, duration: e.target.value }))} /></div>
                    <div className="space-y-2"><Label>Rate (NPR)</Label><Input type="number" placeholder="500" value={newService.price} onChange={(e) => setNewService((s) => ({ ...s, price: e.target.value }))} /></div>
                    <div className="space-y-2"><Label>Capacity</Label><Input type="number" placeholder="20" value={newService.capacity} onChange={(e) => setNewService((s) => ({ ...s, capacity: e.target.value }))} /></div>
                  </div>
                  <div className="space-y-2"><Label>Instructor</Label><Input placeholder="e.g. Trainer Ravi" value={newService.instructor} onChange={(e) => setNewService((s) => ({ ...s, instructor: e.target.value }))} /></div>
                  <Button onClick={handleCreateService} disabled={addServiceMutation.isPending || updateServiceMutation.isPending} className="w-full gradient-gold text-primary-foreground">
                    {(addServiceMutation.isPending || updateServiceMutation.isPending) ? "Saving..." : editServiceId ? "Update Service" : "Create Service"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          {servicesLoading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
          ) : (
            <div className="glass-card rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Service</TableHead>
                    <TableHead>Outlet</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="hidden md:table-cell">Duration</TableHead>
                    <TableHead className="hidden md:table-cell">Instructor</TableHead>
                    <TableHead className="hidden lg:table-cell">Capacity</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {services
                    .filter((s: any) => serviceOutletFilter === "all" || s.outletId === serviceOutletFilter)
                    .map((s: any) => {
                      const o = outlets.find((o) => o.id === s.outletId);
                      return (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium text-sm">{s.name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{o?.name || <span className="italic text-destructive/70">unassigned</span>}</TableCell>
                          <TableCell><Badge variant="secondary" className="text-[10px]">{s.type}</Badge></TableCell>
                          <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{s.duration} min</TableCell>
                          <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{s.instructor || "—"}</TableCell>
                          <TableCell className="hidden lg:table-cell text-sm">{s.capacity || "—"}</TableCell>
                          <TableCell className="text-right font-medium text-sm">{formatNPR(s.price)}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditService(s)}><Edit className="h-3.5 w-3.5" /></Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => handleDeleteService(s.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ─── Auto-Discounts ─── */}
        <TabsContent value="discounts">
          <div className="glass-card rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Percent className="h-5 w-5 text-primary" />
                <h3 className="font-semibold font-display">Loyalty Auto-Discount Rules</h3>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={addDiscountRule}><Plus className="h-4 w-4 mr-1" />Add Rule</Button>
                {discountsEdited && (
                  <Button size="sm" onClick={handleSaveDiscounts} disabled={saveDiscountsMutation.isPending} className="gradient-gold text-primary-foreground">
                    <Save className="h-4 w-4 mr-1" />{saveDiscountsMutation.isPending ? "Saving..." : "Save Rules"}
                  </Button>
                )}
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-6">Discounts are automatically applied based on continuous membership years. Edit values below and save.</p>
            {discountsLoading ? (
              <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
            ) : (
              <div className="space-y-3">
                {editableDiscounts.map((rule, index) => (
                  <div key={index} className="flex items-center gap-4 rounded-lg border border-border/50 p-4">
                    <div className="flex-1 grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Min. Years</Label>
                        <Input
                          type="number"
                          value={rule.years}
                          onChange={(e) => updateDiscount(index, "years", e.target.value)}
                          className="h-9 bg-muted/50 border-0"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Discount %</Label>
                        <Input
                          type="number"
                          value={rule.discount}
                          onChange={(e) => updateDiscount(index, "discount", e.target.value)}
                          className="h-9 bg-muted/50 border-0"
                        />
                      </div>
                    </div>
                    <Badge variant={rule.discount > 0 ? "default" : "secondary"} className="text-sm min-w-[50px] justify-center">{rule.discount}%</Badge>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeDiscountRule(index)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PlansServices;
