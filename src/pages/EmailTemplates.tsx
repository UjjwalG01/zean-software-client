import { useEffect, useState } from "react";
import { Mail, Save, Loader2, Eye, Code2, Variable } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DEFAULT_TEMPLATES,
  getEmailTemplates,
  saveEmailTemplate,
  renderTemplate,
  type EmailTemplate,
  type ReminderTemplateKey,
} from "@/lib/email-templates";
import { useCompanySettings } from "@/hooks/use-firestore";
import { toast } from "sonner";

const templateMeta: Record<
  ReminderTemplateKey,
  { label: string; description: string; sample: Record<string, string> }
> = {
  membership_expiring: {
    label: "Membership Expiring",
    description: "Sent 15 days before a member's plan expires.",
    sample: { memberName: "Aarav Sharma", tier: "Gold", expiryDate: "2026-05-10", daysLeft: "15" },
  },
  membership_expired: {
    label: "Membership Expired",
    description: "Sent the day after expiry to encourage renewal.",
    sample: { memberName: "Priya Thapa", tier: "Silver", expiryDate: "2026-04-20" },
  },
  booking_reminder: {
    label: "Booking Reminder",
    description: "Sent the day before a scheduled booking.",
    sample: {
      memberName: "Bikash Gurung",
      className: "Morning Yoga",
      service: "Gym",
      date: "2026-05-01",
      startTime: "06:00",
      endTime: "07:00",
    },
  },
  payment_due: {
    label: "Payment Due",
    description: "Sent when a member has an outstanding balance.",
    sample: { memberName: "Sita Rai", dueAmount: "5,000" },
  },
  welcome: {
    label: "Welcome Email",
    description: "Sent right after a new member registers.",
    sample: { memberName: "Ramesh Adhikari", tier: "Basic" },
  },
};

export default function EmailTemplatesPage() {
  const qc = useQueryClient();
  const { data: settings = {} } = useCompanySettings();
  const { data: templates, isLoading } = useQuery({
    queryKey: ["emailTemplates"],
    queryFn: getEmailTemplates,
  });

  const saveMutation = useMutation({
    mutationFn: saveEmailTemplate,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["emailTemplates"] });
      toast.success("Template saved");
    },
    onError: () => toast.error("Failed to save template"),
  });

  const keys: ReminderTemplateKey[] = [
    "membership_expiring",
    "membership_expired",
    "booking_reminder",
    "payment_due",
    "welcome",
  ];

  if (isLoading || !templates) return <Skeleton className="h-96 rounded-xl" />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold font-display flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" />
          Email Templates
        </h1>
        <p className="text-muted-foreground text-sm">
          Compose subject and body using <code className="text-primary">{"{{variableName}}"}</code> placeholders. Switch
          to <strong>Preview</strong> to see the merged output.
        </p>
      </div>

      {/* <div className="rounded-lg border border-border/50 bg-muted/30 p-4 text-sm flex items-start gap-3">
        <Variable className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <div className="space-y-1 text-xs leading-relaxed">
          <p className="font-medium text-sm">Setup checklist</p>
          <ul className="text-muted-foreground space-y-1 list-disc pl-4">
            <li>Templates are stored in the <strong>email_templates</strong> table and rendered server-side at send time.</li>
            <li><strong>Resend</strong> sending: configure the <code className="text-primary">RESEND_API_KEY</code> secret on your Supabase project, then deploy the <code>send-email</code> edge function (already included).</li>
            <li>Every send is logged to <strong>email_reminders</strong> with status (sent / failed).</li>
            <li>Without a configured key the app falls back to opening the user's mail client.</li>
          </ul>
        </div>
      </div> */}

      <Tabs defaultValue={keys[0]} className="space-y-4">
        <TabsList className="bg-muted/50 flex-wrap h-auto gap-1">
          {keys.map((k) => (
            <TabsTrigger key={k} value={k}>
              {templateMeta[k].label}
            </TabsTrigger>
          ))}
        </TabsList>

        {keys.map((k) => (
          <TabsContent key={k} value={k}>
            <TemplateEditor
              template={templates[k]}
              meta={templateMeta[k]}
              companyName={settings.companyName || "............."}
              companyPhone={settings.companyPhone || ""}
              companyEmail={settings.companyEmail || ""}
              onSave={(t) => saveMutation.mutate(t)}
              saving={saveMutation.isPending}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function TemplateEditor({
  template,
  meta,
  companyName,
  companyPhone,
  companyEmail,
  onSave,
  saving,
}: {
  template: EmailTemplate;
  meta: { label: string; description: string; sample: Record<string, string> };
  companyName: string;
  companyPhone: string;
  companyEmail: string;
  onSave: (t: EmailTemplate) => void;
  saving: boolean;
}) {
  const [subject, setSubject] = useState(template.subject);
  const [body, setBody] = useState(template.body);
  const [enabled, setEnabled] = useState(template.enabled);
  const [mode, setMode] = useState<"edit" | "preview">("edit");

  useEffect(() => {
    setSubject(template.subject);
    setBody(template.body);
    setEnabled(template.enabled);
    setMode("edit");
  }, [template]);

  const sampleData = { ...meta.sample, companyName, companyPhone, companyEmail };
  const previewSubject = renderTemplate(subject, sampleData);
  const previewBody = renderTemplate(body, sampleData);

  const handleReset = () => {
    const def = DEFAULT_TEMPLATES[template.key];
    setSubject(def.subject);
    setBody(def.body);
    toast.message("Reset to default — remember to save.");
  };

  const handleSave = () => {
    onSave({ key: template.key, subject, body, enabled });
  };

  return (
    <div className="space-y-4">
      <div className="glass-card rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold font-display">{meta.label}</h3>
            <p className="text-xs text-muted-foreground">{meta.description}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Enabled</Label>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>
            <div className="flex rounded-md border border-border overflow-hidden text-xs">
              <button
                onClick={() => setMode("edit")}
                className={`px-3 py-1.5 flex items-center gap-1 ${mode === "edit" ? "bg-primary text-primary-foreground" : "bg-muted/40"}`}
              >
                <Code2 className="h-3 w-3" /> Edit
              </button>
              <button
                onClick={() => setMode("preview")}
                className={`px-3 py-1.5 flex items-center gap-1 ${mode === "preview" ? "bg-primary text-primary-foreground" : "bg-muted/40"}`}
              >
                <Eye className="h-3 w-3" /> Preview
              </button>
            </div>
          </div>
        </div>

        {mode === "edit" ? (
          <>
            <div className="space-y-2">
              <Label>Subject</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} className="bg-muted/50 border-0" />
            </div>
            <div className="space-y-2">
              <Label>Body</Label>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={14}
                className="bg-muted/50 border-0 font-mono text-xs"
              />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground mb-2 uppercase tracking-wider">
                Available variables — click to insert
              </p>
              <div className="flex flex-wrap gap-1">
                {Object.keys(sampleData).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setBody((p) => p + `{{${v}}}`)}
                    className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
                  >
                    {`{{${v}}}`}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-border/50 bg-background/60 p-4 space-y-3">
            <Badge variant="outline" className="text-[10px]">
              Preview · sample data
            </Badge>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Subject</p>
              <p className="text-sm font-medium">{previewSubject}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Body</p>
              <pre className="text-xs whitespace-pre-wrap font-sans leading-relaxed text-foreground/90">
                {previewBody}
              </pre>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={handleReset}>
            Reset to default
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              const to = window.prompt("Send a test email to:", companyEmail || "");
              if (!to) return;
              const { sendEmailViaResend } = await import("@/lib/email-templates");
              const r = await sendEmailViaResend({
                to,
                subject: previewSubject,
                body: previewBody,
                templateKey: template.key,
                fromName: companyName,
              });
              if (r.ok) toast.success(`Test email sent via ${r.channel}`);
              else toast.error(`Send failed: ${r.error || "unknown error"}`);
            }}
          >
            Send test email
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="ml-auto gradient-gold text-primary-foreground"
          >
            {saving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5 mr-1" />
                Save Template
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
