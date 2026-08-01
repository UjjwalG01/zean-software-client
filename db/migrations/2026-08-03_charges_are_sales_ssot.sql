-- =============================================================================
-- VitaFit Club — 2026-08-03
-- "Booking ⇒ Charge, Payment ⇒ Paid" accounting SSOT.
--
-- Every booking (member OR walk-in guest) posts a row into `public.charges`
-- (the debit / sales side). Money only lands in `public.payments` (the credit
-- side) when it is actually collected. `net_balance = charged - paid`.
--
-- This migration makes the charges table able to carry every field the app
-- writes (previously silently rejected inserts fell back to a payments mirror,
-- which made unpaid bookings look settled):
--   • member_id nullable        → guest / walk-in charges
--   • created_by, receipt_no, method columns
-- and rebuilds the ledger views to expose them.
-- Idempotent.
-- =============================================================================

-- 1. Charges table hardening --------------------------------------------------
ALTER TABLE public.charges ALTER COLUMN member_id  DROP NOT NULL;
ALTER TABLE public.charges ALTER COLUMN member_name DROP NOT NULL;

ALTER TABLE public.charges
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS receipt_no text,
  ADD COLUMN IF NOT EXISTS method     text;

CREATE INDEX IF NOT EXISTS idx_charges_receipt ON public.charges (receipt_no);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.charges TO authenticated;
GRANT ALL ON public.charges TO service_role;

-- 2. Ledger view (debit = charges, credit = payments) -------------------------
DROP VIEW IF EXISTS public.member_financial_summaries;
DROP VIEW IF EXISTS public.vw_member_ledger;

CREATE VIEW public.vw_member_ledger AS
WITH unified AS (
  -- ── Charge rows (debit / sales) ─────────────────────────────────────
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
    COALESCE(c.amount, 0)                                 AS gross_amount,
    COALESCE(c.vat_amount, 0)                             AS vat_amount,
    COALESCE(c.discount, 0)                               AS discount_amount,
    (COALESCE(c.total, 0) - COALESCE(c.discount, 0))      AS net_amount,
    COALESCE((c.meta->>'voided')::boolean, false)         AS voided,
    CASE
      WHEN COALESCE((c.meta->>'voided')::boolean, false) THEN 'Voided'
      WHEN c.status = 'paid'                              THEN 'Settled'
      WHEN c.status = 'billed'                            THEN 'Partial'
      ELSE 'Pending'
    END                                                   AS computed_status,
    (COALESCE(c.total, 0) - COALESCE(c.discount, 0))      AS debit,
    0::numeric                                            AS credit,
    CASE WHEN c.meta->>'type' = 'booking' THEN 'booking'
         ELSE 'manual' END                                AS source
  FROM public.charges c

  UNION ALL

  -- ── Payment rows (credit / money received) ──────────────────────────
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
    COALESCE(p.amount, 0)                                 AS gross_amount,
    COALESCE(p.vat_amount, 0)                             AS vat_amount,
    COALESCE(p.discount, 0)                               AS discount_amount,
    COALESCE(p.total, p.amount, 0)                        AS net_amount,
    (p.status = 'refunded' OR p.status = 'voided')        AS voided,
    CASE
      WHEN p.status IN ('refunded','voided') THEN 'Voided'
      WHEN p.status = 'paid'                 THEN 'Settled'
      WHEN p.status = 'pending'              THEN 'Pending'
      ELSE 'Settled'
    END                                                   AS computed_status,
    0::numeric                                            AS debit,
    COALESCE(p.total, p.amount, 0)                        AS credit,
    CASE
      WHEN p.settled_charge_id IS NOT NULL              THEN 'settlement'
      WHEN COALESCE(p.meta->>'type','') ILIKE 'advance' THEN 'advance'
      ELSE 'payment'
    END                                                   AS source
  FROM public.payments p
  WHERE p.member_id IS NOT NULL
    -- Charge-typed rows live in `charges`; never double-count a legacy mirror.
    AND COALESCE(p.meta->>'type', 'Payment') <> 'Charge'
)
SELECT
  u.*,
  SUM(CASE WHEN u.voided THEN 0 ELSE (u.debit - u.credit) END)
    OVER (PARTITION BY u.member_id ORDER BY u.occurred_at ASC, u.id ASC
          ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_balance
FROM unified u;

GRANT SELECT ON public.vw_member_ledger TO authenticated, service_role;

-- 3. Member summary — charged vs paid ----------------------------------------
CREATE VIEW public.member_financial_summaries AS
WITH agg AS (
  SELECT
    member_id,
    COALESCE(SUM(CASE WHEN NOT voided AND type = 'Charge'  THEN net_amount END), 0) AS total_charged,
    COALESCE(SUM(CASE WHEN NOT voided AND type <> 'Charge' THEN credit END), 0)     AS total_paid,
    COALESCE(SUM(CASE WHEN NOT voided THEN discount_amount END), 0)                 AS total_discounts,
    COALESCE(SUM(CASE WHEN NOT voided AND type = 'Advance' THEN credit END), 0)     AS total_advances
  FROM public.vw_member_ledger
  GROUP BY member_id
)
SELECT
  member_id,
  total_charged,
  total_paid,
  total_discounts,
  total_advances,
  (total_charged - total_paid)            AS net_balance,
  GREATEST(total_charged - total_paid, 0) AS outstanding_due,
  GREATEST(total_paid - total_charged, 0) AS advance_balance,
  -- ── legacy aliases ──────────────────────────────────────────────
  total_charged                           AS total_invoiced,
  (total_charged - total_paid)            AS net_outstanding
FROM agg;

GRANT SELECT ON public.member_financial_summaries TO authenticated, service_role;
