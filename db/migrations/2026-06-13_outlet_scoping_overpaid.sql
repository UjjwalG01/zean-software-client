-- =============================================================================
-- VitaFit Club — 2026-06-13
-- Outlet scoping for financial writes + new `overpaid` transaction status.
-- Idempotent.
-- =============================================================================

-- 1. outlet_id on charges -----------------------------------------------------
ALTER TABLE public.charges
  ADD COLUMN IF NOT EXISTS outlet_id uuid;
CREATE INDEX IF NOT EXISTS idx_charges_outlet_created
  ON public.charges (outlet_id, created_at DESC);

-- 2. outlet_id on payments ----------------------------------------------------
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='payments') THEN
    EXECUTE 'ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS outlet_id uuid';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_payments_outlet_created ON public.payments (outlet_id, created_at DESC)';
  END IF;
END $$;

-- 3. outlet_id on transactions (legacy mirror) --------------------------------
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='transactions') THEN
    EXECUTE 'ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS outlet_id uuid';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_transactions_outlet_date ON public.transactions (outlet_id, date DESC)';
  END IF;
END $$;

-- 4. New `overpaid` charge status --------------------------------------------
DO $$ BEGIN
  ALTER TYPE public.charge_status ADD VALUE IF NOT EXISTS 'overpaid';
EXCEPTION WHEN others THEN NULL; END $$;
