-- =============================================================================
-- VitaFit Club — Supabase CRUD unblock + schema compatibility
-- Run after 0001_init.sql and 0002_outlet_fields.sql.
-- =============================================================================

alter table public.app_users
  add column if not exists extras jsonb not null default '{}'::jsonb;

alter table public.members
  add column if not exists avatar_url text,
  add column if not exists address text,
  add column if not exists emergency_contact text,
  add column if not exists plan text,
  add column if not exists services text[] not null default '{}',
  add column if not exists opening_balance numeric not null default 0,
  add column if not exists total_paid numeric not null default 0,
  add column if not exists due_amount numeric not null default 0,
  add column if not exists membership_years integer not null default 0,
  add column if not exists discount numeric not null default 0,
  add column if not exists auto_renew boolean not null default false;

alter table public.services
  add column if not exists capacity integer,
  add column if not exists instructor text;

alter table public.membership_plans
  add column if not exists yearly_price numeric not null default 0,
  add column if not exists long_term_price numeric not null default 0,
  add column if not exists includes text,
  add column if not exists auto_renew boolean not null default false,
  add column if not exists membership_type_id text;

alter table public.bookings
  add column if not exists service_type text,
  add column if not exists class_name text,
  add column if not exists instructor text;

alter table public.check_ins
  add column if not exists created_at timestamptz not null default now();

alter table public.email_templates
  add column if not exists category text,
  add column if not exists trigger_type text,
  add column if not exists variables text[] not null default '{}';

create or replace function public.has_any_role(_user_id uuid, _roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = any(_roles)
  )
$$;

-- Allow authenticated app users to operate the UI tables. Admin policy from 0001 remains stricter for user_roles.
do $$
declare t text;
begin
  for t in select unnest(array[
    'app_users','company_settings','service_types','outlets','membership_plans','services',
    'members','bookings','payments','check_ins','email_templates','email_reminders','audit_logs'
  ]) loop
    execute format('drop policy if exists "auth crud %1$s" on public.%1$s;', t);
    execute format('create policy "auth crud %1$s" on public.%1$s for all to authenticated using (true) with check (true);', t);
  end loop;
end $$;

-- If your current login exists in auth.users but not app_users, this lets the app create its profile row.
drop policy if exists "users can insert own app profile" on public.app_users;
create policy "users can insert own app profile"
  on public.app_users for insert to authenticated
  with check (id = auth.uid());

-- Keep seeded service types present.
insert into public.service_types (name, slug, color, icon) values
  ('Fitness',    'fitness',    '#f5b300', 'Dumbbell'),
  ('Wellness',   'wellness',   '#22c1c3', 'Sparkles'),
  ('Sports',     'sports',     '#ef4444', 'Trophy'),
  ('Membership', 'membership', '#8b5cf6', 'IdCard'),
  ('Health',     'health',     '#10b981', 'HeartPulse'),
  ('Events',     'events',     '#f97316', 'CalendarDays')
on conflict (slug) do nothing;

notify pgrst, 'reload schema';
