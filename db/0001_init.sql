-- =============================================================================
-- VitaFit Club — Initial schema (Postgres / Supabase)
-- Run this in the Supabase SQL Editor of project jjshmzlwhbspaqytgulf
-- (Dashboard → SQL Editor → New query → paste → Run).
-- =============================================================================

-- Roles
do $$ begin
  create type public.app_role as enum ('admin', 'manager', 'staff', 'member');
exception when duplicate_object then null; end $$;

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role);
$$;

-- Core tables
create table if not exists public.app_users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  display_name text,
  phone text,
  avatar_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.company_settings (
  id text primary key default 'main',
  company_name text not null default 'VitaFit Club',
  tagline text,
  address text,
  phone text,
  email text,
  logo_url text,
  vat_no text,
  currency text not null default 'NPR',
  vat_rate numeric not null default 13,
  max_outlets text not null default 'unlimited',
  resend_endpoint text,
  discount_rules jsonb not null default '[]'::jsonb,
  extras jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.service_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  icon text,
  color text,
  default_image text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.outlets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  service_types text[] not null default '{}',
  image_url text,
  color text,
  address text,
  phone text,
  email text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create table if not exists public.membership_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tier text,
  duration_days integer not null,
  price numeric not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  service_type text,
  price numeric not null default 0,
  duration_min integer,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text,
  phone text,
  tier text,
  plan_id uuid references public.membership_plans(id) on delete set null,
  status text not null default 'active',
  join_date timestamptz not null default now(),
  expiry_date timestamptz,
  outlet_id uuid references public.outlets(id) on delete set null,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists members_status_idx on public.members(status);
create index if not exists members_expiry_idx on public.members(expiry_date);
create index if not exists members_tier_idx   on public.members(tier);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.members(id) on delete set null,
  member_name text,
  service_id uuid references public.services(id) on delete set null,
  service_name text,
  outlet_id uuid references public.outlets(id) on delete set null,
  start_at timestamptz not null,
  end_at timestamptz,
  status text not null default 'confirmed',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);
create index if not exists bookings_start_idx        on public.bookings(start_at);
create index if not exists bookings_member_start_idx on public.bookings(member_id, start_at);
create index if not exists bookings_status_idx       on public.bookings(status);
create index if not exists bookings_outlet_idx       on public.bookings(outlet_id);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  receipt_no text not null unique,
  member_id uuid references public.members(id) on delete set null,
  member_name text,
  outlet_id uuid references public.outlets(id) on delete set null,
  service_type text,
  description text,
  amount numeric not null,
  vat_amount numeric not null default 0,
  total numeric not null,
  method text not null default 'cash',
  status text not null default 'paid',
  paid_at timestamptz not null default now(),
  remarks text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);
create index if not exists payments_paid_idx        on public.payments(paid_at);
create index if not exists payments_method_idx      on public.payments(method);
create index if not exists payments_member_paid_idx on public.payments(member_id, paid_at);

-- "Transactions" is a UI synonym for payments
create or replace view public.transactions as select * from public.payments;

create table if not exists public.check_ins (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.members(id) on delete cascade,
  member_name text,
  outlet_id uuid references public.outlets(id) on delete set null,
  check_in_at timestamptz not null default now(),
  check_out_at timestamptz,
  notes text
);
create index if not exists checkins_at_idx        on public.check_ins(check_in_at);
create index if not exists checkins_member_at_idx on public.check_ins(member_id, check_in_at);

create table if not exists public.email_templates (
  key text primary key,
  subject text not null,
  body text not null,
  html text,
  design jsonb,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.email_reminders (
  id uuid primary key default gen_random_uuid(),
  recipient_email text not null,
  recipient_name text,
  template_key text,
  subject text,
  body text,
  channel text not null default 'resend',
  status text not null default 'sent',
  error_message text,
  sent_at timestamptz not null default now()
);
create index if not exists reminders_sent_idx on public.email_reminders(sent_at);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  actor_email text,
  action text not null,
  entity_type text not null,
  entity_id text,
  diff jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_created_idx on public.audit_logs(created_at);
create index if not exists audit_entity_idx  on public.audit_logs(entity_type, entity_id);
create index if not exists audit_actor_idx   on public.audit_logs(actor_id);

-- RLS
alter table public.app_users        enable row level security;
alter table public.company_settings enable row level security;
alter table public.service_types    enable row level security;
alter table public.outlets          enable row level security;
alter table public.membership_plans enable row level security;
alter table public.services         enable row level security;
alter table public.members          enable row level security;
alter table public.bookings         enable row level security;
alter table public.payments         enable row level security;
alter table public.check_ins        enable row level security;
alter table public.email_templates  enable row level security;
alter table public.email_reminders  enable row level security;
alter table public.audit_logs       enable row level security;

-- Public reads
drop policy if exists "public read service_types"    on public.service_types;
create policy "public read service_types"    on public.service_types    for select using (true);
drop policy if exists "public read company_settings" on public.company_settings;
create policy "public read company_settings" on public.company_settings for select using (true);

-- Authenticated reads
do $$
declare t text;
begin
  for t in select unnest(array[
    'app_users','outlets','membership_plans','services','members','bookings',
    'payments','check_ins','email_templates','email_reminders','audit_logs','user_roles'
  ]) loop
    execute format('drop policy if exists "auth read %1$s" on public.%1$s;', t);
    execute format('create policy "auth read %1$s" on public.%1$s for select to authenticated using (true);', t);
  end loop;
end $$;

-- Admin writes everywhere
do $$
declare t text;
begin
  for t in select unnest(array[
    'app_users','company_settings','service_types','outlets','membership_plans','services',
    'members','bookings','payments','check_ins','email_templates','email_reminders','audit_logs','user_roles'
  ]) loop
    execute format('drop policy if exists "admin write %1$s" on public.%1$s;', t);
    execute format($f$create policy "admin write %1$s" on public.%1$s for all to authenticated
      using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));$f$, t);
  end loop;
end $$;

-- Authenticated users can insert audit/reminder rows (telemetry)
drop policy if exists "auth insert audit"     on public.audit_logs;
create policy "auth insert audit"     on public.audit_logs      for insert to authenticated with check (true);
drop policy if exists "auth insert reminders" on public.email_reminders;
create policy "auth insert reminders" on public.email_reminders for insert to authenticated with check (true);

-- Seed
insert into public.service_types (name, slug, color, icon) values
  ('Fitness',    'fitness',    '#f5b300', 'Dumbbell'),
  ('Wellness',   'wellness',   '#22c1c3', 'Sparkles'),
  ('Sports',     'sports',     '#ef4444', 'Trophy'),
  ('Membership', 'membership', '#8b5cf6', 'IdCard'),
  ('Health',     'health',     '#10b981', 'HeartPulse'),
  ('Events',     'events',     '#f97316', 'CalendarDays')
on conflict (slug) do nothing;

insert into public.company_settings (id, company_name)
values ('main', 'VitaFit Club') on conflict (id) do nothing;
