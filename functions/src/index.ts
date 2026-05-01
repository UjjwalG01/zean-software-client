/**
 * VitaFit Club — Firebase Cloud Functions
 *
 * 1) sendEmail        — HTTP POST endpoint that proxies to Resend through
 *                       the Lovable connector gateway. Configure
 *                       companySettings.resendEndpoint to this function URL.
 * 2) scheduledReminders — Runs every day at 08:00 (Asia/Kathmandu).
 *                       Scans members for upcoming expiry / dues and writes
 *                       documents to the `emailReminders` collection so the
 *                       sendEmail function (or another worker) can pick them up.
 *
 * Required runtime config / secrets (set with `firebase functions:secrets:set`):
 *   - LOVABLE_API_KEY          (issued by Lovable Cloud)
 *   - RESEND_API_KEY           (Resend connection key from connector gateway)
 *   - REMINDER_FROM_EMAIL      (verified sender, e.g. "VitaFit <noreply@vitafitclub.com>")
 */

import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

const LOVABLE_API_KEY = defineSecret("LOVABLE_API_KEY");
const RESEND_API_KEY = defineSecret("RESEND_API_KEY");
const REMINDER_FROM_EMAIL = defineSecret("REMINDER_FROM_EMAIL");

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ─── HTTP: sendEmail ────────────────────────────────────────────────
export const sendEmail = onRequest(
  { secrets: [LOVABLE_API_KEY, RESEND_API_KEY, REMINDER_FROM_EMAIL], cors: true },
  async (req, res) => {
    if (req.method === "OPTIONS") { res.set(corsHeaders).status(204).send(""); return; }
    if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

    const { to, subject, html, text, from } = req.body || {};
    if (!to || !subject || (!html && !text)) {
      res.status(400).json({ error: "Missing required fields: to, subject, html|text" });
      return;
    }

    try {
      const r = await fetch(`${GATEWAY_URL}/emails`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${LOVABLE_API_KEY.value()}`,
          "X-Connection-Api-Key": RESEND_API_KEY.value(),
        },
        body: JSON.stringify({
          from: from || REMINDER_FROM_EMAIL.value(),
          to: Array.isArray(to) ? to : [to],
          subject,
          html,
          text,
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        logger.error("Resend gateway failed", { status: r.status, data });
        res.status(r.status).set(corsHeaders).json({ error: data });
        return;
      }
      // Log delivery
      await db.collection("emailReminders").add({
        to, subject, channel: "email", status: "sent",
        providerId: (data as any)?.id || null,
        sentAt: admin.firestore.Timestamp.now(),
      });
      res.set(corsHeaders).status(200).json({ success: true, id: (data as any)?.id });
    } catch (err: any) {
      logger.error("sendEmail error", err);
      res.status(500).set(corsHeaders).json({ error: err?.message || "Unknown error" });
    }
  }
);

// ─── Scheduled: daily reminder scan ─────────────────────────────────
// Runs every day at 08:00 Asia/Kathmandu.
export const scheduledReminders = onSchedule(
  { schedule: "0 8 * * *", timeZone: "Asia/Kathmandu" },
  async () => {
    const now = new Date();
    const in7days = new Date(now.getTime() + 7 * 86400000);

    const membersSnap = await db.collection("members").where("status", "==", "Active").get();
    let queued = 0;

    for (const doc of membersSnap.docs) {
      const m = doc.data();
      if (!m.email) continue;

      // Expiry within 7 days
      const expiry = m.expiryDate?.toDate ? m.expiryDate.toDate() : (m.expiryDate ? new Date(m.expiryDate) : null);
      if (expiry && expiry >= now && expiry <= in7days) {
        await db.collection("emailReminders").add({
          memberId: doc.id,
          to: m.email,
          subject: "Your VitaFit Club membership is expiring soon",
          templateKey: "membership_expiry",
          status: "queued",
          channel: "email",
          createdAt: admin.firestore.Timestamp.now(),
          dueDate: expiry,
        });
        queued++;
      }

      // Outstanding dues
      if ((m.dueAmount || 0) > 0) {
        await db.collection("emailReminders").add({
          memberId: doc.id,
          to: m.email,
          subject: "Outstanding balance on your VitaFit Club account",
          templateKey: "payment_due",
          status: "queued",
          channel: "email",
          dueAmount: m.dueAmount,
          createdAt: admin.firestore.Timestamp.now(),
        });
        queued++;
      }
    }

    logger.info(`scheduledReminders queued ${queued} reminders`);
  }
);
