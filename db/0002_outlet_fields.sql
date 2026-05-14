-- =============================================================================
-- VitaFit Club — Outlet extended fields
-- Run this in the Supabase SQL Editor AFTER 0001_init.sql.
-- =============================================================================

alter table public.outlets
  add column if not exists outlet_code     text,
  add column if not exists cost_center     text,
  add column if not exists outlet_type     text,            -- e.g. REGULAR / SPA / GYM
  add column if not exists effective_from  date,
  add column if not exists country         text,
  add column if not exists state           text,
  add column if not exists city            text,
  add column if not exists street          text,
  add column if not exists zip             text,
  add column if not exists tel1            text,
  add column if not exists tel2            text,
  add column if not exists mobile          text,
  add column if not exists website         text,
  add column if not exists show_room_guest boolean not null default true,
  add column if not exists real_time_sales boolean not null default false,
  add column if not exists enable_membership boolean not null default false,
  add column if not exists allow_bill_date_change boolean not null default false,
  add column if not exists is_ticketing    boolean not null default false;

create unique index if not exists outlets_code_unique
  on public.outlets (lower(outlet_code))
  where outlet_code is not null and length(trim(outlet_code)) > 0;
