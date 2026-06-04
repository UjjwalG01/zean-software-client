-- =============================================================================
-- VitaFit Club — 2026-06-04
-- Dedicated `charges` table for the "Record Charge" flow.
-- Charges drive the member due balance. Settlements flip status unpaid → paid;
-- when a bill is generated against a charge it moves unpaid → billed.
-- Idempotent.
-- =============================================================================

-- 1. Status enum --------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.charge_status AS ENUM ('unpaid', 'billed', 'paid');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Charges table ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.charges (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id    uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  member_name  text NOT NULL,
  charge_head  text NOT NULL,
  description  text,
  amount       numeric(12,2) NOT NULL DEFAULT 0,   -- net (pre-VAT)
  vat_amount   numeric(12,2) NOT NULL DEFAULT 0,
  total        numeric(12,2) NOT NULL DEFAULT 0,   -- amount + vat_amount
  status       public.charge_status NOT NULL DEFAULT 'unpaid',
  meta         jsonb NOT NULL DEFAULT '{}'::jsonb, -- { type, bookingId, ... }
  paid_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_charges_member  ON public.charges (member_id);
CREATE INDEX IF NOT EXISTS idx_charges_status  ON public.charges (status);
CREATE INDEX IF NOT EXISTS idx_charges_booking ON public.charges ((meta->>'bookingId'));
CREATE INDEX IF NOT EXISTS idx_charges_head    ON public.charges (charge_head);

-- 3. updated_at trigger -------------------------------------------------------
DROP TRIGGER IF EXISTS trg_charges_touch ON public.charges;
CREATE TRIGGER trg_charges_touch
  BEFORE UPDATE ON public.charges
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- 4. Grants + RLS -------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.charges TO authenticated;
GRANT ALL ON public.charges TO service_role;

ALTER TABLE public.charges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS charges_select ON public.charges;
CREATE POLICY charges_select ON public.charges
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS charges_write ON public.charges;
CREATE POLICY charges_write ON public.charges
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. Link from payments to charges (settlement bookkeeping) -------------------
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS settled_charge_id uuid REFERENCES public.charges(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payments_settled_charge ON public.payments (settled_charge_id);
