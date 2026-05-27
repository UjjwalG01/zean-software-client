-- =============================================================================
-- VitaFit Club — Consolidated Supabase schema (single source of truth)
-- Drop-in for a fresh Supabase project. Idempotent where safe.
-- Replaces db/0001_init.sql .. db/0004_member_grc.sql for new installs.
--
-- HOW TO APPLY:
--   1) Open Supabase Dashboard → SQL Editor → New query
--   2) Paste this entire file → Run
--   3) Insert your admin role:
--        insert into public.user_roles(user_id, role)
--        values ('<your-auth-user-id>', 'admin');
--   4) Auth → Providers → disable "Confirm email" (admin-managed signup)
-- =============================================================================

-- ─── EXTENSIONS ──────────────────────────────────────────────────────────────
create extension if not exists pgcrypto;

-- ─── ENUMS ───────────────────────────────────────────────────────────────────
do $$ begin create type public.app_role        as enum ('admin','manager','staff','member'); exception when duplicate_object then null; end $$;
do $$ begin create type public.member_status   as enum ('active','expired','expiring','inactive'); exception when duplicate_object then null; end $$;
do $$ begin create type public.booking_status  as enum ('pending','confirmed','completed','cancelled','no_show'); exception when duplicate_object then null; end $$;
do $$ begin create type public.invoice_status  as enum ('draft','issued','partial','paid','void'); exception when duplicate_object then null; end $$;
do $$ begin create type public.payment_status  as enum ('pending','paid','failed','refunded'); exception when duplicate_object then null; end $$;
do $$ begin create type public.payment_method  as enum ('cash','card','esewa','bank_transfer','mobile_wallet'); exception when duplicate_object then null; end $$;
do $$ begin create type public.gender_enum     as enum ('male','female','other'); exception when duplicate_object then null; end $$;
do $$ begin create type public.marital_enum    as enum ('single','married','widowed','divorced'); exception when duplicate_object then null; end $$;
do $$ begin create type public.blood_group     as enum ('A+','A-','B+','B-','O+','O-','AB+','AB-'); exception when duplicate_object then null; end $$;

-- ─── SHARED HELPERS ──────────────────────────────────────────────────────────
create or replace function public.tg_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ─── ROLES ───────────────────────────────────────────────────────────────────
create table if not exists public.user_roles (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role);
$$;

create or replace function public.has_any_role(_user_id uuid, _roles public.app_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = any(_roles));
$$;

-- ─── APP USERS ───────────────────────────────────────────────────────────────
create table if not exists public.app_users (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text unique not null,
  display_name text,
  phone        text,
  avatar_url   text,
  active       boolean not null default true,
  extras       jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
drop trigger if exists tg_app_users_touch on public.app_users;
create trigger tg_app_users_touch before update on public.app_users
for each row execute function public.tg_touch_updated_at();

-- ─── COMPANY SETTINGS (singleton) ────────────────────────────────────────────
create table if not exists public.company_settings (
  id             text primary key default 'main',
  company_name   text not null default 'VitaFit Club',
  tagline        text,
  address        text,
  phone          text,
  email          text,
  logo_url       text,
  vat_no         text,
  currency       text not null default 'NPR',
  vat_rate       numeric not null default 13,
  max_outlets    text not null default 'unlimited',
  resend_endpoint text,
  discount_rules jsonb not null default '[]'::jsonb,
  extras         jsonb not null default '{}'::jsonb,
  updated_at     timestamptz not null default now()
);
drop trigger if exists tg_company_settings_touch on public.company_settings;
create trigger tg_company_settings_touch before update on public.company_settings
for each row execute function public.tg_touch_updated_at();

-- ─── SERVICE TYPES & OUTLETS ─────────────────────────────────────────────────
create table if not exists public.service_types (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text not null unique,
  icon          text,
  color         text,
  default_image text,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

create table if not exists public.outlets (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  description     text,
  service_types   text[] not null default '{}',
  image_url       text,
  color           text,
  address         text,
  phone           text,
  email           text,
  outlet_code     text,
  cost_center     text,
  outlet_type     text,
  effective_from  date,
  country         text,
  state           text,
  city            text,
  street          text,
  zip             text,
  tel1            text,
  tel2            text,
  mobile          text,
  website         text,
  show_room_guest         boolean not null default true,
  real_time_sales         boolean not null default false,
  enable_membership       boolean not null default false,
  allow_bill_date_change  boolean not null default false,
  is_ticketing            boolean not null default false,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id) on delete set null
);
create unique index if not exists outlets_code_unique
  on public.outlets (lower(outlet_code))
  where outlet_code is not null and length(trim(outlet_code)) > 0;
drop trigger if exists tg_outlets_touch on public.outlets;
create trigger tg_outlets_touch before update on public.outlets
for each row execute function public.tg_touch_updated_at();

-- ─── MEMBERSHIP PLANS & SERVICES ─────────────────────────────────────────────
create table if not exists public.membership_plans (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  tier                text,
  duration_days       integer not null,
  price               numeric not null,
  yearly_price        numeric not null default 0,
  long_term_price     numeric not null default 0,
  includes            text,
  auto_renew          boolean not null default false,
  membership_type_id  text,
  description         text,
  active              boolean not null default true,
  created_at          timestamptz not null default now()
);

create table if not exists public.services (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  service_type text,
  price        numeric not null default 0,
  duration_min integer,
  capacity     integer,
  instructor   text,
  description  text,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

-- ─── MEMBERS ─────────────────────────────────────────────────────────────────
-- member_code: M + YY + 5-digit-seq (e.g. M2600001). Auto-generated via trigger.
create sequence if not exists public.member_code_seq;

create table if not exists public.members (
  id                  uuid primary key default gen_random_uuid(),
  member_code         text unique,
  full_name           text not null,
  email               text,
  phone               text,
  avatar_url          text,
  dob                 date,
  gender              public.gender_enum,
  nationality         text,
  religion            text,
  marital_status      public.marital_enum,
  occupation          text,
  -- structured JSONB blobs (per spec)
  address             jsonb not null default '{"permanent":"","temporary":""}'::jsonb,
  emergency_contact   jsonb not null default '{"name":"","phone":"","address":""}'::jsonb,
  physical            jsonb not null default '{"height":"","weight":"","chest":"","blood_group":""}'::jsonb,
  medical             jsonb not null default '{"heart_stroke":false,"breathing_difficulty":false,"skin_disease":false}'::jsonb,
  member_preferences  text[] not null default '{}',
  office_name         text,
  office_address      text,
  contact_alt         text,
  -- membership status
  tier                text default 'Basic',
  plan_id             uuid references public.membership_plans(id) on delete set null,
  status              public.member_status not null default 'active',
  join_date           timestamptz not null default now(),
  expiry_date         timestamptz,
  outlet_id           uuid references public.outlets(id) on delete set null,
  -- legacy compatibility (kept for current UI; new fields above are canonical)
  grc_no              text,
  preferences         jsonb not null default '{}'::jsonb,
  extras              jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists members_status_idx  on public.members(status);
create index if not exists members_expiry_idx  on public.members(expiry_date);
create index if not exists members_tier_idx    on public.members(tier);
create index if not exists members_outlet_idx  on public.members(outlet_id);
create index if not exists members_phone_idx   on public.members(phone);
drop trigger if exists tg_members_touch on public.members;
create trigger tg_members_touch before update on public.members
for each row execute function public.tg_touch_updated_at();

-- Member code auto-gen: M + YY + 5-digit zero-padded sequence
create or replace function public.tg_member_code_assign()
returns trigger language plpgsql as $$
declare
  yy text := to_char(now(), 'YY');
  seq text;
begin
  if new.member_code is null or length(trim(new.member_code)) = 0 then
    seq := lpad(nextval('public.member_code_seq')::text, 5, '0');
    new.member_code := 'M' || yy || seq;
  end if;
  return new;
end $$;
drop trigger if exists tg_members_member_code on public.members;
create trigger tg_members_member_code before insert on public.members
for each row execute function public.tg_member_code_assign();

-- ─── MULTI-OUTLET ACCESS ─────────────────────────────────────────────────────
create table if not exists public.member_outlet_access (
  member_id    uuid not null references public.members(id) on delete cascade,
  outlet_id    uuid not null references public.outlets(id) on delete cascade,
  first_visit  timestamptz not null default now(),
  last_visit   timestamptz not null default now(),
  visit_count  integer not null default 1,
  primary key (member_id, outlet_id)
);

-- ─── MEMBER PACKAGES (selected after registration) ───────────────────────────
create table if not exists public.member_packages (
  id                  uuid primary key default gen_random_uuid(),
  member_id           uuid not null references public.members(id) on delete cascade,
  outlet_id           uuid references public.outlets(id) on delete set null,
  plan_id             uuid references public.membership_plans(id) on delete set null,
  service_id          uuid references public.services(id) on delete set null,
  package_name        text,
  total_sessions      integer,
  remaining_sessions  integer,
  starts_on           date not null default current_date,
  expires_on          date,
  price               numeric not null default 0,
  active              boolean not null default true,
  notes               text,
  created_at          timestamptz not null default now()
);
create index if not exists member_packages_member_idx on public.member_packages(member_id);
create index if not exists member_packages_outlet_idx on public.member_packages(outlet_id);

-- ─── EMPLOYEES (trainers/therapists) ─────────────────────────────────────────
create table if not exists public.employees (
  id         uuid primary key default gen_random_uuid(),
  full_name  text not null,
  role       text,
  email      text,
  phone      text,
  outlet_id  uuid references public.outlets(id) on delete set null,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- ─── BOOKINGS ────────────────────────────────────────────────────────────────
create table if not exists public.bookings (
  id              uuid primary key default gen_random_uuid(),
  member_id       uuid references public.members(id) on delete set null,
  member_name     text,
  service_id      uuid references public.services(id) on delete set null,
  service_name    text,
  service_type    text,
  class_name      text,
  instructor      text,
  employee_id     uuid references public.employees(id) on delete set null,
  member_package_id uuid references public.member_packages(id) on delete set null,
  outlet_id       uuid references public.outlets(id) on delete set null,
  start_at        timestamptz not null,
  end_at          timestamptz,
  status          public.booking_status not null default 'pending',
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id) on delete set null
);
create index if not exists bookings_start_idx        on public.bookings(start_at);
create index if not exists bookings_member_start_idx on public.bookings(member_id, start_at);
create index if not exists bookings_status_idx       on public.bookings(status);
create index if not exists bookings_outlet_idx       on public.bookings(outlet_id);
drop trigger if exists tg_bookings_touch on public.bookings;
create trigger tg_bookings_touch before update on public.bookings
for each row execute function public.tg_touch_updated_at();

-- Trigger: maintain member_outlet_access on booking insert
create or replace function public.tg_booking_outlet_access()
returns trigger language plpgsql as $$
begin
  if new.member_id is not null and new.outlet_id is not null then
    insert into public.member_outlet_access(member_id, outlet_id, first_visit, last_visit, visit_count)
    values (new.member_id, new.outlet_id, new.start_at, new.start_at, 1)
    on conflict (member_id, outlet_id)
    do update set last_visit = greatest(public.member_outlet_access.last_visit, excluded.last_visit),
                  visit_count = public.member_outlet_access.visit_count + 1;
  end if;
  return new;
end $$;
drop trigger if exists tg_bookings_outlet_access on public.bookings;
create trigger tg_bookings_outlet_access after insert on public.bookings
for each row execute function public.tg_booking_outlet_access();

-- Trigger: decrement member_packages.remaining_sessions on booking completion
create or replace function public.tg_booking_decrement_package()
returns trigger language plpgsql as $$
begin
  if new.status = 'completed' and (old.status is distinct from 'completed') and new.member_package_id is not null then
    update public.member_packages
       set remaining_sessions = greatest(coalesce(remaining_sessions,0) - 1, 0)
     where id = new.member_package_id;
  end if;
  return new;
end $$;
drop trigger if exists tg_bookings_decrement_package on public.bookings;
create trigger tg_bookings_decrement_package after update on public.bookings
for each row execute function public.tg_booking_decrement_package();

-- ─── INVOICES & ITEMS ────────────────────────────────────────────────────────
create table if not exists public.invoices (
  id            uuid primary key default gen_random_uuid(),
  invoice_no    text unique,
  member_id     uuid references public.members(id) on delete set null,
  member_name   text,
  outlet_id     uuid references public.outlets(id) on delete set null,
  booking_id    uuid references public.bookings(id) on delete set null, -- nullable for walk-ins
  subtotal      numeric not null default 0,
  discount      numeric not null default 0,
  vat_amount    numeric not null default 0,
  total         numeric not null default 0,
  amount_paid   numeric not null default 0,
  status        public.invoice_status not null default 'draft',
  issued_at     timestamptz,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id) on delete set null
);
drop trigger if exists tg_invoices_touch on public.invoices;
create trigger tg_invoices_touch before update on public.invoices
for each row execute function public.tg_touch_updated_at();

create table if not exists public.invoice_items (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references public.invoices(id) on delete cascade,
  service_id  uuid references public.services(id) on delete set null,
  member_package_id uuid references public.member_packages(id) on delete set null,
  description text not null,
  qty         integer not null default 1,
  unit_price  numeric not null default 0,
  discount    numeric not null default 0,
  tax         numeric not null default 0,
  line_total  numeric not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists invoice_items_invoice_idx on public.invoice_items(invoice_id);

-- Recompute invoice totals when items change
create or replace function public.tg_recompute_invoice_totals()
returns trigger language plpgsql as $$
declare
  inv uuid := coalesce(new.invoice_id, old.invoice_id);
  s numeric; d numeric; t numeric;
begin
  select coalesce(sum(unit_price*qty),0),
         coalesce(sum(discount),0),
         coalesce(sum(tax),0)
    into s, d, t
    from public.invoice_items where invoice_id = inv;
  update public.invoices
     set subtotal = s,
         discount = d,
         vat_amount = t,
         total = s - d + t
   where id = inv;
  return null;
end $$;
drop trigger if exists tg_invoice_items_totals on public.invoice_items;
create trigger tg_invoice_items_totals after insert or update or delete on public.invoice_items
for each row execute function public.tg_recompute_invoice_totals();

-- ─── PAYMENTS ────────────────────────────────────────────────────────────────
create table if not exists public.payments (
  id           uuid primary key default gen_random_uuid(),
  receipt_no   text not null unique,
  invoice_id   uuid references public.invoices(id) on delete set null,
  member_id    uuid references public.members(id) on delete set null,
  member_name  text,
  outlet_id    uuid references public.outlets(id) on delete set null,
  service_type text,
  description  text,
  amount       numeric not null,
  vat_amount   numeric not null default 0,
  total        numeric not null,
  method       public.payment_method not null default 'cash',
  status       public.payment_status not null default 'paid',
  paid_at      timestamptz not null default now(),
  remarks      text,
  meta         jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  created_by   uuid references auth.users(id) on delete set null
);
create index if not exists payments_paid_idx        on public.payments(paid_at);
create index if not exists payments_method_idx      on public.payments(method);
create index if not exists payments_member_paid_idx on public.payments(member_id, paid_at);
create index if not exists payments_invoice_idx     on public.payments(invoice_id);

-- Trigger: payments roll up to invoice.amount_paid / status
create or replace function public.tg_payment_update_invoice_status()
returns trigger language plpgsql as $$
declare
  inv uuid := coalesce(new.invoice_id, old.invoice_id);
  paid numeric;
  total numeric;
begin
  if inv is null then return null; end if;
  select coalesce(sum(total),0) into paid from public.payments where invoice_id = inv and status = 'paid';
  select i.total into total from public.invoices i where i.id = inv;
  update public.invoices
     set amount_paid = paid,
         status = case
           when paid >= total and total > 0 then 'paid'::public.invoice_status
           when paid > 0 then 'partial'::public.invoice_status
           else status end
   where id = inv;
  return null;
end $$;
drop trigger if exists tg_payments_invoice_status on public.payments;
create trigger tg_payments_invoice_status after insert or update or delete on public.payments
for each row execute function public.tg_payment_update_invoice_status();

-- Transactions view (UI synonym)
create or replace view public.transactions as select * from public.payments;

-- ─── CHECK-INS ───────────────────────────────────────────────────────────────
create table if not exists public.check_ins (
  id            uuid primary key default gen_random_uuid(),
  member_id     uuid references public.members(id) on delete cascade,
  member_name   text,
  outlet_id     uuid references public.outlets(id) on delete set null,
  check_in_at   timestamptz not null default now(),
  check_out_at  timestamptz,
  notes         text,
  created_at    timestamptz not null default now()
);
create index if not exists checkins_at_idx        on public.check_ins(check_in_at);
create index if not exists checkins_member_at_idx on public.check_ins(member_id, check_in_at);

-- ─── EMAIL TEMPLATES & LOG ───────────────────────────────────────────────────
create table if not exists public.email_templates (
  key           text primary key,
  subject       text not null,
  body          text not null,
  html          text,
  design        jsonb,
  category      text,
  trigger_type  text,
  variables     text[] not null default '{}',
  enabled       boolean not null default true,
  updated_at    timestamptz not null default now()
);
drop trigger if exists tg_email_templates_touch on public.email_templates;
create trigger tg_email_templates_touch before update on public.email_templates
for each row execute function public.tg_touch_updated_at();

create table if not exists public.email_reminders (
  id              uuid primary key default gen_random_uuid(),
  recipient_email text not null,
  recipient_name  text,
  template_key    text,
  subject         text,
  body            text,
  channel         text not null default 'resend',
  status          text not null default 'sent',
  error_message   text,
  sent_at         timestamptz not null default now()
);
create index if not exists reminders_sent_idx on public.email_reminders(sent_at);

-- ─── AUDIT LOG ───────────────────────────────────────────────────────────────
create table if not exists public.audit_logs (
  id           uuid primary key default gen_random_uuid(),
  actor_id     uuid references auth.users(id) on delete set null,
  actor_email  text,
  action       text not null,
  entity_type  text not null,
  entity_id    text,
  diff         jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists audit_created_idx on public.audit_logs(created_at);
create index if not exists audit_entity_idx  on public.audit_logs(entity_type, entity_id);
create index if not exists audit_actor_idx   on public.audit_logs(actor_id);

-- ─── CONFIG-IN-USE GUARD (used by GeneralSetup delete buttons) ───────────────
create or replace function public.is_config_value_in_use(_category text, _value text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare cnt integer := 0;
begin
  if _value is null or length(trim(_value)) = 0 then return false; end if;
  case lower(_category)
    when 'setup_paymentmodes' then
      select count(*) into cnt from public.payments where lower(method::text) = lower(_value);
    when 'setup_servicetypes' then
      select count(*) into cnt from public.services where lower(coalesce(service_type,'')) = lower(_value);
    when 'setup_packages' then
      select count(*) into cnt from public.member_packages where lower(coalesce(package_name,'')) = lower(_value);
    when 'setup_planDurations'::text then
      cnt := 0; -- best-effort; plans referenced by name only in this build
    when 'setup_bloodgroups' then
      select count(*) into cnt from public.members where lower(coalesce(physical->>'blood_group','')) = lower(_value);
    when 'setup_timeslots' then
      select count(*) into cnt from public.members where lower(coalesce(extras->>'timeSlot','')) = lower(_value);
    when 'setup_classes' then
      select count(*) into cnt from public.bookings where lower(coalesce(class_name,'')) = lower(_value);
    else cnt := 0;
  end case;
  return cnt > 0;
end $$;

-- ─── RLS ─────────────────────────────────────────────────────────────────────
alter table public.user_roles            enable row level security;
alter table public.app_users             enable row level security;
alter table public.company_settings      enable row level security;
alter table public.service_types         enable row level security;
alter table public.outlets               enable row level security;
alter table public.membership_plans      enable row level security;
alter table public.services              enable row level security;
alter table public.members               enable row level security;
alter table public.member_outlet_access  enable row level security;
alter table public.member_packages       enable row level security;
alter table public.employees             enable row level security;
alter table public.bookings              enable row level security;
alter table public.invoices              enable row level security;
alter table public.invoice_items         enable row level security;
alter table public.payments              enable row level security;
alter table public.check_ins             enable row level security;
alter table public.email_templates       enable row level security;
alter table public.email_reminders       enable row level security;
alter table public.audit_logs            enable row level security;

-- Public reads (no PII)
drop policy if exists "public read service_types"    on public.service_types;
create policy "public read service_types"    on public.service_types    for select using (true);
drop policy if exists "public read company_settings" on public.company_settings;
create policy "public read company_settings" on public.company_settings for select using (true);

-- Authenticated CRUD on operational tables
do $$
declare t text;
begin
  for t in select unnest(array[
    'app_users','outlets','membership_plans','services','members',
    'member_outlet_access','member_packages','employees',
    'bookings','invoices','invoice_items','payments','check_ins',
    'email_templates','email_reminders','audit_logs','service_types'
  ]) loop
    execute format('drop policy if exists "auth crud %1$s" on public.%1$s;', t);
    execute format('create policy "auth crud %1$s" on public.%1$s for all to authenticated using (true) with check (true);', t);
  end loop;
end $$;

-- company_settings: admin-only writes, but allow any authenticated user to update (admin app)
drop policy if exists "auth update company_settings" on public.company_settings;
create policy "auth update company_settings" on public.company_settings
  for all to authenticated using (true) with check (true);

-- user_roles: admin-only writes; users can read their own
drop policy if exists "admin write user_roles" on public.user_roles;
create policy "admin write user_roles" on public.user_roles
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));
drop policy if exists "read own roles" on public.user_roles;
create policy "read own roles" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- ─── GRANTS (required for PostgREST/Data API) ────────────────────────────────
do $$
declare t text;
begin
  for t in select unnest(array[
    'app_users','company_settings','service_types','outlets','membership_plans','services',
    'members','member_outlet_access','member_packages','employees',
    'bookings','invoices','invoice_items','payments','check_ins',
    'email_templates','email_reminders','audit_logs','user_roles'
  ]) loop
    execute format('grant select, insert, update, delete on public.%I to authenticated;', t);
    execute format('grant all on public.%I to service_role;', t);
  end loop;
end $$;
grant select on public.service_types    to anon;
grant select on public.company_settings to anon;
grant usage, select on sequence public.member_code_seq to authenticated, service_role;

-- ─── STORAGE: members bucket for profile photos ──────────────────────────────
insert into storage.buckets (id, name, public)
values ('members', 'members', true)
on conflict (id) do update set public = true;

drop policy if exists "members avatars public read"  on storage.objects;
create policy "members avatars public read"  on storage.objects for select using (bucket_id = 'members');
drop policy if exists "members avatars auth insert" on storage.objects;
create policy "members avatars auth insert" on storage.objects for insert to authenticated with check (bucket_id = 'members');
drop policy if exists "members avatars auth update" on storage.objects;
create policy "members avatars auth update" on storage.objects for update to authenticated using (bucket_id = 'members') with check (bucket_id = 'members');
drop policy if exists "members avatars auth delete" on storage.objects;
create policy "members avatars auth delete" on storage.objects for delete to authenticated using (bucket_id = 'members');

-- ─── SEEDS ───────────────────────────────────────────────────────────────────
insert into public.service_types (name, slug, color, icon) values
  ('Fitness',    'fitness',    '#f5b300', 'Dumbbell'),
  ('Wellness',   'wellness',   '#22c1c3', 'Sparkles'),
  ('Sports',     'sports',     '#ef4444', 'Trophy'),
  ('Membership', 'membership', '#8b5cf6', 'IdCard'),
  ('Health',     'health',     '#10b981', 'HeartPulse'),
  ('Events',     'events',     '#f97316', 'CalendarDays')
on conflict (slug) do nothing;

insert into public.company_settings (id, company_name)
values ('main', 'VitaFit Club')
on conflict (id) do nothing;

notify pgrst, 'reload schema';

-- =============================================================================
-- END OF SCHEMA
-- =============================================================================
