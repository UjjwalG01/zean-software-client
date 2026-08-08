import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { signIn } from "@/lib/auth-service";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  Lock,
  Mail,
  Crown,
  KeyRound,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { LicensedFooter } from "@/components/LicensedFooter";
import { SOFTWARE_NAME } from "@/lib/settings";
import { useCompanySettings } from "@/hooks/use-firestore";
import { useLicense } from "@/hooks/use-license";
import { licenseMessage } from "@/lib/license";

const Login = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { data: settings = {} } = useCompanySettings();
  const {
    state: license,
    loading: licenseLoading,
    activate,
  } = useLicense();

  // Mode toggle state: 'login' | 'renew'
  const [mode, setMode] = useState<"login" | "renew">("login");

  // Login form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // License renewal form state
  const [licenseKey, setLicenseKey] = useState("");
  const [renewLoading, setRenewLoading] = useState(false);

  const propertyName = settings.companyName || ".............";
  const licenseBlocked = !licenseLoading && license?.status !== "active";
  const licenseWarning =
    license?.status === "active" && license.daysLeft <= 14
      ? `License expires in ${license.daysLeft} day${license.daysLeft === 1 ? "" : "s"}.`
      : null;

  useEffect(() => {
    if (params.get("deactivated") === "1") {
      toast.error("User deactivated");
    }
  }, [params]);

  // A blocked installation can only proceed through the renewal form.
  useEffect(() => {
    if (licenseBlocked) setMode("renew");
  }, [licenseBlocked]);


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (licenseBlocked) {
      toast.error(licenseMessage(license!));
      setMode("renew");
      return;
    }
    if (!email || !password) {
      toast.error("Please enter email and password");
      return;
    }
    setLoading(true);
    try {
      await signIn(email, password);
      toast.success("Welcome back!");
      navigate("/");
    } catch (err: any) {
      const raw = (err?.message || "").toLowerCase();
      const msg = raw.includes("user deactivated")
        ? "User deactivated"
        : raw.includes("invalid login") || raw.includes("invalid credentials")
          ? "Invalid email or password"
          : raw.includes("email not confirmed")
            ? "Email not confirmed. Contact your administrator."
            : raw.includes("rate") || raw.includes("too many")
              ? "Too many attempts. Try again later."
              : err?.message || "Login failed. Please try again.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleRenewLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    const key = licenseKey.trim();
    if (!key) {
      toast.error("Please enter a valid license key");
      return;
    }

    setRenewLoading(true);
    try {
      const result = await activate(key);
      if (result.status !== "active") {
        toast.error(licenseMessage(result));
        return;
      }
      toast.success(
        result.expiresAt
          ? `License activated — valid until ${new Date(result.expiresAt).toLocaleDateString()}`
          : "License activated",
      );
      setLicenseKey("");
      setMode("login");
    } catch (err: any) {
      toast.error(
        err?.message || "License renewal failed. Please check your key.",
      );
    } finally {
      setRenewLoading(false);
    }
  };


  return (
    <div className="min-h-screen flex items-center justify-center dark:gradient-dark relative overflow-hidden">
      {/* Ambient glow effects */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 rounded-full bg-primary/10 blur-[120px]" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 rounded-full bg-primary/5 blur-[120px]" />

      <div className="w-full max-w-md mx-4 relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl gradient-gold mb-4">
            <Crown className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold font-display text-gradient-gold">
            {SOFTWARE_NAME}
          </h1>
        </div>

        {/* Fade Container Wrapper */}
        <div className="relative">
          {/* ================= LOGIN CARD ================= */}
          <div
            className={`glass-card rounded-2xl p-8 border border-border/50 transition-all duration-500 ease-in-out ${
              mode === "login"
                ? "opacity-100 scale-100 pointer-events-auto relative z-10"
                : "opacity-0 scale-95 pointer-events-none absolute inset-0 z-0"
            }`}
          >
            <div className="mb-6">
              <h2 className="text-xl font-semibold font-display text-foreground">
                Welcome back
              </h2>
              <p className="text-muted-foreground text-sm mt-1">
                Sign in to your account
              </p>
              {licenseWarning && (
                <div className="mt-4 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-xs text-primary">
                  {licenseWarning}
                </div>
              )}
            </div>


            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label
                  htmlFor="email"
                  className="text-sm text-muted-foreground"
                >
                  Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="client@example.com"
                    className="pl-10 bg-muted/50 border-border/50 h-11"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="password"
                  className="text-sm text-muted-foreground"
                >
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    className="pl-10 bg-muted/50 border-border/50 h-11"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </div>

                {/* Action to switch to Renewal Mode */}
                <div className="mt-4 text-right flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setMode("renew")}
                    className="text-xs inline-flex text-primary hover:underline transition-colors cursor-pointer align-bottom items-center pt-1 gap-1"
                  >
                    Renew license
                    <ArrowRight className="h-3 w-3 mr-1" />
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 gradient-gold text-primary-foreground font-semibold text-sm"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>

            <div className="mt-6 pt-5 border-t border-border/30 text-center">
              <LicensedFooter variant="muted" />
            </div>
          </div>

          {/* ================= RENEW LICENSE CARD ================= */}
          <div
            className={`glass-card rounded-2xl p-8 border border-border/50 transition-all duration-500 ease-in-out ${
              mode === "renew"
                ? "opacity-100 scale-100 pointer-events-auto relative z-10"
                : "opacity-0 scale-95 pointer-events-none absolute inset-0 z-0"
            }`}
          >
            <div className="mb-6">
              <h2 className="text-xl font-semibold font-display text-foreground">
                Renew License
              </h2>
              <p className="text-muted-foreground text-xs mt-1">
                Please enter the License Key provided by administration.
              </p>
              {licenseBlocked && license && (
                <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {licenseMessage(license)}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground/70 mt-3">
                Property: {propertyName}
              </p>
            </div>

            <form onSubmit={handleRenewLicense} className="space-y-5">
              <div className="space-y-2">
                <Label
                  htmlFor="licenseKey"
                  className="text-sm text-muted-foreground"
                >
                  License Key
                </Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="licenseKey"
                    type="text"
                    maxLength={19}
                    placeholder="VFCM-XXXX-XXXX-XXXX"
                    className="pl-10 bg-muted/50 border-border/50 h-11 uppercase tracking-widest"
                    value={licenseKey}
                    onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
                    required
                  />
                </div>

                {/* Action to switch back to Login */}
                {!licenseBlocked && (
                  <div className="mt-2 text-right flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setMode("login")}
                      className="text-xs inline-flex text-primary hover:underline transition-colors cursor-pointer align-bottom items-center pt-1 gap-1"
                    >
                      <ArrowLeft className="h-3 w-3 mr-1" />
                      Back to Login
                    </button>
                  </div>
                )}
              </div>


              <Button
                type="submit"
                disabled={renewLoading}
                className="w-full h-11 gradient-gold text-primary-foreground font-semibold text-sm"
              >
                {renewLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving License...
                  </>
                ) : (
                  "Save License Key"
                )}
              </Button>
            </form>

            <div className="mt-6 pt-5 border-t border-border/30 text-center">
              <LicensedFooter variant="muted" />
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground/60 mt-6">
          © 2026 {SOFTWARE_NAME}. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default Login;
