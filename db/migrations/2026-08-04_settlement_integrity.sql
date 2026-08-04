-- =============================================================================
-- VitaFit Club — 2026-08-04
-- Settlement integrity: one bill = one charge (debit) + at most ONE live
-- payment (credit). Booking lifecycle is closed by the database, not the UI.
--
-- Status vocabularies (authoritative):
--   bookings.status  → public.status         ('pending','completed','cancelled','amended','voided')
--   charges.status   → public.charge_status  ('unpaid','billed','paid','overpaid')
--   payments.status  → public.payment_status ('pending','paid','failed','refunded','completed')
-- Idempotent.
-- =============================================================================

-- 1. Enum vocabulary ----------------------------------------------------------
do $$ begin
  create type public.status as enum ('pending','completed','cancelled','amended','voided');
exception when duplicate_object then null; end $$;

alter type public.status add value if not exists 'voided';

-- bookings.status may still be typed with the legacy `booking_status` enum on
-- some environments — make sure the lifecycle labels we write exist there too.
do $$
declare
  t_name text;
begin
  select a.atttypid::regtype::text into t_name
    from pg_attribute a
   where a.attrelid = 'public.bookings'::regclass
     and a.attname  = 'status'
     and a.attnum > 0;

  if t_name is not null and t_name <> 'status' then
    execute format('alter type %s add value if not exists %L', t_name, 'pending');
    execute format('alter type %s add value if not exists %L', t_name, 'completed');
    execute format('alter type %s add value if not exists %L', t_name, 'cancelled');
    execute format('alter type %s add value if not exists %L', t_name, 'amended');
    execute format('alter type %s add value if not exists %L', t_name, 'voided');
  end if;
end $$;

-- 2. Hard duplicate guard ------------------------------------------------------
-- A charge can carry at most one non-voided settlement payment.
create unique index if not exists payments_one_live_settlement_per_charge
  on public.payments (settled_charge_id)
  where settled_charge_id is not null and voided = false;

-- 3. settle_charge() ----------------------------------------------------------
-- Single round-trip settlement: locks the charge, refuses a second settlement,
-- books the credit row and closes every booking attached to the charge.
create or replace function public.settle_charge(
  p_charge_id  uuid,
  p_method     text    default 'cash',
  p_discount   numeric default 0,
  p_paid_on    date    default null,
  p_note       text    default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  c            public.charges%rowtype;
  v_discount   numeric(12,2);
  v_net        numeric(12,2);
  v_vat        numeric(12,2);
  v_gross      numeric(12,2);
  v_paid_at    timestamptz;
  v_payment_id uuid;
  v_receipt    text;
  v_booking_id uuid;
  v_bookings   uuid[] := '{}';
begin
  select * into c from public.charges where id = p_charge_id for update;
  if not found then
    raise exception 'CHARGE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if coalesce((c.meta->>'voided')::boolean, false) then
    raise exception 'CHARGE_VOIDED' using errcode = 'P0001';
  end if;
  if c.status = 'paid' then
    raise exception 'ALREADY_SETTLED' using errcode = 'P0001';
  end if;

  v_discount := greatest(coalesce(p_discount, c.discount, 0), 0);
  v_gross    := greatest(coalesce(c.total, 0) - v_discount, 0);
  -- VAT is embedded in the gross (13%).
  v_net      := round(v_gross / 1.13, 2);
  v_vat      := v_gross - v_net;
  v_paid_at  := coalesce(p_paid_on::timestamptz, now());
  v_receipt  := coalesce(nullif(c.receipt_no, ''), 'CHG-' || left(c.id::text, 8)) || '-P';

  -- Unique receipt_no even if the same charge is settled again after a void.
  if exists (select 1 from public.payments where receipt_no = v_receipt) then
    v_receipt := v_receipt || to_char(clock_timestamp(), 'MISSMS');
  end if;

  insert into public.payments (
    receipt_no, member_id, member_name, outlet_id, module_id,
    service_type, description, amount, vat_amount, discount, total,
    method, status, kind, charge_head, settled_charge_id,
    linked_booking_id, paid_at, notes, created_by, meta
  ) values (
    v_receipt, c.member_id, c.member_name, c.outlet_id, c.module_id,
    c.charge_head, coalesce(p_note, c.description, c.charge_head),
    v_net, v_vat, v_discount, v_gross,
    coalesce(p_method, 'cash')::public.payment_method, 'paid', 'settlement',
    c.charge_head, c.id,
    nullif(c.meta->>'bookingId','')::uuid, v_paid_at, p_note, auth.uid(),
    jsonb_build_object('type','Payment','isSettlement', true,
                       'chargeRowId', c.id,
                       'bookingId', c.meta->>'bookingId')
  )
  returning id into v_payment_id;

  update public.charges
     set status   = 'paid',
         discount = v_discount,
         method   = coalesce(p_method, method),
         paid_at  = v_paid_at
   where id = c.id;

  -- Close every booking carried by the charge (single or bundled POS order).
  if nullif(c.meta->>'bookingId','') is not null then
    v_bookings := array_append(v_bookings, (c.meta->>'bookingId')::uuid);
  end if;
  if jsonb_typeof(c.meta->'bookingIds') = 'array' then
    select v_bookings || coalesce(array_agg(x::uuid), '{}')
      into v_bookings
      from jsonb_array_elements_text(c.meta->'bookingIds') x
     where x <> '';
  end if;

  foreach v_booking_id in array v_bookings loop
    update public.bookings
       set status = 'completed', updated_at = now()
     where id = v_booking_id
       and status::text not in ('cancelled','voided');
  end loop;

  return v_payment_id;
end $$;

grant execute on function public.settle_charge(uuid, text, numeric, date, text)
  to authenticated, service_role;

-- 4. void_payment() -----------------------------------------------------------
-- The only way back from a settled bill. Reverses the credit and re-opens the
-- charge (and its bookings) so it may be settled again.
create or replace function public.void_payment(
  p_payment_id uuid,
  p_reason     text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  p            public.payments%rowtype;
  c            public.charges%rowtype;
  v_booking_id uuid;
  v_bookings   uuid[] := '{}';
begin
  select * into p from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'PAYMENT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if p.voided then
    raise exception 'ALREADY_VOIDED' using errcode = 'P0001';
  end if;

  update public.payments
     set voided      = true,
         status      = 'refunded',
         voided_at   = now(),
         voided_by   = auth.uid(),
         void_reason = p_reason
   where id = p.id;

  if p.settled_charge_id is not null then
    select * into c from public.charges where id = p.settled_charge_id for update;
    if found then
      update public.charges
         set status  = 'unpaid',
             paid_at = null
       where id = c.id;

      if nullif(c.meta->>'bookingId','') is not null then
        v_bookings := array_append(v_bookings, (c.meta->>'bookingId')::uuid);
      end if;
      if jsonb_typeof(c.meta->'bookingIds') = 'array' then
        select v_bookings || coalesce(array_agg(x::uuid), '{}')
          into v_bookings
          from jsonb_array_elements_text(c.meta->'bookingIds') x
         where x <> '';
      end if;

      foreach v_booking_id in array v_bookings loop
        update public.bookings
           set status = 'pending', updated_at = now()
         where id = v_booking_id
           and status::text = 'completed';
      end loop;
    end if;
  end if;
end $$;

grant execute on function public.void_payment(uuid, text) to authenticated, service_role;

-- 5. One-off cleanup of historical duplicates (REVIEW BEFORE RUNNING) ---------
-- Keeps the earliest live settlement per charge and voids the rest.
-- with ranked as (
--   select id, row_number() over (partition by settled_charge_id order by created_at) rn
--     from public.payments
--    where settled_charge_id is not null and voided = false
-- )
-- update public.payments p
--    set voided = true, status = 'refunded', voided_at = now(),
--        void_reason = 'duplicate settlement cleanup'
--   from ranked r
--  where p.id = r.id and r.rn > 1;
