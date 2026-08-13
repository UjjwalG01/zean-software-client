/**
 * Automated (background) email sending.
 *
 * A templated email is only sent when BOTH are true:
 *  1. The matching switch under Settings → Notifications is enabled
 *     (stored in `company_settings.extras.notifications`).
 *  2. The template itself is enabled on the Email Templates page.
 *
 * Every send is logged server-side in `email_reminders` by the `send-email`
 * Edge Function. Failures never throw — automation must not break the flow
 * that triggered it.
 */

import {
  getEmailTemplates,
  renderTemplate,
  sendEmailViaResend,
  type ReminderTemplateKey,
} from "./email-templates";
import { getCompanySettings } from "./supabase-services";

/** Settings → Notifications switch that governs each template. */
const NOTIFICATION_SWITCH: Record<ReminderTemplateKey, string> = {
  welcome: "newRegistration",
  membership_expiring: "expiryReminders",
  membership_expired: "expiryReminders",
  booking_reminder: "bookingConfirmations",
  payment_due: "failedPayments",
};

export interface TemplatedEmailResult {
  sent: boolean;
  /** Why nothing was sent — useful for toasts/debugging. */
  reason?: "no-recipient" | "notification-disabled" | "template-disabled" | "send-failed";
  error?: string;
}

/**
 * Render and send a template to one recipient, honouring the notification
 * switches. Returns a result object instead of throwing.
 */
export async function sendTemplatedEmail(
  templateKey: ReminderTemplateKey,
  opts: {
    to: string;
    recipientName?: string;
    /** Extra variables merged into the template ({{tier}}, {{expiryDate}}, …). */
    data?: Record<string, string | number>;
  },
): Promise<TemplatedEmailResult> {
  const to = (opts.to || "").trim();
  if (!to) return { sent: false, reason: "no-recipient" };

  try {
    const [settings, templates] = await Promise.all([
      getCompanySettings(),
      getEmailTemplates(),
    ]);

    const notifications = (settings?.extras?.notifications ?? {}) as Record<string, boolean>;
    const switchKey = NOTIFICATION_SWITCH[templateKey];
    if (notifications[switchKey] === false) {
      return { sent: false, reason: "notification-disabled" };
    }

    const template = templates[templateKey];
    if (!template || template.enabled === false) {
      return { sent: false, reason: "template-disabled" };
    }

    const companyName = settings?.company_name || "ZeanFit Club";
    const vars: Record<string, string | number> = {
      companyName,
      companyEmail: settings?.email || "",
      companyPhone: settings?.phone || "",
      companyAddress: settings?.address || "",
      memberName: opts.recipientName || "",
      ...(opts.data ?? {}),
    };

    const subject = renderTemplate(template.subject || "", vars);
    const body = renderTemplate(template.body || "", vars);
    const html = template.html ? renderTemplate(template.html, vars) : undefined;

    const res = await sendEmailViaResend({
      to,
      subject,
      body,
      html,
      templateKey,
      recipientName: opts.recipientName,
      fromName: companyName,
      fromEmail: settings?.email || undefined,
      silent: true,
    });

    if (!res.ok) return { sent: false, reason: "send-failed", error: res.error };
    return { sent: true };
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : String(e);
    console.warn(`[email-automation] ${templateKey} send skipped:`, error);
    return { sent: false, reason: "send-failed", error };
  }
}
