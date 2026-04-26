import {
  collection, doc, getDocs, setDoc, addDoc, query, where, orderBy, limit,
  Timestamp,
} from "firebase/firestore";
import { getFirestoreDb } from "./firebase";

export type ReminderTemplateKey =
  | "membership_expiring"
  | "membership_expired"
  | "booking_reminder"
  | "payment_due"
  | "welcome";

export interface EmailTemplate {
  key: ReminderTemplateKey;
  subject: string;
  body: string;
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

const COLL = "emailTemplates";

export async function getEmailTemplates(): Promise<Record<ReminderTemplateKey, EmailTemplate>> {
  const db = getFirestoreDb();
  const snap = await getDocs(collection(db, COLL));
  const result: Record<string, EmailTemplate> = { ...DEFAULT_TEMPLATES };
  snap.docs.forEach((d) => {
    const data = d.data();
    if (data.key) {
      result[data.key] = {
        key: data.key,
        subject: data.subject || "",
        body: data.body || "",
        enabled: data.enabled !== false,
      };
    }
  });
  return result as Record<ReminderTemplateKey, EmailTemplate>;
}

export async function saveEmailTemplate(template: EmailTemplate): Promise<void> {
  const db = getFirestoreDb();
  await setDoc(doc(db, COLL, template.key), {
    ...template,
    updatedAt: Timestamp.now(),
  });
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
  const db = getFirestoreDb();
  const ref = await addDoc(collection(db, "emailReminders"), {
    ...entry,
    sentAt: Timestamp.now(),
  });
  return ref.id;
}

export async function getReminderLog(max = 100): Promise<ReminderLogEntry[]> {
  const db = getFirestoreDb();
  const q = query(collection(db, "emailReminders"), orderBy("sentAt", "desc"), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      recipientEmail: data.recipientEmail || "",
      recipientName: data.recipientName || "",
      templateKey: data.templateKey,
      subject: data.subject || "",
      body: data.body || "",
      sentAt: data.sentAt?.toDate?.()?.toISOString?.() || "",
      status: data.status || "sent",
      channel: data.channel || "mailto",
      errorMessage: data.errorMessage || "",
    };
  });
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
 * Send an email through a Resend-backed Firebase Cloud Function.
 *
 * Configure the endpoint URL in companySettings.resendEndpoint
 * (e.g. https://us-central1-PROJECT.cloudfunctions.net/sendEmail).
 * The function should accept { to, subject, html, text, from } and call
 * Resend's API server-side using a private RESEND_API_KEY.
 *
 * Falls back to mailto: when no endpoint is configured so the app
 * always provides a way to reach the recipient.
 */
export async function sendEmailViaResend(opts: {
  endpoint?: string;
  to: string;
  subject: string;
  body: string;
  fromEmail?: string;
  fromName?: string;
}): Promise<{ ok: boolean; channel: "resend" | "mailto"; error?: string }> {
  const { endpoint, to, subject, body, fromEmail, fromName } = opts;
  if (!endpoint) {
    openMailtoReminder({ to, subject, body });
    return { ok: true, channel: "mailto" };
  }
  try {
    const html = body
      .split("\n")
      .map((l) => l.length === 0 ? "<br/>" : `<p style="margin:0 0 8px">${escapeHtml(l)}</p>`)
      .join("");
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to,
        subject,
        html,
        text: body,
        from: fromEmail ? (fromName ? `${fromName} <${fromEmail}>` : fromEmail) : undefined,
      }),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => res.statusText);
      return { ok: false, channel: "resend", error: err };
    }
    return { ok: true, channel: "resend" };
  } catch (e: any) {
    return { ok: false, channel: "resend", error: e?.message || String(e) };
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
