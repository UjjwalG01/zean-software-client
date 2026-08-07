-- =============================================================================
-- VitaFit Club — 2026-08-07
-- Canonical amount model:
--   amount        = excl. VAT
--   vat_amount    = VAT on amount
--   amt_after_vat = amount + vat_amount        (billed amount)
--   discount      = applied on amt_after_vat only
--   total         = amt_after_vat - discount   (net payable / collected)
--
-- Sales reports read      amount / vat_amount / amt_after_vat
-- Collection reports read amt_after_vat / discount / total
-- Idempotent.
-- =============================================================================

-- 1. Columns ------------------------------------------------------------------
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS amt_after_vat numeric(12,2);
ALTER TABLE public.charges  ADD COLUMN IF NOT EXISTS amt_after_vat numeric(12,2);

UPDATE public.payments
   SET amt_after_vat = COALESCE(amount, 0) + COALESCE(vat_amount, 0)
 WHERE amt_after_vat IS NULL;

UPDATE public.charges
   SET amt_after_vat = COALESCE(amount, 0) + COALESCE(vat_amount, 0)
 WHERE amt_after_vat IS NULL;

ALTER TABLE public.payments ALTER COLUMN amt_after_vat SET DEFAULT 0;
ALTER TABLE public.charges  ALTER COLUMN amt_after_vat SET DEFAULT 0;
ALTER TABLE public.payments ALTER COLUMN amt_after_vat SET NOT NULL;
ALTER TABLE public.charges  ALTER COLUMN amt_after_vat SET NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.charges TO authenticated;
GRANT ALL ON public.charges TO service_role;

-- 2. Settlement RPC — writes the full quintet ---------------------------------
CREATE OR REPLACE FUNCTION public.settle_charge(
  p_charge_id  uuid,
  p_method     text    DEFAULT 'cash',
  p_discount   numeric DEFAULT 0,
  p_paid_on    date    DEFAULT null,
  p_note       text    DEFAULT null
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c              public.charges%rowtype;
  v_discount     numeric(12,2);
  v_amt_after    numeric(12,2);
  v_amount       numeric(12,2);
  v_vat          numeric(12,2);
  v_total        numeric(12,2);
  v_paid_at      timestamptz;
  v_payment_id   uuid;
  v_receipt      text;
  v_booking_id   uuid;
  v_bookings     uuid[] := '{}';
BEGIN
  SELECT * INTO c FROM public.charges WHERE id = p_charge_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CHARGE_NOT_FOUND' USING errcode = 'P0002';
  END IF;
  IF COALESCE((c.meta->>'voided')::boolean, false) THEN
    RAISE EXCEPTION 'CHARGE_VOIDED' USING errcode = 'P0001';
  END IF;
  IF c.status = 'paid' THEN
    RAISE EXCEPTION 'ALREADY_SETTLED' USING errcode = 'P0001';
  END IF;

  -- Billed amount = the charge's amt_after_vat (fallback: amount + vat).
  v_amt_after := COALESCE(NULLIF(c.amt_after_vat, 0),
                          COALESCE(c.amount, 0) + COALESCE(c.vat_amount, 0),
                          COALESCE(c.total, 0));
  v_amount    := COALESCE(c.amount, v_amt_after);
  v_vat       := COALESCE(c.vat_amount, 0);
  v_discount  := LEAST(GREATEST(COALESCE(p_discount, 0), 0), v_amt_after);
  v_total     := GREATEST(v_amt_after - v_discount, 0);
  v_paid_at   := COALESCE(p_paid_on::timestamptz, now());
  v_receipt   := COALESCE(NULLIF(c.receipt_no, ''), 'CHG-' || left(c.id::text, 8)) || '-P';

  IF EXISTS (SELECT 1 FROM public.payments WHERE receipt_no = v_receipt) THEN
    v_receipt := v_receipt || to_char(clock_timestamp(), 'MISSMS');
  END IF;

  INSERT INTO public.payments (
    receipt_no, member_id, member_name, outlet_id, module_id,
    service_type, description,
    amount, vat_amount, amt_after_vat, discount, total,
    method, status, kind, charge_head, settled_charge_id,
    linked_booking_id, paid_at, notes, created_by, meta
  ) VALUES (
    v_receipt, c.member_id, c.member_name, c.outlet_id, c.module_id,
    c.charge_head, COALESCE(p_note, c.description, c.charge_head),
    v_amount, v_vat, v_amt_after, v_discount, v_total,
    COALESCE(p_method, 'cash')::public.payment_method, 'paid', 'settlement',
    c.charge_head, c.id,
    NULLIF(c.meta->>'bookingId','')::uuid, v_paid_at, p_note, auth.uid(),
    jsonb_build_object('type','Payment','isSettlement', true,
                       'chargeRowId', c.id,
                       'bookingId', c.meta->>'bookingId')
  )
  RETURNING id INTO v_payment_id;

  UPDATE public.charges
     SET status   = 'paid',
         discount = v_discount,
         total    = v_total,
         method   = COALESCE(p_method, method),
         paid_at  = v_paid_at
   WHERE id = c.id;

  IF NULLIF(c.meta->>'bookingId','') IS NOT NULL THEN
    v_bookings := array_append(v_bookings, (c.meta->>'bookingId')::uuid);
  END IF;
  IF jsonb_typeof(c.meta->'bookingIds') = 'array' THEN
    SELECT v_bookings || COALESCE(array_agg(x::uuid), '{}')
      INTO v_bookings
      FROM jsonb_array_elements_text(c.meta->'bookingIds') x
     WHERE x <> '';
  END IF;

  -- Settlement closes the booking lifecycle only; `booking_status`
  -- (classification) is intentionally left untouched.
  FOREACH v_booking_id IN ARRAY v_bookings LOOP
    UPDATE public.bookings
       SET status = 'completed', updated_at = now()
     WHERE id = v_booking_id
       AND status::text NOT IN ('cancelled','voided');
  END LOOP;

  RETURN v_payment_id;
END $$;

GRANT EXECUTE ON FUNCTION public.settle_charge(uuid, text, numeric, date, text)
  TO authenticated, service_role;

-- 3. Ledger view — gross = amt_after_vat, net = total -------------------------
DROP VIEW IF EXISTS public.member_financial_summaries;
DROP VIEW IF EXISTS public.vw_member_ledger;

CREATE VIEW public.vw_member_ledger AS
WITH unified AS (
  SELECT
    c.id,
    c.member_id,
    c.receipt_no                                          AS receipt_no,
    COALESCE(c.paid_at, c.created_at)                     AS occurred_at,
    (COALESCE(c.paid_at, c.created_at))::date             AS occurred_on,
    'Charge'::text                                        AS type,
    COALESCE(c.description, c.charge_head)                AS description,
    c.charge_head                                         AS charge_head,
    c.method                                              AS method,
    COALESCE(c.amount, 0)                                 AS amount,
    COALESCE(c.vat_amount, 0)                             AS vat_amount,
    COALESCE(NULLIF(c.amt_after_vat, 0),
             COALESCE(c.amount,0) + COALESCE(c.vat_amount,0)) AS gross_amount,
    COALESCE(c.discount, 0)                               AS discount_amount,
    COALESCE(c.total, 0)                                  AS net_amount,
    COALESCE((c.meta->>'voided')::boolean, false)         AS voided,
    CASE
      WHEN COALESCE((c.meta->>'voided')::boolean, false) THEN 'Voided'
      WHEN c.status = 'paid'                              THEN 'Settled'
      WHEN c.status = 'billed'                            THEN 'Partial'
      ELSE 'Pending'
    END                                                   AS computed_status,
    COALESCE(c.total, 0)                                  AS debit,
    0::numeric                                            AS credit,
    CASE WHEN c.meta->>'type' = 'booking' THEN 'booking' ELSE 'manual' END AS source
  FROM public.charges c

  UNION ALL

  SELECT
    p.id,
    p.member_id,
    p.receipt_no,
    COALESCE(p.paid_at, p.created_at)                     AS occurred_at,
    (COALESCE(p.paid_at, p.created_at))::date             AS occurred_on,
    COALESCE(p.meta->>'type', 'Payment')                  AS type,
    COALESCE(p.meta->>'description', p.notes, '')         AS description,
    NULL::text                                            AS charge_head,
    p.method::text                                        AS method,
    COALESCE(p.amount, 0)                                 AS amount,
    COALESCE(p.vat_amount, 0)                             AS vat_amount,
    COALESCE(NULLIF(p.amt_after_vat, 0),
             COALESCE(p.amount,0) + COALESCE(p.vat_amount,0)) AS gross_amount,
    COALESCE(p.discount, 0)                               AS discount_amount,
    COALESCE(p.total, 0)                                  AS net_amount,
    (p.status = 'refunded' OR p.status = 'voided' OR p.voided) AS voided,
    CASE
      WHEN p.voided OR p.status IN ('refunded','voided') THEN 'Voided'
      WHEN p.status = 'paid'                             THEN 'Settled'
      WHEN p.status = 'pending'                          THEN 'Pending'
      ELSE 'Settled'
    END                                                   AS computed_status,
    0::numeric                                            AS debit,
    COALESCE(p.total, 0)                                  AS credit,
    CASE
      WHEN p.settled_charge_id IS NOT NULL              THEN 'settlement'
      WHEN COALESCE(p.meta->>'type','') ILIKE 'advance' THEN 'advance'
      ELSE 'payment'
    END                                                   AS source
  FROM public.payments p
  WHERE p.member_id IS NOT NULL
    AND COALESCE(p.meta->>'type', 'Payment') <> 'Charge'
)
SELECT
  u.*,
  SUM(CASE WHEN u.voided THEN 0 ELSE (u.debit - u.credit) END)
    OVER (PARTITION BY u.member_id ORDER BY u.occurred_at ASC, u.id ASC
          ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_balance
FROM unified u;

GRANT SELECT ON public.vw_member_ledger TO authenticated, service_role;

-- 4. Member summary -----------------------------------------------------------
CREATE VIEW public.member_financial_summaries AS
WITH agg AS (
  SELECT
    member_id,
    COALESCE(SUM(CASE WHEN NOT voided AND type = 'Charge'  THEN net_amount END), 0) AS total_charged,
    COALESCE(SUM(CASE WHEN NOT voided AND type = 'Charge'  THEN gross_amount END), 0) AS total_billed,
    COALESCE(SUM(CASE WHEN NOT voided AND type <> 'Charge' THEN credit END), 0)     AS total_paid,
    COALESCE(SUM(CASE WHEN NOT voided THEN discount_amount END), 0)                 AS total_discounts,
    COALESCE(SUM(CASE WHEN NOT voided AND type = 'Advance' THEN credit END), 0)     AS total_advances
  FROM public.vw_member_ledger
  GROUP BY member_id
)
SELECT
  member_id,
  total_charged,
  total_billed,
  total_paid,
  total_discounts,
  total_advances,
  (total_charged - total_paid)            AS net_balance,
  GREATEST(total_charged - total_paid, 0) AS outstanding_due,
  GREATEST(total_paid - total_charged, 0) AS advance_balance,
  total_charged                           AS total_invoiced,
  (total_charged - total_paid)            AS net_outstanding
FROM agg;

GRANT SELECT ON public.member_financial_summaries TO authenticated, service_role;
