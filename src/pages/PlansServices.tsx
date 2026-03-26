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
import { TierBadge } from "@/components/TierBadge";
import { formatNPR } from "@/lib/mock-data";
import { toast } from "sonner";

const plans = [
  { id: 1, tier: "Basic" as const, monthly: 3000, yearly: 30000, longTerm: 350000, includes: "Gym Only", autoRenew: true },
  { id: 2, tier: "Silver" as const, monthly: 5000, yearly: 50000, longTerm: 550000, includes: "Gym + Swimming", autoRenew: true },
  { id: 3, tier: "Gold" as const, monthly: 8000, yearly: 80000, longTerm: 850000, includes: "Gym + Spa + Sauna", autoRenew: false },
  { id: 4, tier: "Platinum" as const, monthly: 12000, yearly: 120000, longTerm: 1200000, includes: "Full Access + Personal Trainer", autoRenew: false },
];

const services = [
  { id: 1, name: "Morning Power Yoga", type: "Gym", duration: "60 min", price: 500, capacity: 20, instructor: "Trainer Ravi" },
  { id: 2, name: "HIIT Blast", type: "Gym", duration: "45 min", price: 600, capacity: 15, instructor: "Trainer Ravi" },
  { id: 3, name: "CrossFit WOD", type: "Gym", duration: "60 min", price: 700, capacity: 12, instructor: "Trainer Prakash" },
  { id: 4, name: "Deep Tissue Massage", type: "Spa", duration: "90 min", price: 2500, capacity: 1, instructor: "Therapist Maya" },
  { id: 5, name: "Aromatherapy", type: "Spa", duration: "60 min", price: 2000, capacity: 1, instructor: "Therapist Sunita" },
  { id: 6, name: "Hot Stone Therapy", type: "Spa", duration: "75 min", price: 3000, capacity: 1, instructor: "Therapist Maya" },
  { id: 7, name: "Sauna Session", type: "Sauna", duration: "30 min", price: 500, capacity: 8, instructor: "Staff Binita" },
  { id: 8, name: "Infrared Sauna", type: "Sauna", duration: "45 min", price: 800, capacity: 4, instructor: "Staff Binita" },
  { id: 9, name: "Lap Swimming", type: "Swimming", duration: "60 min", price: 400, capacity: 6, instructor: "Coach Anil" },
  { id: 10, name: "Aqua Fitness", type: "Swimming", duration: "45 min", price: 600, capacity: 10, instructor: "Coach Anil" },
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
              <div className="space-y-2"><Label>Tier Name</Label><Input placeholder="e.g. Diamond" /></div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2"><Label>Monthly (NPR)</Label><Input type="number" placeholder="0" /></div>
                <div className="space-y-2"><Label>Yearly (NPR)</Label><Input type="number" placeholder="0" /></div>
                <div className="space-y-2"><Label>15-Year (NPR)</Label><Input type="number" placeholder="0" /></div>
              </div>
              <div className="space-y-2"><Label>Included Services</Label><Input placeholder="e.g. Gym + Spa + Sauna" /></div>
              <Button onClick={() => { toast.success("Plan created (connect backend to persist)"); setPlanDialogOpen(false); }} className="w-full gradient-gold text-primary-foreground">Create Plan</Button>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {plans.map((plan) => (
              <div key={plan.id} className="glass-card rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <TierBadge tier={plan.tier} />
                  <Crown className="h-4 w-4 text-primary/60" />
                </div>
                <div>
                  <p className="text-2xl font-bold font-display">{formatNPR(plan.monthly)}</p>
                  <p className="text-xs text-muted-foreground">per month</p>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Yearly</span><span className="font-medium">{formatNPR(plan.yearly)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">15-Year</span><span className="font-medium">{formatNPR(plan.longTerm)}</span></div>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Includes</span>
                  <span className="font-medium text-right text-xs">{plan.includes}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Auto-Renew</span>
                  <Switch checked={plan.autoRenew} onCheckedChange={() => toast.info("Toggle saved (connect backend)")} />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => toast.info("Edit plan (connect backend)")}>
                    <Edit className="h-3.5 w-3.5 mr-1" />Edit
                  </Button>
                  <Button variant="outline" size="icon" className="h-9 w-9 text-destructive hover:bg-destructive/10" onClick={() => toast.error("Delete plan (connect backend)")}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="services">
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium text-sm">{s.name}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-[10px]">{s.type}</Badge></TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{s.duration}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{s.instructor}</TableCell>
                    <TableCell className="hidden lg:table-cell text-sm">{s.capacity}</TableCell>
                    <TableCell className="text-right font-medium text-sm">{formatNPR(s.price)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
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
            <p className="text-[10px] text-muted-foreground mt-4">💡 Connect to backend to customize discount tiers and auto-apply during renewals.</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PlansServices;
