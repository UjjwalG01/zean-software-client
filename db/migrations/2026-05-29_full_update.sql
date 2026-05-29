-- =============================================================================
-- VitaFit Club — Consolidated update migration (2026-05-29)
--
-- Covers the 14-item product request:
--   1  Admin-driven password reset (no schema change; handled via edge fn)
--   2  Split / multi-mode payments              -> transaction_payments
--   3  Outlet image URL                         -> outlets.image_url (already in base)
--   4  Record Charge (non-payment ledger entry) -> charge_heads + payments.kind
--   5  Outlet-independent members               -> members.outlet_id stays nullable
--   6  Real backend for inventory & roles       -> stores / item_groups /
--                                                   inventory_items / stock_movements /
--                                                   custom_roles / role_permissions
--   7  RBAC per assigned page                   -> custom_roles + role_permissions +
--                                                   user_role_assignments
--   8  Sports outlet 24h timeline + statuses    -> bookings.start_at/end_at + booking_status
--   9  Amend / cancel booking                   -> bookings.amended_from + cancel reason
--  10  Void / reverse sale                      -> payments.voided / void_reason
--  11  Discounted rate on bookings              -> bookings.original_rate / discount
--  12  New reports (driven by new columns)
--  13  One check-in per member per day          -> check_ins unique index
--  14  THIS FILE (single drop-in SQL)
--
-- Idempotent — safe to re-run.
-- =============================================================================

-- ───── Extensions ──────────────────────────────────────────────────────────
create extension if not exists pgcrypto;
create extension if not exists btree_gist;     -- needed for booking overlap exclusion

-- ───── Enums ───────────────────────────────────────────────────────────────
do $$ begin
  create type public.booking_status_v2 as enum
    ('pending','confirmed','provisional','waitlisted','completed','cancelled','amended','no_show');
exception when duplicate_object then null; end $$;

do $$ begin
  alter type public.payment_method add value if not exists 'cheque';
exception when undefined_object then null; end $$;

-- ───── 3 / 11. Outlets — image already present, ensure column exists ───────
alter table public.outlets
  add column if not exists image_url text;

-- ───── 5. Members — outlet must remain nullable ────────────────────────────
alter table public.members
  alter column outlet_id drop not null;

-- ───── 8 / 9 / 11. Bookings — timeline, statuses, discount, amend ──────────
alter table public.bookings
  add column if not exists start_time      timestamptz,
  add column if not exists end_time        timestamptz,
  add column if not exists original_rate   numeric,
  add column if not exists rate            numeric,
  add column if not exists discount_amount numeric not null default 0,
  add column if not exists discount_reason text,
  add column if not exists amended_from    uuid references public.bookings(id) on delete set null,
  add column if not exists cancel_reason   text,
  add column if not exists status_v2       public.booking_status_v2 not null default 'pending';

-- Back-fill start_time / end_time from existing start_at / end_at (one-time)
update public.bookings
   set start_time = coalesce(start_time, start_at),
       end_time   = coalesce(end_time,   end_at)
 where start_time is null;

-- Overlap guard for SPORTS outlets: same outlet cannot have two CONFIRMED
-- bookings whose time ranges overlap. waitlisted / provisional are allowed to overlap.
do $$ begin
  alter table public.bookings
    add constraint bookings_no_overlap
    exclude using gist (
      outlet_id with =,
      tstzrange(start_time, end_time, '[)') with &&
    ) where (status_v2 = 'confirmed' and start_time is not null and end_time is not null);
exception when duplicate_object then null; when undefined_column then null; end $$;

-- ───── 10. Payments — void / reverse + charge marker ───────────────────────
alter table public.payments
  add column if not exists kind         text not null default 'sale',  -- 'sale' | 'charge'
  add column if not exists charge_head  text,                          -- for kind='charge'
  add column if not exists voided       boolean not null default false,
  add column if not exists voided_at    timestamptz,
  add column if not exists voided_by    uuid references auth.users(id) on delete set null,
  add column if not exists void_reason  text;

create index if not exists payments_kind_idx    on public.payments(kind);
create index if not exists payments_voided_idx  on public.payments(voided);

-- ───── 2. Split payments ───────────────────────────────────────────────────
create table if not exists public.transaction_payments (
  id              uuid primary key default gen_random_uuid(),
  payment_id      uuid not null references public.payments(id) on delete cascade,
  mode            public.payment_method not null,
  amount          numeric not null check (amount <> 0),
  reference       text,
  note            text,
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id) on delete set null
);
create index if not exists tx_payments_payment_idx on public.transaction_payments(payment_id);

-- Sum guard: split payments cannot exceed payments.total (per parent).
create or replace function public.tg_tx_payment_check_sum()
returns trigger language plpgsql as $$
declare
  parent uuid := coalesce(new.payment_id, old.payment_id);
  bill numeric;
  paid numeric;
begin
  if parent is null then return null; end if;
  select total into bill from public.payments where id = parent;
  select coalesce(sum(amount),0) into paid
    from public.transaction_payments where payment_id = parent;
  if bill is not null and paid > bill + 0.01 then
    raise exception 'Split payments (%) exceed bill total (%)', paid, bill;
  end if;
  return null;
end $$;
drop trigger if exists tg_tx_payments_sum on public.transaction_payments;
create trigger tg_tx_payments_sum
after insert or update or delete on public.transaction_payments
for each row execute function public.tg_tx_payment_check_sum();

-- ───── 4. Charge heads (damage / breakage / license renewal / misc) ────────
create table if not exists public.charge_heads (
  id              uuid primary key default gen_random_uuid(),
  name            text not null unique,
  description     text,
  default_amount  numeric,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

insert into public.charge_heads (name, description)
values
  ('Damage',          'Property damage cost recovery'),
  ('Breakage',        'Equipment / glassware breakage'),
  ('License Renewal', 'Renewal / late renewal charges'),
  ('Lost Item',       'Replacement charge for lost items'),
  ('Late Cancellation','Booking late-cancellation penalty'),
  ('Miscellaneous',   'Other ad-hoc charges')
on conflict (name) do nothing;

-- ───── 6. Inventory tables (replace localStorage backend) ──────────────────
create table if not exists public.inv_stores (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  location    text,
  outlet_id   uuid references public.outlets(id) on delete set null,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.inv_item_groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.inv_items (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,
  name            text not null,
  group_id        uuid references public.inv_item_groups(id) on delete set null,
  store_id        uuid references public.inv_stores(id) on delete set null,
  unit            text not null default 'pcs',
  quantity        numeric not null default 0,
  rate            numeric not null default 0,        -- weighted-average, VAT incl.
  reorder_level   numeric not null default 0,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists inv_items_group_idx on public.inv_items(group_id);
create index if not exists inv_items_store_idx on public.inv_items(store_id);

drop trigger if exists tg_inv_items_touch on public.inv_items;
create trigger tg_inv_items_touch before update on public.inv_items
for each row execute function public.tg_touch_updated_at();

create table if not exists public.inv_movements (
  id              uuid primary key default gen_random_uuid(),
  item_id         uuid not null references public.inv_items(id) on delete cascade,
  type            text not null check (type in ('opening','purchase','issue','adjustment')),
  quantity        numeric not null,
  rate            numeric not null default 0,
  reference       text,
  note            text,
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id) on delete set null
);
create index if not exists inv_mov_item_idx on public.inv_movements(item_id, created_at);

-- ───── 7. Custom roles & permissions ───────────────────────────────────────
create table if not exists public.custom_roles (
  id           uuid primary key default gen_random_uuid(),
  name         text not null unique,
  description  text,
  is_admin     boolean not null default false,   -- wildcard role
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
drop trigger if exists tg_custom_roles_touch on public.custom_roles;
create trigger tg_custom_roles_touch before update on public.custom_roles
for each row execute function public.tg_touch_updated_at();

create table if not exists public.role_permissions (
  id           uuid primary key default gen_random_uuid(),
  role_id      uuid not null references public.custom_roles(id) on delete cascade,
  page_key     text not null,
  can_view     boolean not null default true,
  can_create   boolean not null default false,
  can_edit     boolean not null default false,
  can_delete   boolean not null default false,
  unique (role_id, page_key)
);
create index if not exists role_perms_role_idx on public.role_permissions(role_id);

-- Map app_users → custom_roles. Kept separate from the `user_roles` enum table
-- (which controls coarse RLS roles like admin/manager/staff).
create table if not exists public.user_role_assignments (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  role_id      uuid not null references public.custom_roles(id) on delete restrict,
  assigned_at  timestamptz not null default now(),
  assigned_by  uuid references auth.users(id) on delete set null
);

-- Seed an Administrator role (wildcard) so admins keep full access.
insert into public.custom_roles (name, description, is_admin)
values ('Administrator', 'Full access to every page and action', true)
on conflict (name) do nothing;

-- Helper: does the calling user have a permission on a page?
create or replace function public.user_has_page_permission(
  _user_id uuid, _page_key text, _action text default 'view'
) returns boolean
language sql stable security definer set search_path = public as $$
  with role_id as (
    select role_id from public.user_role_assignments where user_id = _user_id
  ),
  is_admin as (
    select coalesce(bool_or(is_admin), false) as v
      from public.custom_roles
     where id in (select role_id from role_id)
  )
  select case
    when (select v from is_admin) then true
    when public.has_role(_user_id, 'admin') then true
    else exists (
      select 1 from public.role_permissions rp
      where rp.role_id in (select role_id from role_id)
        and rp.page_key = _page_key
        and case _action
              when 'view'   then rp.can_view
              when 'create' then rp.can_create
              when 'edit'   then rp.can_edit
              when 'delete' then rp.can_delete
              else false
            end
    )
  end;
$$;

-- ───── 13. One attendance per member per day ───────────────────────────────
-- Add a generated `check_in_date` column (date portion of check_in_at) and a
-- unique index so duplicate check-ins on the same day are rejected at the DB.
alter table public.check_ins
  add column if not exists check_in_date date
  generated always as ((check_in_at at time zone 'Asia/Kathmandu')::date) stored;

create unique index if not exists check_ins_member_day_unique
  on public.check_ins(member_id, check_in_date)
  where member_id is not null;

-- ───── Reporting view used by Daily Sales / Cashier / Sales Contribution ──
create or replace view public.v_payment_totals as
  select
    p.id,
    p.receipt_no,
    p.invoice_id,
    p.member_id,
    p.member_name,
    p.outlet_id,
    p.service_type,
    p.kind,
    p.method,
    p.status,
    p.paid_at,
    (p.paid_at at time zone 'Asia/Kathmandu')::date as sale_date,
    p.amount   as net_amount,
    p.vat_amount,
    p.total    as gross_amount,
    p.voided,
    coalesce(sp.split_paid, p.total) as effective_paid
  from public.payments p
  left join (
    select payment_id, sum(amount) as split_paid
      from public.transaction_payments
     group by payment_id
  ) sp on sp.payment_id = p.id
  where p.voided = false;

-- ───── RLS ─────────────────────────────────────────────────────────────────
alter table public.transaction_payments    enable row level security;
alter table public.charge_heads            enable row level security;
alter table public.inv_stores              enable row level security;
alter table public.inv_item_groups         enable row level security;
alter table public.inv_items               enable row level security;
alter table public.inv_movements           enable row level security;
alter table public.custom_roles            enable row level security;
alter table public.role_permissions        enable row level security;
alter table public.user_role_assignments   enable row level security;

do $$
declare t text;
begin
  for t in select unnest(array[
    'transaction_payments','charge_heads',
    'inv_stores','inv_item_groups','inv_items','inv_movements',
    'custom_roles','role_permissions','user_role_assignments'
  ]) loop
    execute format('drop policy if exists "auth crud %1$s" on public.%1$s;', t);
    execute format('create policy "auth crud %1$s" on public.%1$s for all to authenticated using (true) with check (true);', t);
  end loop;
end $$;

-- ───── GRANTS (required by PostgREST / Data API) ───────────────────────────
do $$
declare t text;
begin
  for t in select unnest(array[
    'transaction_payments','charge_heads',
    'inv_stores','inv_item_groups','inv_items','inv_movements',
    'custom_roles','role_permissions','user_role_assignments'
  ]) loop
    execute format('grant select, insert, update, delete on public.%I to authenticated;', t);
    execute format('grant all on public.%I to service_role;', t);
  end loop;
end $$;

grant select on public.v_payment_totals to authenticated, service_role;

-- Reload PostgREST schema cache
notify pgrst, 'reload schema';

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
