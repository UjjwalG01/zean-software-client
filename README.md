# ZEAN SOFTWARE

Premium gym & spa management app — React + Vite + Tailwind, backed by **Supabase**
(database, auth, storage, edge functions) with **Resend** for transactional email
and **Unlayer** as the drag-and-drop email designer.

---

## 1. One-time Supabase setup

Do these once in your Supabase project (`...............`).

### 1.1 Create / migrate the schema

For a **fresh project** (recommended): paste `db/schema.sql` into the SQL Editor and Run.
It is the single source of truth — enums, tables, triggers (member-code auto-gen,
invoice totals, package decrement), RLS, GRANTs, storage bucket, and seeds.

For an **existing project** previously bootstrapped with the older migrations
(`0001`…`0004`), `db/schema.sql` is idempotent for most statements and safe to re-run.

### 1.1b Disable email confirmation (admin-managed signup)

In **Supabase Dashboard → Authentication → Providers → Email**, turn **OFF**
"Confirm email". Admin-created users can then log in immediately with the
email/password set on creation — no verification link required.

### 1.2 Create a public storage bucket for outlet covers (optional)

Storage → **New bucket** → name `outlets`, **public** → Save.
(If you don't create it, just paste an image URL into the outlet form.)

### 1.3 Set the Resend secret

```bash
supabase login
supabase link --project-ref xxxxxxxxxxxxxxxxxxx
supabase secrets set RESEND_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 1.4 Deploy the email Edge Function

```bash
supabase functions deploy send-email --no-verify-jwt
```

The frontend calls it through `supabase.functions.invoke('send-email', …)` from
`src/lib/email-templates.ts`. Every send is logged to `public.email_reminders`.

### 1.5 Make yourself an admin

In the SQL Editor, replace `<auth-user-id>` with your auth UID
(found under **Auth → Users**), then run:

```sql
insert into public.user_roles (user_id, role)
values ('<auth-user-id>', 'admin');
```

Without an admin row, RLS will block all writes.

---

## 2. Environment variables

`.env` already contains the working values:

| Variable                        | Purpose                                                                     |
| ------------------------------- | --------------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`             | Supabase project URL                                                        |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Public anon key                                                             |
| `VITE_SUPABASE_PROJECT_ID`      | Project ref                                                                 |
| `VITE_UNLAYER_PROJECT_ID`       | **`286809`** — removes the demo banner & saves designs against your project |
| `VITE_UNLAYER_API_KEY`          | Unlayer REST key (server-side templates / brand kit)                        |

---

## 3. Feature map → backend table

| Feature                                                                | Supabase table                    |
| ---------------------------------------------------------------------- | --------------------------------- |
| Outlets                                                                | `outlets`                         |
| Service types (Fitness, Wellness, Sports, Membership, Health, Events…) | `service_types`                   |
| Bookings (scoped per outlet)                                           | `bookings`                        |
| Members                                                                | `members`                         |
| Membership plans                                                       | `membership_plans`                |
| Services / classes                                                     | `services`                        |
| Payments / Transactions                                                | `payments` (view: `transactions`) |
| Check-ins / attendance                                                 | `check_ins`                       |
| Email templates (subject/HTML/Unlayer design JSON)                     | `email_templates`                 |
| Email send log                                                         | `email_reminders`                 |
| App users (profile metadata)                                           | `app_users`                       |
| Audit log                                                              | `audit_logs`                      |
| Roles                                                                  | `user_roles`                      |
| Company-wide settings                                                  | `company_settings`                |

---

## 4. Verifying the wiring

Open the running app — the browser console should print
`[supabase] ✓ connected`. Then:

- **Setup → Service Types** lists the 6 seeded categories. Add / edit / delete works against `service_types`.
- **Setup → Outlets → Add Outlet** persists every field (code, cost center, type, address, flags, linked service types) into `outlets`.
- **Bookings** shows the **Outlet Picker** as a popup; selecting an outlet scopes all booking CRUD to that `outlet_id`.
- **Email Templates** loads/saves from `email_templates`. The **Send test email** button calls the `send-email` Edge Function which uses Resend; the send is logged to `email_reminders`.
- The **Unlayer** editor saves both the rendered `html` and the `design` JSON, so editing is round-trippable.
