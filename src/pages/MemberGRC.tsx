import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMember, useCompanySettings } from "@/hooks/use-firestore";
import { useOutlet } from "@/contexts/OutletContext";
import { Skeleton } from "@/components/ui/skeleton";

function parseList(settings: Record<string, string>, key: string, fallback: string[]): string[] {
  try { return settings[key] ? JSON.parse(settings[key]) : fallback; } catch { return fallback; }
}

const v = (x: any) => (x === undefined || x === null || x === "" || x === false ? "" : x === true ? "✓" : String(x));

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
  const memberPkgs: string[] = Array.isArray(m.packages) ? m.packages : [];

  if (isLoading) return <div className="p-6"><Skeleton className="h-96 w-full" /></div>;
  if (!member) return <div className="p-6">Member not found</div>;

  const handlePrint = () => window.print();
  const fullAddress = m.permanentAddress || m.address || "";
  const code = m.memberCode || m.grcNo || "—";

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

      <div id="grc-page" className="bg-white text-black mx-auto shadow-lg print:shadow-none" style={{ width: "210mm", minHeight: "297mm", fontFamily: "Inter, Arial, sans-serif", padding: 0 }}>
        {/* Compact header */}
        <div style={{ backgroundColor: "#0c3a52", color: "white", padding: "10px 16px" }}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {logoUrl && <img src={logoUrl} alt="logo" style={{ height: 36 }} />}
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: 0.5, lineHeight: 1.1 }}>{companyName}</div>
                <div style={{ fontSize: 9, opacity: 0.9 }}>
                  {[companyAddress, companyPhone && `Tel: ${companyPhone}`, companyEmail && `Email: ${companyEmail}`].filter(Boolean).join(" • ")}
                </div>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ backgroundColor: "white", color: "#0c3a52", padding: "4px 12px", borderRadius: 4, fontWeight: 700, fontSize: 13, letterSpacing: 1 }}>
                REGISTRATION FORM
              </div>
              <div style={{ fontSize: 10, marginTop: 4 }}>FORM NO: <strong>#{code}</strong></div>
            </div>
          </div>
        </div>

        {/* Personal + photo */}
        <SH>PERSONAL INFORMATION</SH>
        <div style={{ padding: "8px 16px" }}>
          <div className="flex gap-4">
            <div className="flex-1 grid grid-cols-3 gap-x-3 gap-y-1.5" style={{ fontSize: 10 }}>
              <F label="FULL NAME" value={m.name} span={2} />
              <F label="DATE OF BIRTH" value={m.dob} />
              <F label="GENDER" value={m.gender} />
              <F label="NATIONALITY" value={m.nationality} />
              <F label="RELIGION" value={m.religion} />
              <F label="MARITAL STATUS" value={m.maritalStatus} />
              <F label="OCCUPATION" value={m.occupation} span={2} />
              <F label="PERMANENT ADDRESS" value={fullAddress} span={3} />
              <F label="TEMPORARY ADDRESS" value={m.temporaryAddress} span={3} />
            </div>
            <div style={{ width: 90, height: 110, border: "1px solid #0c3a52", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#666", overflow: "hidden", flexShrink: 0 }}>
              {m.avatar && !m.avatar.includes("dicebear") ? <img src={m.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "Photo"}
            </div>
          </div>
        </div>

        {/* Contact */}
        <SH>CONTACT INFORMATION</SH>
        <div style={{ padding: "8px 16px", fontSize: 10 }} className="grid grid-cols-4 gap-x-3 gap-y-1.5">
          <F label="PHONE" value={m.phone} />
          <F label="EMAIL" value={m.email} span={2} />
          <F label="ALT CONTACT" value={m.contactAlt} />
          <F label="OFFICE NAME" value={m.officeName} span={2} />
          <F label="OFFICE ADDRESS" value={m.officeAddress} span={2} />
        </div>

        {/* Emergency */}
        <SH>EMERGENCY CONTACT</SH>
        <div style={{ padding: "8px 16px", fontSize: 10 }} className="grid grid-cols-3 gap-x-3 gap-y-1.5">
          <F label="NAME" value={m.emergencyName} />
          <F label="PHONE" value={m.emergencyContactNum || m.emergencyContact} />
          <F label="ADDRESS" value={m.emergencyAddress || m.doctorContact} />
        </div>

        {/* Membership */}
        <SH>MEMBERSHIP</SH>
        <div style={{ padding: "8px 16px", fontSize: 10 }} className="space-y-2">
          <div className="grid grid-cols-4 gap-x-3">
            <F label="TIER" value={m.tier} />
            <F label="PLAN" value={m.plan} />
            <F label="TIME SLOT" value={m.timeSlot} opts={timeSlots} />
            <F label="OUTLET" value={outlet?.name} />
          </div>
          {packages.length > 0 && (
            <div>
              <div style={{ fontSize: 9, fontWeight: 600, color: "#0c3a52", marginBottom: 2 }}>AVAILABLE PACKAGES</div>
              <div className="grid grid-cols-6 gap-x-2 gap-y-0.5" style={{ fontSize: 9 }}>
                {packages.map((p: string) => (
                  <label key={p} className="flex items-center gap-1">
                    <span style={{ display: "inline-block", width: 10, height: 10, border: "1px solid #0c3a52", textAlign: "center", lineHeight: "8px", fontSize: 8 }}>
                      {memberPkgs.includes(p) ? "✓" : ""}
                    </span>
                    {p}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Physical & Medical */}
        <SH>PHYSICAL & MEDICAL DETAILS</SH>
        <div style={{ padding: "8px 16px", fontSize: 10 }} className="space-y-2">
          <div className="grid grid-cols-4 gap-x-3">
            <F label="HEIGHT (ft)" value={m.height} />
            <F label="WEIGHT (kg)" value={m.weight} />
            <F label="CHEST (in)" value={m.chest} />
            <F label="BLOOD GROUP" value={m.bloodGroup} />
          </div>
          <div className="grid grid-cols-3 gap-x-3">
            <F label="ANY HEART STROKE" value={m.heartStroke ? "Yes" : "No"} opts={["Yes","No"]} />
            <F label="BREATHING DIFFICULTY" value={(m.breathingDifficulty === true || (typeof m.breathingDifficulty === "string" && m.breathingDifficulty.trim())) ? "Yes" : "No"} opts={["Yes","No"]} />
            <F label="ANY SKIN DISEASE" value={(m.skinDisease === true || (typeof m.skinDisease === "string" && m.skinDisease.trim())) ? "Yes" : "No"} opts={["Yes","No"]} />
          </div>
          {Array.isArray(m.preferences) && m.preferences.length > 0 && (
            <F label="PREFERENCES" value={m.preferences.join(", ")} />
          )}
        </div>

        {/* Footer */}
        <div style={{ marginTop: 8, padding: "8px 16px", borderTop: "1px solid #0c3a52", fontSize: 9, color: "#333" }}>
          <div style={{ fontWeight: 700, marginBottom: 2, color: "#0c3a52" }}>Note:</div>
          <ol style={{ paddingLeft: 16, margin: 0 }}>
            {rules.map((r, i) => <li key={i}>{r}</li>)}
          </ol>
          <div className="flex justify-between mt-3 gap-6" style={{ fontSize: 10 }}>
            <div>
              Notify:
              <span style={{ marginLeft: 6 }}>{m.notifyPhone ? "☑" : "☐"} Phone</span>
              <span style={{ marginLeft: 6 }}>{m.notifyEmail ? "☑" : "☐"} Email</span>
              <span style={{ marginLeft: 6 }}>{m.notifySMS ? "☑" : "☐"} SMS</span>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ borderTop: "1px solid #333", paddingTop: 2, minWidth: 160 }}>MEMBER SIGNATURE</div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          html, body { background: white !important; margin: 0 !important; padding: 0 !important; }
          body * { visibility: hidden !important; }
          #grc-page, #grc-page * { visibility: visible !important; }
          #grc-page {
            position: absolute !important;
            left: 0 !important; top: 0 !important;
            width: 210mm !important; min-height: auto !important;
            box-shadow: none !important; margin: 0 !important;
          }
          @page { size: A4; margin: 6mm; }
        }
      `}</style>
    </div>
  );
};

function SH({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: "#0c3a52", color: "white", padding: "3px 16px", fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textAlign: "center", marginTop: 6 }}>
      {children}
    </div>
  );
}

function F({ label, value, opts, span }: { label: string; value?: any; opts?: string[]; span?: number }) {
  const style: React.CSSProperties = span ? { gridColumn: `span ${span} / span ${span}` } : {};
  if (opts) {
    return (
      <div style={style}>
        <div style={{ fontSize: 8.5, fontWeight: 600, color: "#0c3a52", marginBottom: 1 }}>{label}</div>
        <div className="flex gap-3" style={{ fontSize: 10 }}>
          {opts.map((opt) => (
            <span key={opt} className="flex items-center gap-1">
              <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 99, border: "1px solid #0c3a52", textAlign: "center", lineHeight: "8px", fontSize: 8 }}>
                {value === opt ? "•" : ""}
              </span>{opt}
            </span>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div style={style}>
      <div style={{ fontSize: 8.5, fontWeight: 600, color: "#0c3a52", marginBottom: 1 }}>{label}</div>
      <div style={{ borderBottom: "1px solid #999", paddingBottom: 1, minHeight: 14, fontSize: 10 }}>{v(value)}</div>
    </div>
  );
}

export default MemberGRC;
