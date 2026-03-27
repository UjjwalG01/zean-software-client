import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useAddMember } from "@/hooks/use-firestore";
import type { MemberTier, ServiceType, PaymentMethod } from "@/lib/mock-data";

const steps = ["Personal Info", "Membership", "Payment"];

const AddMember = () => {
  const navigate = useNavigate();
  const addMemberMutation = useAddMember();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name: "", email: "", phone: "", address: "", emergencyContact: "",
    tier: "Basic" as MemberTier, services: [] as ServiceType[], plan: "Monthly",
    paymentMethod: "Cash" as PaymentMethod, autoRenew: false,
  });

  const update = (key: string, value: any) => setForm((prev) => ({ ...prev, [key]: value }));
  const toggleService = (s: ServiceType) => {
    update("services", form.services.includes(s) ? form.services.filter((x) => x !== s) : [...form.services, s]);
  };

  const handleSubmit = async () => {
    try {
      await addMemberMutation.mutateAsync({
        name: form.name,
        email: form.email,
        phone: form.phone,
        address: form.address,
        emergencyContact: form.emergencyContact,
        tier: form.tier,
        services: form.services,
        plan: form.plan,
        autoRenew: form.autoRenew,
      });
      toast.success(`Member "${form.name}" registered successfully!`);
      navigate("/members");
    } catch (err) {
      toast.error("Failed to register member");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
      <Button variant="ghost" size="sm" onClick={() => navigate("/members")} className="text-muted-foreground">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back
      </Button>
      <h1 className="text-2xl font-bold font-display">Add New Member</h1>

      {/* Step Indicator */}
      <div className="flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${i < step ? "bg-success text-success-foreground" : i === step ? "gradient-gold text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
              {i < step ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span className={`text-sm hidden sm:inline ${i === step ? "font-medium" : "text-muted-foreground"}`}>{s}</span>
            {i < steps.length - 1 && <div className="w-8 h-px bg-border" />}
          </div>
        ))}
      </div>

      <div className="glass-card rounded-xl p-6 space-y-5">
        {step === 0 && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Full Name</Label><Input value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Aarav Sharma" /></div>
              <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="aarav@email.com" /></div>
              <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="+977-984XXXXXXX" /></div>
              <div className="space-y-2"><Label>Address</Label><Input value={form.address} onChange={(e) => update("address", e.target.value)} placeholder="Kathmandu, Nepal" /></div>
            </div>
            <div className="space-y-2"><Label>Emergency Contact</Label><Input value={form.emergencyContact} onChange={(e) => update("emergencyContact", e.target.value)} placeholder="+977-984XXXXXXX" /></div>
          </>
        )}

        {step === 1 && (
          <>
            <div className="space-y-2">
              <Label>Membership Tier</Label>
              <Select value={form.tier} onValueChange={(v) => update("tier", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Basic">Basic – NPR 3,000/mo</SelectItem>
                  <SelectItem value="Silver">Silver – NPR 5,000/mo</SelectItem>
                  <SelectItem value="Gold">Gold – NPR 8,000/mo</SelectItem>
                  <SelectItem value="Platinum">Platinum – NPR 15,000/mo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Plan Duration</Label>
              <Select value={form.plan} onValueChange={(v) => update("plan", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Monthly">Monthly</SelectItem>
                  <SelectItem value="Yearly">Yearly</SelectItem>
                  <SelectItem value="15-Year">15-Year Long-Term</SelectItem>
                  <SelectItem value="Pay-per-Use">Pay-per-Use</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3">
              <Label>Services</Label>
              <div className="grid grid-cols-2 gap-3">
                {(["Gym", "Spa", "Sauna", "Swimming"] as ServiceType[]).map((s) => (
                  <label key={s} className="flex items-center gap-2 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/30 transition-colors">
                    <Checkbox checked={form.services.includes(s)} onCheckedChange={() => toggleService(s)} />
                    <span className="text-sm">{s}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.autoRenew} onCheckedChange={(v) => update("autoRenew", v)} />
              <Label>Auto-Renew Membership</Label>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={form.paymentMethod} onValueChange={(v) => update("paymentMethod", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="Card">Card (Stripe)</SelectItem>
                  <SelectItem value="Esewa">Esewa</SelectItem>
                  <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                  <SelectItem value="Mobile Wallet">Mobile Wallet</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="glass-card rounded-lg p-4 bg-muted/30 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Tier</span><span className="font-medium">{form.tier}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Plan</span><span className="font-medium">{form.plan}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Services</span><span className="font-medium">{form.services.join(", ") || "None"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Payment</span><span className="font-medium">{form.paymentMethod}</span></div>
              <div className="border-t border-border pt-2 flex justify-between font-semibold"><span>Auto-Renew</span><span>{form.autoRenew ? "Yes" : "No"}</span></div>
            </div>
          </>
        )}

        <div className="flex justify-between pt-2">
          <Button variant="outline" disabled={step === 0} onClick={() => setStep(step - 1)}>Previous</Button>
          {step < 2 ? (
            <Button onClick={() => setStep(step + 1)}>Next</Button>
          ) : (
            <Button onClick={handleSubmit} disabled={addMemberMutation.isPending} className="gradient-gold text-primary-foreground">
              {addMemberMutation.isPending ? "Registering..." : "Register Member"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddMember;
