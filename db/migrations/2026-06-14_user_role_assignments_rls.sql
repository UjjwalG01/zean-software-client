-- =============================================================================
-- 2026-06-14 — Tighten user_role_assignments RLS to admin-only writes
-- Resolves the "row violates row-level security" error encountered when an
-- admin assigns outlet access to a user.
-- =============================================================================

ALTER TABLE public.user_role_assignments ENABLE ROW LEVEL SECURITY;

-- Drop legacy permissive policies (auth crud) if present
DROP POLICY IF EXISTS "auth crud user_role_assignments" ON public.user_role_assignments;
DROP POLICY IF EXISTS user_role_assignments_select ON public.user_role_assignments;
DROP POLICY IF EXISTS user_role_assignments_write  ON public.user_role_assignments;
DROP POLICY IF EXISTS "user_role_assignments staff read"  ON public.user_role_assignments;
DROP POLICY IF EXISTS "user_role_assignments staff write" ON public.user_role_assignments;

-- Everyone authenticated may read their own assignments; admins read all
CREATE POLICY "ura self or admin read"
  ON public.user_role_assignments FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.user_role_assignments ura2
        JOIN public.custom_roles cr ON cr.id = ura2.role_id
       WHERE ura2.user_id = auth.uid() AND cr.is_admin = TRUE
    )
  );

-- Only admins (custom_roles.is_admin or app_role 'admin') may insert/update/delete
CREATE POLICY "ura admin write"
  ON public.user_role_assignments FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.user_role_assignments ura2
        JOIN public.custom_roles cr ON cr.id = ura2.role_id
       WHERE ura2.user_id = auth.uid() AND cr.is_admin = TRUE
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.user_role_assignments ura2
        JOIN public.custom_roles cr ON cr.id = ura2.role_id
       WHERE ura2.user_id = auth.uid() AND cr.is_admin = TRUE
    )
  );

-- Grants (idempotent re-affirmation)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_role_assignments TO authenticated;
GRANT ALL ON public.user_role_assignments TO service_role;

NOTIFY pgrst, 'reload schema';
