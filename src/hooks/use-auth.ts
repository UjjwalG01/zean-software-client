import { useState, useEffect } from "react";
import { isConfigured } from "@/lib/firebase";
import { onAuthChange } from "@/lib/firebase-auth";
import type { User } from "@supabase/supabase-js";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isConfigured()) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthChange((u) => {
      setUser(u);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return { user, loading, isConfigured: isConfigured() };
}
