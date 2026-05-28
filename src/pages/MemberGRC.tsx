import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMember, useCompanySettings } from "@/hooks/use-firestore";
import { useOutlet } from "@/contexts/OutletContext";
import { Skeleton } from "@/components/ui/skeleton";

function parseList(settings: Record<string, string>, key: string, fallback: string[]): string[] {
  try { return settings[key] ? JSON.parse(settings[key]) : fallback; } catch { return fallback; }
}

const v = (x: any) => (x === undefined || x === null || x === "" || x === false ? "—" : x === true ? "✓" : String(x));

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

  const tpl = settings.grc_template || "classic";
  const baseFs = Number(settings.grc_textSize || 11);
  const show = {
    photo: settings.grc_showPhoto !== "false",
    office: settings.grc_showOffice !== "false",
    emergency: settings.grc_showEmergency !== "false",
    physical: settings.grc_showPhysical !== "false",
    packages: settings.grc_showPackages !== "false",
    preferences: settings.grc_showPreferences !== "false",
    notify: settings.grc_showNotify !== "false",
  };

  const rules = parseList(settings, "setup_grcFooterRules", [
    "Periodic check up (3, 6, 12 months) body analysis will be made.",
    "If you need to be informed or communicated.",
    "Membership expiration will be informed before 7 days.",
  ]);
  const packages = parseList(settings, "setup_packages", []);
  const timeSlots = parseList(settings, "setup_timeSlots", ["Morning","Day","Evening"]);
  const memberPkgs: string[] = Array.isArray(m.packages) ? m.packages : [];

  if (isLoading && id !== "blank") return <div className="p-6"><Skeleton className="h-96 w-full" /></div>;
  if (!member) return <div className="p-6">Member not found</div>;

  const handlePrint = () => window.print();
  const fullAddress = m.permanentAddress || (typeof m.address === "string" ? m.address : m.address?.permanent) || "";
  const code = m.memberCode || m.grcNo || "—";

  // Premium accent per template
  const accent =
    tpl === "modern" ? "#b9985a" :
    tpl === "elegant" ? "#1a1a2e" :
    "#0c3a52";
  const accentSoft =
    tpl === "modern" ? "#f8f3e6" :
    tpl === "elegant" ? "#f4f1ec" :
    "#eaf2f6";

  // ── Reusable atoms ──
  const SH = ({ children }: { children: React.ReactNode }) => {
    if (tpl === "modern") {
      return (
        <div style={{ marginTop: 14, marginBottom: 6, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 22, height: 2, background: accent }} />
          <span style={{ fontSize: baseFs, fontWeight: 700, letterSpacing: 3, color: accent, textTransform: "uppercase" }}>{children}</span>
          <span style={{ flex: 1, height: 1, background: `${accent}33` }} />
        </div>
      );
    }
    if (tpl === "elegant") {
      return (
        <div style={{
          marginTop: 14, marginBottom: 8, padding: "6px 14px",
          background: accentSoft, borderLeft: `3px solid ${accent}`,
          fontSize: baseFs, fontWeight: 700, letterSpacing: 2, color: accent, textTransform: "uppercase",
        }}>{children}</div>
      );
    }
    // classic
    return (
      <div style={{
        marginTop: 12, marginBottom: 6,
        background: accent, color: "white",
        padding: "5px 14px",
        fontSize: baseFs, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase",
      }}>{children}</div>
    );
  };

  const F = ({ label, value, opts, span }: { label: string; value?: any; opts?: string[]; span?: number }) => {
    const style: React.CSSProperties = span ? { gridColumn: `span ${span} / span ${span}` } : {};
    const labelStyle: React.CSSProperties = { fontSize: Math.max(baseFs - 2, 8), fontWeight: 600, color: `${accent}cc`, marginBottom: 3, letterSpacing: 0.5, textTransform: "uppercase" };
    if (opts) {
      return (
        <div style={style}>
          <div style={labelStyle}>{label}</div>
          <div style={{ display: "flex", gap: 14, fontSize: baseFs }}>
            {opts.map((opt) => (
              <span key={opt} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <span style={{ display: "inline-block", width: 11, height: 11, borderRadius: 99, border: `1.2px solid ${accent}`, textAlign: "center", lineHeight: "9px", fontSize: 9, color: accent }}>
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
        <div style={labelStyle}>{label}</div>
        <div style={{
          borderBottom: tpl === "modern" ? `1px solid ${accent}66` : "1px dotted #888",
          paddingBottom: 3, minHeight: 18, fontSize: baseFs, color: "#111",
        }}>{v(value)}</div>
      </div>
    );
  };

  // ── Header per template (with margin/padding) ──
  const Header = () => {
    if (tpl === "modern") {
      return (
        <div style={{ borderBottom: `3px solid ${accent}`, paddingBottom: 14, marginBottom: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              {logoUrl && <img src={logoUrl} alt="logo" style={{ height: 60 }} />}
              <div>
                <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: 1.5, color: accent, lineHeight: 1, fontFamily: "Georgia, serif" }}>{companyName}</div>
                <div style={{ fontSize: 10, color: "#555", marginTop: 4, letterSpacing: 1 }}>
                  {[companyAddress, companyPhone && `T ${companyPhone}`, companyEmail].filter(Boolean).join("  ·  ")}
                </div>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 9, color: "#888", letterSpacing: 3 }}>GUEST REGISTRATION</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: accent, marginTop: 2 }}>№ {code}</div>
              <div style={{ fontSize: 9, color: "#888", marginTop: 4 }}>{outlet?.name || ""}</div>
            </div>
          </div>
        </div>
      );
    }
    if (tpl === "elegant") {
      return (
        <div style={{ marginBottom: 10 }}>
          <div style={{
            border: `1px solid ${accent}`, padding: "16px 18px",
            background: `linear-gradient(135deg, ${accentSoft} 0%, white 100%)`,
            display: "flex", justifyContent: "space-between", alignItems: "center", gap: 18,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              {logoUrl && <img src={logoUrl} alt="logo" style={{ height: 56 }} />}
              <div>
                <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: 0.5, color: accent, lineHeight: 1.1, fontFamily: "'Playfair Display', Georgia, serif" }}>{companyName}</div>
                <div style={{ fontSize: 10, color: "#555", marginTop: 3 }}>{companyAddress}</div>
                <div style={{ fontSize: 10, color: "#555" }}>
                  {[companyPhone && `Tel ${companyPhone}`, companyEmail].filter(Boolean).join("   ·   ")}
                </div>
              </div>
            </div>
            <div style={{ textAlign: "center", border: `1px solid ${accent}`, padding: "8px 16px", background: "white" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: accent, letterSpacing: 2 }}>REGISTRATION</div>
              <div style={{ fontSize: 9, color: "#888", letterSpacing: 1, marginTop: 2 }}>FORM NUMBER</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: accent, marginTop: 2 }}>{code}</div>
            </div>
          </div>
        </div>
      );
    }
    // classic
    return (
      <div style={{ marginBottom: 8, background: accent, color: "white", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {logoUrl && <img src={logoUrl} alt="logo" style={{ height: 54, background: "white", padding: 4, borderRadius: 4 }} />}
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 1, lineHeight: 1.1 }}>{companyName}</div>
            <div style={{ fontSize: 10, opacity: 0.9, marginTop: 3 }}>
              {[companyAddress, companyPhone && `Tel: ${companyPhone}`, companyEmail].filter(Boolean).join("  ·  ")}
            </div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ background: "white", color: accent, padding: "6px 16px", borderRadius: 3, fontWeight: 700, fontSize: 14, letterSpacing: 1.5 }}>
            REGISTRATION FORM
          </div>
          <div style={{ fontSize: 11, marginTop: 6, opacity: 0.95 }}>FORM N°  <strong>{code}</strong></div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between print:hidden">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/members/${id}`)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div className="text-xs text-muted-foreground">Template: <span className="font-medium capitalize">{tpl}</span> · {baseFs}px</div>
        <Button onClick={handlePrint} className="gradient-gold text-primary-foreground">
          <Printer className="h-4 w-4 mr-1" /> Print GRC
        </Button>
      </div>

      <div
        id="grc-page"
        className="bg-white text-black mx-auto shadow-lg print:shadow-none"
        style={{
          width: "210mm",
          minHeight: "297mm",
          fontFamily: "Inter, Arial, sans-serif",
          padding: "16mm 14mm",
          display: "flex",
          flexDirection: "column",
          boxSizing: "border-box",
          color: "#111",
        }}
      >
        <Header />

        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {/* Personal + photo */}
          <SH>Personal Information</SH>
          <div style={{ display: "flex", gap: 16 }}>
            <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", columnGap: 14, rowGap: 10 }}>
              <F label="Full Name" value={m.name} span={2} />
              <F label="Date of Birth" value={m.dob} />
              <F label="Gender" value={m.gender} />
              <F label="Nationality" value={m.nationality} />
              <F label="Marital Status" value={m.maritalStatus} />
              <F label="Religion" value={m.religion} />
              <F label="Occupation" value={m.occupation} span={2} />
              <F label="Permanent Address" value={fullAddress} span={3} />
              <F label="Temporary Address" value={m.temporaryAddress} span={3} />
            </div>
            {show.photo && (
              <div style={{
                width: 100, height: 130, border: `1.5px solid ${accent}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, color: "#888", overflow: "hidden", flexShrink: 0,
                background: accentSoft,
              }}>
                {m.avatar && !m.avatar.includes("dicebear")
                  ? <img src={m.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <span style={{ letterSpacing: 2 }}>PHOTO</span>}
              </div>
            )}
          </div>

          {/* Contact */}
          <SH>Contact Information</SH>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", columnGap: 14, rowGap: 10 }}>
            <F label="Phone" value={m.phone} />
            <F label="Email" value={m.email} span={2} />
            <F label="Alt. Contact" value={m.contactAlt} />
            {show.office && (<>
              <F label="Office Name" value={m.officeName} span={2} />
              <F label="Office Address" value={m.officeAddress} span={2} />
            </>)}
          </div>

          {/* Emergency */}
          {show.emergency && (<>
            <SH>Emergency Contact</SH>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", columnGap: 14, rowGap: 10 }}>
              <F label="Name" value={m.emergencyName} />
              <F label="Phone" value={m.emergencyContactNum || m.emergencyContact} />
              <F label="Address" value={m.emergencyAddress || m.doctorContact} />
            </div>
          </>)}

          {/* Membership */}
          <SH>Membership</SH>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", columnGap: 14, rowGap: 10 }}>
            <F label="Tier" value={m.tier} />
            <F label="Plan" value={m.plan} />
            <F label="Time Slot" value={m.timeSlot} opts={timeSlots} />
            <F label="Outlet" value={outlet?.name} />
          </div>
          {show.packages && packages.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: Math.max(baseFs - 2, 8), fontWeight: 600, color: `${accent}cc`, marginBottom: 4, letterSpacing: 0.5, textTransform: "uppercase" }}>Available Packages</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0,1fr))", columnGap: 10, rowGap: 4, fontSize: Math.max(baseFs - 1, 10) }}>
                {packages.map((p: string) => (
                  <label key={p} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ display: "inline-block", width: 12, height: 12, border: `1px solid ${accent}`, textAlign: "center", lineHeight: "10px", fontSize: 9, color: accent }}>
                      {memberPkgs.includes(p) ? "✓" : ""}
                    </span>
                    {p}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Physical & Medical */}
          {show.physical && (<>
            <SH>Physical &amp; Medical Details</SH>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", columnGap: 14, rowGap: 10 }}>
              <F label="Height (ft)" value={m.height} />
              <F label="Weight (kg)" value={m.weight} />
              <F label="Chest (in)" value={m.chest} />
              <F label="Blood Group" value={m.bloodGroup} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", columnGap: 14, rowGap: 10, marginTop: 10 }}>
              <F label="Any Heart Stroke" value={m.heartStroke ? "Yes" : "No"} opts={["Yes","No"]} />
              <F label="Breathing Difficulty" value={(m.breathingDifficulty === true || (typeof m.breathingDifficulty === "string" && m.breathingDifficulty.trim())) ? "Yes" : "No"} opts={["Yes","No"]} />
              <F label="Any Skin Disease" value={(m.skinDisease === true || (typeof m.skinDisease === "string" && m.skinDisease.trim())) ? "Yes" : "No"} opts={["Yes","No"]} />
            </div>
            {show.preferences && Array.isArray(m.preferences) && m.preferences.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <F label="Preferences" value={m.preferences.join(", ")} />
              </div>
            )}
          </>)}

          {/* Spacer pushes footer to bottom */}
          <div style={{ flex: 1, minHeight: 20 }} />

          {/* Footer */}
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: `1.5px solid ${accent}` }}>
            <div style={{ fontSize: Math.max(baseFs - 2, 8), fontWeight: 700, color: accent, letterSpacing: 1, marginBottom: 4, textTransform: "uppercase" }}>Important Notes</div>
            <ol style={{ paddingLeft: 18, margin: 0, fontSize: Math.max(baseFs - 1.5, 9), color: "#333", lineHeight: 1.5 }}>
              {rules.map((r, i) => <li key={i}>{r}</li>)}
            </ol>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 28, gap: 24, fontSize: baseFs }}>
              {show.notify ? (
                <div>
                  <div style={{ fontSize: Math.max(baseFs - 2, 8), color: `${accent}cc`, letterSpacing: 1, marginBottom: 4, textTransform: "uppercase", fontWeight: 600 }}>Preferred Notification</div>
                  <div style={{ display: "flex", gap: 14, fontSize: Math.max(baseFs - 1, 10) }}>
                    <span>{m.notifyPhone ? "☑" : "☐"} Phone</span>
                    <span>{m.notifyEmail ? "☑" : "☐"} Email</span>
                    <span>{m.notifySMS ? "☑" : "☐"} SMS</span>
                  </div>
                </div>
              ) : <div />}
              <div style={{ textAlign: "center", minWidth: 200 }}>
                <div style={{ borderTop: "1px solid #333", paddingTop: 4, fontSize: Math.max(baseFs - 2, 8), letterSpacing: 1.5, color: "#444", textTransform: "uppercase", fontWeight: 600 }}>
                  Member Signature
                </div>
              </div>
              <div style={{ textAlign: "center", minWidth: 200 }}>
                <div style={{ borderTop: "1px solid #333", paddingTop: 4, fontSize: Math.max(baseFs - 2, 8), letterSpacing: 1.5, color: "#444", textTransform: "uppercase", fontWeight: 600 }}>
                  Authorised Signature
                </div>
              </div>
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
            width: 210mm !important; min-height: 297mm !important;
            box-shadow: none !important; margin: 0 !important;
          }
          @page { size: A4; margin: 0; }
        }
      `}</style>
    </div>
  );
};

export default MemberGRC;
