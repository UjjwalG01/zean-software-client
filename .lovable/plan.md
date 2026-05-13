# Plan — Supabase migration, Resend mail, Unlayer key, and new receipt format

This is a large change. The app currently runs on **Firebase (Firestore + Cloud Functions)**. You've asked me to switch to **Supabase** with the credentials you supplied, wire up **Resend** for outbound mail, plug in your **Unlayer** project key, and add a print-ready **fee-receipt** layout matching the uploaded sample.

I'll do it in 6 ordered steps. Nothing is destructive — Firebase code is kept behind a flag until Supabase is verified.

---

## 1. Connect the project to your Supabase backend

Add a Supabase client and the env vars you provided.

- New file `src/lib/supabase.ts` exporting a typed `createClient(...)` using `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Add `.env` entries (Vite reads `VITE_*` only — your `NEXT_PUBLIC_*` names won't work, so I'll rename them):
  - `VITE_SUPABASE_URL=https://jjshmzlwhbspaqytgulf.supabase.co`
  - `VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_zUMrTp50lpc2blGwbQufaA_SLGInNP9`
- Add a `src/lib/backend.ts` switch (`VITE_BACKEND=firebase|supabase`, default `supabase`) so existing Firestore code still compiles.
- Smoke-test: small `useEffect` in `App.tsx` that runs `supabase.from('app_users').select('count').limit(1)` and logs the response — verifies URL, key, network, RLS auth.

> Note: I cannot verify connectivity from inside this sandbox. After deploy you'll see the result in the browser console; if it fails I'll iterate.

---

## 2. Map the 13 tables to Supabase (schema migration)

Create one SQL migration that mirrors the Firestore collections you listed, plus RLS. Names use Supabase convention (snake_case):

```text
app_users           members            membership_plans   services
outlets             service_types      bookings           payments
transactions(view)  check_ins          email_templates    email_reminders
audit_logs          company_settings
```

Key points:
- `transactions` will be a **view over `payments`** (the app already uses `payments` as the canonical table; "transactions" is the UI term).
- `outlets.service_types` = `text[]`; `service_types` table seeded with the 6 defaults.
- `app_users` linked to `auth.users(id)` 1:1; roles stored in a separate `user_roles` table with an `app_role` enum + `has_role()` SECURITY DEFINER function (per platform rules — never store role on profile).
- RLS on every table. Public read on `service_types` + `company_settings`; authenticated read elsewhere; admin-only write via `has_role(auth.uid(),'admin')`.
- Indexes: `bookings(start_at)`, `payments(paid_at)`, `check_ins(check_in_at)`, `members(expiry_date)`, `audit_logs(created_at)`.

Then rewrite the data-access layer:
- `src/lib/firebase-services.ts` → `src/lib/db.ts` with the same exported function names so React Query hooks don't change.
- `src/lib/firebase-converters.ts` → `src/lib/db-types.ts` (TS types matching the SQL columns).
- `src/contexts/AuthContext.tsx` swapped to `supabase.auth` (email/password + Google).

---

## 3. Resend mail — make sending actually work

Your key `re_Jw1Sm8jp_3X6dhr3S37TZ1aNJdaQKxhaE` is a **secret** and must never sit in the frontend bundle. I'll:

- Store it as a Supabase secret (`RESEND_API_KEY`) via the secrets tool — you'll paste it into the secure form once.
- Create Edge Function `supabase/functions/send-email/index.ts` that POSTs to `https://api.resend.com/emails` server-side, with CORS, Zod validation, and writes a row to `email_reminders` for every send (status `sent` / `failed`).
- Replace `sendEmailViaResend()` in `src/lib/email-templates.ts` with `supabase.functions.invoke('send-email', { body: ... })` — no more `companySettings.resendEndpoint` field needed.
- Add a "Send test email" button on the Email Templates page.
- Default `from`: `VitaFit Club <onboarding@resend.dev>` until you verify a domain in Resend.

---

## 4. Unlayer project key

`UnlayerEditor.tsx` already reads `import.meta.env.VITE_UNLAYER_PROJECT_ID`. Unlayer expects a **numeric Project ID**, but the value you sent (`usiz5uUh45oEBVwYLglBCY4n3FX78slJayRVEMAHMrX5ufMcMPsfkPNH1oDzystT`) looks like an **API key / secret token**, not a project ID.

I'll wire it as both, so whichever role it actually plays will work:
- `VITE_UNLAYER_PROJECT_ID` — kept for the editor's `projectId` option (you can paste the numeric ID later from the Unlayer dashboard).
- `VITE_UNLAYER_API_KEY` — set to the value you provided; used only if we later add server-side template export.

I'll add a one-line note in the Email Templates UI explaining where to find the numeric Project ID (Unlayer dashboard → Project Settings).

---

## 5. New fee-receipt / billing format

Match the uploaded image: blue header band with company name, tagline, contact strip; "FEE PAYMENT RECEIPT" title; receipt no + date row; member info block; blue table header with line items; net amount; blue "Amount Paid" bar; payment method + status pill; remarks; thank-you + signature line; **company logo as a faint centered watermark behind the body**.

- New component `src/components/ReceiptA5.tsx` (A5 print size, semantic tokens only — uses your existing gold/dark theme variables, but the receipt itself is light because it prints).
- Hook into existing print flow in `src/lib/print-utils.ts` — replace the current template, keep the same `printReceipt(payment)` API so all call sites keep working.
- Watermark = `<img>` with `opacity:.06`, absolutely centered, `print-color-adjust: exact`.
- Pulls header/contact/logo from `company_settings`.

---

## 6. Cleanup & verification

- Remove `firestore.rules`, `firebase.json`, `functions/` once Supabase paths are green (kept in git history).
- Run a checklist after deploy:
  1. Sign in with email/password → AuthContext returns a session
  2. `select count(*) from app_users` returns a number
  3. Send test email from Email Templates → row appears in `email_reminders` with `status='sent'`
  4. Open a paid booking → print preview shows the new receipt with watermark
  5. Outlet picker on `/bookings` lists rows from `outlets` table

---

## Files I'll create / edit

**Create**
- `src/lib/supabase.ts`, `src/lib/db.ts`, `src/lib/db-types.ts`, `src/lib/backend.ts`
- `supabase/migrations/0001_init.sql` (all 13 tables + RLS + seed)
- `supabase/functions/send-email/index.ts`
- `src/components/ReceiptA5.tsx`
- `.env` additions

**Edit**
- `src/contexts/AuthContext.tsx`, `src/contexts/OutletContext.tsx`
- `src/lib/email-templates.ts`, `src/lib/print-utils.ts`, `src/lib/firebase-outlets.ts`
- `src/hooks/use-firestore.ts` → `use-db.ts` (re-exported alias to avoid touching every page)
- `src/pages/EmailTemplates.tsx` (test-send button + Unlayer note)
- `DATABASE.md` (Firestore → Postgres column map)

---

## Things I need from you before I start

1. **Confirm switching the live backend from Firebase to Supabase** (one-way for the running app — Firestore data won't be migrated automatically; tell me if you have data to import and I'll add a CSV import step).
2. **Confirm the Unlayer value is an API key, not a Project ID.** If you have the numeric Project ID, paste it — otherwise the editor will run in demo mode (with banner) until you add it.
3. After approval I'll trigger the secure form for `RESEND_API_KEY` — please paste the Resend key there (don't send it again in chat).

Reply "approve" (or with edits) and I'll implement steps 1-6 in order.
