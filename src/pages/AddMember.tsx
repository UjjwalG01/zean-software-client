import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Upload, Loader2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { useAddMember, useCompanySettings, useUpdateMember } from "@/hooks/use-firestore";
import { useOutlet } from "@/contexts/OutletContext";
import { uploadMemberAvatar, generateGRCNumber } from "@/lib/firebase-services";
import type { MemberTier, ServiceType, PaymentMethod } from "@/lib/mock-data";

const STEPS = ["Personal", "Contact", "Membership", "Physical & Medical", "Review"];

function parseList(settings: Record<string, string>, key: string, fallback: string[]): string[] {
  try { return settings[key] ? JSON.parse(settings[key]) : fallback; } catch { return fallback; }
}

const AddMember = () => {
  const navigate = useNavigate();
  const addMember = useAddMember();
  const updateMember = useUpdateMember();
  const { data: settings = {} } = useCompanySettings();
  const { selected: outlet, setPickerOpen } = useOutlet();
  const fileRef = useRef<HTMLInputElement>(null);

  const planDurations = parseList(settings, "setup_planDurations", ["Monthly","Quarterly","Half-Yearly","Yearly","15-Year"]);
  const paymentModes = parseList(settings, "setup_paymentModes", ["Cash","Card","Esewa","Bank Transfer","Mobile Wallet"]);
  const timeSlots = parseList(settings, "setup_timeSlots", ["Morning","Day","Evening"]);
  const packages = parseList(settings, "setup_packages", ["Gym","Cardio","Swimming","Spa","Combo"]);
  const bloodGroups = parseList(settings, "setup_bloodGroups", ["A+","A-","B+","B-","O+","O-","AB+","AB-"]);

  const [step, setStep] = useState(0);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const [f, setF] = useState({
    // personal
    firstName: "", middleName: "", lastName: "",
    dob: "", gender: "", nationality: "Nepali", religion: "",
    maritalStatus: "", residenceStatus: "", nationalId: "", tinNo: "",
    fatherName: "", occupation: "",
    // contact
    email: "", phone: "", contactAlt: "",
    permanentAddress: "", temporaryAddress: "",
    officeName: "", officeAddress: "",
    emergencyName: "", emergencyContactNum: "", doctorName: "", doctorContact: "",
    notifyPhone: true, notifyEmail: true, notifySMS: false,
    // membership
    tier: "Basic" as MemberTier, plan: planDurations[0] || "Monthly",
    timeSlot: timeSlots[0] || "Morning",
    packages: [] as string[],
    paymentMethod: (paymentModes[0] || "Cash") as PaymentMethod,
    autoRenew: false,
    // physical
    height: "", weight: "", chest: "", arms: "", thigh: "",
    waistInch: "", hipInch: "", shoulder: "",
    bloodGroup: "",
    heartStroke: false, breathingDifficulty: "", skinDisease: "",
  });

  const u = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));
  const togglePackage = (p: string) => u("packages", f.packages.includes(p) ? f.packages.filter((x) => x !== p) : [...f.packages, p]);

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Photo must be < 5MB"); return; }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const validateStep = (s: number): boolean => {
    if (s === 0) {
      if (!f.firstName.trim()) { toast.error("First name is required"); return false; }
      if (!f.lastName.trim()) { toast.error("Last name is required"); return false; }
    }
    if (s === 1) {
      if (!f.phone.trim()) { toast.error("Phone is required"); return false; }
      if (!f.email.trim()) { toast.error("Email is required"); return false; }
    }
    return true;
  };

  const next = () => { if (validateStep(step)) setStep(Math.min(step + 1, STEPS.length - 1)); };
  const back = () => setStep(Math.max(step - 1, 0));

  const handleSubmit = async () => {
    if (!outlet) { toast.error("Please select an outlet first"); setPickerOpen(true); return; }
    if (!validateStep(0) || !validateStep(1)) return;
    setSaving(true);
    try {
      const fullName = [f.firstName, f.middleName, f.lastName].filter(Boolean).join(" ");
      const grcNo = await generateGRCNumber(outlet.id, outlet.outletCode || outlet.name.slice(0, 2).toUpperCase());

      // map packages → services type (best effort)
      const services = Array.from(new Set(f.packages.flatMap((p) =>
        p.split(/[+\-]/).map((x) => x.trim()).filter(Boolean)
      ))) as ServiceType[];

      const id = await addMember.mutateAsync({
        ...f,
        name: fullName,
        services,
        address: f.permanentAddress || f.temporaryAddress,
        emergencyContact: f.emergencyContactNum,
        outletId: outlet.id,
        grcNo,
      } as any);

      if (photoFile && id !== "mock-id") {
        try {
          const url = await uploadMemberAvatar(id, photoFile);
          await updateMember.mutateAsync({ id, data: { avatar: url } });
        } catch (e: any) {
          toast.error(`Photo upload failed: ${e.message}`);
        }
      }
      toast.success(`Member ${fullName} registered as ${grcNo}`);
      navigate(`/members/${id}`);
    } catch (e: any) {
      toast.error(e.message || "Failed to register");
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate("/members")} className="text-muted-foreground">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        {outlet && (
          <p className="text-xs text-muted-foreground">
            Outlet: <span className="font-medium text-foreground">{outlet.name}</span>
            {outlet.outletCode && <span className="ml-2 text-primary">[{outlet.outletCode}]</span>}
          </p>
        )}
      </div>

      <div>
        <h1 className="text-2xl font-bold font-display">Member Registration Form</h1>
        <p className="text-muted-foreground text-sm">Step {step + 1} of {STEPS.length} — {STEPS[step]}</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 flex-wrap">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${i < step ? "bg-success text-success-foreground" : i === step ? "gradient-gold text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
              {i < step ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span className={`text-sm hidden md:inline ${i === step ? "font-medium" : "text-muted-foreground"}`}>{s}</span>
            {i < STEPS.length - 1 && <div className="w-6 h-px bg-border" />}
          </div>
        ))}
      </div>

      <div className="glass-card rounded-xl p-6 space-y-6">
        {step === 0 && (
          <>
            {/* Photo */}
            <div className="flex items-center gap-4">
              <Avatar className="h-24 w-24 ring-2 ring-primary/30">
                {photoPreview ? <AvatarImage src={photoPreview} /> : <AvatarFallback><User className="h-8 w-8" /></AvatarFallback>}
              </Avatar>
              <div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  <Upload className="h-4 w-4 mr-1" /> Upload Photo
                </Button>
                <p className="text-xs text-muted-foreground mt-1">JPG/PNG, &lt; 5MB</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2"><Label>First Name *</Label><Input value={f.firstName} onChange={(e) => u("firstName", e.target.value)} /></div>
              <div className="space-y-2"><Label>Middle Name</Label><Input value={f.middleName} onChange={(e) => u("middleName", e.target.value)} /></div>
              <div className="space-y-2"><Label>Last Name *</Label><Input value={f.lastName} onChange={(e) => u("lastName", e.target.value)} /></div>
              <div className="space-y-2"><Label>Date of Birth</Label><Input type="date" value={f.dob} onChange={(e) => u("dob", e.target.value)} /></div>
              <div className="space-y-2"><Label>Gender</Label>
                <Select value={f.gender} onValueChange={(v) => u("gender", v)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Marital Status</Label>
                <Select value={f.maritalStatus} onValueChange={(v) => u("maritalStatus", v)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Single">Single</SelectItem>
                    <SelectItem value="Married">Married</SelectItem>
                    <SelectItem value="Widowed">Widowed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Nationality</Label><Input value={f.nationality} onChange={(e) => u("nationality", e.target.value)} /></div>
              <div className="space-y-2"><Label>Religion</Label><Input value={f.religion} onChange={(e) => u("religion", e.target.value)} /></div>
              <div className="space-y-2"><Label>Residence Status</Label>
                <Select value={f.residenceStatus} onValueChange={(v) => u("residenceStatus", v)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Residence">Residence</SelectItem>
                    <SelectItem value="Non-Residence">Non-Residence</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>National ID No.</Label><Input value={f.nationalId} onChange={(e) => u("nationalId", e.target.value)} /></div>
              <div className="space-y-2"><Label>TIN No.</Label><Input value={f.tinNo} onChange={(e) => u("tinNo", e.target.value)} /></div>
              <div className="space-y-2"><Label>Father's Name</Label><Input value={f.fatherName} onChange={(e) => u("fatherName", e.target.value)} /></div>
              <div className="space-y-2 sm:col-span-2"><Label>Occupation</Label><Input value={f.occupation} onChange={(e) => u("occupation", e.target.value)} /></div>
            </div>
          </>
        )}

        {step === 1 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Email *</Label><Input type="email" value={f.email} onChange={(e) => u("email", e.target.value)} /></div>
            <div className="space-y-2"><Label>Mobile / Phone *</Label><Input value={f.phone} onChange={(e) => u("phone", e.target.value)} /></div>
            <div className="space-y-2"><Label>Alt. Contact</Label><Input value={f.contactAlt} onChange={(e) => u("contactAlt", e.target.value)} /></div>
            <div className="space-y-2"><Label>Office Name</Label><Input value={f.officeName} onChange={(e) => u("officeName", e.target.value)} /></div>
            <div className="space-y-2 sm:col-span-2"><Label>Office Address</Label><Input value={f.officeAddress} onChange={(e) => u("officeAddress", e.target.value)} /></div>
            <div className="space-y-2 sm:col-span-2"><Label>Permanent Address</Label><Textarea rows={2} value={f.permanentAddress} onChange={(e) => u("permanentAddress", e.target.value)} /></div>
            <div className="space-y-2 sm:col-span-2"><Label>Temporary Address</Label><Textarea rows={2} value={f.temporaryAddress} onChange={(e) => u("temporaryAddress", e.target.value)} /></div>

            <div className="sm:col-span-2 border-t border-border pt-4 mt-2">
              <h3 className="font-semibold mb-3">Emergency Contact</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Contact Name</Label><Input value={f.emergencyName} onChange={(e) => u("emergencyName", e.target.value)} /></div>
                <div className="space-y-2"><Label>Telephone</Label><Input value={f.emergencyContactNum} onChange={(e) => u("emergencyContactNum", e.target.value)} /></div>
                <div className="space-y-2"><Label>Doctor's Name</Label><Input value={f.doctorName} onChange={(e) => u("doctorName", e.target.value)} /></div>
                <div className="space-y-2"><Label>Doctor's Contact / Address</Label><Input value={f.doctorContact} onChange={(e) => u("doctorContact", e.target.value)} /></div>
              </div>
            </div>

            <div className="sm:col-span-2 border-t border-border pt-4 mt-2">
              <h3 className="font-semibold mb-3">Notification Preferences</h3>
              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-2"><Checkbox checked={f.notifyPhone} onCheckedChange={(v) => u("notifyPhone", !!v)} /> Phone</label>
                <label className="flex items-center gap-2"><Checkbox checked={f.notifyEmail} onCheckedChange={(v) => u("notifyEmail", !!v)} /> Email</label>
                <label className="flex items-center gap-2"><Checkbox checked={f.notifySMS} onCheckedChange={(v) => u("notifySMS", !!v)} /> SMS</label>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2"><Label>Membership Tier</Label>
                <Select value={f.tier} onValueChange={(v) => u("tier", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Basic","Silver","Gold","Platinum"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Plan Duration</Label>
                <Select value={f.plan} onValueChange={(v) => u("plan", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{planDurations.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Time Slot</Label>
                <Select value={f.timeSlot} onValueChange={(v) => u("timeSlot", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{timeSlots.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="mb-3 block">Available Packages</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {packages.map((p) => (
                  <label key={p} className="flex items-center gap-2 rounded-lg border border-border p-2.5 cursor-pointer hover:bg-muted/30 text-sm">
                    <Checkbox checked={f.packages.includes(p)} onCheckedChange={() => togglePackage(p)} />
                    <span>{p}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Payment Method</Label>
                <Select value={f.paymentMethod} onValueChange={(v) => u("paymentMethod", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{paymentModes.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3 pt-7">
                <Switch checked={f.autoRenew} onCheckedChange={(v) => u("autoRenew", v)} />
                <Label>Auto-Renew Membership</Label>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold mb-3">Physical Details</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="space-y-2"><Label>Weight (kg)</Label><Input value={f.weight} onChange={(e) => u("weight", e.target.value)} /></div>
                <div className="space-y-2"><Label>Height (ft.)</Label><Input value={f.height} onChange={(e) => u("height", e.target.value)} /></div>
                <div className="space-y-2"><Label>Chest (inch)</Label><Input value={f.chest} onChange={(e) => u("chest", e.target.value)} /></div>
                <div className="space-y-2"><Label>Shoulder (inch)</Label><Input value={f.shoulder} onChange={(e) => u("shoulder", e.target.value)} /></div>
                <div className="space-y-2"><Label>Arms (inch)</Label><Input value={f.arms} onChange={(e) => u("arms", e.target.value)} /></div>
                <div className="space-y-2"><Label>Thigh (inch)</Label><Input value={f.thigh} onChange={(e) => u("thigh", e.target.value)} /></div>
                <div className="space-y-2"><Label>Waist (inch)</Label><Input value={f.waistInch} onChange={(e) => u("waistInch", e.target.value)} /></div>
                <div className="space-y-2"><Label>Hip (inch)</Label><Input value={f.hipInch} onChange={(e) => u("hipInch", e.target.value)} /></div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-3">Medical Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Blood Group</Label>
                  <Select value={f.bloodGroup} onValueChange={(v) => u("bloodGroup", v)}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{bloodGroups.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-3 pt-7">
                  <Switch checked={f.heartStroke} onCheckedChange={(v) => u("heartStroke", v)} />
                  <Label>Any Heart Stroke?</Label>
                </div>
                <div className="space-y-2 sm:col-span-2"><Label>Any Breathing Difficulties?</Label><Input value={f.breathingDifficulty} onChange={(e) => u("breathingDifficulty", e.target.value)} /></div>
                <div className="space-y-2 sm:col-span-2"><Label>Any Skin Disease? (If yes, not allowed to use Jacuzzi)</Label><Input value={f.skinDisease} onChange={(e) => u("skinDisease", e.target.value)} /></div>
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3 text-sm">
            <h3 className="font-semibold mb-3">Review</h3>
            <div className="grid grid-cols-2 gap-3 glass-card p-4 rounded-lg bg-muted/30">
              <Row label="Name" value={[f.firstName, f.middleName, f.lastName].filter(Boolean).join(" ")} />
              <Row label="DOB" value={f.dob} />
              <Row label="Gender" value={f.gender} />
              <Row label="Phone" value={f.phone} />
              <Row label="Email" value={f.email} />
              <Row label="Tier / Plan" value={`${f.tier} · ${f.plan}`} />
              <Row label="Time Slot" value={f.timeSlot} />
              <Row label="Packages" value={f.packages.join(", ") || "—"} />
              <Row label="Payment" value={f.paymentMethod} />
              <Row label="Outlet" value={outlet?.name || "—"} />
              <Row label="GRC No." value={`${outlet?.outletCode || "—"}xxxxx (auto)`} />
            </div>
            <p className="text-xs text-muted-foreground">A GRC number will be generated when you submit, prefixed with the outlet code.</p>
          </div>
        )}

        <div className="flex justify-between pt-4 border-t border-border">
          <Button variant="outline" disabled={step === 0} onClick={back}>Previous</Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={next}>Next</Button>
          ) : (
            <Button onClick={handleSubmit} disabled={saving} className="gradient-gold text-primary-foreground">
              {saving ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Saving...</> : "Register Member"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value || "—"}</p>
    </div>
  );
}

export default AddMember;
