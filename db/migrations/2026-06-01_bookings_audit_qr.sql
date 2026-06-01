-- =============================================================================
-- VitaFit Club — 2026-06-01 update
-- Adds: invoice uniqueness, inactive members, attendance dedup,
--       audit log, booking cancellation columns, member preferences.
-- Safe to re-run (idempotent).
-- =============================================================================

-- 1. Transactions / Invoice uniqueness ---------------------------------------
-- Deduplicate any historical clashes first, then enforce uniqueness.
DO $$
BEGIN
  IF EXISTS (
    SELECT receipt_no FROM public.payments
    WHERE receipt_no IS NOT NULL
    GROUP BY receipt_no HAVING COUNT(*) > 1
  ) THEN
    UPDATE public.payments p
       SET receipt_no = p.receipt_no || '-' || p.id
     WHERE p.id IN (
       SELECT id FROM (
         SELECT id, row_number() OVER (PARTITION BY receipt_no ORDER BY created_at NULLS LAST, id) AS rn
         FROM public.payments WHERE receipt_no IS NOT NULL
       ) x WHERE rn > 1
     );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payments_receipt_no_unique'
  ) THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_receipt_no_unique UNIQUE (receipt_no);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_payments_member_date ON public.payments (member_id, payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments (status);

-- 2. Members - preferences + inactive status ---------------------------------
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS preferences jsonb DEFAULT '{}'::jsonb;

-- Relax / extend status check so "inactive" is a valid value.
DO $$
DECLARE c text;
BEGIN
  SELECT conname INTO c FROM pg_constraint
   WHERE conrelid = 'public.members'::regclass AND contype = 'c'
     AND pg_get_constraintdef(oid) ILIKE '%status%';
  IF c IS NOT NULL THEN EXECUTE format('ALTER TABLE public.members DROP CONSTRAINT %I', c); END IF;
END $$;

ALTER TABLE public.members
  ADD CONSTRAINT members_status_check
  CHECK (status IN ('active','expired','expiring','inactive'));

-- 3. Bookings - cancellation metadata ----------------------------------------
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_reason text;

CREATE INDEX IF NOT EXISTS idx_bookings_date ON public.bookings (booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings (status);

-- 4. Attendance dedup --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid REFERENCES public.members(id) ON DELETE CASCADE,
  member_name text NOT NULL,
  date date NOT NULL,
  check_in_time timestamptz NOT NULL DEFAULT now(),
  outlet_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS attendance_member_date_unique
  ON public.attendance (member_id, date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS attendance_select ON public.attendance;
CREATE POLICY attendance_select ON public.attendance
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS attendance_write ON public.attendance;
CREATE POLICY attendance_write ON public.attendance
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. Audit log ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ts timestamptz NOT NULL DEFAULT now(),
  user_id uuid,
  user_email text,
  module text NOT NULL,
  action text NOT NULL,
  entity_id text,
  old_value jsonb,
  new_value jsonb
);

CREATE INDEX IF NOT EXISTS idx_audit_ts ON public.audit_logs (ts DESC);
CREATE INDEX IF NOT EXISTS idx_audit_module ON public.audit_logs (module);
CREATE INDEX IF NOT EXISTS idx_audit_user ON public.audit_logs (user_id);

GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_select ON public.audit_logs;
CREATE POLICY audit_select ON public.audit_logs
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS audit_insert ON public.audit_logs;
CREATE POLICY audit_insert ON public.audit_logs
  FOR INSERT TO authenticated WITH CHECK (true);

-- 6. Members - phone column hardening (text only, never numeric) -------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'members'
       AND column_name = 'phone' AND data_type IN ('numeric','bigint','integer')
  ) THEN
    ALTER TABLE public.members ALTER COLUMN phone TYPE text USING phone::text;
  END IF;
END $$;
