import { createClient } from "@supabase/supabase-js";

// ─── Environment-driven configuration ──────────────────────────────────────
// All Supabase endpoint + key data is read from environment variables so the
// same codebase can be deployed against any client/tenant by swapping the
// `.env` file. NEVER hardcode a project URL or key here.
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || "";
const SUPABASE_PUBLISHABLE_KEY =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)?.trim() || "";

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  // eslint-disable-next-line no-console
  console.error(
    "[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. " +
      "Set them in your .env (or hosting provider env) before building/deploying."
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  },
});

/** One-shot connectivity probe — call from a useEffect to verify the project is reachable. */
export async function pingSupabase(): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await supabase.from("app_users").select("id", { count: "exact", head: true });
    if (error && !/relation .* does not exist/i.test(error.message)) {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}
