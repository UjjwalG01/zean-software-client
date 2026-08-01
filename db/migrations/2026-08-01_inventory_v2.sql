-- =============================================================================
-- VitaFit Club — 2026-08-01
-- Inventory v2: suppliers master, richer item metadata, full movement ledger
-- (received / issued / adjusted / transferred) with running balances.
-- Idempotent.
-- =============================================================================

-- 1. Suppliers ----------------------------------------------------------------
create table if not exists public.inv_suppliers (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  contact_person text,
  phone          text,
  email          text,
  address        text,
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

grant select, insert, update, delete on public.inv_suppliers to authenticated;
grant all on public.inv_suppliers to service_role;

alter table public.inv_suppliers enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'inv_suppliers'
      and policyname = 'inv_suppliers_rw'
  ) then
    execute $p$
      create policy inv_suppliers_rw on public.inv_suppliers
        for all to authenticated
        using (public.user_has_action('inventory', 'view'))
        with check (public.user_has_action('inventory', 'edit'))
    $p$;
  end if;
exception when others then
  -- Projects without the RBAC helpers fall back to an authenticated-only policy.
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'inv_suppliers'
      and policyname = 'inv_suppliers_rw_basic'
  ) then
    execute 'create policy inv_suppliers_rw_basic on public.inv_suppliers for all to authenticated using (true) with check (true)';
  end if;
end $$;

drop trigger if exists tg_inv_suppliers_touch on public.inv_suppliers;
create trigger tg_inv_suppliers_touch before update on public.inv_suppliers
for each row execute function public.tg_touch_updated_at();

-- 2. Item metadata ------------------------------------------------------------
alter table public.inv_items
  add column if not exists supplier_id      uuid references public.inv_suppliers(id) on delete set null,
  add column if not exists description      text,
  add column if not exists reorder_quantity numeric not null default 0;

create index if not exists inv_items_supplier_idx on public.inv_items(supplier_id);

-- 3. Movement ledger ----------------------------------------------------------
alter table public.inv_movements
  add column if not exists supplier_id       uuid references public.inv_suppliers(id) on delete set null,
  add column if not exists from_store_id     uuid references public.inv_stores(id) on delete set null,
  add column if not exists to_store_id       uuid references public.inv_stores(id) on delete set null,
  add column if not exists performed_by_name text,
  add column if not exists balance_after     numeric;

-- Widen the allowed movement types to include transfers.
do $$
declare
  con_name text;
begin
  select conname into con_name
  from pg_constraint
  where conrelid = 'public.inv_movements'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%type%opening%';
  if con_name is not null then
    execute format('alter table public.inv_movements drop constraint %I', con_name);
  end if;
end $$;

alter table public.inv_movements
  drop constraint if exists inv_movements_type_chk;
alter table public.inv_movements
  add constraint inv_movements_type_chk
  check (type in ('opening', 'purchase', 'issue', 'adjustment', 'transfer'));

create index if not exists inv_mov_created_idx on public.inv_movements(created_at desc);
create index if not exists inv_mov_type_created_idx on public.inv_movements(type, created_at desc);
