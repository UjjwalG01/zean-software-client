-- =============================================================================
-- VitaFit Club — 2026-06-22
-- Dynamic membership plans backed by dedicated columns + reusable
-- plan_durations lookup + per-plan price matrix.
-- Idempotent.
-- =============================================================================

-- 1. plan_durations -----------------------------------------------------------
create table if not exists public.plan_durations (
  id          uuid primary key default gen_random_uuid(),
  months      integer not null check (months > 0),
  name        text not null,
  sort_order  integer not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (months)
);

grant select on public.plan_durations to anon;
grant select, insert, update, delete on public.plan_durations to authenticated;
grant all on public.plan_durations to service_role;

alter table public.plan_durations enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='plan_durations' and policyname='plan_durations read') then
    create policy "plan_durations read" on public.plan_durations for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='plan_durations' and policyname='plan_durations write') then
    create policy "plan_durations write" on public.plan_durations for all
      to authenticated using (true) with check (true);
  end if;
end $$;

insert into public.plan_durations (months, name, sort_order) values
  (1,'Monthly',1),
  (3,'Quarterly',2),
  (6,'Half-Yearly',3),
  (12,'Yearly',4),
  (180,'15-Year',5)
on conflict (months) do nothing;

-- 2. membership_plans new columns --------------------------------------------
alter table public.membership_plans
  add column if not exists duration_months    integer,
  add column if not exists included_services  text[] not null default '{}',
  add column if not exists auto_discount      boolean not null default false;

-- 3. membership_plan_prices --------------------------------------------------
create table if not exists public.membership_plan_prices (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references public.membership_plans(id) on delete cascade,
  duration_id uuid not null references public.plan_durations(id)   on delete restrict,
  price       numeric(12,2) not null default 0,
  created_at  timestamptz not null default now(),
  unique (plan_id, duration_id)
);

create index if not exists idx_mpp_plan on public.membership_plan_prices (plan_id);

grant select on public.membership_plan_prices to anon;
grant select, insert, update, delete on public.membership_plan_prices to authenticated;
grant all on public.membership_plan_prices to service_role;

alter table public.membership_plan_prices enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='membership_plan_prices' and policyname='mpp read') then
    create policy "mpp read" on public.membership_plan_prices for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='membership_plan_prices' and policyname='mpp write') then
    create policy "mpp write" on public.membership_plan_prices for all
      to authenticated using (true) with check (true);
  end if;
end $$;
