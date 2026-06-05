// Supabase Edge Function: send-email
// Sends transactional email via Resend and logs every send to the
// `email_reminders` table. Requires the RESEND_API_KEY secret.
//
// Deploy:  supabase functions deploy send-email --no-verify-jwt
// Secret:  supabase secrets set RESEND_API_KEY=re_...

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface SendBody {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  templateKey?: string;
  recipientName?: string;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY is not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: SendBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { to, subject, html, text, from, templateKey, recipientName } = body;
  if (!to || !subject || (!html && !text)) {
    return new Response(JSON.stringify({ error: "to, subject, and html|text are required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const renderedHtml =
    html ??
    (text ?? "")
      .split("\n")
      .map((l) => (l.length === 0 ? "<br/>" : `<p style="margin:0 0 8px">${escapeHtml(l)}</p>`))
      .join("");

  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!,
  );

  let status: "sent" | "failed" = "sent";
  let errorMessage: string | undefined;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: from || "ZeanFit Club <onboarding@resend.dev>",
        to: [to],
        subject,
        html: renderedHtml,
        text,
      }),
    });
    if (!res.ok) {
      status = "failed";
      errorMessage = await res.text().catch(() => res.statusText);
    }
  } catch (e: any) {
    status = "failed";
    errorMessage = e?.message || String(e);
  }

  // Log (best-effort — never block the response)
  await supa
    .from("email_reminders")
    .insert({
      recipient_email: to,
      recipient_name: recipientName ?? null,
      template_key: templateKey ?? null,
      subject,
      body: text ?? renderedHtml,
      channel: "resend",
      status,
      error_message: errorMessage ?? null,
    })
    .then(
      () => {},
      () => {},
    );

  return new Response(JSON.stringify({ ok: status === "sent", status, error: errorMessage }), {
    status: status === "sent" ? 200 : 502,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
