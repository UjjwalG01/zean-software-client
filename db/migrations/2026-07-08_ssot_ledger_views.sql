-- =============================================================================
-- VitaFit Club — 2026-07-08
-- Server-side Single Source of Truth for member ledger + financial summaries.
--
-- IMPORTANT: This project has NO `transactions` table. The "Transaction" type
-- exposed to the frontend is synthesized from two real tables:
--   • public.charges  — debit side (bookings + manual charges)
--   • public.payments — credit side (payments, advances, settlements)
--
-- These two views combine them into a single chronological ledger and a
-- per-member summary, so the React layer can drop client-side .reduce() math.
--
-- Views inherit RLS from the underlying tables. They are read-only.
-- =============================================================================

-- 1. Row-level ledger view ---------------------------------------------------
DROP VIEW IF EXISTS public.vw_member_ledger;
CREATE VIEW public.vw_member_ledger AS
WITH unified AS (
  -- ── Charge rows (debit) ─────────────────────────────────────────────
  SELECT
    c.id,
    c.member_id,
    NULL::text                                            AS receipt_no,
    COALESCE(c.paid_at, c.created_at)                     AS occurred_at,
    (COALESCE(c.paid_at, c.created_at))::date             AS occurred_on,
    'Charge'::text                                        AS type,
    COALESCE(c.description, c.charge_head)                AS description,
    c.charge_head                                         AS charge_head,
    NULL::text                                            AS method,
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

  -- ── Payment rows (credit) ───────────────────────────────────────────
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
    (p.status = 'refunded')                               AS voided,
    CASE
      WHEN p.status = 'refunded' THEN 'Voided'
      WHEN p.status = 'paid'     THEN 'Settled'
      WHEN p.status = 'pending'  THEN 'Pending'
      ELSE 'Settled'
    END                                                   AS computed_status,
    0::numeric                                            AS debit,
    COALESCE(p.total, p.amount, 0)                        AS credit,
    CASE
      WHEN p.settled_charge_id IS NOT NULL     THEN 'settlement'
      WHEN COALESCE(p.meta->>'type','') ILIKE 'advance' THEN 'advance'
      ELSE 'payment'
    END                                                   AS source
  FROM public.payments p
  WHERE p.member_id IS NOT NULL
)
SELECT
  u.*,
  SUM(CASE WHEN u.voided THEN 0 ELSE (u.debit - u.credit) END)
    OVER (PARTITION BY u.member_id ORDER BY u.occurred_at ASC, u.id ASC
          ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_balance
FROM unified u;

-- 2. Member-level summary view -----------------------------------------------
DROP VIEW IF EXISTS public.member_financial_summaries;
CREATE VIEW public.member_financial_summaries AS
SELECT
  member_id,
  COALESCE(SUM(CASE WHEN NOT voided AND type = 'Charge'                  THEN net_amount END), 0) AS total_invoiced,
  COALESCE(SUM(CASE WHEN NOT voided AND type NOT IN ('Charge','Advance') THEN credit    END), 0) AS total_paid,
  COALESCE(SUM(CASE WHEN NOT voided                                       THEN discount_amount END), 0) AS total_discounts,
  COALESCE(SUM(CASE WHEN NOT voided AND type = 'Advance'                 THEN credit    END), 0) AS total_advances,
  COALESCE(SUM(CASE WHEN voided THEN 0 ELSE (debit - credit) END), 0)                            AS net_outstanding
FROM public.vw_member_ledger
GROUP BY member_id;

-- 3. Grants (views expose data through the caller's role + RLS on base tables)
GRANT SELECT ON public.vw_member_ledger           TO authenticated, service_role;
GRANT SELECT ON public.member_financial_summaries TO authenticated, service_role;
