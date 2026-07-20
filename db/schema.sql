-- =============================================================================
-- VitaFit Club — Consolidated Supabase schema (single source of truth)
-- Generated: 2026-07-15. Idempotent. Drop-in for a fresh Supabase project.
--
-- Merged sources:
--   • prior db/schema.sql
--   • db/migrations/2026-05-29 .. 2026-07-12
--   • Codebase alignment audit (Transactions, QuickBalanceModal, LedgerReport,
--     BookingDetailModal, MemberProfile, use-member-ledger, use-member-financials,
--     finance-math)
--
-- File layout:
--   1  Extensions
--   2  Enums
--   3  Shared helpers & triggers
--   4  Core tables (with FKs) + per-table indexes/triggers
--   5  Aggregate indexes
--   6  Views (security_invoker)
--   7  RLS enable + policies
--   8  Grants
--   9  Storage buckets + policies
--  10  Seeds
-- =============================================================================

-- ─── 1. EXTENSIONS ──────────────────────────────────────────────────────────
create extension if not exists pgcrypto;
create extension if not exists btree_gist;

-- ─── 2. ENUMS ───────────────────────────────────────────────────────────────
do $$ begin create type public.app_role       as enum ('admin','manager','staff','member'); exception when duplicate_object then null; end $$;
do $$ begin create type public.member_status  as enum ('active','expired','expiring','inactive'); exception when duplicate_object then null; end $$;
do $$ begin create type public.booking_status as enum ('pending','confirmed','provisional','waitlisted','completed','cancelled','no_show','wait-listed','not-fixed','amended'); exception when duplicate_object then null; end $$;
do $$ begin create type public.invoice_status as enum ('draft','issued','partial','paid','void'); exception when duplicate_object then null; end $$;
do $$ begin create type public.payment_status as enum ('pending','paid','failed','refunded'); exception when duplicate_object then null; end $$;
do $$ begin create type public.payment_method as enum ('cash','card','esewa','bank_transfer','mobile_wallet','cheque'); exception when duplicate_object then null; end $$;
do $$ begin create type public.gender_enum    as enum ('male','female','other'); exception when duplicate_object then null; end $$;
do $$ begin create type public.marital_enum   as enum ('single','married','widowed','divorced'); exception when duplicate_object then null; end $$;
do $$ begin create type public.blood_group    as enum ('A+','A-','B+','B-','O+','O-','AB+','AB-'); exception when duplicate_object then null; end $$;
do $$ begin create type public.charge_status  as enum ('unpaid','billed','paid','overpaid'); exception when duplicate_object then null; end $$;

-- ─── 3. SHARED HELPERS ──────────────────────────────────────────────────────
create or replace function public.tg_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

-- ─── 4. CORE TABLES ─────────────────────────────────────────────────────────

-- 4.1 Roles ------------------------------------------------------------------
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

create or replace function public.is_staff(_uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _uid and role in ('admin','manager','staff')
  );
$$;

-- 4.2 App users --------------------------------------------------------------
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

-- 4.3 Company settings (singleton) ------------------------------------------
create table if not exists public.company_settings (
  id              text primary key default 'main',
  company_name    text not null default 'VitaFit Club',
  tagline         text,
  address         text,
  phone           text,
  email           text,
  logo_url        text,
  vat_no          text,
  currency        text not null default 'NPR',
  vat_rate        numeric not null default 13,
  max_outlets     text not null default 'unlimited',
  resend_endpoint text,
  discount_rules  jsonb not null default '[]'::jsonb,
  extras          jsonb not null default '{}'::jsonb,
  updated_at      timestamptz not null default now()
);
drop trigger if exists tg_company_settings_touch on public.company_settings;
create trigger tg_company_settings_touch before update on public.company_settings
for each row execute function public.tg_touch_updated_at();

-- 4.4 Modules (UI page registry / RBAC anchor) ------------------------------
create table if not exists public.modules (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  description text,
  parent_id   uuid references public.modules(id) on delete set null,
  route       text,
  icon        text,
  order_index integer not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists idx_modules_slug   on public.modules(slug);
create index if not exists idx_modules_parent on public.modules(parent_id);

-- 4.5 Service types + Outlets -----------------------------------------------
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
  show_room_guest        boolean not null default true,
  real_time_sales        boolean not null default false,
  enable_membership      boolean not null default false,
  allow_bill_date_change boolean not null default false,
  is_ticketing           boolean not null default false,
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

-- 4.6 Plan durations & Membership plans -------------------------------------
create table if not exists public.plan_durations (
  id         uuid primary key default gen_random_uuid(),
  months     integer not null check (months > 0),
  name       text not null,
  sort_order integer not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  unique (months)
);

create table if not exists public.membership_plans (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  tier               text,
  duration_days      integer not null,
  duration_months    integer,
  included_services  text[] not null default '{}',
  auto_discount      boolean not null default false,
  price              numeric not null,
  yearly_price       numeric not null default 0,
  long_term_price    numeric not null default 0,
  includes           text,
  auto_renew         boolean not null default false,
  membership_type_id text,
  description        text,
  active             boolean not null default true,
  outlet_id          uuid references public.outlets(id) on delete restrict,
  module_id          uuid references public.modules(id) on delete restrict,
  created_at         timestamptz not null default now()
);
create index if not exists idx_membership_plans_outlet on public.membership_plans(outlet_id);
create index if not exists idx_membership_plans_module on public.membership_plans(module_id);

create table if not exists public.membership_plan_prices (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references public.membership_plans(id) on delete cascade,
  duration_id uuid not null references public.plan_durations(id)   on delete restrict,
  price       numeric(12,2) not null default 0,
  created_at  timestamptz not null default now(),
  unique (plan_id, duration_id)
);
create index if not exists idx_mpp_plan on public.membership_plan_prices(plan_id);

-- 4.7 Services --------------------------------------------------------------
create table if not exists public.services (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  service_type text,
  price        numeric not null default 0,
  duration_min integer,
  instructor   text,
  description  text,
  active       boolean not null default true,
  outlet_id    uuid references public.outlets(id) on delete restrict,
  module_id    uuid references public.modules(id) on delete restrict,
  created_at   timestamptz not null default now()
);
create index if not exists idx_services_outlet on public.services(outlet_id);
create index if not exists idx_services_module on public.services(module_id);

-- 4.8 Members ---------------------------------------------------------------
create sequence if not exists public.member_code_seq;

create table if not exists public.members (
  id                 uuid primary key default gen_random_uuid(),
  member_code        text unique,
  full_name          text not null,
  email              text,
  phone              text,
  avatar_url         text,
  dob                date,
  gender             public.gender_enum,
  nationality        text,
  religion           text,
  marital_status     public.marital_enum,
  occupation         text,
  address            jsonb not null default '{"permanent":"","temporary":""}'::jsonb,
  emergency_contact  jsonb not null default '{"name":"","phone":"","address":""}'::jsonb,
  physical           jsonb not null default '{"height":"","weight":"","chest":"","blood_group":""}'::jsonb,
  medical            jsonb not null default '{"heart_stroke":false,"breathing_difficulty":false,"skin_disease":false}'::jsonb,
  member_preferences text[] not null default '{}',
  office_name        text,
  office_address     text,
  contact_alt        text,
  tier               text default 'Basic',
  plan_id            uuid references public.membership_plans(id) on delete set null,
  status             public.member_status not null default 'active',
  join_date          timestamptz not null default now(),
  expiry_date        timestamptz,
  outlet_id          uuid references public.outlets(id) on delete set null,
  grc_no             text,
  preferences        jsonb not null default '{}'::jsonb,
  extras             jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists members_status_idx on public.members(status);
create index if not exists members_expiry_idx on public.members(expiry_date);
create index if not exists members_tier_idx   on public.members(tier);
create index if not exists members_outlet_idx on public.members(outlet_id);
create index if not exists members_phone_idx  on public.members(phone);

drop trigger if exists tg_members_touch on public.members;
create trigger tg_members_touch before update on public.members
for each row execute function public.tg_touch_updated_at();

create or replace function public.tg_member_code_assign()
returns trigger language plpgsql as $$
declare
  yy  text := to_char(now(), 'YY');
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

-- 4.9 Multi-outlet member access -------------------------------------------
create table if not exists public.member_outlet_access (
  member_id   uuid not null references public.members(id) on delete cascade,
  outlet_id   uuid not null references public.outlets(id) on delete cascade,
  first_visit timestamptz not null default now(),
  last_visit  timestamptz not null default now(),
  visit_count integer not null default 1,
  primary key (member_id, outlet_id)
);

-- 4.10 Member packages -----------------------------------------------------
create table if not exists public.member_packages (
  id                 uuid primary key default gen_random_uuid(),
  member_id          uuid not null references public.members(id) on delete cascade,
  outlet_id          uuid references public.outlets(id) on delete set null,
  plan_id            uuid references public.membership_plans(id) on delete set null,
  service_id         uuid references public.services(id) on delete set null,
  package_name       text,
  total_sessions     integer,
  remaining_sessions integer,
  starts_on          date not null default current_date,
  expires_on         date,
  price              numeric not null default 0,
  active             boolean not null default true,
  notes              text,
  created_at         timestamptz not null default now()
);
create index if not exists member_packages_member_idx on public.member_packages(member_id);
create index if not exists member_packages_outlet_idx on public.member_packages(outlet_id);

-- 4.11 Employees -----------------------------------------------------------
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

-- 4.12 Bookings ------------------------------------------------------------
create table if not exists public.bookings (
  id                uuid primary key default gen_random_uuid(),
  member_id         uuid references public.members(id) on delete set null,
  member_name       text,
  service_id        uuid references public.services(id) on delete set null,
  service_name      text,
  service_type      text,
  class_name        text,
  instructor        text,
  employee_id       uuid references public.employees(id) on delete set null,
  member_package_id uuid references public.member_packages(id) on delete set null,
  outlet_id         uuid references public.outlets(id) on delete restrict,
  module_id         uuid references public.modules(id) on delete restrict,
  start_at          timestamptz not null,
  end_at            timestamptz,
  start_time        timestamptz,
  end_time          timestamptz,
  booking_status    public.booking_status not null default 'confirmed',
  original_rate     numeric,
  rate              numeric,
  discount_amount   numeric not null default 0,
  discount_reason   text,
  amended_from      uuid references public.bookings(id) on delete set null,
  cancelled_at      timestamptz,
  cancel_reason     text,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid references auth.users(id) on delete set null
);
create index if not exists idx_bookings_start_at     on public.bookings(start_at);
create index if not exists idx_bookings_end_at       on public.bookings(end_at);
create index if not exists idx_bookings_date_range   on public.bookings(start_at, end_at);
create index if not exists idx_bookings_status       on public.bookings(booking_status);
create index if not exists idx_bookings_member_id    on public.bookings(member_id);
create index if not exists idx_bookings_member_start on public.bookings(member_id, start_at);
create index if not exists idx_bookings_outlet       on public.bookings(outlet_id);
create index if not exists idx_bookings_module       on public.bookings(module_id);
create index if not exists idx_bookings_cancelled    on public.bookings(cancelled_at);

drop trigger if exists tg_bookings_touch on public.bookings;
create trigger tg_bookings_touch before update on public.bookings
for each row execute function public.tg_touch_updated_at();

-- overlap guard for CONFIRMED bookings within the same outlet
do $$ begin
  alter table public.bookings
    add constraint bookings_no_overlap
    exclude using gist (
      outlet_id with =,
      tstzrange(start_time, end_time, '[)') with &&
    ) where (booking_status = 'confirmed' and start_time is not null and end_time is not null);
exception when duplicate_object then null; when undefined_column then null; end $$;

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

create or replace function public.tg_booking_decrement_package()
returns trigger language plpgsql as $$
begin
  if new.booking_status = 'completed'
     and (old.booking_status is distinct from 'completed')
     and new.member_package_id is not null then
    update public.member_packages
       set remaining_sessions = greatest(coalesce(remaining_sessions,0) - 1, 0)
     where id = new.member_package_id;
  end if;
  return new;
end $$;
drop trigger if exists tg_bookings_decrement_package on public.bookings;
create trigger tg_bookings_decrement_package after update on public.bookings
for each row execute function public.tg_booking_decrement_package();

-- 4.13 Invoices + items ---------------------------------------------------
create table if not exists public.invoices (
  id          uuid primary key default gen_random_uuid(),
  invoice_no  text unique,
  member_id   uuid references public.members(id) on delete set null,
  member_name text,
  outlet_id   uuid references public.outlets(id) on delete set null,
  module_id   uuid references public.modules(id) on delete restrict,
  booking_id  uuid references public.bookings(id) on delete set null,
  subtotal    numeric not null default 0,
  discount    numeric not null default 0,
  vat_amount  numeric not null default 0,
  total       numeric not null default 0,
  amount_paid numeric not null default 0,
  status      public.invoice_status not null default 'draft',
  issued_at   timestamptz,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id) on delete set null
);
drop trigger if exists tg_invoices_touch on public.invoices;
create trigger tg_invoices_touch before update on public.invoices
for each row execute function public.tg_touch_updated_at();

create table if not exists public.invoice_items (
  id                uuid primary key default gen_random_uuid(),
  invoice_id        uuid not null references public.invoices(id) on delete cascade,
  service_id        uuid references public.services(id) on delete set null,
  member_package_id uuid references public.member_packages(id) on delete set null,
  description       text not null,
  qty               integer not null default 1,
  unit_price        numeric not null default 0,
  discount          numeric not null default 0,
  tax               numeric not null default 0,
  line_total        numeric not null default 0,
  created_at        timestamptz not null default now()
);
create index if not exists invoice_items_invoice_idx on public.invoice_items(invoice_id);

-- Recompute invoice totals from item changes (writes only to invoices — no recursion).
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
     set subtotal = s, discount = d, vat_amount = t, total = s - d + t
   where id = inv
     and (subtotal, discount, vat_amount, total) is distinct from (s, d, t, s - d + t);
  return null;
end $$;
drop trigger if exists tg_invoice_items_totals on public.invoice_items;
create trigger tg_invoice_items_totals after insert or update or delete on public.invoice_items
for each row execute function public.tg_recompute_invoice_totals();

-- 4.14 Charges ------------------------------------------------------------
create table if not exists public.charges (
  id            uuid primary key default gen_random_uuid(),
  member_id     uuid not null references public.members(id) on delete cascade,
  member_name   text not null,
  charge_head   text not null,
  description   text,
  amount        numeric(12,2) not null default 0,
  vat_amount    numeric(12,2) not null default 0,
  discount      numeric(12,2) not null default 0,
  total         numeric(12,2) not null default 0,
  status        public.charge_status not null default 'unpaid',
  used_amount   numeric(12,2) not null default 0,
  attendance_id uuid,
  pool_id       uuid,
  outlet_id     uuid references public.outlets(id) on delete restrict,
  module_id     uuid references public.modules(id) on delete restrict,
  meta          jsonb not null default '{}'::jsonb,
  paid_at       timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_charges_member  on public.charges(member_id);
create index if not exists idx_charges_status  on public.charges(status);
create index if not exists idx_charges_booking on public.charges ((meta->>'bookingId'));
create index if not exists idx_charges_head    on public.charges(charge_head);
create index if not exists idx_charges_outlet_created on public.charges(outlet_id, created_at desc);

drop trigger if exists trg_charges_touch on public.charges;
create trigger trg_charges_touch before update on public.charges
for each row execute function public.tg_touch_updated_at();

-- 4.15 Payments -----------------------------------------------------------
create table if not exists public.payments (
  id                 uuid primary key default gen_random_uuid(),
  receipt_no         text not null,
  invoice_id         uuid references public.invoices(id) on delete set null,
  member_id          uuid references public.members(id) on delete set null,
  member_name        text,
  outlet_id          uuid references public.outlets(id) on delete restrict,
  module_id          uuid references public.modules(id) on delete restrict,
  service_type       text,
  description        text,
  amount             numeric not null,
  vat_amount         numeric not null default 0,
  discount           numeric not null default 0,
  total              numeric not null,
  method             public.payment_method not null default 'cash',
  status             public.payment_status not null default 'paid',
  kind               text not null default 'sale',
  charge_head        text,
  linked_booking_id  uuid,
  linked_charge_ids  uuid[],
  settled_charge_id  uuid references public.charges(id) on delete set null,
  voided             boolean not null default false,
  voided_at          timestamptz,
  voided_by          uuid references auth.users(id) on delete set null,
  void_reason        text,
  paid_at            timestamptz not null default now(),
  remarks            text,
  notes              text,
  meta               jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now(),
  created_by         uuid references auth.users(id) on delete set null,
  constraint payments_receipt_no_unique unique (receipt_no)
);
create index if not exists idx_payments_paid           on public.payments(paid_at);
create index if not exists idx_payments_method         on public.payments(method);
create index if not exists idx_payments_status         on public.payments(status);
create index if not exists idx_payments_member_paid    on public.payments(member_id, paid_at);
create index if not exists idx_payments_invoice        on public.payments(invoice_id);
create index if not exists idx_payments_kind           on public.payments(kind);
create index if not exists idx_payments_voided         on public.payments(voided);
create index if not exists idx_payments_charge_head    on public.payments(charge_head);
create index if not exists idx_payments_linked_booking on public.payments(linked_booking_id);
create index if not exists idx_payments_settled_charge on public.payments(settled_charge_id);
create index if not exists idx_payments_outlet_created on public.payments(outlet_id, created_at desc);

-- Roll payments up into invoices.amount_paid / status.
-- Writes only to invoices; guard against redundant writes to avoid recursion via other triggers.
create or replace function public.tg_payment_update_invoice_status()
returns trigger language plpgsql as $$
declare
  inv uuid := coalesce(new.invoice_id, old.invoice_id);
  paid numeric;
  tot  numeric;
  new_status public.invoice_status;
  cur_status public.invoice_status;
  cur_paid   numeric;
begin
  if inv is null then return null; end if;
  select coalesce(sum(total),0) into paid from public.payments
    where invoice_id = inv and status = 'paid' and voided = false;
  select i.total, i.status, i.amount_paid into tot, cur_status, cur_paid
    from public.invoices i where i.id = inv;
  new_status := case
    when paid >= tot and tot > 0 then 'paid'::public.invoice_status
    when paid > 0                then 'partial'::public.invoice_status
    else cur_status end;
  if cur_paid is distinct from paid or cur_status is distinct from new_status then
    update public.invoices set amount_paid = paid, status = new_status where id = inv;
  end if;
  return null;
end $$;
drop trigger if exists tg_payments_invoice_status on public.payments;
create trigger tg_payments_invoice_status after insert or update or delete on public.payments
for each row execute function public.tg_payment_update_invoice_status();

-- Post-migration FK for charges.pool_id (declared after prepaid_pools below)

-- 4.16 Split-payment lines -------------------------------------------------
create table if not exists public.transaction_payments (
  id         uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  mode       public.payment_method not null,
  amount     numeric not null check (amount <> 0),
  reference  text,
  note       text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);
create index if not exists tx_payments_payment_idx on public.transaction_payments(payment_id);

create or replace function public.tg_tx_payment_check_sum()
returns trigger language plpgsql as $$
declare
  parent uuid := coalesce(new.payment_id, old.payment_id);
  bill   numeric; paid numeric;
begin
  if parent is null then return null; end if;
  select total into bill from public.payments where id = parent;
  select coalesce(sum(amount),0) into paid from public.transaction_payments where payment_id = parent;
  if bill is not null and paid > bill + 0.01 then
    raise exception 'Split payments (%) exceed bill total (%)', paid, bill;
  end if;
  return null;
end $$;
drop trigger if exists tg_tx_payments_sum on public.transaction_payments;
create trigger tg_tx_payments_sum after insert or update or delete on public.transaction_payments
for each row execute function public.tg_tx_payment_check_sum();

-- 4.17 Charge heads --------------------------------------------------------
create table if not exists public.charge_heads (
  id             uuid primary key default gen_random_uuid(),
  name           text not null unique,
  description    text,
  default_amount numeric,
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);

-- 4.18 Inventory -----------------------------------------------------------
create table if not exists public.inv_stores (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  location   text,
  outlet_id  uuid references public.outlets(id) on delete set null,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.inv_item_groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.inv_items (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,
  name          text not null,
  group_id      uuid references public.inv_item_groups(id) on delete set null,
  store_id      uuid references public.inv_stores(id) on delete set null,
  unit          text not null default 'pcs',
  quantity      numeric not null default 0,
  rate          numeric not null default 0,
  reorder_level numeric not null default 0,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists inv_items_group_idx on public.inv_items(group_id);
create index if not exists inv_items_store_idx on public.inv_items(store_id);
drop trigger if exists tg_inv_items_touch on public.inv_items;
create trigger tg_inv_items_touch before update on public.inv_items
for each row execute function public.tg_touch_updated_at();

create table if not exists public.inv_movements (
  id         uuid primary key default gen_random_uuid(),
  item_id    uuid not null references public.inv_items(id) on delete cascade,
  type       text not null check (type in ('opening','purchase','issue','adjustment')),
  quantity   numeric not null,
  rate       numeric not null default 0,
  reference  text,
  note       text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);
create index if not exists inv_mov_item_idx on public.inv_movements(item_id, created_at);

-- 4.19 Custom roles + permissions -----------------------------------------
create table if not exists public.custom_roles (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text,
  is_admin    boolean not null default false,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
drop trigger if exists tg_custom_roles_touch on public.custom_roles;
create trigger tg_custom_roles_touch before update on public.custom_roles
for each row execute function public.tg_touch_updated_at();

create table if not exists public.role_permissions (
  id         uuid primary key default gen_random_uuid(),
  role_id    uuid not null references public.custom_roles(id) on delete cascade,
  page_key   text not null,
  can_view   boolean not null default true,
  can_create boolean not null default false,
  can_edit   boolean not null default false,
  can_delete boolean not null default false,
  unique (role_id, page_key)
);
create index if not exists role_perms_role_idx on public.role_permissions(role_id);

create table if not exists public.user_role_assignments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  role_id     uuid not null references public.custom_roles(id) on delete restrict,
  outlet_id   uuid references public.outlets(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references auth.users(id) on delete set null
);
create unique index if not exists user_role_assignments_uniq
  on public.user_role_assignments (user_id, coalesce(outlet_id, '00000000-0000-0000-0000-000000000000'));

-- 4.20 Check-ins + Attendance --------------------------------------------
create table if not exists public.check_ins (
  id             uuid primary key default gen_random_uuid(),
  member_id      uuid references public.members(id) on delete cascade,
  member_name    text,
  outlet_id      uuid references public.outlets(id) on delete set null,
  check_in_at    timestamptz not null default now(),
  check_out_at   timestamptz,
  check_in_date  date generated always as ((check_in_at at time zone 'Asia/Kathmandu')::date) stored,
  notes          text,
  created_at     timestamptz not null default now()
);
create index if not exists checkins_at_idx        on public.check_ins(check_in_at);
create index if not exists checkins_member_at_idx on public.check_ins(member_id, check_in_at);
create unique index if not exists check_ins_member_day_unique
  on public.check_ins(member_id, check_in_date) where member_id is not null;

create table if not exists public.attendance (
  id            uuid primary key default gen_random_uuid(),
  member_id     uuid references public.members(id) on delete cascade,
  member_name   text not null,
  date          date not null,
  check_in_time timestamptz not null default now(),
  outlet_id     uuid,
  created_at    timestamptz not null default now()
);
create unique index if not exists attendance_member_date_unique on public.attendance (member_id, date);

-- 4.21 Prepaid pools -----------------------------------------------------
create table if not exists public.prepaid_pools (
  id                uuid primary key default gen_random_uuid(),
  member_id         uuid not null references public.members(id) on delete cascade,
  plan_id           uuid references public.membership_plans(id) on delete set null,
  outlet_id         uuid references public.outlets(id) on delete restrict,
  module_id         uuid references public.modules(id) on delete restrict,
  source_payment_id uuid references public.payments(id) on delete set null,
  total_paid        numeric(12,2) not null default 0,
  daily_rate        numeric(12,2) not null default 0,
  start_date        date not null,
  end_date          date,
  used_amount       numeric(12,2) not null default 0,
  status            text not null default 'active' check (status in ('active','exhausted','closed')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_prepaid_member on public.prepaid_pools(member_id);
create index if not exists idx_prepaid_status on public.prepaid_pools(status);
create index if not exists idx_prepaid_outlet on public.prepaid_pools(outlet_id);
drop trigger if exists trg_prepaid_touch on public.prepaid_pools;
create trigger trg_prepaid_touch before update on public.prepaid_pools
for each row execute function public.tg_touch_updated_at();

-- back-fill FK on charges.pool_id
do $$ begin
  alter table public.charges
    add constraint charges_pool_id_fkey
    foreign key (pool_id) references public.prepaid_pools(id) on delete set null;
exception when duplicate_object then null; end $$;
create unique index if not exists charges_pool_attendance_uniq
  on public.charges (pool_id, attendance_id)
  where pool_id is not null and attendance_id is not null;

-- 4.22 Email templates + reminders ---------------------------------------
create table if not exists public.email_templates (
  key          text primary key,
  subject      text not null,
  body         text not null,
  html         text,
  design       jsonb,
  category     text,
  trigger_type text,
  variables    text[] not null default '{}',
  enabled      boolean not null default true,
  updated_at   timestamptz not null default now()
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

-- 4.23 Audit log --------------------------------------------------------
create table if not exists public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  actor_id    uuid references auth.users(id) on delete set null,
  actor_email text,
  user_email  text,
  module      text,
  module_id   uuid references public.modules(id) on delete set null,
  action      text not null,
  entity_type text,
  entity_id   text,
  diff        jsonb,
  old_value   jsonb,
  new_value   jsonb
);
create index if not exists idx_audit_created_at on public.audit_logs(created_at desc);
create index if not exists idx_audit_module     on public.audit_logs(module);
create index if not exists idx_audit_actor      on public.audit_logs(actor_id);
create index if not exists idx_audit_entity     on public.audit_logs(entity_type, entity_id);

-- ─── 5. RBAC + config helpers ─────────────────────────────────────────────
create or replace function public.user_has_outlet_access(_user_id uuid, _outlet uuid)
returns boolean language sql stable security definer set search_path = public as $$
  -- Default-deny. NULL outlet rows are NOT world-readable; only admins or users
  -- with an explicit global (outlet_id IS NULL) assignment can access them.
  select
    _user_id IS NOT NULL
    AND (
      public.has_role(_user_id, 'admin')
      OR EXISTS (
        SELECT 1 FROM public.user_role_assignments ura
          JOIN public.custom_roles cr ON cr.id = ura.role_id
         WHERE ura.user_id = _user_id AND cr.is_admin = true
      )
      OR EXISTS (
        SELECT 1 FROM public.user_role_assignments ura
         WHERE ura.user_id = _user_id
           AND (
             ura.outlet_id IS NULL
             OR (_outlet IS NOT NULL AND ura.outlet_id = _outlet)
           )
      )
    );
$$;


create or replace function public.user_has_page_permission(
  _user_id uuid, _page_key text, _action text default 'view'
) returns boolean language sql stable security definer set search_path = public as $$
  with role_ids as (
    select role_id from public.user_role_assignments where user_id = _user_id
  ),
  admin_flag as (
    select coalesce(bool_or(is_admin), false) as v
      from public.custom_roles where id in (select role_id from role_ids)
  )
  select case
    when (select v from admin_flag) then true
    when public.has_role(_user_id, 'admin') then true
    else exists (
      select 1 from public.role_permissions rp
       where rp.role_id in (select role_id from role_ids)
         and rp.page_key = _page_key
         and case _action
               when 'view'   then rp.can_view
               when 'create' then rp.can_create
               when 'edit'   then rp.can_edit
               when 'delete' then rp.can_delete
               else false end
    )
  end;
$$;

create or replace function public.user_has_action(_uid uuid, _page_key text, _action text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  v_is_admin boolean;
  v_allowed  boolean;
begin
  if _uid is null then return false; end if;
  if public.has_role(_uid, 'admin') then return true; end if;

  select exists (
    select 1 from public.user_role_assignments ura
      join public.custom_roles cr on cr.id = ura.role_id
     where ura.user_id = _uid and cr.is_admin = true
  ) into v_is_admin;
  if v_is_admin then return true; end if;

  -- Default-deny. Require an explicit permission grant; unconfigured users
  -- do not get blanket access to bookings/payments/charges/services/plans.
  execute format(
    'select exists (
       select 1 from public.role_permissions rp
         join public.user_role_assignments ura on ura.role_id = rp.role_id
        where ura.user_id = $1 and rp.page_key = $2 and rp.%I = true
     )', 'can_' || _action)
  into v_allowed using _uid, _page_key;

  return coalesce(v_allowed, false);
end $$;


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

-- ─── 6. VIEWS (security_invoker) ─────────────────────────────────────────
drop view if exists public.v_payment_totals cascade;
create view public.v_payment_totals with (security_invoker = true) as
  select
    p.id, p.receipt_no, p.invoice_id, p.member_id, p.member_name,
    p.outlet_id, p.service_type, p.kind, p.method, p.status, p.paid_at,
    (p.paid_at at time zone 'Asia/Kathmandu')::date as sale_date,
    p.amount     as net_amount,
    p.vat_amount,
    p.total      as gross_amount,
    p.voided,
    coalesce(sp.split_paid, p.total) as effective_paid
  from public.payments p
  left join (
    select payment_id, sum(amount) as split_paid
      from public.transaction_payments group by payment_id
  ) sp on sp.payment_id = p.id
  where p.voided = false;

drop view if exists public.vw_member_ledger cascade;
create view public.vw_member_ledger with (security_invoker = true) as
with unified as (
  select
    c.id, c.member_id,
    null::text                                          as receipt_no,
    coalesce(c.paid_at, c.created_at)                   as occurred_at,
    (coalesce(c.paid_at, c.created_at))::date           as occurred_on,
    'Charge'::text                                      as type,
    coalesce(c.description, c.charge_head)              as description,
    c.charge_head                                       as charge_head,
    null::text                                          as method,
    coalesce(c.amount, 0)                               as gross_amount,
    coalesce(c.vat_amount, 0)                           as vat_amount,
    coalesce(c.discount, 0)                             as discount_amount,
    (coalesce(c.total, 0) - coalesce(c.discount, 0))    as net_amount,
    coalesce((c.meta->>'voided')::boolean, false)       as voided,
    case
      when coalesce((c.meta->>'voided')::boolean, false) then 'Voided'
      when c.status = 'paid'                             then 'Settled'
      when c.status = 'billed'                           then 'Partial'
      else 'Pending'
    end                                                 as computed_status,
    (coalesce(c.total, 0) - coalesce(c.discount, 0))    as debit,
    0::numeric                                          as credit,
    case when c.meta->>'type' = 'booking' then 'booking' else 'manual' end as source
  from public.charges c
  union all
  select
    p.id, p.member_id, p.receipt_no,
    coalesce(p.paid_at, p.created_at)                   as occurred_at,
    (coalesce(p.paid_at, p.created_at))::date           as occurred_on,
    coalesce(p.meta->>'type', 'Payment')                as type,
    coalesce(p.meta->>'description', p.notes, '')       as description,
    null::text                                          as charge_head,
    p.method::text                                      as method,
    coalesce(p.amount, 0)                               as gross_amount,
    coalesce(p.vat_amount, 0)                           as vat_amount,
    coalesce(p.discount, 0)                             as discount_amount,
    coalesce(p.total, p.amount, 0)                      as net_amount,
    (p.status = 'refunded' or p.voided)                 as voided,
    case
      when p.status = 'refunded' or p.voided then 'Voided'
      when p.status = 'paid'                 then 'Settled'
      when p.status = 'pending'              then 'Pending'
      else 'Settled'
    end                                                 as computed_status,
    0::numeric                                          as debit,
    coalesce(p.total, p.amount, 0)                      as credit,
    case
      when p.settled_charge_id is not null              then 'settlement'
      when coalesce(p.meta->>'type','') ilike 'advance' then 'advance'
      else 'payment'
    end                                                 as source
  from public.payments p
  where p.member_id is not null
)
select u.*,
  sum(case when u.voided then 0 else (u.debit - u.credit) end)
    over (partition by u.member_id order by u.occurred_at asc, u.id asc
          rows between unbounded preceding and current row) as running_balance
from unified u;

drop view if exists public.member_financial_summaries cascade;
create view public.member_financial_summaries with (security_invoker = true) as
select
  member_id,
  coalesce(sum(case when not voided and type = 'Charge'                    then net_amount end), 0) as total_invoiced,
  coalesce(sum(case when not voided and type not in ('Charge','Advance')   then credit     end), 0) as total_paid,
  coalesce(sum(case when not voided                                        then discount_amount end), 0) as total_discounts,
  coalesce(sum(case when not voided and type = 'Advance'                   then credit     end), 0) as total_advances,
  coalesce(sum(case when voided then 0 else (debit - credit) end), 0)                              as net_outstanding
from public.vw_member_ledger
group by member_id;

-- Legacy alias — synonym for payments (some UI still selects transactions.*)
create or replace view public.transactions with (security_invoker = true) as
  select * from public.payments;

-- ─── 7. ROW LEVEL SECURITY ───────────────────────────────────────────────
do $$
declare t text;
begin
  for t in select unnest(array[
    'user_roles','app_users','company_settings','modules',
    'service_types','outlets','plan_durations','membership_plans','membership_plan_prices',
    'services','members','member_outlet_access','member_packages','employees',
    'bookings','invoices','invoice_items','charges','payments',
    'transaction_payments','charge_heads',
    'inv_stores','inv_item_groups','inv_items','inv_movements',
    'custom_roles','role_permissions','user_role_assignments',
    'check_ins','attendance','prepaid_pools',
    'email_templates','email_reminders','audit_logs'
  ]) loop
    execute format('alter table public.%I enable row level security;', t);
  end loop;
end $$;

-- 7.1 Publicly readable lookup tables (no PII) ----------------------------
drop policy if exists "service_types public read" on public.service_types;
create policy "service_types public read" on public.service_types
  for select using (true);

drop policy if exists "company_settings public read" on public.company_settings;
create policy "company_settings public read" on public.company_settings
  for select using (true);

drop policy if exists "company_settings admin write" on public.company_settings;
create policy "company_settings admin write" on public.company_settings
  for all to authenticated
  using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));

drop policy if exists "modules auth read" on public.modules;
create policy "modules auth read" on public.modules for select to authenticated, anon using (true);
drop policy if exists "modules staff write" on public.modules;
create policy "modules staff write" on public.modules for all to authenticated
  using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

drop policy if exists "outlets auth read" on public.outlets;
create policy "outlets auth read" on public.outlets for select to authenticated using (true);
drop policy if exists "outlets staff write" on public.outlets;
create policy "outlets staff write" on public.outlets for all to authenticated
  using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

drop policy if exists "service_types staff write" on public.service_types;
create policy "service_types staff write" on public.service_types for all to authenticated
  using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

-- 7.2 user_roles — self-read, admin-write --------------------------------
drop policy if exists "user_roles self read" on public.user_roles;
create policy "user_roles self read" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
drop policy if exists "user_roles admin write" on public.user_roles;
create policy "user_roles admin write" on public.user_roles for all to authenticated
  using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));

-- 7.3 Staff-only operational tables -------------------------------------
do $$
declare t text;
begin
  for t in select unnest(array[
    'app_users','members','member_outlet_access','member_packages',
    'employees','invoices','invoice_items',
    'check_ins','attendance','email_templates','email_reminders',
    'transaction_payments','charge_heads',
    'inv_stores','inv_item_groups','inv_items','inv_movements'
  ]) loop
    execute format('drop policy if exists "%1$s staff read" on public.%1$s;', t);
    execute format('drop policy if exists "%1$s staff write" on public.%1$s;', t);
    execute format('create policy "%1$s staff read" on public.%1$s for select to authenticated using (public.is_staff(auth.uid()));', t);
    execute format('create policy "%1$s staff write" on public.%1$s for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));', t);
  end loop;
end $$;

-- audit_logs — append-only for staff, admin can read
drop policy if exists "audit_logs staff read" on public.audit_logs;
create policy "audit_logs staff read" on public.audit_logs for select to authenticated
  using (public.is_staff(auth.uid()));
drop policy if exists "audit_logs staff insert" on public.audit_logs;
create policy "audit_logs staff insert" on public.audit_logs for insert to authenticated
  with check (public.is_staff(auth.uid()));

-- 7.4 Custom roles / permissions — staff read, admin write --------------
drop policy if exists "custom_roles staff read" on public.custom_roles;
create policy "custom_roles staff read" on public.custom_roles for select to authenticated
  using (public.is_staff(auth.uid()));
drop policy if exists "custom_roles admin write" on public.custom_roles;
create policy "custom_roles admin write" on public.custom_roles for all to authenticated
  using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));

drop policy if exists "role_permissions staff read" on public.role_permissions;
create policy "role_permissions staff read" on public.role_permissions for select to authenticated
  using (public.is_staff(auth.uid()));
drop policy if exists "role_permissions admin write" on public.role_permissions;
create policy "role_permissions admin write" on public.role_permissions for all to authenticated
  using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));

-- 7.5 user_role_assignments — self-or-admin read, admin-only write ------
drop policy if exists "ura self or admin read" on public.user_role_assignments;
create policy "ura self or admin read" on public.user_role_assignments for select to authenticated
  using (
    user_id = auth.uid()
    or public.has_role(auth.uid(),'admin')
    or exists (
      select 1 from public.user_role_assignments ura2
        join public.custom_roles cr on cr.id = ura2.role_id
       where ura2.user_id = auth.uid() and cr.is_admin = true
    )
  );
drop policy if exists "ura admin write" on public.user_role_assignments;
create policy "ura admin write" on public.user_role_assignments for all to authenticated
  using (
    public.has_role(auth.uid(),'admin')
    or exists (
      select 1 from public.user_role_assignments ura2
        join public.custom_roles cr on cr.id = ura2.role_id
       where ura2.user_id = auth.uid() and cr.is_admin = true
    )
  )
  with check (
    public.has_role(auth.uid(),'admin')
    or exists (
      select 1 from public.user_role_assignments ura2
        join public.custom_roles cr on cr.id = ura2.role_id
       where ura2.user_id = auth.uid() and cr.is_admin = true
    )
  );

-- 7.6 Plan pricing — read to all authenticated, staff-only writes -------
drop policy if exists "plan_durations read"        on public.plan_durations;
drop policy if exists "plan_durations staff write" on public.plan_durations;
create policy "plan_durations read"        on public.plan_durations for select to authenticated using (true);
create policy "plan_durations staff write" on public.plan_durations for all to authenticated
  using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

drop policy if exists "mpp read"        on public.membership_plan_prices;
drop policy if exists "mpp staff write" on public.membership_plan_prices;
create policy "mpp read"        on public.membership_plan_prices for select to authenticated using (true);
create policy "mpp staff write" on public.membership_plan_prices for all to authenticated
  using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

-- 7.7 Outlet-scoped tables with per-action RBAC (bookings, payments, charges, services, membership_plans)
do $$
declare rec record; page_key text;
begin
  for rec in
    select column1 as t, column2 as pk
      from (values
        ('bookings','bookings'),
        ('payments','transactions'),
        ('charges','transactions'),
        ('services','plans-services'),
        ('membership_plans','plans-services')
      ) v
  loop
    execute format('drop policy if exists %1$s_outlet_scope on public.%1$s;', rec.t);
    execute format('drop policy if exists "%1$s outlet select" on public.%1$s;', rec.t);
    execute format('drop policy if exists "%1$s outlet insert" on public.%1$s;', rec.t);
    execute format('drop policy if exists "%1$s outlet update" on public.%1$s;', rec.t);
    execute format('drop policy if exists "%1$s outlet delete" on public.%1$s;', rec.t);

    execute format($f$
      create policy "%1$s outlet select" on public.%1$s for select to authenticated
        using (
          public.user_has_outlet_access(auth.uid(), outlet_id)
          and public.user_has_action(auth.uid(), %2$L, 'view')
        );
    $f$, rec.t, rec.pk);

    execute format($f$
      create policy "%1$s outlet insert" on public.%1$s for insert to authenticated
        with check (
          public.user_has_outlet_access(auth.uid(), outlet_id)
          and public.user_has_action(auth.uid(), %2$L, 'create')
        );
    $f$, rec.t, rec.pk);

    execute format($f$
      create policy "%1$s outlet update" on public.%1$s for update to authenticated
        using (
          public.user_has_outlet_access(auth.uid(), outlet_id)
          and public.user_has_action(auth.uid(), %2$L, 'edit')
        )
        with check (
          public.user_has_outlet_access(auth.uid(), outlet_id)
          and public.user_has_action(auth.uid(), %2$L, 'edit')
        );
    $f$, rec.t, rec.pk);

    execute format($f$
      create policy "%1$s outlet delete" on public.%1$s for delete to authenticated
        using (
          public.user_has_outlet_access(auth.uid(), outlet_id)
          and public.user_has_action(auth.uid(), %2$L, 'delete')
        );
    $f$, rec.t, rec.pk);
  end loop;
end $$;

-- prepaid_pools — outlet-scoped for staff
drop policy if exists prepaid_pools_scope on public.prepaid_pools;
create policy prepaid_pools_scope on public.prepaid_pools for all to authenticated
  using (public.is_staff(auth.uid()) and public.user_has_outlet_access(auth.uid(), outlet_id))
  with check (public.is_staff(auth.uid()) and public.user_has_outlet_access(auth.uid(), outlet_id));

-- ─── 8. GRANTS ───────────────────────────────────────────────────────────
do $$
declare t text;
begin
  for t in select unnest(array[
    'user_roles','app_users','company_settings','modules',
    'service_types','outlets','plan_durations','membership_plans','membership_plan_prices',
    'services','members','member_outlet_access','member_packages','employees',
    'bookings','invoices','invoice_items','charges','payments',
    'transaction_payments','charge_heads',
    'inv_stores','inv_item_groups','inv_items','inv_movements',
    'custom_roles','role_permissions','user_role_assignments',
    'check_ins','attendance','prepaid_pools',
    'email_templates','email_reminders','audit_logs'
  ]) loop
    execute format('grant select, insert, update, delete on public.%I to authenticated;', t);
    execute format('grant all on public.%I to service_role;', t);
  end loop;
end $$;

grant select on public.service_types             to anon;
grant select on public.company_settings          to anon;
grant select on public.modules                   to anon;
grant select on public.plan_durations            to anon;
grant select on public.membership_plan_prices    to anon;

grant select on public.vw_member_ledger           to authenticated, service_role;
grant select on public.member_financial_summaries to authenticated, service_role;
grant select on public.v_payment_totals           to authenticated, service_role;
grant select on public.transactions               to authenticated, service_role;

grant usage, select on sequence public.member_code_seq to authenticated, service_role;

grant execute on function public.has_role(uuid, public.app_role)                to authenticated, anon;
grant execute on function public.has_any_role(uuid, public.app_role[])          to authenticated, anon;
grant execute on function public.is_staff(uuid)                                 to authenticated, anon;
grant execute on function public.user_has_outlet_access(uuid, uuid)             to authenticated, anon;
grant execute on function public.user_has_page_permission(uuid, text, text)     to authenticated, anon;
grant execute on function public.user_has_action(uuid, text, text)              to authenticated, service_role;
grant execute on function public.is_config_value_in_use(text, text)             to authenticated, service_role;

-- ─── 9. STORAGE: members avatar bucket (PRIVATE — signed URLs only) ────
insert into storage.buckets (id, name, public)
values ('members', 'members', false)
on conflict (id) do update set public = false;

drop policy if exists "members avatars public read"  on storage.objects;
drop policy if exists "members avatars auth read"    on storage.objects;
create policy "members avatars auth read" on storage.objects
  for select to authenticated using (bucket_id = 'members');
drop policy if exists "members avatars auth insert" on storage.objects;
create policy "members avatars auth insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'members');
drop policy if exists "members avatars auth update" on storage.objects;
create policy "members avatars auth update" on storage.objects
  for update to authenticated using (bucket_id = 'members') with check (bucket_id = 'members');
drop policy if exists "members avatars auth delete" on storage.objects;
create policy "members avatars auth delete" on storage.objects
  for delete to authenticated using (bucket_id = 'members');

-- ─── 10. SEEDS ──────────────────────────────────────────────────────────
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

insert into public.plan_durations (months, name, sort_order) values
  (1,'Monthly',1),
  (3,'Quarterly',2),
  (6,'Half-Yearly',3),
  (12,'Yearly',4),
  (180,'15-Year',5)
on conflict (months) do nothing;

insert into public.charge_heads (name, description) values
  ('Damage',           'Property damage cost recovery'),
  ('Breakage',         'Equipment / glassware breakage'),
  ('License Renewal',  'Renewal / late renewal charges'),
  ('Lost Item',        'Replacement charge for lost items'),
  ('Late Cancellation','Booking late-cancellation penalty'),
  ('Miscellaneous',    'Other ad-hoc charges')
on conflict (name) do nothing;

insert into public.custom_roles (name, description, is_admin)
values ('Administrator', 'Full access to every page and action', true)
on conflict (name) do nothing;

insert into public.modules (name, slug, route, icon, order_index) values
  ('Dashboard',       'dashboard',       '/',                       'LayoutDashboard', 10),
  ('Members',         'members',         '/members',                'Users',           20),
  ('Bookings',        'bookings',        '/bookings',               'CalendarDays',    30),
  ('Attendance',      'attendance',      '/attendance',             'UserCheck',       40),
  ('Transactions',    'transactions',    '/transactions',           'Receipt',         50),
  ('Inventory',       'inventory',       '/inventory',              'Package',         60),
  ('Reports',         'reports',         '/reports',                'BarChart3',       70),
  ('Forecast',        'forecast',        '/forecast',               'TrendingUp',      80),
  ('Audit Logs',      'audit-logs',      '/audit-logs',             'ScrollText',      90),
  ('General Setup',   'general',         '/setup/general',          'Wrench',          200),
  ('Outlets',         'outlets',         '/setup/outlets',          'Building2',       210),
  ('Service Types',   'service-types',   '/setup/service-types',    'Tag',             220),
  ('Plans & Services','plans-services',  '/setup/plans',            'Dumbbell',        230),
  ('Stores',          'stores',          '/setup/stores',           'Warehouse',       240),
  ('Item Groups',     'item-groups',     '/setup/item-groups',      'Layers',          250),
  ('Charge Heads',    'charge-heads',    '/setup/charge-heads',     'Tag',             260),
  ('Users & Roles',   'users',           '/setup/users',            'UserCog',         270),
  ('Email Templates', 'email-templates', '/setup/email-templates',  'Mail',            280),
  ('Settings',        'settings',        '/setup/settings',         'Settings',        290)
on conflict (slug) do update
  set name = excluded.name, route = excluded.route,
      icon = excluded.icon, order_index = excluded.order_index;

notify pgrst, 'reload schema';

-- =============================================================================
-- END OF SCHEMA
-- =============================================================================
