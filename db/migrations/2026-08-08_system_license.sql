-- =====================================================================
-- Zean Software — Client App Integration
-- Run this ONCE on each client property's own database (Lovable Cloud /
-- Supabase). The Master Admin Panel deploys license values into this table.
--
-- Contract version: 1.0.0 (see CLIENT_INTEGRATION.md section 0 and the
-- changelog in section 7). Bump only when the master panel announces a new
-- contract version.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.system_license (
  id            UUID PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  license_key   TEXT UNIQUE NOT NULL,
  client_name   TEXT NOT NULL,
  duration_days INT NOT NULL,
  expires_at    TIMESTAMPTZ,
  tier          TEXT DEFAULT 'standard',   -- 'trial' | 'standard' | 'enterprise'
  max_outlets   INT DEFAULT 1,
  is_active     BOOLEAN DEFAULT true,
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Data API access (PostgREST grants nothing on public by default).
GRANT SELECT, INSERT, UPDATE ON public.system_license TO anon, authenticated;
GRANT ALL ON public.system_license TO service_role;

ALTER TABLE public.system_license ENABLE ROW LEVEL SECURITY;

-- The client app reads its own license; the Master Admin Panel deploys it
-- using this property's publishable / anon key.
CREATE POLICY "License is readable" ON public.system_license
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "License can be deployed" ON public.system_license
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "License can be updated" ON public.system_license
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------
-- Reference queries used by the client app
-- ---------------------------------------------------------------------

-- 1. Read the singleton license row on startup.
SELECT license_key, client_name, duration_days, expires_at, tier,
       max_outlets, is_active, updated_at
FROM   public.system_license
WHERE  id = '00000000-0000-0000-0000-000000000001'::uuid;

-- 2. Server-side validation of a key entered by the user.
--    Returns one row only when the key matches AND the window is valid.
SELECT tier, max_outlets, expires_at
FROM   public.system_license
WHERE  id = '00000000-0000-0000-0000-000000000001'::uuid
  AND  license_key = $1            -- exact, case-sensitive, includes 'VFCM-'
  AND  is_active IS TRUE
  AND  (expires_at IS NULL OR expires_at > now());

-- 3. Optional convenience function for the client app.
CREATE OR REPLACE FUNCTION public.validate_license(_key text)
RETURNS TABLE (valid boolean, tier text, max_outlets int, expires_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    (l.license_key = _key AND l.is_active IS TRUE
      AND (l.expires_at IS NULL OR l.expires_at > now())) AS valid,
    l.tier, l.max_outlets, l.expires_at
  FROM public.system_license l
  WHERE l.id = '00000000-0000-0000-0000-000000000001'::uuid
$$;

REVOKE ALL ON FUNCTION public.validate_license(text) FROM public;
GRANT EXECUTE ON FUNCTION public.validate_license(text) TO anon, authenticated;

-- 4. Days remaining (display only).
SELECT GREATEST(0, CEIL(EXTRACT(EPOCH FROM (expires_at - now())) / 86400))::int
       AS days_remaining
FROM   public.system_license
WHERE  id = '00000000-0000-0000-0000-000000000001'::uuid;
