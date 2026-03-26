import { useState } from "react";
import { Mail, Building, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const Settings = () => {
  const [notifications, setNotifications] = useState({
    expiryReminders: true,
    failedPayments: true,
    newRegistration: true,
    bookingConfirmations: true,
    smsNotifications: false,
  });

  const toggleNotif = (key: keyof typeof notifications) => {
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }));
    toast.success("Setting updated (connect backend to persist)");
  };

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
              <div className="space-y-2"><Label>Company Name</Label><Input defaultValue="VitaFit Club" /></div>
              <div className="space-y-2"><Label>Registration Number</Label><Input defaultValue="REG-2018-KTM-4521" /></div>
              <div className="space-y-2"><Label>Email</Label><Input type="email" defaultValue="info@vitafitclub.com" /></div>
              <div className="space-y-2"><Label>Phone</Label><Input defaultValue="+977-01-4567890" /></div>
              <div className="space-y-2 sm:col-span-2"><Label>Address</Label><Input defaultValue="Thamel, Kathmandu, Nepal" /></div>
            </div>
            <div className="space-y-2">
              <Label>Company Logo</Label>
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center text-xl font-bold text-primary">VF</div>
                <Button variant="outline" size="sm" onClick={() => toast.info("Upload logo (connect backend)")}>Upload Logo</Button>
              </div>
            </div>
            <Button onClick={() => toast.success("Company settings saved (connect backend)")} className="gradient-gold text-primary-foreground">Save Changes</Button>
          </div>
        </TabsContent>

        <TabsContent value="tax">
          <div className="glass-card rounded-xl p-6 space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <Shield className="h-5 w-5 text-primary" />
              <h3 className="font-semibold font-display">Tax & VAT Configuration</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>VAT Rate (%)</Label><Input type="number" defaultValue="13" /></div>
              <div className="space-y-2"><Label>PAN Number</Label><Input defaultValue="123456789" /></div>
              <div className="space-y-2">
                <Label>Tax Year Start</Label>
                <Select defaultValue="shrawan">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="shrawan">Shrawan (Jul-Aug)</SelectItem>
                    <SelectItem value="january">January</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select defaultValue="NPR">
                  <SelectTrigger><SelectValue /></SelectTrigger>
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
              <p>All invoices automatically include 13% VAT. Monthly VAT reports are available in the Reports section.</p>
            </div>
            <Button onClick={() => toast.success("Tax settings saved (connect backend)")} className="gradient-gold text-primary-foreground">Save Changes</Button>
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
                { key: "expiryReminders" as const, label: "Expiry Reminders", desc: "Send email 15 days before membership expires" },
                { key: "failedPayments" as const, label: "Failed Payment Alerts", desc: "Notify admin & member on failed recurring payments" },
                { key: "newRegistration" as const, label: "New Registration", desc: "Email admin when a new member registers" },
                { key: "bookingConfirmations" as const, label: "Booking Confirmations", desc: "Send confirmation email after successful booking" },
                { key: "smsNotifications" as const, label: "SMS Notifications", desc: "Send SMS reminders (via Twilio)" },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between py-4 border-b border-border/30 last:border-0">
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
                <Select defaultValue="en">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="ne">नेपाली (Nepali)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Timezone</Label>
                <Select defaultValue="asia-kathmandu">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asia-kathmandu">Asia/Kathmandu (NPT +5:45)</SelectItem>
                    <SelectItem value="asia-kolkata">Asia/Kolkata (IST +5:30)</SelectItem>
                    <SelectItem value="utc">UTC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Date Format</Label>
                <Select defaultValue="yyyy-mm-dd">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yyyy-mm-dd">YYYY-MM-DD</SelectItem>
                    <SelectItem value="dd-mm-yyyy">DD-MM-YYYY</SelectItem>
                    <SelectItem value="mm-dd-yyyy">MM-DD-YYYY</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Default Member View</Label>
                <Select defaultValue="table">
                  <SelectTrigger><SelectValue /></SelectTrigger>
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
                  <div key={api.name} className="flex items-center justify-between rounded-lg border border-border/30 p-3">
                    <span>{api.name}</span>
                    <span className={`text-xs ${api.color}`}>{api.status}</span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">💡 Enable Lovable Cloud to connect payment gateways and notification services.</p>
            </div>

            <Button onClick={() => toast.success("General settings saved (connect backend)")} className="gradient-gold text-primary-foreground">Save Changes</Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
