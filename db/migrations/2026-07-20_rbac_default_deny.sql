-- =============================================================================
-- 2026-07-20 — RBAC default-deny hardening
-- Fixes: DEFINER_OR_RPC_BYPASS (rbac_default_allow)
--
-- Previously:
--   • user_has_action() returned TRUE when the caller had zero role_permissions
--     rows configured ("unconfigured = allow"). Any authenticated account without
--     a custom-role assignment therefore passed the RLS action check.
--   • user_has_outlet_access() returned TRUE whenever the target row's outlet_id
--     was NULL, letting any authenticated account read/write unscoped rows.
--
-- Now: both helpers default-deny. Access requires an explicit staff/admin role
-- OR a matching role_permissions grant AND an outlet assignment (or admin).
-- Idempotent.
-- =============================================================================

-- ─── 1. user_has_action: deny by default ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.user_has_action(_uid uuid, _page_key text, _action text)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_is_admin boolean;
  v_allowed  boolean;
BEGIN
  IF _uid IS NULL THEN RETURN false; END IF;

  -- app_role admin short-circuit
  IF public.has_role(_uid, 'admin') THEN RETURN true; END IF;

  -- custom-role is_admin short-circuit
  SELECT EXISTS (
    SELECT 1 FROM public.user_role_assignments ura
      JOIN public.custom_roles cr ON cr.id = ura.role_id
     WHERE ura.user_id = _uid AND cr.is_admin = true
  ) INTO v_is_admin;
  IF v_is_admin THEN RETURN true; END IF;

  -- Require an explicit permission grant. Unconfigured users are denied.
  EXECUTE format(
    'SELECT EXISTS (
       SELECT 1 FROM public.role_permissions rp
         JOIN public.user_role_assignments ura ON ura.role_id = rp.role_id
        WHERE ura.user_id = $1 AND rp.page_key = $2 AND rp.%I = true
     )', 'can_' || _action)
  INTO v_allowed USING _uid, _page_key;

  RETURN COALESCE(v_allowed, false);
END $$;

GRANT EXECUTE ON FUNCTION public.user_has_action(uuid, text, text) TO authenticated, service_role;

-- ─── 2. user_has_outlet_access: deny NULL-outlet blanket access ──────────────
-- Admins still see everything (including unscoped legacy rows). Regular users
-- only see rows whose outlet_id matches one of their explicit assignments, or
-- unscoped rows only when they hold a global (outlet_id IS NULL) assignment.
CREATE OR REPLACE FUNCTION public.user_has_outlet_access(_user_id uuid, _outlet uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    _user_id IS NOT NULL
    AND (
      -- app_role admin
      public.has_role(_user_id, 'admin')
      -- custom-role admin
      OR EXISTS (
        SELECT 1 FROM public.user_role_assignments ura
          JOIN public.custom_roles cr ON cr.id = ura.role_id
         WHERE ura.user_id = _user_id AND cr.is_admin = true
      )
      -- explicit outlet assignment (or a global assignment) matching the row.
      -- Global assignment (ura.outlet_id IS NULL) grants access to any outlet,
      -- including unscoped rows (_outlet IS NULL).
      OR EXISTS (
        SELECT 1 FROM public.user_role_assignments ura
         WHERE ura.user_id = _user_id
           AND (
             ura.outlet_id IS NULL
             OR (_outlet IS NOT NULL AND ura.outlet_id = _outlet)
           )
      )
    );
$$;

GRANT EXECUTE ON FUNCTION public.user_has_outlet_access(uuid, uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
