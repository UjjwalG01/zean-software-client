import { useState } from "react";
import { Plus, Edit, Trash2, Crown } from "lucide-react";
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
import { useMembershipPlans, useAddMembershipPlan, useUpdateMembershipPlan, useDeleteMembershipPlan, useServices, useAddService, useDeleteService } from "@/hooks/use-firestore";
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
  { id: "3", name: "CrossFit WOD", type: "Gym", duration: 60, price: 700, capacity: 12, instructor: "Trainer Prakash", isActive: true },
  { id: "4", name: "Deep Tissue Massage", type: "Spa", duration: 90, price: 2500, capacity: 1, instructor: "Therapist Maya", isActive: true },
  { id: "5", name: "Aromatherapy", type: "Spa", duration: 60, price: 2000, capacity: 1, instructor: "Therapist Sunita", isActive: true },
  { id: "6", name: "Hot Stone Therapy", type: "Spa", duration: 75, price: 3000, capacity: 1, instructor: "Therapist Maya", isActive: true },
  { id: "7", name: "Sauna Session", type: "Sauna", duration: 30, price: 500, capacity: 8, instructor: "Staff Binita", isActive: true },
  { id: "8", name: "Infrared Sauna", type: "Sauna", duration: 45, price: 800, capacity: 4, instructor: "Staff Binita", isActive: true },
  { id: "9", name: "Lap Swimming", type: "Swimming", duration: 60, price: 400, capacity: 6, instructor: "Coach Anil", isActive: true },
  { id: "10", name: "Aqua Fitness", type: "Swimming", duration: 45, price: 600, capacity: 10, instructor: "Coach Anil", isActive: true },
];

const discountRules = [
  { years: 1, discount: 0, label: "No discount" },
  { years: 2, discount: 5, label: "5% discount" },
  { years: 3, discount: 10, label: "10% discount" },
  { years: 5, discount: 15, label: "15% discount" },
  { years: 7, discount: 20, label: "20% discount (max)" },
];

const PlansServices = () => {
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [newPlan, setNewPlan] = useState({ tier: "Basic", monthly: "", yearly: "", longTerm: "", includes: "" });
  const [newService, setNewService] = useState({ name: "", type: "Gym", duration: "", price: "", capacity: "", instructor: "" });

  const { data: firestorePlans = [], isLoading: plansLoading } = useMembershipPlans();
  const { data: firestoreServices = [], isLoading: servicesLoading } = useServices();
  const addPlanMutation = useAddMembershipPlan();
  const updatePlanMutation = useUpdateMembershipPlan();
  const deletePlanMutation = useDeleteMembershipPlan();
  const addServiceMutation = useAddService();
  const deleteServiceMutation = useDeleteService();

  const plans = firestorePlans.length > 0 ? firestorePlans : fallbackPlans;
  const services = firestoreServices.length > 0 ? firestoreServices : fallbackServices;

  const handleCreatePlan = async () => {
    try {
      await addPlanMutation.mutateAsync({
        name: newPlan.tier,
        tier: newPlan.tier,
        price: Number(newPlan.monthly) || 0,
        yearlyPrice: Number(newPlan.yearly) || 0,
        longTermPrice: Number(newPlan.longTerm) || 0,
        includes: newPlan.includes,
      });
      toast.success("Plan created successfully!");
      setPlanDialogOpen(false);
      setNewPlan({ tier: "Basic", monthly: "", yearly: "", longTerm: "", includes: "" });
    } catch {
      toast.error("Failed to create plan");
    }
  };

  const handleDeletePlan = async (id: string) => {
    try {
      await deletePlanMutation.mutateAsync(id);
      toast.success("Plan deleted");
    } catch {
      toast.error("Failed to delete plan");
    }
  };

  const handleToggleAutoRenew = async (id: string, current: boolean) => {
    try {
      await updatePlanMutation.mutateAsync({ id, data: { autoRenew: !current } });
      toast.success("Auto-renew updated");
    } catch {
      toast.error("Failed to update");
    }
  };

  const handleCreateService = async () => {
    try {
      await addServiceMutation.mutateAsync({
        name: newService.name,
        type: newService.type,
        duration: Number(newService.duration) || 60,
        price: Number(newService.price) || 0,
        capacity: Number(newService.capacity) || 1,
        instructor: newService.instructor,
        isActive: true,
      });
      toast.success("Service created successfully!");
      setServiceDialogOpen(false);
      setNewService({ name: "", type: "Gym", duration: "", price: "", capacity: "", instructor: "" });
    } catch {
      toast.error("Failed to create service");
    }
  };

  const handleDeleteService = async (id: string) => {
    try {
      await deleteServiceMutation.mutateAsync(id);
      toast.success("Service deleted");
    } catch {
      toast.error("Failed to delete service");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display">Plans & Services</h1>
          <p className="text-muted-foreground text-sm">Configure membership tiers and pricing</p>
        </div>
        <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" />Add Plan</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-display">Add Membership Plan</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Tier</Label>
                <Select value={newPlan.tier} onValueChange={(v) => setNewPlan((p) => ({ ...p, tier: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Basic">Basic</SelectItem>
                    <SelectItem value="Silver">Silver</SelectItem>
                    <SelectItem value="Gold">Gold</SelectItem>
                    <SelectItem value="Platinum">Platinum</SelectItem>
                    <SelectItem value="Diamond">Diamond</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2"><Label>Monthly (NPR)</Label><Input type="number" placeholder="0" value={newPlan.monthly} onChange={(e) => setNewPlan((p) => ({ ...p, monthly: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Yearly (NPR)</Label><Input type="number" placeholder="0" value={newPlan.yearly} onChange={(e) => setNewPlan((p) => ({ ...p, yearly: e.target.value }))} /></div>
                <div className="space-y-2"><Label>15-Year (NPR)</Label><Input type="number" placeholder="0" value={newPlan.longTerm} onChange={(e) => setNewPlan((p) => ({ ...p, longTerm: e.target.value }))} /></div>
              </div>
              <div className="space-y-2"><Label>Included Services</Label><Input placeholder="e.g. Gym + Spa + Sauna" value={newPlan.includes} onChange={(e) => setNewPlan((p) => ({ ...p, includes: e.target.value }))} /></div>
              <Button onClick={handleCreatePlan} disabled={addPlanMutation.isPending} className="w-full gradient-gold text-primary-foreground">
                {addPlanMutation.isPending ? "Creating..." : "Create Plan"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="plans" className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="plans">Membership Plans</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="discounts">Auto-Discounts</TabsTrigger>
        </TabsList>

        <TabsContent value="plans">
          {plansLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {plans.map((plan) => (
                <div key={plan.id} className="glass-card rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <TierBadge tier={plan.tier as any} />
                    <Crown className="h-4 w-4 text-primary/60" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold font-display">{formatNPR(plan.price)}</p>
                    <p className="text-xs text-muted-foreground">per month</p>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Yearly</span><span className="font-medium">{formatNPR(plan.yearlyPrice || 0)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">15-Year</span><span className="font-medium">{formatNPR(plan.longTermPrice || 0)}</span></div>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Includes</span>
                    <span className="font-medium text-right text-xs">{plan.includes || "—"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Auto-Renew</span>
                    <Switch checked={plan.autoRenew || false} onCheckedChange={() => handleToggleAutoRenew(plan.id, plan.autoRenew || false)} />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => toast.info("Edit plan dialog coming soon")}>
                      <Edit className="h-3.5 w-3.5 mr-1" />Edit
                    </Button>
                    <Button variant="outline" size="icon" className="h-9 w-9 text-destructive hover:bg-destructive/10" onClick={() => handleDeletePlan(plan.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="services">
          <div className="flex justify-end mb-4">
            <Dialog open={serviceDialogOpen} onOpenChange={setServiceDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" />Add Service</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle className="font-display">Add Service</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2"><Label>Service Name</Label><Input placeholder="e.g. Power Yoga" value={newService.name} onChange={(e) => setNewService((s) => ({ ...s, name: e.target.value }))} /></div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={newService.type} onValueChange={(v) => setNewService((s) => ({ ...s, type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Gym">Gym</SelectItem>
                        <SelectItem value="Spa">Spa</SelectItem>
                        <SelectItem value="Sauna">Sauna</SelectItem>
                        <SelectItem value="Swimming">Swimming</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2"><Label>Duration (min)</Label><Input type="number" placeholder="60" value={newService.duration} onChange={(e) => setNewService((s) => ({ ...s, duration: e.target.value }))} /></div>
                    <div className="space-y-2"><Label>Price (NPR)</Label><Input type="number" placeholder="500" value={newService.price} onChange={(e) => setNewService((s) => ({ ...s, price: e.target.value }))} /></div>
                    <div className="space-y-2"><Label>Capacity</Label><Input type="number" placeholder="20" value={newService.capacity} onChange={(e) => setNewService((s) => ({ ...s, capacity: e.target.value }))} /></div>
                  </div>
                  <div className="space-y-2"><Label>Instructor</Label><Input placeholder="e.g. Trainer Ravi" value={newService.instructor} onChange={(e) => setNewService((s) => ({ ...s, instructor: e.target.value }))} /></div>
                  <Button onClick={handleCreateService} disabled={addServiceMutation.isPending} className="w-full gradient-gold text-primary-foreground">
                    {addServiceMutation.isPending ? "Creating..." : "Create Service"}
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
                    <TableHead>Type</TableHead>
                    <TableHead className="hidden md:table-cell">Duration</TableHead>
                    <TableHead className="hidden md:table-cell">Instructor</TableHead>
                    <TableHead className="hidden lg:table-cell">Capacity</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {services.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium text-sm">{s.name}</TableCell>
                      <TableCell><Badge variant="secondary" className="text-[10px]">{s.type}</Badge></TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{s.duration} min</TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{s.instructor || "—"}</TableCell>
                      <TableCell className="hidden lg:table-cell text-sm">{s.capacity || "—"}</TableCell>
                      <TableCell className="text-right font-medium text-sm">{formatNPR(s.price)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => handleDeleteService(s.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="discounts">
          <div className="glass-card rounded-xl p-5">
            <h3 className="font-semibold font-display mb-4">Loyalty Auto-Discount Rules</h3>
            <p className="text-sm text-muted-foreground mb-6">Discounts are automatically applied based on continuous membership years.</p>
            <div className="space-y-3">
              {discountRules.map((rule) => (
                <div key={rule.years} className="flex items-center justify-between rounded-lg border border-border/50 p-4">
                  <div>
                    <p className="font-medium text-sm">{rule.years}+ year{rule.years > 1 ? "s" : ""} of membership</p>
                    <p className="text-xs text-muted-foreground">{rule.label}</p>
                  </div>
                  <Badge variant={rule.discount > 0 ? "default" : "secondary"} className="text-sm">{rule.discount}%</Badge>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PlansServices;
