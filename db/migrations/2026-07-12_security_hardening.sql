-- =============================================================================
-- 2026-07-12 — Security hardening pass
-- Fixes:
--   • view_rls_bypass       — recreate reporting views with security_invoker
--   • public_data_exposure  — lock role/permission/inventory/txn-payment tables
--   • plan_pricing_write    — lock plan pricing tables to staff
--   • client_side_auth      — enforce per-action RBAC in RLS on outlet-scoped tables
-- Idempotent.
-- =============================================================================

-- ─── 1. security_invoker views ────────────────────────────────────────────────
-- Recreate ledger + summary views so RLS on charges/payments applies to callers.
DROP VIEW IF EXISTS public.vw_member_ledger CASCADE;
CREATE VIEW public.vw_member_ledger WITH (security_invoker = true) AS
WITH unified AS (
  SELECT
    c.id, c.member_id,
    NULL::text AS receipt_no,
    COALESCE(c.paid_at, c.created_at) AS occurred_at,
    (COALESCE(c.paid_at, c.created_at))::date AS occurred_on,
    'Charge'::text AS type,
    COALESCE(c.description, c.charge_head) AS description,
    c.charge_head AS charge_head,
    NULL::text AS method,
    COALESCE(c.amount, 0) AS gross_amount,
    COALESCE(c.vat_amount, 0) AS vat_amount,
    COALESCE(c.discount, 0) AS discount_amount,
    (COALESCE(c.total, 0) - COALESCE(c.discount, 0)) AS net_amount,
    COALESCE((c.meta->>'voided')::boolean, false) AS voided,
    CASE
      WHEN COALESCE((c.meta->>'voided')::boolean, false) THEN 'Voided'
      WHEN c.status = 'paid' THEN 'Settled'
      WHEN c.status = 'billed' THEN 'Partial'
      ELSE 'Pending'
    END AS computed_status,
    (COALESCE(c.total, 0) - COALESCE(c.discount, 0)) AS debit,
    0::numeric AS credit,
    CASE WHEN c.meta->>'type' = 'booking' THEN 'booking' ELSE 'manual' END AS source
  FROM public.charges c
  UNION ALL
  SELECT
    p.id, p.member_id, p.receipt_no,
    COALESCE(p.paid_at, p.created_at) AS occurred_at,
    (COALESCE(p.paid_at, p.created_at))::date AS occurred_on,
    COALESCE(p.meta->>'type', 'Payment') AS type,
    COALESCE(p.meta->>'description', p.notes, '') AS description,
    NULL::text AS charge_head,
    p.method::text AS method,
    COALESCE(p.amount, 0) AS gross_amount,
    COALESCE(p.vat_amount, 0) AS vat_amount,
    COALESCE(p.discount, 0) AS discount_amount,
    COALESCE(p.total, p.amount, 0) AS net_amount,
    (p.status = 'refunded') AS voided,
    CASE
      WHEN p.status = 'refunded' THEN 'Voided'
      WHEN p.status = 'paid' THEN 'Settled'
      WHEN p.status = 'pending' THEN 'Pending'
      ELSE 'Settled'
    END AS computed_status,
    0::numeric AS debit,
    COALESCE(p.total, p.amount, 0) AS credit,
    CASE
      WHEN p.settled_charge_id IS NOT NULL THEN 'settlement'
      WHEN COALESCE(p.meta->>'type','') ILIKE 'advance' THEN 'advance'
      ELSE 'payment'
    END AS source
  FROM public.payments p
  WHERE p.member_id IS NOT NULL
)
SELECT u.*,
  SUM(CASE WHEN u.voided THEN 0 ELSE (u.debit - u.credit) END)
    OVER (PARTITION BY u.member_id ORDER BY u.occurred_at ASC, u.id ASC
          ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_balance
FROM unified u;

DROP VIEW IF EXISTS public.member_financial_summaries CASCADE;
CREATE VIEW public.member_financial_summaries WITH (security_invoker = true) AS
SELECT
  member_id,
  COALESCE(SUM(CASE WHEN NOT voided AND type = 'Charge' THEN net_amount END), 0) AS total_invoiced,
  COALESCE(SUM(CASE WHEN NOT voided AND type NOT IN ('Charge','Advance') THEN credit END), 0) AS total_paid,
  COALESCE(SUM(CASE WHEN NOT voided THEN discount_amount END), 0) AS total_discounts,
  COALESCE(SUM(CASE WHEN NOT voided AND type = 'Advance' THEN credit END), 0) AS total_advances,
  COALESCE(SUM(CASE WHEN voided THEN 0 ELSE (debit - credit) END), 0) AS net_outstanding
FROM public.vw_member_ledger
GROUP BY member_id;

GRANT SELECT ON public.vw_member_ledger           TO authenticated, service_role;
GRANT SELECT ON public.member_financial_summaries TO authenticated, service_role;

-- v_payment_totals — recreate with security_invoker if it exists
DO $$
DECLARE v_def text;
BEGIN
  SELECT pg_get_viewdef('public.v_payment_totals'::regclass, true) INTO v_def;
  EXECUTE 'DROP VIEW public.v_payment_totals CASCADE';
  EXECUTE 'CREATE VIEW public.v_payment_totals WITH (security_invoker = true) AS ' || v_def;
  EXECUTE 'GRANT SELECT ON public.v_payment_totals TO authenticated, service_role';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- ─── 2. Lock down role / permission / inventory / txn-payment tables ─────────
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'custom_roles','role_permissions','transaction_payments',
    'charge_heads','inv_stores','inv_item_groups','inv_items','inv_movements'
  ]) LOOP
    -- only proceed if table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
      EXECUTE format('DROP POLICY IF EXISTS "auth crud %1$s" ON public.%1$s;', t);
      EXECUTE format('DROP POLICY IF EXISTS %1$s_select ON public.%1$s;', t);
      EXECUTE format('DROP POLICY IF EXISTS %1$s_write  ON public.%1$s;', t);
      EXECUTE format('DROP POLICY IF EXISTS "%1$s staff read"  ON public.%1$s;', t);
      EXECUTE format('DROP POLICY IF EXISTS "%1$s staff write" ON public.%1$s;', t);
      EXECUTE format('DROP POLICY IF EXISTS "%1$s admin write" ON public.%1$s;', t);
    END IF;
  END LOOP;
END $$;

-- custom_roles + role_permissions: staff read, admin-only write
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='custom_roles') THEN
    CREATE POLICY "custom_roles staff read" ON public.custom_roles
      FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
    CREATE POLICY "custom_roles admin write" ON public.custom_roles
      FOR ALL TO authenticated
      USING (public.has_role(auth.uid(), 'admin'))
      WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='role_permissions') THEN
    CREATE POLICY "role_permissions staff read" ON public.role_permissions
      FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
    CREATE POLICY "role_permissions admin write" ON public.role_permissions
      FOR ALL TO authenticated
      USING (public.has_role(auth.uid(), 'admin'))
      WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

-- transaction_payments + inventory tables + charge_heads: staff read/write
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'transaction_payments','charge_heads',
    'inv_stores','inv_item_groups','inv_items','inv_movements'
  ]) LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format(
        'CREATE POLICY "%1$s staff read" ON public.%1$s FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));', t);
      EXECUTE format(
        'CREATE POLICY "%1$s staff write" ON public.%1$s FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));', t);
    END IF;
  END LOOP;
END $$;

-- ─── 3. plan_durations + membership_plan_prices: staff-only write ────────────
DROP POLICY IF EXISTS "plan_durations write" ON public.plan_durations;
DROP POLICY IF EXISTS "plan_durations read"  ON public.plan_durations;
CREATE POLICY "plan_durations read" ON public.plan_durations
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "plan_durations staff write" ON public.plan_durations
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "mpp write" ON public.membership_plan_prices;
DROP POLICY IF EXISTS "mpp read"  ON public.membership_plan_prices;
CREATE POLICY "mpp read" ON public.membership_plan_prices
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "mpp staff write" ON public.membership_plan_prices
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- ─── 4. Per-action RBAC helper + tightened outlet-scope policies ─────────────
-- Helper: does the user hold the given action right on the given page_key?
-- Admins short-circuit to true. Falls back to true when no role_permissions
-- rows exist for the user at all (matches the UI's "unconfigured = allow" rule
-- in canView / useMyPermissions).
CREATE OR REPLACE FUNCTION public.user_has_action(_uid uuid, _page_key text, _action text)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_is_admin boolean;
  v_has_any  boolean;
  v_allowed  boolean;
BEGIN
  IF _uid IS NULL THEN RETURN false; END IF;

  -- admin app_role short-circuits
  IF public.has_role(_uid, 'admin') THEN RETURN true; END IF;

  -- custom-role is_admin short-circuits
  SELECT EXISTS (
    SELECT 1 FROM public.user_role_assignments ura
      JOIN public.custom_roles cr ON cr.id = ura.role_id
     WHERE ura.user_id = _uid AND cr.is_admin = true
  ) INTO v_is_admin;
  IF v_is_admin THEN RETURN true; END IF;

  -- If no permission rows configured for this user's roles at all, allow
  SELECT EXISTS (
    SELECT 1 FROM public.role_permissions rp
      JOIN public.user_role_assignments ura ON ura.role_id = rp.role_id
     WHERE ura.user_id = _uid
  ) INTO v_has_any;
  IF NOT v_has_any THEN RETURN true; END IF;

  -- Check the specific action flag
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

-- Map database tables → UI page_key used by role_permissions
-- bookings→bookings, payments→transactions, charges→transactions,
-- services→plans-services, membership_plans→plans-services
DO $$
DECLARE
  rec record;
  page_key text;
BEGIN
  FOR rec IN VALUES
    ('bookings','bookings'),
    ('payments','transactions'),
    ('charges','transactions'),
    ('services','plans-services'),
    ('membership_plans','plans-services')
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema='public' AND table_name=rec.column1) THEN
      -- Drop legacy outlet-scope FOR ALL policy
      EXECUTE format('DROP POLICY IF EXISTS %1$s_outlet_scope ON public.%1$s;', rec.column1);
      EXECUTE format('DROP POLICY IF EXISTS "%1$s outlet select" ON public.%1$s;', rec.column1);
      EXECUTE format('DROP POLICY IF EXISTS "%1$s outlet insert" ON public.%1$s;', rec.column1);
      EXECUTE format('DROP POLICY IF EXISTS "%1$s outlet update" ON public.%1$s;', rec.column1);
      EXECUTE format('DROP POLICY IF EXISTS "%1$s outlet delete" ON public.%1$s;', rec.column1);

      -- SELECT: outlet access + view right
      EXECUTE format($f$
        CREATE POLICY "%1$s outlet select" ON public.%1$s FOR SELECT TO authenticated
          USING (
            public.user_has_outlet_access(auth.uid(), outlet_id)
            AND public.user_has_action(auth.uid(), %2$L, 'view')
          );
      $f$, rec.column1, rec.column2);

      -- INSERT: outlet access + create right
      EXECUTE format($f$
        CREATE POLICY "%1$s outlet insert" ON public.%1$s FOR INSERT TO authenticated
          WITH CHECK (
            public.user_has_outlet_access(auth.uid(), outlet_id)
            AND public.user_has_action(auth.uid(), %2$L, 'create')
          );
      $f$, rec.column1, rec.column2);

      -- UPDATE: outlet access + edit right
      EXECUTE format($f$
        CREATE POLICY "%1$s outlet update" ON public.%1$s FOR UPDATE TO authenticated
          USING (
            public.user_has_outlet_access(auth.uid(), outlet_id)
            AND public.user_has_action(auth.uid(), %2$L, 'edit')
          )
          WITH CHECK (
            public.user_has_outlet_access(auth.uid(), outlet_id)
            AND public.user_has_action(auth.uid(), %2$L, 'edit')
          );
      $f$, rec.column1, rec.column2);

      -- DELETE: outlet access + delete right
      EXECUTE format($f$
        CREATE POLICY "%1$s outlet delete" ON public.%1$s FOR DELETE TO authenticated
          USING (
            public.user_has_outlet_access(auth.uid(), outlet_id)
            AND public.user_has_action(auth.uid(), %2$L, 'delete')
          );
      $f$, rec.column1, rec.column2);
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
