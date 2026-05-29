import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Check, Upload, Loader2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { useAddMember, useCompanySettings, useUpdateMember, useMember } from "@/hooks/use-firestore";
import { useOutlet } from "@/contexts/OutletContext";
import { uploadMemberAvatar, generateMemberCode } from "@/lib/firebase-services";
import PackageSelectionModal from "@/components/PackageSelectionModal";

const STEPS = ["Personal", "Contact", "Physical & Medical", "Review"];

const NATIONALITIES = [
  "Nepali",
  "Indian",
  "American",
  "British",
  "Australian",
  "Canadian",
  "Chinese",
  "Japanese",
  "German",
  "French",
  "Italian",
  "Spanish",
  "Russian",
  "Brazilian",
  "Mexican",
  "Other",
];
const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];

function parseList(settings: Record<string, string>, key: string, fallback: string[]): string[] {
  try {
    return settings[key] ? JSON.parse(settings[key]) : fallback;
  } catch {
    return fallback;
  }
}

const AddMember = () => {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const editId = search.get("edit") || undefined;
  const isEdit = !!editId;

  const addMember = useAddMember();
  const updateMember = useUpdateMember();
  const { data: existing } = useMember(editId);
  const { data: settings = {} } = useCompanySettings();
  const { selected: outlet, setPickerOpen } = useOutlet();
  const fileRef = useRef<HTMLInputElement>(null);

  const nationalities = parseList(settings, "setup_nationalities", NATIONALITIES);
  const bloodGroups = parseList(settings, "setup_bloodGroups", BLOOD_GROUPS);
  const preferenceOptions = parseList(settings, "setup_preferences", [
    "Yoga",
    "Cardio",
    "Weight Training",
    "Swimming Laps",
    "Steam Bath",
    "Personal Training",
    "Dance Fitness",
    "Meditation",
    "Boxing",
  ]);

  const [step, setStep] = useState(0);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [memberCode, setMemberCode] = useState<string>("");
  const [pkgModalOpen, setPkgModalOpen] = useState(false);
  const [createdId, setCreatedId] = useState<string>("");
  const [createdName, setCreatedName] = useState<string>("");

  const [f, setF] = useState({
    // Personal
    memberCode: "",
    firstName: "",
    middleName: "",
    lastName: "",
    dob: "",
    gender: "",
    nationality: "Nepali",
    religion: "",
    occupation: "",
    permanentAddress: "",
    temporaryAddress: "",
    // Contact
    email: "",
    phone: "",
    contactAlt: "",
    officeName: "",
    officeAddress: "",
    emergencyName: "",
    emergencyPhone: "",
    emergencyAddress: "",
    // Physical & Medical
    height: "",
    weight: "",
    chest: "",
    bloodGroup: "",
    heartStroke: false,
    breathingDifficulty: false,
    skinDisease: false,
    preferences: [] as string[],
  });

  const u = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));
  const togglePref = (p: string) =>
    u("preferences", f.preferences.includes(p) ? f.preferences.filter((x) => x !== p) : [...f.preferences, p]);

  // Hydrate for edit mode
  useEffect(() => {
    if (!existing) return;
    const m: any = existing;
    setF((p) => ({
      ...p,
      memberCode: m.memberCode || m.grcNo || "",
      firstName: m.firstName || (m.name ? m.name.split(" ")[0] : ""),
      middleName: m.middleName || "",
      lastName: m.lastName || (m.name ? m.name.split(" ").slice(1).join(" ") : ""),
      dob: m.dob || "",
      gender: m.gender || "",
      nationality: m.nationality || "Nepali",
      religion: m.religion || "",
      occupation: m.occupation || "",
      permanentAddress: m.permanentAddress || m.address || "",
      temporaryAddress: m.temporaryAddress || "",
      email: m.email || "",
      phone: m.phone || "",
      contactAlt: m.contactAlt || "",
      officeName: m.officeName || "",
      officeAddress: m.officeAddress || "",
      emergencyName: m.emergencyName || "",
      emergencyPhone: m.emergencyContactNum || m.emergencyContact || "",
      emergencyAddress: m.emergencyAddress || "",
      height: m.height || "",
      weight: m.weight || "",
      chest: m.chest || "",
      bloodGroup: m.bloodGroup || "",
      heartStroke: !!m.heartStroke,
      breathingDifficulty:
        typeof m.breathingDifficulty === "boolean"
          ? m.breathingDifficulty
          : !!String(m.breathingDifficulty || "").trim(),
      skinDisease: typeof m.skinDisease === "boolean" ? m.skinDisease : !!String(m.skinDisease || "").trim(),
      preferences: Array.isArray(m.preferences) ? m.preferences : [],
    }));
    if (m.avatar && !String(m.avatar).includes("dicebear")) setPhotoPreview(m.avatar);
    setMemberCode(m.memberCode || m.grcNo || "");
  }, [existing]);

  // Generate the member code once on create
  useEffect(() => {
    if (!isEdit && !memberCode) {
      generateMemberCode()
        .then((c) => setMemberCode(c))
        .catch(() => setMemberCode(""));
    }
  }, [isEdit, memberCode]);

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Photo must be < 5MB");
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const validateStep = (s: number): boolean => {
    if (s === 0) {
      if (!f.firstName.trim()) {
        toast.error("First name is required");
        return false;
      }
      if (!f.lastName.trim()) {
        toast.error("Last name is required");
        return false;
      }
    }
    if (s === 1 && !f.phone.trim()) {
      toast.error("Phone is required");
      return false;
    }
    return true;
  };

  const next = () => {
    if (validateStep(step)) setStep(Math.min(step + 1, STEPS.length - 1));
  };
  const back = () => setStep(Math.max(step - 1, 0));

  const handleSubmit = async () => {
    if (!validateStep(0) || !validateStep(1)) return;
    setSaving(true);
    try {
      const fullName = [f.firstName, f.middleName, f.lastName].filter(Boolean).join(" ");
      const payload: any = {
        ...f,
        name: fullName,
        // legacy compat
        address: f.permanentAddress || f.temporaryAddress,
        emergencyContact: f.emergencyPhone,
        emergencyContactNum: f.emergencyPhone,
        emergencyAddress: f.emergencyAddress,
        // Members are NOT bound to a specific outlet — they're visible from any outlet.
        outletId: null,
        grcNo: memberCode, // legacy field (existing schema)
        memberCode: memberCode, // new field (schema.sql)
      };

      let id: string;
      if (isEdit && editId) {
        await updateMember.mutateAsync({ id: editId, data: payload });
        id = editId;
      } else {
        id = await addMember.mutateAsync(payload);
      }

      if (photoFile && id && id !== "mock-id") {
        try {
          const url = await uploadMemberAvatar(id, photoFile);
          await updateMember.mutateAsync({ id, data: { avatar: url } });
        } catch (e: any) {
          toast.error(`Photo upload failed: ${e.message}`);
        }
      }

      toast.success(isEdit ? `Member ${fullName} updated` : `Member ${fullName} registered (${memberCode})`);
      setCreatedId(id);
      setCreatedName(fullName);

      if (isEdit) {
        navigate(`/members/${id}`);
      } else {
        // Per workflow: package selection happens AFTER member creation
        setPkgModalOpen(true);
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate("/members")} className="text-muted-foreground">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {outlet && (
            <span>
              Outlet: <span className="font-medium text-foreground">{outlet.name}</span>
              {outlet.outletCode && <span className="ml-2 text-primary">[{outlet.outletCode}]</span>}
            </span>
          )}
          {memberCode && (
            <span>
              Member Code: <span className="font-mono font-semibold text-primary">{memberCode}</span>
            </span>
          )}
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-bold font-display">{isEdit ? "Edit Member" : "Member Registration Form"}</h1>
        <p className="text-muted-foreground text-sm">
          Step {step + 1} of {STEPS.length} — {STEPS[step]}
        </p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${i < step ? "bg-success text-success-foreground" : i === step ? "gradient-gold text-primary-foreground" : "bg-muted text-muted-foreground"}`}
            >
              {i < step ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span className={`text-sm hidden md:inline ${i === step ? "font-medium" : "text-muted-foreground"}`}>
              {s}
            </span>
            {i < STEPS.length - 1 && <div className="w-6 h-px bg-border" />}
          </div>
        ))}
      </div>

      <div className="glass-card rounded-xl p-6 space-y-6">
        {step === 0 && (
          <>
            <div className="flex items-center gap-4">
              <Avatar className="h-24 w-24 ring-2 ring-primary/30">
                {photoPreview ? (
                  <AvatarImage src={photoPreview} />
                ) : (
                  <AvatarFallback>
                    <User className="h-8 w-8" />
                  </AvatarFallback>
                )}
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
              <div className="space-y-2 hidden">
                <Label>Member Code</Label>
                <Input value={memberCode} readOnly className="font-mono bg-muted/40" />
              </div>
              <div className="space-y-2">
                <Label>First Name *</Label>
                <Input value={f.firstName} onChange={(e) => u("firstName", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Middle Name</Label>
                <Input value={f.middleName} onChange={(e) => u("middleName", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Last Name *</Label>
                <Input value={f.lastName} onChange={(e) => u("lastName", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Date of Birth</Label>
                <Input type="date" value={f.dob} onChange={(e) => u("dob", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Gender</Label>
                <Select value={f.gender} onValueChange={(v) => u("gender", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Nationality</Label>
                <Select value={f.nationality} onValueChange={(v) => u("nationality", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {nationalities.map((n) => (
                      <SelectItem key={n} value={n}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Religion</Label>
                <Input value={f.religion} onChange={(e) => u("religion", e.target.value)} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Occupation</Label>
                <Input value={f.occupation} onChange={(e) => u("occupation", e.target.value)} />
              </div>
              <div className="space-y-2 sm:col-span-3">
                <Label>Permanent Address</Label>
                <Textarea rows={2} value={f.permanentAddress} onChange={(e) => u("permanentAddress", e.target.value)} />
              </div>
              <div className="space-y-2 sm:col-span-3">
                <Label>Temporary Address</Label>
                <Textarea rows={2} value={f.temporaryAddress} onChange={(e) => u("temporaryAddress", e.target.value)} />
              </div>
            </div>
          </>
        )}

        {step === 1 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Mobile / Phone *</Label>
              <Input value={f.phone} onChange={(e) => u("phone", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={f.email} onChange={(e) => u("email", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Alt. Contact</Label>
              <Input value={f.contactAlt} onChange={(e) => u("contactAlt", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Office Name</Label>
              <Input value={f.officeName} onChange={(e) => u("officeName", e.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Office Address</Label>
              <Input value={f.officeAddress} onChange={(e) => u("officeAddress", e.target.value)} />
            </div>

            <div className="sm:col-span-2 border-t border-border pt-4 mt-2">
              <h3 className="font-semibold mb-3">Emergency Contact</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={f.emergencyName} onChange={(e) => u("emergencyName", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={f.emergencyPhone} onChange={(e) => u("emergencyPhone", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Input value={f.emergencyAddress} onChange={(e) => u("emergencyAddress", e.target.value)} />
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold mb-3">Physical Details</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Height (ft.)</Label>
                  <Input value={f.height} onChange={(e) => u("height", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Weight (kg)</Label>
                  <Input value={f.weight} onChange={(e) => u("weight", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Chest (inch)</Label>
                  <Input value={f.chest} onChange={(e) => u("chest", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Blood Group</Label>
                  <Select value={f.bloodGroup} onValueChange={(v) => u("bloodGroup", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {bloodGroups.map((b) => (
                        <SelectItem key={b} value={b}>
                          {b}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-3">Medical Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <label className="flex items-center justify-between rounded-lg border border-border p-3">
                  <span className="text-sm">Any Heart Stroke?</span>
                  <Switch checked={f.heartStroke} onCheckedChange={(v) => u("heartStroke", v)} />
                </label>
                <label className="flex items-center justify-between rounded-lg border border-border p-3">
                  <span className="text-sm">Breathing Difficulty?</span>
                  <Switch checked={f.breathingDifficulty} onCheckedChange={(v) => u("breathingDifficulty", v)} />
                </label>
                <label className="flex items-center justify-between rounded-lg border border-border p-3">
                  <span className="text-sm">Any Skin Disease?</span>
                  <Switch checked={f.skinDisease} onCheckedChange={(v) => u("skinDisease", v)} />
                </label>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-3">Member Preferences</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {preferenceOptions.map((p) => (
                  <label
                    key={p}
                    className="flex items-center gap-2 rounded-lg border border-border p-2.5 cursor-pointer hover:bg-muted/30 text-sm"
                  >
                    <input type="checkbox" checked={f.preferences.includes(p)} onChange={() => togglePref(p)} />
                    <span>{p}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3 text-sm">
            <h3 className="font-semibold mb-3">Review</h3>
            <div className="grid grid-cols-2 gap-3 glass-card p-4 rounded-lg bg-muted/30">
              <Row label="Member Code" value={memberCode} />
              <Row label="Name" value={[f.firstName, f.middleName, f.lastName].filter(Boolean).join(" ")} />
              <Row label="DOB / Gender" value={`${f.dob || "—"} · ${f.gender || "—"}`} />
              <Row label="Phone / Email" value={`${f.phone} · ${f.email || "—"}`} />
              <Row label="Nationality / Religion" value={`${f.nationality} · ${f.religion || "—"}`} />
              <Row label="Permanent Address" value={f.permanentAddress} />
              <Row label="Emergency" value={[f.emergencyName, f.emergencyPhone].filter(Boolean).join(" · ")} />
              <Row
                label="Blood / Height / Weight"
                value={`${f.bloodGroup || "—"} · ${f.height || "—"} · ${f.weight || "—"}`}
              />
              <Row label="Outlet" value={outlet?.name || "—"} />
            </div>
            <p className="text-xs text-muted-foreground">
              No package is assigned during registration. After saving you'll be prompted to choose packages & plan for
              the selected outlet.
            </p>
          </div>
        )}

        <div className="flex justify-between pt-4 border-t border-border">
          <Button variant="outline" disabled={step === 0} onClick={back}>
            Previous
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={next}>Next</Button>
          ) : (
            <Button onClick={handleSubmit} disabled={saving} className="gradient-gold text-primary-foreground">
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Saving...
                </>
              ) : isEdit ? (
                "Update Member"
              ) : (
                "Register Member"
              )}
            </Button>
          )}
        </div>
      </div>

      <PackageSelectionModal
        open={pkgModalOpen}
        onOpenChange={setPkgModalOpen}
        memberId={createdId}
        memberName={createdName}
        onDone={() => navigate(`/members/${createdId}`)}
      />
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
