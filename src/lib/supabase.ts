import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  // eslint-disable-next-line no-console
  console.warn("[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY — Supabase calls will fail.");
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
