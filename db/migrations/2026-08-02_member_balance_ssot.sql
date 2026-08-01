-- =============================================================================
-- VitaFit Club — 2026-08-02
-- Member Financial Balance SSOT.
--
-- Redefines `member_financial_summaries` around the canonical accounting rules:
--   total_charged  = every non-voided charge (bookings, POS sales, packages)
--   total_paid     = every non-voided credit (cash/card/online/bank + advances)
--   net_balance    = total_charged - total_paid
--                    > 0  → outstanding due
--                    = 0  → fully settled
--                    < 0  → advance / refundable credit  (abs value)
--
-- Legacy column names (total_invoiced / net_outstanding) are kept as aliases so
-- existing consumers keep compiling while they migrate.
-- Idempotent.
-- =============================================================================

DROP VIEW IF EXISTS public.member_financial_summaries;

CREATE VIEW public.member_financial_summaries AS
WITH agg AS (
  SELECT
    member_id,
    COALESCE(SUM(CASE WHEN NOT voided AND type = 'Charge' THEN net_amount END), 0) AS total_charged,
    -- Every credit-side row counts as money received, advances included.
    COALESCE(SUM(CASE WHEN NOT voided AND type <> 'Charge' THEN credit END), 0)    AS total_paid,
    COALESCE(SUM(CASE WHEN NOT voided THEN discount_amount END), 0)                AS total_discounts,
    COALESCE(SUM(CASE WHEN NOT voided AND type = 'Advance' THEN credit END), 0)    AS total_advances
  FROM public.vw_member_ledger
  GROUP BY member_id
)
SELECT
  member_id,
  total_charged,
  total_paid,
  total_discounts,
  total_advances,
  (total_charged - total_paid)                        AS net_balance,
  GREATEST(total_charged - total_paid, 0)             AS outstanding_due,
  GREATEST(total_paid - total_charged, 0)             AS advance_balance,
  -- ── legacy aliases ──────────────────────────────────────────────
  total_charged                                       AS total_invoiced,
  (total_charged - total_paid)                        AS net_outstanding
FROM agg;

GRANT SELECT ON public.member_financial_summaries TO authenticated, service_role;
