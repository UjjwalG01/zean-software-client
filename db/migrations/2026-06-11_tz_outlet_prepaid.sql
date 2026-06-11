-- =============================================================================
-- VitaFit Club — 2026-06-11
--   1. Outlet + module scoping on core tables (FKs + indexes)
--   2. Outlet-aware role assignments + helper `user_has_outlet_access`
--   3. Refresh RLS policies on scoped tables (NULL outlet_id = open for back-compat)
--   4. Prepaid pools (membership consumption-by-attendance)
--   5. Charges: link to attendance + pool for consumption rows
-- All operations idempotent. Run after 2026-06-10_settlement_discount_and_void.sql.
-- =============================================================================

-- 1. Outlet + module FKs ------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'bookings','payments','services','membership_plans','charges','invoices'
  ]) LOOP
    IF to_regclass('public.'||t) IS NOT NULL THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS outlet_id uuid REFERENCES public.outlets(id) ON DELETE RESTRICT', t);
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS module_id uuid REFERENCES public.modules(id) ON DELETE RESTRICT', t);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%1$s_outlet ON public.%1$I (outlet_id)', t);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%1$s_module ON public.%1$I (module_id)', t);
    END IF;
  END LOOP;
END $$;

-- 2. Outlet on role assignments ----------------------------------------------
ALTER TABLE public.user_role_assignments
  ADD COLUMN IF NOT EXISTS outlet_id uuid REFERENCES public.outlets(id) ON DELETE CASCADE;

-- Drop the primary-key-on-user constraint so a user can be mapped to several outlets.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.user_role_assignments'::regclass
       AND contype  = 'p'
  ) THEN
    BEGIN
      ALTER TABLE public.user_role_assignments DROP CONSTRAINT user_role_assignments_pkey;
    EXCEPTION WHEN others THEN NULL;
    END;
  END IF;
END $$;

-- Composite uniqueness: user × outlet (NULL outlet = "all outlets" mapping)
CREATE UNIQUE INDEX IF NOT EXISTS user_role_assignments_uniq
  ON public.user_role_assignments (user_id, COALESCE(outlet_id, '00000000-0000-0000-0000-000000000000'));

-- 3. Outlet access helper -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_has_outlet_access(_user_id uuid, _outlet uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    _outlet IS NULL                                -- back-compat: unscoped row
    OR _user_id IS NULL                            -- anonymous service-role bypass guarded by RLS
    OR EXISTS (                                    -- admin role short-circuit
      SELECT 1 FROM public.user_role_assignments ura
        JOIN public.custom_roles cr ON cr.id = ura.role_id
       WHERE ura.user_id = _user_id AND cr.is_admin = true
    )
    OR EXISTS (                                    -- explicit outlet match
      SELECT 1 FROM public.user_role_assignments ura
       WHERE ura.user_id = _user_id
         AND (ura.outlet_id IS NULL OR ura.outlet_id = _outlet)
    );
$$;
GRANT EXECUTE ON FUNCTION public.user_has_outlet_access(uuid, uuid) TO authenticated, anon;

-- 4. Replace permissive RLS on scoped tables ---------------------------------
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['bookings','payments','services','membership_plans','charges']) LOOP
    IF to_regclass('public.'||t) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "%1$s_outlet_scope" ON public.%1$I', t);
    EXECUTE format(
      'CREATE POLICY "%1$s_outlet_scope" ON public.%1$I FOR ALL TO authenticated
         USING (public.user_has_outlet_access(auth.uid(), outlet_id))
         WITH CHECK (public.user_has_outlet_access(auth.uid(), outlet_id))', t);
  END LOOP;
END $$;

-- 5. Prepaid pools ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.prepaid_pools (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id       uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  plan_id         uuid REFERENCES public.membership_plans(id) ON DELETE SET NULL,
  outlet_id       uuid REFERENCES public.outlets(id) ON DELETE RESTRICT,
  module_id       uuid REFERENCES public.modules(id) ON DELETE RESTRICT,
  source_payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  total_paid      numeric(12,2) NOT NULL DEFAULT 0,
  daily_rate      numeric(12,2) NOT NULL DEFAULT 0,
  start_date      date NOT NULL,
  end_date        date,
  used_amount     numeric(12,2) NOT NULL DEFAULT 0,
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active','exhausted','closed')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_prepaid_member ON public.prepaid_pools (member_id);
CREATE INDEX IF NOT EXISTS idx_prepaid_status ON public.prepaid_pools (status);
CREATE INDEX IF NOT EXISTS idx_prepaid_outlet ON public.prepaid_pools (outlet_id);

DROP TRIGGER IF EXISTS trg_prepaid_touch ON public.prepaid_pools;
CREATE TRIGGER trg_prepaid_touch
  BEFORE UPDATE ON public.prepaid_pools
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prepaid_pools TO authenticated;
GRANT ALL ON public.prepaid_pools TO service_role;
ALTER TABLE public.prepaid_pools ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS prepaid_pools_scope ON public.prepaid_pools;
CREATE POLICY prepaid_pools_scope ON public.prepaid_pools FOR ALL TO authenticated
  USING (public.user_has_outlet_access(auth.uid(), outlet_id))
  WITH CHECK (public.user_has_outlet_access(auth.uid(), outlet_id));

-- 6. Charges: consumption metadata -------------------------------------------
ALTER TABLE public.charges
  ADD COLUMN IF NOT EXISTS used_amount   numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS attendance_id uuid,
  ADD COLUMN IF NOT EXISTS pool_id       uuid REFERENCES public.prepaid_pools(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS charges_pool_attendance_uniq
  ON public.charges (pool_id, attendance_id)
  WHERE pool_id IS NOT NULL AND attendance_id IS NOT NULL;

-- 7. Reload PostgREST schema cache -------------------------------------------
NOTIFY pgrst, 'reload schema';
