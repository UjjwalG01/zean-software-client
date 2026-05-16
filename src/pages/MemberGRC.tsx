import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMember, useCompanySettings } from "@/hooks/use-firestore";
import { useOutlet } from "@/contexts/OutletContext";
import { Skeleton } from "@/components/ui/skeleton";

function parseList(settings: Record<string, string>, key: string, fallback: string[]): string[] {
  try { return settings[key] ? JSON.parse(settings[key]) : fallback; } catch { return fallback; }
}

const field = (v?: string | number | boolean | null) => {
  if (v === undefined || v === null || v === "" || v === false) return "";
  if (v === true) return "✓";
  return String(v);
};

const MemberGRC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: member, isLoading } = useMember(id);
  const { data: settings = {} } = useCompanySettings();
  const { outlets } = useOutlet();

  const m: any = member || {};
  const outlet = outlets.find((o) => o.id === m.outletId);

  const companyName = settings.companyName || "VitaFit Club";
  const companyAddress = settings.companyAddress || "";
  const companyPhone = settings.companyPhone || "";
  const companyEmail = settings.companyEmail || "";
  const logoUrl = settings.logoUrl || "";

  const rules = parseList(settings, "setup_grcFooterRules", [
    "Periodic check up (3, 6, 12 months) body analysis will be made.",
    "If you need to be informed or communicated.",
    "Membership expiration will be informed before 7 days.",
  ]);
  const packages = parseList(settings, "setup_packages", []);
  const timeSlots = parseList(settings, "setup_timeSlots", ["Morning","Day","Evening"]);

  if (isLoading) return <div className="p-6"><Skeleton className="h-96 w-full" /></div>;
  if (!member) return <div className="p-6">Member not found</div>;

  const handlePrint = () => window.print();

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between print:hidden">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/members/${id}`)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <Button onClick={handlePrint} className="gradient-gold text-primary-foreground">
          <Printer className="h-4 w-4 mr-1" /> Print GRC
        </Button>
      </div>

      <div id="grc-page" className="bg-white text-black mx-auto shadow-lg print:shadow-none" style={{ width: "210mm", minHeight: "297mm", fontFamily: "Inter, Arial, sans-serif" }}>
        {/* Header */}
        <div className="relative" style={{ backgroundColor: "#0c3a52", color: "white", padding: "24px 32px" }}>
          <div className="flex items-start justify-between gap-6">
            <div className="flex items-center gap-4">
              {logoUrl && <img src={logoUrl} alt="logo" style={{ height: 60 }} />}
              <div>
                <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 1 }}>{companyName}</div>
                {settings.tagline && <div style={{ fontSize: 11, opacity: 0.9 }}>{settings.tagline}</div>}
              </div>
            </div>
            <div style={{ backgroundColor: "white", color: "#0c3a52", padding: "12px 24px", borderRadius: 8, fontWeight: 800, fontSize: 22, letterSpacing: 2 }}>
              REGISTRATION FORM
            </div>
          </div>
          <div className="flex items-center justify-between mt-4" style={{ fontSize: 11, opacity: 0.95 }}>
            <div>
              {companyAddress && <div>{companyAddress}</div>}
              <div>
                {companyPhone && <span>Tel: {companyPhone}</span>}
                {companyEmail && <span style={{ marginLeft: 12 }}>Email: {companyEmail}</span>}
              </div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>FORM NO: #{m.grcNo || "—"}</div>
          </div>
        </div>

        {/* Personal Information */}
        <SectionHeader>PERSONAL INFORMATION</SectionHeader>
        <div style={{ padding: "16px 32px" }}>
          <div className="flex gap-6">
            <div className="flex-1 space-y-3" style={{ fontSize: 12 }}>
              <FieldRow label="FULL NAME" value={m.name} />
              <FieldRow label="GENDER" value={m.gender} options={["Male","Female"]} />
              <FieldRow label="DATE OF BIRTH" value={m.dob} />
              <div className="grid grid-cols-2 gap-4">
                <FieldRow label="NATIONALITY" value={m.nationality} />
                <FieldRow label="RELIGION" value={m.religion} />
              </div>
              <FieldRow label="RESIDENCE STATUS" value={m.residenceStatus} options={["Residence","Non-Residence"]} />
              <FieldRow label="MARITAL STATUS" value={m.maritalStatus} options={["Single","Married","Widowed"]} />
              <div className="grid grid-cols-2 gap-4">
                <FieldRow label="NATIONAL ID NO" value={m.nationalId} />
                <FieldRow label="TIN NO" value={m.tinNo} />
              </div>
              <FieldRow label="FATHER'S NAME" value={m.fatherName} />
              <FieldRow label="OCCUPATION" value={m.occupation} />
            </div>
            {/* Photo */}
            <div style={{ width: 110, height: 130, border: "1px solid #0c3a52", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#666", overflow: "hidden" }}>
              {m.avatar && !m.avatar.includes("dicebear") ? <img src={m.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "Photo"}
            </div>
          </div>
        </div>

        {/* Contact */}
        <SectionHeader>CONTACT INFORMATION</SectionHeader>
        <div style={{ padding: "16px 32px", fontSize: 12 }} className="space-y-3">
          <div className="grid grid-cols-2 gap-6">
            <FieldRow label="PERMANENT ADDRESS" value={m.permanentAddress} />
            <FieldRow label="TEMPORARY ADDRESS" value={m.temporaryAddress} />
            <FieldRow label="PHONE" value={m.phone} />
            <FieldRow label="EMAIL" value={m.email} />
            <FieldRow label="ALT CONTACT" value={m.contactAlt} />
            <FieldRow label="OFFICE NAME" value={m.officeName} />
            <FieldRow label="OFFICE ADDRESS" value={m.officeAddress} />
          </div>
        </div>

        {/* Membership */}
        <SectionHeader>MEMBERSHIP INFORMATION</SectionHeader>
        <div style={{ padding: "16px 32px", fontSize: 12 }} className="space-y-3">
          <div className="grid grid-cols-3 gap-4">
            <FieldRow label="TIER" value={m.tier} />
            <FieldRow label="PLAN" value={m.plan} />
            <FieldRow label="TIME SLOT" value={m.timeSlot} options={timeSlots} />
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: "#0c3a52", marginBottom: 4 }}>AVAILABLE PACKAGE</div>
            <div className="grid grid-cols-4 gap-1" style={{ fontSize: 11 }}>
              {(packages.length ? packages : (m.packages || [])).map((p: string) => (
                <label key={p} className="flex items-center gap-1">
                  <span style={{ display: "inline-block", width: 12, height: 12, border: "1px solid #0c3a52", textAlign: "center", lineHeight: "10px", fontSize: 9 }}>
                    {(m.packages || []).includes(p) ? "✓" : ""}
                  </span>
                  {p}
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Physical */}
        <SectionHeader>PHYSICAL DETAILS</SectionHeader>
        <div style={{ padding: "16px 32px", fontSize: 12 }}>
          <div className="grid grid-cols-4 gap-4">
            <FieldRow label="WEIGHT (kg)" value={m.weight} />
            <FieldRow label="HEIGHT (ft)" value={m.height} />
            <FieldRow label="CHEST (inch)" value={m.chest} />
            <FieldRow label="SHOULDER (inch)" value={m.shoulder} />
            <FieldRow label="ARMS (inch)" value={m.arms} />
            <FieldRow label="THIGH (inch)" value={m.thigh} />
            <FieldRow label="WAIST (inch)" value={m.waistInch} />
            <FieldRow label="HIP (inch)" value={m.hipInch} />
          </div>
          <div className="grid grid-cols-2 gap-6 mt-3">
            <FieldRow label="BLOOD GROUP" value={m.bloodGroup} />
            <FieldRow label="ANY HEART STROKE" value={m.heartStroke ? "Yes" : ""} options={["Yes","No"]} />
            <FieldRow label="BREATHING DIFFICULTIES" value={m.breathingDifficulty} />
            <FieldRow label="ANY SKIN DISEASE" value={m.skinDisease} />
          </div>
        </div>

        {/* Emergency */}
        <SectionHeader>EMERGENCY DETAILS</SectionHeader>
        <div style={{ padding: "16px 32px", fontSize: 12 }} className="grid grid-cols-2 gap-6">
          <FieldRow label="NAME" value={m.emergencyName} />
          <FieldRow label="TELEPHONE" value={m.emergencyContactNum} />
          <FieldRow label="DOCTOR'S NAME" value={m.doctorName} />
          <FieldRow label="DOCTOR'S CONTACT / ADDRESS" value={m.doctorContact} />
        </div>

        {/* Footer rules */}
        <div style={{ marginTop: 16, padding: "12px 32px", borderTop: "1px solid #0c3a52", fontSize: 10, color: "#333" }}>
          <div style={{ fontWeight: 700, marginBottom: 4, color: "#0c3a52" }}>Note:</div>
          <ol style={{ paddingLeft: 18 }}>
            {rules.map((r, i) => <li key={i}>{r}</li>)}
          </ol>
          <div className="flex justify-between mt-4 gap-6" style={{ fontSize: 11 }}>
            <div>
              Notify via:
              <span style={{ marginLeft: 8 }}>{m.notifyPhone ? "☑" : "☐"} Phone</span>
              <span style={{ marginLeft: 8 }}>{m.notifyEmail ? "☑" : "☐"} Email</span>
              <span style={{ marginLeft: 8 }}>{m.notifySMS ? "☑" : "☐"} SMS</span>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ borderTop: "1px solid #333", paddingTop: 2, minWidth: 180 }}>SIGNATURE</div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body { background: white !important; }
          #grc-page { box-shadow: none !important; margin: 0 !important; }
          @page { size: A4; margin: 0; }
        }
      `}</style>
    </div>
  );
};

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: "#0c3a52", color: "white", padding: "6px 32px", fontSize: 12, fontWeight: 700, letterSpacing: 2, textAlign: "center", margin: "12px 0 0 0" }}>
      {children}
    </div>
  );
}

function FieldRow({ label, value, options }: { label: string; value?: any; options?: string[] }) {
  if (options) {
    return (
      <div>
        <div style={{ fontSize: 10, fontWeight: 600, color: "#0c3a52", marginBottom: 2 }}>{label}</div>
        <div className="flex gap-4" style={{ fontSize: 11 }}>
          {options.map((opt) => (
            <span key={opt} className="flex items-center gap-1">
              <span style={{ display: "inline-block", width: 12, height: 12, borderRadius: 99, border: "1px solid #0c3a52", textAlign: "center", lineHeight: "10px", fontSize: 9 }}>
                {value === opt ? "•" : ""}
              </span>
              {opt}
            </span>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, color: "#0c3a52", marginBottom: 2 }}>{label}</div>
      <div style={{ borderBottom: "1px solid #999", paddingBottom: 2, minHeight: 16, fontSize: 12 }}>
        {field(value)}
      </div>
    </div>
  );
}

export default MemberGRC;
