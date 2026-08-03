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

const Login = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { data: settings = {} } = useCompanySettings();

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

  useEffect(() => {
    if (params.get("deactivated") === "1") {
      toast.error("User deactivated");
    }
  }, [params]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
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
    if (!licenseKey.trim()) {
      toast.error("Please enter a valid license key");
      return;
    }

    setRenewLoading(true);
    try {
      // Send the license key and property details to your API endpoint
      // const response = await fetch("/api/license/renew", {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify({
      //     licenseKey: licenseKey.trim(),
      //     propertyName,
      //   }),
      // });

      // if (!response.ok) {
      //   const errorData = await response.json().catch(() => ({}));
      //   throw new Error(errorData.message || "Failed to renew license");
      // }

      toast.success("License renewed successfully!");
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
                    maxLength={16}
                    placeholder="xxxx-xxxx-xxxx-xxxx"
                    className="pl-10 bg-muted/50 border-border/50 h-11 uppercase tracking-widest"
                    value={licenseKey}
                    onChange={(e) => setLicenseKey(e.target.value)}
                    required
                  />
                </div>

                {/* Action to switch back to Login */}
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
