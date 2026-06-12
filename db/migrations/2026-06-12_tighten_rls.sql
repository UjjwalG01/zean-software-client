-- =============================================================================
-- 2026-06-12 — Tighten RLS policies on operational tables
-- Replaces blanket `USING (true) WITH CHECK (true)` with role-scoped policies
-- so non-staff authenticated users (e.g. member-role accounts) cannot read
-- or modify sensitive PII / financial / employee / audit data.
-- =============================================================================

-- Convenience helper: any staff role
create or replace function public.is_staff(_uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _uid and role in ('admin','manager','staff')
  );
$$;

-- ─── Tighten operational tables ──────────────────────────────────────────────
do $$
declare t text;
begin
  for t in select unnest(array[
    'app_users','members','member_outlet_access','member_packages',
    'employees','bookings','invoices','invoice_items','payments',
    'check_ins','email_templates','email_reminders','audit_logs',
    'membership_plans','services','charges','attendance'
  ]) loop
    -- Drop old permissive policies (multiple historical names)
    execute format('drop policy if exists "auth crud %1$s" on public.%1$s;', t);
    execute format('drop policy if exists %1$s_write on public.%1$s;', t);
    execute format('drop policy if exists %1$s_select on public.%1$s;', t);
    execute format('drop policy if exists attendance_select on public.%1$s;', t);
    execute format('drop policy if exists attendance_write on public.%1$s;', t);
    execute format('drop policy if exists audit_select on public.%1$s;', t);
    execute format('drop policy if exists audit_insert on public.%1$s;', t);
    execute format('drop policy if exists charges_select on public.%1$s;', t);
    execute format('drop policy if exists charges_write on public.%1$s;', t);

    -- Staff-only read/write
    execute format(
      'create policy "%1$s staff read" on public.%1$s for select to authenticated using (public.is_staff(auth.uid()));',
      t
    );
    execute format(
      'create policy "%1$s staff write" on public.%1$s for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));',
      t
    );
  end loop;
end $$;

-- Audit logs: append-only for staff (no UPDATE/DELETE except service_role)
drop policy if exists "audit_logs staff write" on public.audit_logs;
create policy "audit_logs staff insert" on public.audit_logs
  for insert to authenticated with check (public.is_staff(auth.uid()));

-- Outlets / service_types / modules — keep readable to all authenticated users
-- (needed for navigation/UI) but writes restricted to staff.
do $$
declare t text;
begin
  for t in select unnest(array['outlets','service_types','modules']) loop
    execute format('drop policy if exists "auth crud %1$s" on public.%1$s;', t);
    execute format('drop policy if exists %1$s_write on public.%1$s;', t);
    execute format('drop policy if exists %1$s_select on public.%1$s;', t);

    execute format(
      'create policy "%1$s auth read" on public.%1$s for select to authenticated using (true);',
      t
    );
    execute format(
      'create policy "%1$s staff write" on public.%1$s for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));',
      t
    );
  end loop;
end $$;

-- company_settings: readable to all authenticated; admin-only writes
drop policy if exists "auth update company_settings" on public.company_settings;
create policy "company_settings auth read" on public.company_settings
  for select to authenticated using (true);
create policy "company_settings admin write" on public.company_settings
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));
