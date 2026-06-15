import { useState, useEffect } from "react";
import { onAuthChange } from "@/lib/auth-service";
import type { User } from "@supabase/supabase-js";

const supabaseConfigured = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthChange((u) => {
      setUser(u);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return { user, loading, isConfigured: supabaseConfigured };
}
