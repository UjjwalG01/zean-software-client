import { supabase } from "./supabase";

export type ReminderTemplateKey =
  | "membership_expiring"
  | "membership_expired"
  | "booking_reminder"
  | "payment_due"
  | "welcome";

export interface EmailTemplate {
  key: ReminderTemplateKey;
  subject: string;
  body: string;          // plain-text fallback / source
  html?: string;         // rendered HTML from Unlayer
  design?: any;          // Unlayer JSON design (for re-editing)
  enabled: boolean;
}

export const DEFAULT_TEMPLATES: Record<ReminderTemplateKey, EmailTemplate> = {
  membership_expiring: {
    key: "membership_expiring",
    enabled: true,
    subject: "Your {{companyName}} membership expires in {{daysLeft}} days",
    body: `Dear {{memberName}},

This is a friendly reminder that your {{tier}} membership at {{companyName}} will expire on {{expiryDate}} ({{daysLeft}} days from now).

To avoid any interruption to your access, please renew your membership at your earliest convenience.

If you have already renewed, please disregard this message.

Thank you for being a valued member!

Warm regards,
{{companyName}}
{{companyPhone}} | {{companyEmail}}`,
  },
  membership_expired: {
    key: "membership_expired",
    enabled: true,
    subject: "Your {{companyName}} membership has expired",
    body: `Dear {{memberName}},

Your {{tier}} membership at {{companyName}} expired on {{expiryDate}}.

We'd love to have you back! Renew today to continue enjoying our services.

Warm regards,
{{companyName}}`,
  },
  booking_reminder: {
    key: "booking_reminder",
    enabled: true,
    subject: "Reminder: {{className}} on {{date}} at {{startTime}}",
    body: `Hi {{memberName}},

This is a reminder of your upcoming booking:

  • Class: {{className}}
  • Service: {{service}}
  • Date: {{date}}
  • Time: {{startTime}} – {{endTime}}

We look forward to seeing you!

— {{companyName}}`,
  },
  payment_due: {
    key: "payment_due",
    enabled: true,
    subject: "Payment due — {{companyName}}",
    body: `Dear {{memberName}},

You have an outstanding balance of NPR {{dueAmount}} on your {{companyName}} account.

Please settle the amount at your earliest convenience.

Thank you,
{{companyName}}`,
  },
  welcome: {
    key: "welcome",
    enabled: true,
    subject: "Welcome to {{companyName}}, {{memberName}}!",
    body: `Dear {{memberName}},

Welcome to {{companyName}}! Your {{tier}} membership is now active.

We're thrilled to have you. If you have any questions, our team is always here to help.

Warm regards,
{{companyName}}`,
  },
};

export async function getEmailTemplates(): Promise<Record<ReminderTemplateKey, EmailTemplate>> {
  const result: Record<string, EmailTemplate> = { ...DEFAULT_TEMPLATES };
  const { data, error } = await supabase.from("email_templates").select("*");
  if (error) { console.warn("[email_templates] read failed:", error.message); return result as any; }
  (data || []).forEach((row: any) => {
    if (!row?.key) return;
    result[row.key] = {
      key: row.key,
      subject: row.subject || "",
      body: row.body || "",
      html: row.html || "",
      design: row.design || null,
      enabled: row.enabled !== false,
    };
  });
  return result as Record<ReminderTemplateKey, EmailTemplate>;
}

export async function saveEmailTemplate(template: EmailTemplate): Promise<void> {
  const { error } = await supabase.from("email_templates").upsert({
    key: template.key,
    subject: template.subject,
    body: template.body,
    html: template.html ?? null,
    design: template.design ?? null,
    enabled: template.enabled,
    updated_at: new Date().toISOString(),
  }, { onConflict: "key" });
  if (error) throw error;
}

/** Fill template variables of the form {{varName}}. */
export function renderTemplate(text: string, data: Record<string, string | number>): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
    const v = data[key];
    return v !== undefined && v !== null ? String(v) : "";
  });
}

// ─── Reminder Log ──────────────────────────────────────────────────────
export interface ReminderLogEntry {
  id?: string;
  recipientEmail: string;
  recipientName: string;
  templateKey: ReminderTemplateKey;
  subject: string;
  body: string;
  sentAt: string;
  status: "sent" | "queued" | "failed";
  channel: "mailto" | "smtp" | "resend" | "manual";
  errorMessage?: string;
}

export async function logReminder(entry: Omit<ReminderLogEntry, "id" | "sentAt">): Promise<string> {
  const { data, error } = await supabase.from("email_reminders").insert({
    recipient_email: entry.recipientEmail,
    recipient_name: entry.recipientName,
    template_key: entry.templateKey,
    subject: entry.subject,
    body: entry.body,
    channel: entry.channel,
    status: entry.status,
    error_message: entry.errorMessage ?? null,
  }).select("id").single();
  if (error) throw error;
  return data.id as string;
}

export async function getReminderLog(max = 100): Promise<ReminderLogEntry[]> {
  const { data, error } = await supabase
    .from("email_reminders")
    .select("*")
    .order("sent_at", { ascending: false })
    .limit(max);
  if (error) { console.warn("[email_reminders] read failed:", error.message); return []; }
  return (data || []).map((r: any) => ({
    id: r.id,
    recipientEmail: r.recipient_email || "",
    recipientName: r.recipient_name || "",
    templateKey: r.template_key,
    subject: r.subject || "",
    body: r.body || "",
    sentAt: r.sent_at || "",
    status: r.status || "sent",
    channel: r.channel || "resend",
    errorMessage: r.error_message || "",
  }));
}

/**
 * Open the user's mail client with a pre-filled message.
 * This is a frontend-only fallback that always works without backend setup.
 */
export function openMailtoReminder(opts: {
  to: string;
  subject: string;
  body: string;
}): void {
  const params = new URLSearchParams({
    subject: opts.subject,
    body: opts.body,
  });
  // Use ? then replace + with %20 for proper line-break handling in body
  const url = `mailto:${encodeURIComponent(opts.to)}?${params.toString().replace(/\+/g, "%20")}`;
  window.location.href = url;
}

/**
 * Send an email via the Supabase Edge Function `send-email`, which uses
 * Resend server-side. The RESEND_API_KEY secret must be configured on the
 * Supabase project. Falls back to mailto: only if the call fails outright.
 */
export async function sendEmailViaResend(opts: {
  endpoint?: string; // legacy / ignored — kept for signature compatibility
  to: string;
  subject: string;
  body: string;
  fromEmail?: string;
  fromName?: string;
  templateKey?: ReminderTemplateKey;
  recipientName?: string;
}): Promise<{ ok: boolean; channel: "resend" | "mailto"; error?: string }> {
  const { to, subject, body, fromEmail, fromName, templateKey, recipientName } = opts;
  try {
    const { supabase } = await import("./supabase");
    const html = body
      .split("\n")
      .map((l) => l.length === 0 ? "<br/>" : `<p style="margin:0 0 8px">${escapeHtml(l)}</p>`)
      .join("");
    const { data, error } = await supabase.functions.invoke("send-email", {
      body: {
        to, subject, html, text: body,
        from: fromEmail ? (fromName ? `${fromName} <${fromEmail}>` : fromEmail) : undefined,
        templateKey, recipientName,
      },
    });
    if (error) return { ok: false, channel: "resend", error: error.message };
    if (data && data.ok === false) return { ok: false, channel: "resend", error: data.error || "send failed" };
    return { ok: true, channel: "resend" };
  } catch (e: any) {
    openMailtoReminder({ to, subject, body });
    return { ok: false, channel: "mailto", error: e?.message || String(e) };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
