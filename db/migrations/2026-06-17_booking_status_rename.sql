-- Task 1: rename bookings.status -> bookings.booking_status
-- and extend allowed values to include wait-listed / not-fixed.
-- Default new bookings to 'confirmed'.
--
-- NOTE: ALTER TYPE ADD VALUE cannot be used in the same transaction
-- as a query that references the new value, so each statement below
-- must be committed separately. Supabase's migration runner executes
-- top-level statements one-by-one which satisfies that constraint.

-- 1) extend enum with the two new labels
alter type public.booking_status add value if not exists 'wait-listed';
alter type public.booking_status add value if not exists 'not-fixed';

-- 2) rename column (idempotent guard)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='bookings' and column_name='status'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='bookings' and column_name='booking_status'
  ) then
    execute 'alter table public.bookings rename column status to booking_status';
  end if;
end $$;

-- 3) backfill legacy values into the new vocabulary
update public.bookings set booking_status = 'wait-listed' where booking_status::text = 'pending';
update public.bookings set booking_status = 'confirmed'   where booking_status::text = 'completed';
update public.bookings set booking_status = 'not-fixed'   where booking_status::text in ('cancelled','no_show');

-- 4) default to confirmed for new bookings
alter table public.bookings alter column booking_status set default 'confirmed';
