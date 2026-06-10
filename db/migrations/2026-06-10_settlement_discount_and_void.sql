-- =============================================================================
-- VitaFit Club — 2026-06-10
-- 1. Add `discount` column to payments + charges to capture settlement-time
--    write-offs that lower the Net Payable.
-- 2. Add outlet_id passthrough on payments (already present in schema.sql; this
--    migration is a no-op for installations that already have it).
-- Idempotent.
-- =============================================================================

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS discount numeric(12,2) NOT NULL DEFAULT 0;

ALTER TABLE public.charges
  ADD COLUMN IF NOT EXISTS discount numeric(12,2) NOT NULL DEFAULT 0;

-- Ensure the existing grants still apply to the new column. RLS unchanged.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.charges TO authenticated;
GRANT ALL ON public.charges TO service_role;
