# Dynamic Membership Plans & Reusable Plan Durations

Refactor `Plans & Services → Membership Plans` so each plan is fully dynamic (name, tier, duration, price, services, toggles), backed by dedicated DB columns, and driven by a new reusable `plan_durations` lookup. Booking duration picker shows the selected plan's details inline.

## 1. Database (new migration)

New file: `db/migrations/2026-06-22_membership_plan_dynamic.sql`

```sql
-- Reusable duration presets (e.g. 1 / Monthly, 12 / Yearly, 180 / 15-Year)
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
create policy "plan_durations read"  on public.plan_durations for select using (true);
create policy "plan_durations write" on public.plan_durations for all
  to authenticated using (true) with check (true);

insert into public.plan_durations (months, name, sort_order) values
  (1,'Monthly',1),(3,'Quarterly',2),(6,'Half-Yearly',3),
  (12,'Yearly',4),(180,'15-Year',5)
on conflict (months) do nothing;

-- Membership plans: dedicated columns, drop reliance on description JSON
alter table public.membership_plans
  add column if not exists duration_months    integer,
  add column if not exists included_services  text[] not null default '{}',
  add column if not exists auto_discount      boolean not null default false;

-- Per-plan price matrix (one row per duration option attached to a plan).
-- A plan exposes ONE price for each duration it supports.
create table if not exists public.membership_plan_prices (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references public.membership_plans(id) on delete cascade,
  duration_id uuid not null references public.plan_durations(id)   on delete restrict,
  price       numeric(12,2) not null default 0,
  created_at  timestamptz not null default now(),
  unique (plan_id, duration_id)
);
grant select on public.membership_plan_prices to anon;
grant select, insert, update, delete on public.membership_plan_prices to authenticated;
grant all on public.membership_plan_prices to service_role;
alter table public.membership_plan_prices enable row level security;
create policy "mpp read"  on public.membership_plan_prices for select using (true);
create policy "mpp write" on public.membership_plan_prices for all
  to authenticated using (true) with check (true);
```

Legacy `price`, `yearly_price`, `long_term_price`, `description`, `duration_days` stay for backward read compatibility but new writes target the new columns/table.

## 2. Service layer — `src/lib/supabase-services.ts`

- Extend `FirestoreMembershipPlan`:
  ```ts
  interface FirestoreMembershipPlan {
    id: string; name: string; tier: string;
    durationMonths: number;
    includedServices: string[];
    autoRenew: boolean;
    autoDiscount: boolean;
    prices: { durationId: string; months: number; name: string; price: number }[];
    // legacy mirror kept for old screens
    price: number; yearlyPrice?: number; longTermPrice?: number;
  }
  ```
- `getMembershipPlans()` joins `membership_plan_prices` + `plan_durations`; maps new columns first, falls back to legacy JSON only when `included_services` is empty.
- `addMembershipPlan` / `updateMembershipPlan`:
  - Write `name`, `tier`, `duration_months`, `included_services`, `auto_renew`, `auto_discount` into dedicated columns.
  - Upsert `membership_plan_prices` rows from `prices[]` (delete rows missing from payload).
  - Keep mirroring `price` = the lowest duration's price for legacy widgets.
- New `getPlanDurations / addPlanDuration / updatePlanDuration / deletePlanDuration` + matching React-Query hooks in `src/hooks/use-firestore.ts` (`usePlanDurations`, `useSavePlanDuration`, `useDeletePlanDuration`).

## 3. Plan Duration Setup UI

Add a new sub-tab **"Plan Durations"** under `Plans & Services` (or under `GeneralSetup`, matching existing setup style) with a two-column table:

| Months | Name        | Actions |
|--------|-------------|---------|
| 1      | Monthly     | Edit/Delete |
| 12     | Yearly      | Edit/Delete |

Inline add row + edit. `months` is a number input; `name` is free text. These rows feed every duration dropdown across the app.

## 4. Membership Plan Add/Edit modal — `src/pages/PlansServices.tsx`

Rebuilt fields:
1. **Name** — text input.
2. **Tier** — `Select` (Basic / Silver / Gold / Platinum / Diamond).
3. **Base Duration** — `Select` sourced from `usePlanDurations()`; shows e.g. "12 months · Yearly", auto-formatted (≥12 → `"X year(s) Y month(s)"`).
4. **Prices** — dynamic list rendered from `plan_durations`. For each active duration: `Select duration` (only one row per duration — already-selected ones disabled) + numeric `Price (NPR)`. `+ Add price tier` / trash button per row. Validates uniqueness.
5. **Included Services** — multi-entry chips: type a value, press Enter → chip. Backspace removes. Stored as `text[]`. (Optionally seed suggestions from `useServices()`.)
6. **Auto-Renew** — `Switch`.
7. **Auto-Discount Applied** — `Switch` (new).

Submit builds the payload `{ name, tier, durationMonths, includedServices, autoRenew, autoDiscount, prices }` and calls add/update mutation.

## 5. Card display (Membership Plans list)

Each card shows: tier badge + name, base price (lowest tier price as headline), a compact price matrix (one row per `prices[]` entry rendered as `Name … NPR x,xxx`), included-services chips, Auto-Renew switch, Auto-Discount badge, Edit/Delete. Drop the hard-coded Monthly/Yearly/15-Year rows.

## 6. Bookings — duration selector with plan details

`src/pages/Bookings.tsx` (around the existing "Select Booking Duration" Select, lines ~793–810 and the `bookDuration` logic at 479–510):

- Replace the hard-coded `monthly | yearly | longTerm` options with options derived from the selected plan's `prices[]` (one entry per available duration).
- On change, store the chosen `durationId` / `months` / `price`.
- Below the Select, render a read-only details panel:
  - Plan name + tier badge
  - Duration label (e.g. "1 Year (12 months)")
  - Price + auto-discount indicator
  - Included services chips
  - Auto-renew status
- Update transaction/booking write paths to use the selected price instead of `monthly/yearly/longTerm` keys.

## 7. Helpers

Add `src/lib/duration.ts` with `formatMonths(n)` → `"3 months"`, `"1 year"`, `"1 year 6 months"`, `"15 years"`.

## 8. Manual follow-ups for the user

1. Run the new migration.
2. Re-save each existing plan once so legacy `description` JSON is migrated into the new columns / `membership_plan_prices` rows.
3. Confirm the Plan Durations table content matches your business presets before relying on it in bookings.

## Files touched

- **new** `db/migrations/2026-06-22_membership_plan_dynamic.sql`
- **new** `src/lib/duration.ts`
- `src/lib/supabase-services.ts` (plan + duration + price CRUD)
- `src/hooks/use-firestore.ts` (new duration hooks)
- `src/pages/PlansServices.tsx` (modal, cards, new sub-tab — or split duration tab into `GeneralSetup`)
- `src/pages/Bookings.tsx` (dynamic duration select + plan detail panel)
