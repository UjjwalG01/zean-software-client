import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Edit,
  Trash2,
  Crown,
  Save,
  Percent,
  Building2,
  X,
  Clock,
  BadgeCheck,
  ShieldCheck,
  Diamond,
  Gem,
  Swords,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { TierBadge } from "@/components/TierBadge";
import { formatNPR } from "@/lib/mock-data";
import { formatMonths } from "@/lib/duration";
import {
  useMembershipPlans,
  useAddMembershipPlan,
  useUpdateMembershipPlan,
  useDeleteMembershipPlan,
  useServices,
  useAddService,
  useUpdateService,
  useDeleteService,
  useDiscountRules,
  useSaveDiscountRules,
  usePlanDurations,
  useAddPlanDuration,
  useUpdatePlanDuration,
  useDeletePlanDuration,
  useCompanySettings,
} from "@/hooks/use-firestore";
import { useOutlet } from "@/contexts/OutletContext";
import { useQuery } from "@tanstack/react-query";
import { getServiceTypes } from "@/lib/supabase-outlets";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit-log";

const fallbackPlans = [
  {
    id: "1",
    tier: "Basic",
    price: 3000,
    yearlyPrice: 30000,
    longTermPrice: 350000,
    includes: "Gym Only",
    autoRenew: true,
    name: "Basic",
  },
  {
    id: "2",
    tier: "Silver",
    price: 5000,
    yearlyPrice: 50000,
    longTermPrice: 550000,
    includes: "Gym + Swimming",
    autoRenew: true,
    name: "Silver",
  },
  {
    id: "3",
    tier: "Gold",
    price: 8000,
    yearlyPrice: 80000,
    longTermPrice: 850000,
    includes: "Gym + Spa + Sauna",
    autoRenew: false,
    name: "Gold",
  },
  {
    id: "4",
    tier: "Platinum",
    price: 12000,
    yearlyPrice: 120000,
    longTermPrice: 1200000,
    includes: "Full Access + Personal Trainer",
    autoRenew: false,
    name: "Platinum",
  },
];

const fallbackServices = [
  {
    id: "1",
    name: "Morning Power Yoga",
    type: "Gym",
    duration: 60,
    price: 500,
    instructor: "Trainer Ravi",
    isActive: true,
  },
  {
    id: "2",
    name: "HIIT Blast",
    type: "Gym",
    duration: 45,
    price: 600,
    instructor: "Trainer Ravi",
    isActive: true,
  },
  {
    id: "3",
    name: "Deep Tissue Massage",
    type: "Spa",
    duration: 90,
    price: 2500,
    instructor: "Therapist Maya",
    isActive: true,
  },
  {
    id: "4",
    name: "Sauna Session",
    type: "Sauna",
    duration: 30,
    price: 500,
    instructor: "Staff Binita",
    isActive: true,
  },
  {
    id: "5",
    name: "Lap Swimming",
    type: "Swimming",
    duration: 60,
    price: 400,
    instructor: "Coach Anil",
    isActive: true,
  },
];

const PlansServices = () => {
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [editPlanId, setEditPlanId] = useState<string | null>(null);
  const [editServiceId, setEditServiceId] = useState<string | null>(null);
  const emptyPlan = {
    name: "",
    tier: "Basic",
    durationMonths: "1",
    includedServices: [] as string[],
    autoRenew: false,
    autoDiscount: false,
    prices: [] as { durationId: string; price: string }[],
  };
  const [newPlan, setNewPlan] = useState(emptyPlan);
  const [includeInput, setIncludeInput] = useState("");

  // Plan-duration setup state
  const [durationDialogOpen, setDurationDialogOpen] = useState(false);
  const [editDurationId, setEditDurationId] = useState<string | null>(null);
  const [durationDraft, setDurationDraft] = useState({ months: "", name: "" });
  const [newService, setNewService] = useState({
    name: "",
    outletId: "",
    type: "",
    duration: "",
    price: "",
    instructor: "",
    requiresInstructor: false,
  });
  const [serviceOutletFilter, setServiceOutletFilter] = useState<string>("all");

  const { outlets } = useOutlet();
  const { data: serviceTypes = [] } = useQuery({
    queryKey: ["serviceTypes"],
    queryFn: getServiceTypes,
  });

  const { data: firestorePlans = [], isLoading: plansLoading } =
    useMembershipPlans();
  const { data: firestoreServices = [], isLoading: servicesLoading } =
    useServices();
  const { data: discountRules = [], isLoading: discountsLoading } =
    useDiscountRules();
  const addPlanMutation = useAddMembershipPlan();
  const updatePlanMutation = useUpdateMembershipPlan();
  const deletePlanMutation = useDeleteMembershipPlan();
  const addServiceMutation = useAddService();
  const updateServiceMutation = useUpdateService();
  const deleteServiceMutation = useDeleteService();
  const saveDiscountsMutation = useSaveDiscountRules();
  const { data: companySettings = {} } = useCompanySettings();
  const instructorOptions: string[] = (() => {
    try {
      const raw = (companySettings as any)?.setup_instructors;
      if (!raw) return [];
      const arr = typeof raw === "string" ? JSON.parse(raw) : raw;
      return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
    } catch {
      return [];
    }
  })();
  const { data: planDurations = [], isLoading: durationsLoading } =
    usePlanDurations();
  const addDurationMutation = useAddPlanDuration();
  const updateDurationMutation = useUpdatePlanDuration();
  const deleteDurationMutation = useDeletePlanDuration();

  const plans =
    firestorePlans.length > 0 ? firestorePlans : (fallbackPlans as any);
  const services =
    firestoreServices.length > 0 ? firestoreServices : fallbackServices;

  // Editable discount rules state
  const defaultDiscounts = [
    { years: 1, discount: 0 },
    { years: 2, discount: 5 },
    { years: 3, discount: 10 },
    { years: 5, discount: 15 },
    { years: 7, discount: 20 },
  ];
  const [editableDiscounts, setEditableDiscounts] = useState(defaultDiscounts);
  const [discountsEdited, setDiscountsEdited] = useState(false);

  useEffect(() => {
    if (discountRules && discountRules.length > 0) {
      setEditableDiscounts(discountRules);
    }
  }, [discountRules]);

  const handleCreatePlan = async () => {
    if (!newPlan.name.trim()) {
      toast.error("Plan name is required");
      return;
    }
    const cleanPrices = newPlan.prices
      .filter((p) => p.durationId)
      .map((p) => ({ durationId: p.durationId, price: Number(p.price) || 0 }));
    if (cleanPrices.length === 0) {
      toast.error("Add at least one price tier");
      return;
    }
    const seen = new Set<string>();
    for (const p of cleanPrices) {
      if (seen.has(p.durationId)) {
        toast.error("Each duration can only have one price");
        return;
      }
      seen.add(p.durationId);
    }

    try {
      const planPayload = {
        name: newPlan.name,
        tier: newPlan.tier,
        durationMonths: Number(newPlan.durationMonths) || 1,
        includedServices: newPlan.includedServices,
        autoRenew: newPlan.autoRenew,
        autoDiscount: newPlan.autoDiscount,
        prices: cleanPrices,
      };

      if (editPlanId) {
        await updatePlanMutation.mutateAsync({
          id: editPlanId,
          data: planPayload,
        });
        await logAudit({
          module: "Plans & Services",
          entityType: "plan",
          action: "update",
          entityId: editPlanId,
          outletId: null,
          newValue: planPayload,
        });
        toast.success("Plan updated!");
      } else {
        const addedPlanId = await addPlanMutation.mutateAsync(planPayload);
        await logAudit({
          module: "Plans & Services",
          entityType: "plan",
          action: "create",
          entityId:
            typeof addedPlanId === "string" ? addedPlanId : newPlan.name,
          outletId: null,
          newValue: planPayload,
        });
        toast.success("Plan created!");
      }
      setPlanDialogOpen(false);
      setEditPlanId(null);
      setNewPlan(emptyPlan);
      setIncludeInput("");
    } catch {
      toast.error("Failed to save plan");
    }
  };

  const openEditPlan = (plan: any) => {
    setEditPlanId(plan.id);
    setNewPlan({
      name: plan.name || plan.tier,
      tier: plan.tier || "Basic",
      durationMonths: String(plan.durationMonths || plan.durationInMonths || 1),
      includedServices: Array.isArray(plan.includedServices)
        ? plan.includedServices
        : plan.includes
          ? String(plan.includes)
              .split(/[+,]/)
              .map((s: string) => s.trim())
              .filter(Boolean)
          : [],
      autoRenew: !!plan.autoRenew,
      autoDiscount: !!plan.autoDiscount,
      prices:
        Array.isArray(plan.prices) && plan.prices.length > 0
          ? plan.prices.map((p: any) => ({
              durationId: p.durationId,
              price: String(p.price),
            }))
          : [],
    });
    setIncludeInput("");
    setPlanDialogOpen(true);
  };

  const addPriceTier = () => {
    const used = new Set(newPlan.prices.map((p) => p.durationId));
    const next = planDurations.find((d) => d.active && !used.has(d.id));
    setNewPlan((p) => ({
      ...p,
      prices: [...p.prices, { durationId: next?.id || "", price: "" }],
    }));
  };

  const updatePriceTier = (
    idx: number,
    patch: Partial<{ durationId: string; price: string }>,
  ) => {
    setNewPlan((p) => ({
      ...p,
      prices: p.prices.map((row, i) =>
        i === idx ? { ...row, ...patch } : row,
      ),
    }));
  };

  const removePriceTier = (idx: number) => {
    setNewPlan((p) => ({ ...p, prices: p.prices.filter((_, i) => i !== idx) }));
  };

  const addIncludedService = () => {
    const v = includeInput.trim();
    if (!v) return;
    if (newPlan.includedServices.includes(v)) {
      setIncludeInput("");
      return;
    }
    setNewPlan((p) => ({ ...p, includedServices: [...p.includedServices, v] }));
    setIncludeInput("");
  };

  const removeIncludedService = (val: string) => {
    setNewPlan((p) => ({
      ...p,
      includedServices: p.includedServices.filter((s) => s !== val),
    }));
  };

  // Plan-duration handlers
  const openAddDuration = () => {
    setEditDurationId(null);
    setDurationDraft({ months: "", name: "" });
    setDurationDialogOpen(true);
  };

  const openEditDuration = (d: any) => {
    setEditDurationId(d.id);
    setDurationDraft({ months: String(d.months), name: d.name });
    setDurationDialogOpen(true);
  };

  const handleSaveDuration = async () => {
    const months = Number(durationDraft.months);
    const name = durationDraft.name.trim();
    if (!months || months <= 0) return toast.error("Enter months (>0)");
    if (!name) return toast.error("Enter a name");
    try {
      if (editDurationId) {
        await updateDurationMutation.mutateAsync({
          id: editDurationId,
          data: { months, name },
        });
        toast.success("Duration updated");
      } else {
        await addDurationMutation.mutateAsync({
          months,
          name,
          sortOrder: months,
        });
        toast.success("Duration added");
      }
      setDurationDialogOpen(false);
    } catch {
      toast.error("Failed to save duration");
    }
  };

  const handleDeleteDuration = async (id: string) => {
    try {
      await deleteDurationMutation.mutateAsync(id);
      toast.success("Duration removed");
    } catch {
      toast.error("Cannot delete — duration is referenced by plans");
    }
  };

  const handleDeletePlan = async (id: string) => {
    try {
      const planToDelete = plans.find((p) => p.id === id);
      await deletePlanMutation.mutateAsync(id);

      await logAudit({
        module: "plans & services",
        entityType: "plan",
        action: "delete",
        entityId: id,
        outletId: "No Outlet",
        newValue: { name: planToDelete?.name || id, tier: planToDelete?.tier },
      });

      toast.success("Plan deleted");
    } catch {
      toast.error("Failed to delete");
    }
  };

  const handleToggleAutoRenew = async (id: string, current: boolean) => {
    try {
      await updatePlanMutation.mutateAsync({
        id,
        data: { autoRenew: !current },
      });

      await logAudit({
        module: "plans & services",
        entityType: "plan",
        action: "update",
        entityId: id,
        outletId: "No Outlet",
        newValue: { autoRenew: !current },
      });

      toast.success("Auto-renew updated");
    } catch {
      toast.error("Failed");
    }
  };

  const emptyService = {
    name: "",
    outletId: "",
    type: "",
    duration: "",
    price: "",
    instructor: "",
    requiresInstructor: false,
  };

  const handleCreateService = async () => {
    if (!newService.name.trim()) {
      toast.error("Service name required");
      return;
    }
    if (!newService.outletId) {
      toast.error("Select the outlet this service belongs to");
      return;
    }
    if (!newService.type) {
      toast.error("Select service type");
      return;
    }
    try {
      const payload = {
        name: newService.name,
        type: newService.type,
        outletId: newService.outletId,
        duration: Number(newService.duration) || 60,
        price: Number(newService.price) || 0,
        instructor: newService.requiresInstructor ? newService.instructor : "",
        requiresInstructor: newService.requiresInstructor,
      };

      if (editServiceId) {
        await updateServiceMutation.mutateAsync({
          id: editServiceId,
          data: payload,
        });

        await logAudit({
          module: "Plans & Services",
          entityType: "service",
          action: "update",
          entityId: editServiceId,
          outletId: newService.outletId || null,
          newValue: payload,
        });

        toast.success("Service updated!");
      } else {
        const addedServiceId = await addServiceMutation.mutateAsync({
          ...payload,
          isActive: true,
        });

        await logAudit({
          module: "Plans & Services",
          entityType: "service",
          action: "create",
          entityId:
            typeof addedServiceId === "string"
              ? addedServiceId
              : newService.name,
          outletId: newService.outletId || null,
          newValue: { ...payload, isActive: true },
        });

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
      name: svc.name,
      outletId: svc.outletId || "",
      type: svc.type || "",
      duration: String(svc.duration),
      price: String(svc.price),
      instructor: svc.instructor || "",
      requiresInstructor: svc.requiresInstructor === true,
    });
    setServiceDialogOpen(true);
  };

  const handleDeleteService = async (id: string) => {
    try {
      const serviceToDelete = services.find((s: any) => s.id === id);
      await deleteServiceMutation.mutateAsync(id);

      await logAudit({
        module: "plans & services",
        entityType: "service",
        action: "delete",
        entityId: id,
        outletId: "No Outlet",
        newValue: {
          name: serviceToDelete?.name || id,
          type: serviceToDelete?.type,
        },
      });

      toast.success("Service deleted");
    } catch {
      toast.error("Failed");
    }
  };

  const updateDiscount = (
    index: number,
    field: "years" | "discount",
    value: string,
  ) => {
    const updated = [...editableDiscounts];
    updated[index] = { ...updated[index], [field]: Number(value) || 0 };
    setEditableDiscounts(updated);
    setDiscountsEdited(true);
  };

  const addDiscountRule = () => {
    setEditableDiscounts([
      ...editableDiscounts,
      { years: editableDiscounts.length + 1, discount: 0 },
    ]);
    setDiscountsEdited(true);
  };

  const removeDiscountRule = (index: number) => {
    setEditableDiscounts(editableDiscounts.filter((_, i) => i !== index));
    setDiscountsEdited(true);
  };

  const handleSaveDiscounts = async () => {
    try {
      await saveDiscountsMutation.mutateAsync(editableDiscounts);

      await logAudit({
        module: "plans & services",
        entityType: "discount_rules",
        action: "update",
        entityId: "global_loyalty_matrix",
        outletId: "No Outlet",
        newValue: { rules: editableDiscounts },
      });

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
          <p className="text-muted-foreground text-sm">
            Configure membership tiers, services, and auto-discount rules
          </p>
        </div>
      </div>

      <Tabs defaultValue="plans" className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="plans">Membership Plans</TabsTrigger>
          <TabsTrigger value="durations">Plan Durations</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="discounts">Auto-Discounts</TabsTrigger>
        </TabsList>

        {/* ─── Plans ─── */}
        <TabsContent value="plans">
          <div className="flex justify-end mb-4">
            <Dialog
              open={planDialogOpen}
              onOpenChange={(o) => {
                setPlanDialogOpen(o);
                if (!o) {
                  setEditPlanId(null);
                  setNewPlan(emptyPlan);
                  setIncludeInput("");
                }
              }}
            >
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Plan
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="font-display">
                    {editPlanId ? "Edit" : "Add"} Membership Plan
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Plan Name *</Label>
                      <Input
                        placeholder="e.g. Silver Annual"
                        value={newPlan.name}
                        onChange={(e) =>
                          setNewPlan((p) => ({ ...p, name: e.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Tier *</Label>
                      <Select
                        value={newPlan.tier}
                        onValueChange={(v) =>
                          setNewPlan((p) => ({ ...p, tier: v }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[
                            "Basic",
                            "Silver",
                            "Gold",
                            "Platinum",
                            "Diamond",
                          ].map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Base Duration (months) *</Label>
                    <Input
                      type="number"
                      min={1}
                      placeholder="1"
                      value={newPlan.durationMonths}
                      onChange={(e) =>
                        setNewPlan((p) => ({
                          ...p,
                          durationMonths: e.target.value,
                        }))
                      }
                    />
                    <p className="text-[11px] text-muted-foreground">
                      {Number(newPlan.durationMonths) > 0
                        ? formatMonths(Number(newPlan.durationMonths))
                        : "Enter total months — auto-converts to years after 12."}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Price Tiers *</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addPriceTier}
                        disabled={
                          newPlan.prices.length >=
                          planDurations.filter((d) => d.active).length
                        }
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add Tier
                      </Button>
                    </div>
                    {planDurations.length === 0 && (
                      <p className="text-xs text-destructive">
                        No plan durations configured. Add some in the Plan
                        Durations tab.
                      </p>
                    )}
                    <div className="space-y-2">
                      {newPlan.prices.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2">
                          No tiers yet — click "Add Tier" to attach a duration +
                          price.
                        </p>
                      ) : (
                        newPlan.prices.map((row, idx) => {
                          const usedIds = new Set(
                            newPlan.prices
                              .filter((_, i) => i !== idx)
                              .map((p) => p.durationId),
                          );
                          return (
                            <div
                              key={idx}
                              className="grid grid-cols-[1fr_140px_auto] gap-2 items-end"
                            >
                              <div>
                                <Label className="text-[11px] text-muted-foreground">
                                  Duration
                                </Label>
                                <Select
                                  value={row.durationId}
                                  onValueChange={(v) =>
                                    updatePriceTier(idx, { durationId: v })
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select duration" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {planDurations
                                      .filter((d) => d.active)
                                      .map((d) => (
                                        <SelectItem
                                          key={d.id}
                                          value={d.id}
                                          disabled={usedIds.has(d.id)}
                                        >
                                          {d.name} · {formatMonths(d.months)}
                                        </SelectItem>
                                      ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label className="text-[11px] text-muted-foreground">
                                  Price (NPR)
                                </Label>
                                <Input
                                  type="number"
                                  placeholder="0"
                                  value={row.price}
                                  onChange={(e) =>
                                    updatePriceTier(idx, {
                                      price: e.target.value,
                                    })
                                  }
                                />
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="text-destructive"
                                onClick={() => removePriceTier(idx)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Included Services</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Type and press Enter (e.g. Gym)"
                        value={includeInput}
                        onChange={(e) => setIncludeInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addIncludedService();
                          } else if (
                            e.key === "Backspace" &&
                            !includeInput &&
                            newPlan.includedServices.length > 0
                          ) {
                            removeIncludedService(
                              newPlan.includedServices[
                                newPlan.includedServices.length - 1
                              ],
                            );
                          }
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={addIncludedService}
                      >
                        Add
                      </Button>
                    </div>
                    {newPlan.includedServices.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {newPlan.includedServices.map((s) => (
                          <Badge key={s} variant="secondary" className="gap-1">
                            {s}
                            <button
                              type="button"
                              onClick={() => removeIncludedService(s)}
                              className="hover:text-destructive"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-lg border border-border bg-muted/30 p-3 flex items-center justify-between">
                      <div>
                        <Label className="text-sm">Auto-Renew</Label>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Renew at end of term automatically.
                        </p>
                      </div>
                      <Switch
                        checked={newPlan.autoRenew}
                        onCheckedChange={(v) =>
                          setNewPlan((p) => ({ ...p, autoRenew: v }))
                        }
                      />
                    </div>
                    <div className="rounded-lg border border-border bg-muted/30 p-3 flex items-center justify-between">
                      <div>
                        <Label className="text-sm">Auto-Discount</Label>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Apply loyalty discount rules.
                        </p>
                      </div>
                      <Switch
                        checked={newPlan.autoDiscount}
                        onCheckedChange={(v) =>
                          setNewPlan((p) => ({ ...p, autoDiscount: v }))
                        }
                      />
                    </div>
                  </div>

                  <Button
                    onClick={handleCreatePlan}
                    disabled={
                      addPlanMutation.isPending || updatePlanMutation.isPending
                    }
                    className="w-full gradient-gold text-primary-foreground"
                  >
                    {addPlanMutation.isPending || updatePlanMutation.isPending
                      ? "Saving..."
                      : editPlanId
                        ? "Update Plan"
                        : "Create Plan"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          {plansLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-64 rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {plans.map((plan: any) => {
                const priceList = Array.isArray(plan.prices) ? plan.prices : [];
                const headline = priceList[0]?.price ?? plan.price ?? 0;
                return (
                  <div
                    key={plan.id}
                    className="glass-card rounded-xl p-5 space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TierBadge tier={plan.tier as any} className="" />
                        {plan.autoDiscount && (
                          <Badge variant="outline" className="text-[10px]">
                            <Percent className="h-2.5 w-2.5 mr-0.5" /> Auto
                          </Badge>
                        )}
                      </div>
                      {plan.tier === "Basic" ? (
                        <Crown className="h-4 w-4 text-primary/60" />
                      ) : plan.tier === "Premium" ? (
                        <ShieldCheck className="h-6 w-6 text-primary/60" />
                      ) : plan.tier === "Gold" ? (
                        <Diamond className="h-6 w-6 text-primary/60" />
                      ) : plan.tier === "Diamond" ? (
                        <Gem className="h-6 w-6 text-primary/60" />
                      ) : (
                        <Swords className="h-6 w-6 text-primary/60" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium truncate">
                        {plan.name || plan.tier}
                      </p>
                      <p className="text-2xl font-bold font-display">
                        {formatNPR(headline)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {priceList[0]?.name ||
                          formatMonths(
                            plan.durationMonths || plan.durationInMonths || 1,
                          )}
                      </p>
                    </div>
                    {priceList.length > 0 && (
                      <div className="space-y-1.5 text-sm">
                        {priceList.map((p: any) => (
                          <div
                            key={p.durationId}
                            className="flex justify-between"
                          >
                            <span className="text-muted-foreground text-xs">
                              {p.name || formatMonths(p.months || 0)}
                            </span>
                            <span className="font-medium text-xs">
                              {formatNPR(p.price)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Includes</p>
                      <div className="flex flex-wrap gap-1">
                        {(plan.includedServices &&
                        plan.includedServices.length > 0
                          ? plan.includedServices
                          : plan.includes
                            ? String(plan.includes)
                                .split(/[+,]/)
                                .map((s: string) => s.trim())
                                .filter(Boolean)
                            : []
                        ).map((s: string) => (
                          <Badge
                            key={s}
                            variant="secondary"
                            className="text-[10px]"
                          >
                            {s}
                          </Badge>
                        ))}
                        {(!plan.includedServices ||
                          plan.includedServices.length === 0) &&
                          !plan.includes && (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        Auto-Renew
                      </span>
                      <Switch
                        checked={plan.autoRenew || false}
                        onCheckedChange={() =>
                          handleToggleAutoRenew(
                            plan.id,
                            plan.autoRenew || false,
                          )
                        }
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => openEditPlan(plan)}
                      >
                        <Edit className="h-3.5 w-3.5 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 text-destructive hover:bg-destructive/10"
                        onClick={() => handleDeletePlan(plan.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ─── Plan Durations ─── */}
        <TabsContent value="durations">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Reusable duration presets. These power every plan & booking
                duration dropdown.
              </p>
            </div>
            <Button size="sm" onClick={openAddDuration}>
              <Plus className="h-4 w-4 mr-1" />
              Add Duration
            </Button>
          </div>
          {durationsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="glass-card rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-32">Months</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="w-32 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {planDurations.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={3}
                        className="text-center text-sm text-muted-foreground py-8"
                      >
                        No durations yet. Add one to start.
                      </TableCell>
                    </TableRow>
                  ) : (
                    planDurations.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="font-medium">
                          {d.months}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span>{d.name}</span>
                            <span className="text-[11px] text-muted-foreground">
                              {formatMonths(d.months)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => openEditDuration(d)}
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:bg-destructive/10"
                              onClick={() => handleDeleteDuration(d.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          <Dialog
            open={durationDialogOpen}
            onOpenChange={setDurationDialogOpen}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display">
                  {editDurationId ? "Edit" : "Add"} Duration
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Months *</Label>
                  <Input
                    type="number"
                    min={1}
                    value={durationDraft.months}
                    onChange={(e) =>
                      setDurationDraft((d) => ({
                        ...d,
                        months: e.target.value,
                      }))
                    }
                    placeholder="12"
                  />
                  {Number(durationDraft.months) > 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      {formatMonths(Number(durationDraft.months))}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input
                    value={durationDraft.name}
                    onChange={(e) =>
                      setDurationDraft((d) => ({ ...d, name: e.target.value }))
                    }
                    placeholder="Yearly"
                  />
                </div>
                <Button
                  onClick={handleSaveDuration}
                  className="w-full gradient-gold text-primary-foreground"
                  disabled={
                    addDurationMutation.isPending ||
                    updateDurationMutation.isPending
                  }
                >
                  {addDurationMutation.isPending ||
                  updateDurationMutation.isPending
                    ? "Saving..."
                    : editDurationId
                      ? "Update Duration"
                      : "Create Duration"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ─── Services ─── */}
        <TabsContent value="services">
          <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <Label className="text-xs text-muted-foreground">Outlet</Label>
              <Select
                value={serviceOutletFilter}
                onValueChange={setServiceOutletFilter}
              >
                <SelectTrigger className="w-[220px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All outlets</SelectItem>
                  {outlets.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Dialog
              open={serviceDialogOpen}
              onOpenChange={(o) => {
                setServiceDialogOpen(o);
                if (!o) {
                  setEditServiceId(null);
                  setNewService(emptyService);
                }
              }}
            >
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Service
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="font-display">
                    {editServiceId ? "Edit" : "Add"} Service
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Outlet *</Label>
                    <Select
                      value={newService.outletId}
                      onValueChange={(v) =>
                        setNewService((s) => ({ ...s, outletId: v, type: "" }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select outlet" />
                      </SelectTrigger>
                      <SelectContent>
                        {outlets.map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Service Name *</Label>
                    <Input
                      placeholder="e.g. Power Yoga"
                      value={newService.name}
                      onChange={(e) =>
                        setNewService((s) => ({ ...s, name: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>
                      Service Type *{" "}
                      <span className="text-xs text-muted-foreground">
                        (inherited from outlet)
                      </span>
                    </Label>
                    <Select
                      value={newService.type}
                      onValueChange={(v) =>
                        setNewService((s) => ({ ...s, type: v }))
                      }
                      disabled={!newService.outletId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {(() => {
                          const o = outlets.find(
                            (o) => o.id === newService.outletId,
                          );
                          const slugs = o?.serviceTypes || [];
                          const items = serviceTypes.filter((st) =>
                            slugs.includes(st.slug),
                          );
                          return items.length > 0
                            ? items.map((st) => (
                                <SelectItem key={st.slug} value={st.name}>
                                  {st.name}
                                </SelectItem>
                              ))
                            : slugs.map((sl) => (
                                <SelectItem key={sl} value={sl}>
                                  {sl}
                                </SelectItem>
                              ));
                        })()}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Duration (min)</Label>
                      <Input
                        type="number"
                        placeholder="60"
                        value={newService.duration}
                        onChange={(e) =>
                          setNewService((s) => ({
                            ...s,
                            duration: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Rate (NPR)</Label>
                      <Input
                        type="number"
                        placeholder="500"
                        value={newService.price}
                        onChange={(e) =>
                          setNewService((s) => ({
                            ...s,
                            price: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 p-3 flex items-center justify-between">
                    <div>
                      <Label className="text-sm">Requires Instructor?</Label>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Toggle on if this service needs a dedicated
                        trainer/therapist.
                      </p>
                    </div>
                    <Switch
                      checked={newService.requiresInstructor}
                      onCheckedChange={(v) =>
                        setNewService((s) => ({
                          ...s,
                          requiresInstructor: v,
                          instructor: v ? s.instructor : "",
                        }))
                      }
                    />
                  </div>
                  {newService.requiresInstructor && (
                    <div className="space-y-2">
                      <Label>Default Instructor</Label>
                      <Select
                        value={newService.instructor}
                        onValueChange={(v) =>
                          setNewService((s) => ({ ...s, instructor: v }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              instructorOptions.length === 0
                                ? "Add instructors in General Setup first"
                                : "Select instructor"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {instructorOptions.map((name) => (
                            <SelectItem key={name} value={name}>
                              {name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <Button
                    onClick={handleCreateService}
                    disabled={
                      addServiceMutation.isPending ||
                      updateServiceMutation.isPending
                    }
                    className="w-full gradient-gold text-primary-foreground"
                  >
                    {addServiceMutation.isPending ||
                    updateServiceMutation.isPending
                      ? "Saving..."
                      : editServiceId
                        ? "Update Service"
                        : "Create Service"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          {servicesLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="glass-card rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Service</TableHead>
                    <TableHead>Outlet</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="hidden md:table-cell">
                      Duration
                    </TableHead>
                    <TableHead className="hidden md:table-cell">
                      Instructor
                    </TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {services
                    .filter(
                      (s: any) =>
                        serviceOutletFilter === "all" ||
                        s.outletId === serviceOutletFilter,
                    )
                    .map((s: any) => {
                      const o = outlets.find((o) => o.id === s.outletId);
                      return (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium text-sm">
                            {s.name}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {o?.name || (
                              <span className="italic text-destructive/70">
                                unassigned
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-[10px]">
                              {s.type}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                            {s.duration} min
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                            {s.instructor || "—"}
                          </TableCell>
                          <TableCell className="text-right font-medium text-sm">
                            {formatNPR(s.price)}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => openEditService(s)}
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                onClick={() => handleDeleteService(s.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
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
                <h3 className="font-semibold font-display">
                  Loyalty Auto-Discount Rules
                </h3>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={addDiscountRule}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Rule
                </Button>
                {discountsEdited && (
                  <Button
                    size="sm"
                    onClick={handleSaveDiscounts}
                    disabled={saveDiscountsMutation.isPending}
                    className="gradient-gold text-primary-foreground"
                  >
                    <Save className="h-4 w-4 mr-1" />
                    {saveDiscountsMutation.isPending
                      ? "Saving..."
                      : "Save Rules"}
                  </Button>
                )}
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              Discounts are automatically applied based on continuous membership
              years. Edit values below and save.
            </p>
            {discountsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 rounded-lg" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {editableDiscounts.map((rule, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-4 rounded-lg border border-border/50 p-4"
                  >
                    <div className="flex-1 grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">
                          Min. Years
                        </Label>
                        <Input
                          type="number"
                          value={rule.years}
                          onChange={(e) =>
                            updateDiscount(index, "years", e.target.value)
                          }
                          className="h-9 bg-muted/50 border-0"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">
                          Discount %
                        </Label>
                        <Input
                          type="number"
                          value={rule.discount}
                          onChange={(e) =>
                            updateDiscount(index, "discount", e.target.value)
                          }
                          className="h-9 bg-muted/50 border-0"
                        />
                      </div>
                    </div>
                    <Badge
                      variant={rule.discount > 0 ? "default" : "secondary"}
                      className="text-sm min-w-[50px] justify-center"
                    >
                      {rule.discount}%
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => removeDiscountRule(index)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
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
