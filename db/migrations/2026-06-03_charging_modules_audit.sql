-- =============================================================================
-- VitaFit Club — 2026-06-03 update
-- Adds:
--   1. modules table (single source of truth for app pages / RBAC)
--   2. audit_logs.module_id link
--   3. payments.charge_head, payments.linked_booking_id, payments.linked_charge_ids
--      to support the charging-first flow.
-- Safe to re-run (idempotent).
-- =============================================================================

-- 1. Modules ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.modules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  description text,
  parent_id   uuid REFERENCES public.modules(id) ON DELETE SET NULL,
  route       text,
  icon        text,
  order_index integer NOT NULL DEFAULT 0,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_modules_slug ON public.modules (slug);
CREATE INDEX IF NOT EXISTS idx_modules_parent ON public.modules (parent_id);

GRANT SELECT ON public.modules TO authenticated, anon;
GRANT ALL    ON public.modules TO service_role;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS modules_select ON public.modules;
CREATE POLICY modules_select ON public.modules
  FOR SELECT TO authenticated, anon USING (true);
DROP POLICY IF EXISTS modules_write ON public.modules;
CREATE POLICY modules_write ON public.modules
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed app pages. Idempotent via ON CONFLICT (slug).
INSERT INTO public.modules (name, slug, route, icon, order_index) VALUES
  ('Dashboard',       'dashboard',       '/',                       'LayoutDashboard', 10),
  ('Members',         'members',         '/members',                'Users',           20),
  ('Bookings',        'bookings',        '/bookings',               'CalendarDays',    30),
  ('Attendance',      'attendance',      '/attendance',             'UserCheck',       40),
  ('Transactions',    'transactions',    '/transactions',           'Receipt',         50),
  ('Inventory',       'inventory',       '/inventory',              'Package',         60),
  ('Reports',         'reports',         '/reports',                'BarChart3',       70),
  ('Forecast',        'forecast',        '/forecast',               'TrendingUp',      80),
  ('Audit Logs',      'audit-logs',      '/audit-logs',             'ScrollText',      90),
  ('General Setup',   'general',         '/setup/general',          'Wrench',          200),
  ('Outlets',         'outlets',         '/setup/outlets',          'Building2',       210),
  ('Service Types',   'service-types',   '/setup/service-types',    'Tag',             220),
  ('Plans & Services','plans',           '/setup/plans',            'Dumbbell',        230),
  ('Stores',          'stores',          '/setup/stores',           'Warehouse',       240),
  ('Item Groups',     'item-groups',     '/setup/item-groups',      'Layers',          250),
  ('Charge Heads',    'charge-heads',    '/setup/charge-heads',     'Tag',             260),
  ('Users & Roles',   'users',           '/setup/users',            'UserCog',         270),
  ('Email Templates', 'email-templates', '/setup/email-templates',  'Mail',            280),
  ('Settings',        'settings',        '/setup/settings',         'Settings',        290)
ON CONFLICT (slug) DO UPDATE
  SET name = EXCLUDED.name,
      route = EXCLUDED.route,
      icon = EXCLUDED.icon,
      order_index = EXCLUDED.order_index;

-- 2. Audit logs — link to module ----------------------------------------------
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS module_id uuid REFERENCES public.modules(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_audit_module_id ON public.audit_logs (module_id);

-- 3. Payments — charging-first metadata ---------------------------------------
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS charge_head        text,
  ADD COLUMN IF NOT EXISTS linked_booking_id  uuid,
  ADD COLUMN IF NOT EXISTS linked_charge_ids  uuid[];

CREATE INDEX IF NOT EXISTS idx_payments_linked_booking ON public.payments (linked_booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_charge_head    ON public.payments (charge_head);
