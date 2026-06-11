import { useState, useEffect, useMemo } from "react";
import { Mail, Building, Shield, Loader2, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompanySettings, useSaveCompanySettings } from "@/hooks/use-firestore";
import { getBrowserTimezone, listTimezones, formatInTz } from "@/lib/tz";
import { toast } from "sonner";

const Settings = () => {
  const { data: settings = {}, isLoading } = useCompanySettings();
  const saveMutation = useSaveCompanySettings();

  const [company, setCompany] = useState({
    companyName: ".............",
    registrationNumber: "REG-2018-KTM-4521",
    companyEmail: "info@zeansoftware.com",
    companyPhone: "+977-xx-xxxxxxx",
    companyAddress: "Thamel, Kathmandu, Nepal",
  });

  const [tax, setTax] = useState({
    vatRate: "13",
    panNumber: "123456789",
    taxYearStart: "shrawan",
    currency: "NPR",
  });

  const browserTz = useMemo(() => getBrowserTimezone(), []);
  const allTimezones = useMemo(() => listTimezones(), []);

  const [general, setGeneral] = useState({
    language: "en",
    timezone: browserTz,
    dateFormat: "yyyy-mm-dd",
    defaultMemberView: "table",
  });
  

  const [notifications, setNotifications] = useState({
    expiryReminders: true,
    failedPayments: true,
    newRegistration: true,
    bookingConfirmations: true,
    smsNotifications: false,
  });

  // Populate from Firestore settings when loaded
  useEffect(() => {
    if (Object.keys(settings).length > 0) {
      setCompany((prev) => ({
        companyName: settings.companyName || prev.companyName,
        registrationNumber: settings.registrationNumber || prev.registrationNumber,
        companyEmail: settings.companyEmail || prev.companyEmail,
        companyPhone: settings.companyPhone || prev.companyPhone,
        companyAddress: settings.companyAddress || prev.companyAddress,
      }));
      setTax((prev) => ({
        vatRate: settings.vatRate || prev.vatRate,
        panNumber: settings.panNumber || prev.panNumber,
        taxYearStart: settings.taxYearStart || prev.taxYearStart,
        currency: settings.currency || prev.currency,
      }));
      setGeneral((prev) => ({
        language: settings.language || prev.language,
        timezone: settings.timezone || prev.timezone,
        dateFormat: settings.dateFormat || prev.dateFormat,
        defaultMemberView: settings.defaultMemberView || prev.defaultMemberView,
      }));
    }
  }, [settings]);

  const handleSaveCompany = async () => {
    try {
      await saveMutation.mutateAsync(company);
      toast.success("Company settings saved!");
    } catch {
      toast.error("Failed to save settings");
    }
  };

  const handleSaveTax = async () => {
    try {
      await saveMutation.mutateAsync(tax);
      toast.success("Tax settings saved!");
    } catch {
      toast.error("Failed to save settings");
    }
  };

  const handleSaveGeneral = async () => {
    try {
      await saveMutation.mutateAsync(general);
      toast.success("General settings saved!");
    } catch {
      toast.error("Failed to save settings");
    }
  };

  const toggleNotif = (key: keyof typeof notifications) => {
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }));
    toast.success("Setting updated");
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold font-display">Settings</h1>
        <p className="text-muted-foreground text-sm">Company & system configuration</p>
      </div>

      <Tabs defaultValue="company" className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="company">Company</TabsTrigger>
          <TabsTrigger value="tax">Tax & VAT</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="general">General</TabsTrigger>
        </TabsList>

        <TabsContent value="company">
          <div className="glass-card rounded-xl p-6 space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <Building className="h-5 w-5 text-primary" />
              <h3 className="font-semibold font-display">Company Information</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Company Name</Label>
                <Input
                  value={company.companyName}
                  onChange={(e) => setCompany((p) => ({ ...p, companyName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Registration Number</Label>
                <Input
                  value={company.registrationNumber}
                  onChange={(e) => setCompany((p) => ({ ...p, registrationNumber: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={company.companyEmail}
                  onChange={(e) => setCompany((p) => ({ ...p, companyEmail: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={company.companyPhone}
                  onChange={(e) => setCompany((p) => ({ ...p, companyPhone: e.target.value }))}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Address</Label>
                <Input
                  value={company.companyAddress}
                  onChange={(e) => setCompany((p) => ({ ...p, companyAddress: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Company Logo</Label>
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center text-xl font-bold text-primary">
                  VF
                </div>
                <Button variant="outline" size="sm" onClick={() => toast.info("Upload logo via Firebase Storage")}>
                  Upload Logo
                </Button>
              </div>
            </div>
            <Button
              onClick={handleSaveCompany}
              disabled={saveMutation.isPending}
              className="gradient-gold text-primary-foreground"
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="tax">
          <div className="glass-card rounded-xl p-6 space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <Shield className="h-5 w-5 text-primary" />
              <h3 className="font-semibold font-display">Tax & VAT Configuration</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>VAT Rate (%)</Label>
                <Input
                  type="number"
                  value={tax.vatRate}
                  onChange={(e) => setTax((p) => ({ ...p, vatRate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>PAN Number</Label>
                <Input value={tax.panNumber} onChange={(e) => setTax((p) => ({ ...p, panNumber: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Tax Year Start</Label>
                <Select value={tax.taxYearStart} onValueChange={(v) => setTax((p) => ({ ...p, taxYearStart: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="shrawan">Shrawan (Jul-Aug)</SelectItem>
                    <SelectItem value="january">January</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select value={tax.currency} onValueChange={(v) => setTax((p) => ({ ...p, currency: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NPR">NPR (Nepali Rupees)</SelectItem>
                    <SelectItem value="USD">USD (US Dollar)</SelectItem>
                    <SelectItem value="INR">INR (Indian Rupees)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="rounded-lg border border-border/50 bg-muted/30 p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">VAT Calculation</p>
              <p>
                All invoices automatically include {tax.vatRate}% VAT. Monthly VAT reports are available in the Reports
                section.
              </p>
            </div>
            <Button
              onClick={handleSaveTax}
              disabled={saveMutation.isPending}
              className="gradient-gold text-primary-foreground"
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="notifications">
          <div className="glass-card rounded-xl p-6 space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <Mail className="h-5 w-5 text-primary" />
              <h3 className="font-semibold font-display">Notification Settings</h3>
            </div>
            <div className="space-y-1">
              {[
                {
                  key: "expiryReminders" as const,
                  label: "Expiry Reminders",
                  desc: "Send email 15 days before membership expires",
                },
                {
                  key: "failedPayments" as const,
                  label: "Failed Payment Alerts",
                  desc: "Notify admin & member on failed recurring payments",
                },
                {
                  key: "newRegistration" as const,
                  label: "New Registration",
                  desc: "Email admin when a new member registers",
                },
                {
                  key: "bookingConfirmations" as const,
                  label: "Booking Confirmations",
                  desc: "Send confirmation email after successful booking",
                },
                {
                  key: "smsNotifications" as const,
                  label: "SMS Notifications",
                  desc: "Send SMS reminders (via Twilio)",
                },
              ].map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between py-4 border-b border-border/30 last:border-0"
                >
                  <div>
                    <p className="font-medium text-sm">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                  <Switch checked={notifications[item.key]} onCheckedChange={() => toggleNotif(item.key)} />
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="general">
          <div className="glass-card rounded-xl p-6 space-y-6">
            <h3 className="font-semibold font-display">General Settings</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Language</Label>
                <Select value={general.language} onValueChange={(v) => setGeneral((p) => ({ ...p, language: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="ne">नेपाली (Nepali)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label className="flex items-center gap-2"><Globe className="h-3.5 w-3.5" /> Timezone</Label>
                <Input
                  list="tz-options"
                  value={general.timezone}
                  placeholder="Start typing… e.g. Asia/Kathmandu"
                  onChange={(e) => setGeneral((p) => ({ ...p, timezone: e.target.value }))}
                />
                <datalist id="tz-options">
                  {allTimezones
                    .filter((z) => !tzSearch || z.toLowerCase().includes(tzSearch.toLowerCase()))
                    .slice(0, 500)
                    .map((z) => (<option key={z} value={z} />))}
                </datalist>
                <p className="text-[11px] text-muted-foreground">
                  Detected from this PC: <button type="button" className="underline text-primary" onClick={() => setGeneral((p) => ({ ...p, timezone: browserTz }))}>{browserTz}</button>
                  {" · "}
                  Now: <span className="font-mono">{formatInTz(new Date(), { dateStyle: "medium", timeStyle: "long" }, general.timezone || browserTz)}</span>
                </p>
              </div>
              <div className="space-y-2">
                <Label>Date Format</Label>
                <Select value={general.dateFormat} onValueChange={(v) => setGeneral((p) => ({ ...p, dateFormat: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yyyy-mm-dd">YYYY-MM-DD</SelectItem>
                    <SelectItem value="dd-mm-yyyy">DD-MM-YYYY</SelectItem>
                    <SelectItem value="mm-dd-yyyy">MM-DD-YYYY</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Default Member View</Label>
                <Select
                  value={general.defaultMemberView}
                  onValueChange={(v) => setGeneral((p) => ({ ...p, defaultMemberView: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="table">Table</SelectItem>
                    <SelectItem value="grid">Grid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-lg border border-border/50 bg-muted/30 p-4 space-y-3">
              <p className="font-medium text-sm">API Integrations</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                {[
                  { name: "Stripe", status: "Not Connected", color: "text-muted-foreground" },
                  { name: "eSewa", status: "Not Connected", color: "text-muted-foreground" },
                  { name: "Resend (Email)", status: "Not Connected", color: "text-muted-foreground" },
                  { name: "Twilio (SMS)", status: "Not Connected", color: "text-muted-foreground" },
                ].map((api) => (
                  <div
                    key={api.name}
                    className="flex items-center justify-between rounded-lg border border-border/30 p-3"
                  >
                    <span>{api.name}</span>
                    <span className={`text-xs ${api.color}`}>{api.status}</span>
                  </div>
                ))}
              </div>
            </div>

            <Button
              onClick={handleSaveGeneral}
              disabled={saveMutation.isPending}
              className="gradient-gold text-primary-foreground"
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
