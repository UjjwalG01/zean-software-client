# Supabase Setup — ZEAN SOFTWARE

This project's frontend is now wired to your Supabase project
**`jjshmzlwhbspaqytgulf`** via `src/lib/supabase.ts` (env vars in `.env`).

## 1. Create the schema

Open the **Supabase Dashboard → SQL Editor → New query**, paste the
contents of [`db/0001_init.sql`](../db/0001_init.sql), and Run.

This creates 13 tables + a `transactions` view + RLS policies + the
`has_role()` security-definer function + 6 default service types.

## 2. Set the Resend secret

```bash
supabase login
supabase link --project-ref jjshmzlwhbspaqytgulf
supabase secrets set RESEND_API_KEY=re_<your-key>
```

## 3. Deploy the email Edge Function

```bash
supabase functions deploy send-email --no-verify-jwt
```

The frontend calls it via `supabase.functions.invoke('send-email', ...)`
from `src/lib/email-templates.ts`. Every send is logged in
`public.email_reminders`.

## 4. Verify connectivity

Open the app preview and check the browser console — you should see
`[supabase] ✓ connected`. If you see `✗ failed`, re-check the URL/key
in `.env` and that step 1 has been run.

## 5. Make yourself an admin

In the SQL Editor:

```sql
insert into public.user_roles (user_id, role)
values ('<your-auth-user-id>', 'admin');
```

You can find your auth user id under **Auth → Users**.

---

**Note:** the legacy Firebase code in `src/lib/firebase-*.ts` is still in
the project as a fallback. The data-access layer rewrite (Firestore →
Supabase queries) is the next step — this PR ships the schema, the email
pipeline, the connection, the new receipt format, and the Unlayer key
plumbing.
