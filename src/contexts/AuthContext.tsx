import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  signIn,
  signOut,
  changePassword as fbChangePassword,
} from "@/lib/auth-service";
import {
  getAppUserByEmail,
  clearMustChangePassword,
  type AppUser,
} from "@/lib/firebase-users";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isConfigured: boolean;
  appUser: AppUser | null;
  mustChangePassword: boolean;
  refreshAppUser: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<any>;
  signOut: () => Promise<void>;
  changePassword: (
    current: string,
    next: string,
    confirm: string,
  ) => Promise<void>;
}

const AuthContext = createContext<{
  user: User | null;
  loading: boolean;
  appUser: AppUser | null;
}>({
  user: null,
  loading: true,
  appUser: null,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadAppUser = async (email: string | null | undefined) => {
      if (!email) {
        if (active) setAppUser(null);
        return;
      }
      try {
        const profile = await getAppUserByEmail(email);
        if (active) setAppUser(profile);
      } catch {
        if (active) setAppUser(null);
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return;
      setUser(session?.user ?? null);
      setLoading(false);
      loadAppUser(session?.user?.email);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setUser(session?.user ?? null);
      setLoading(false);
      loadAppUser(session?.user?.email);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, appUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = () => useContext(AuthContext);


// const AuthContext = createContext<AuthContextType | null>(null);

// export function AuthProvider({ children }: { children: ReactNode }) {
//   const auth = useAuth();
//   const [appUser, setAppUser] = useState<AppUser | null>(null);

//   const refreshAppUser = useCallback(async () => {
//     if (!auth.user?.email) {
//       setAppUser(null);
//       return;
//     }
//     try {
//       const profile = await getAppUserByEmail(auth.user.email);
//       setAppUser(profile);
//     } catch {
//       setAppUser(null);
//     }
//   }, [auth.user?.email]);

//   useEffect(() => {
//     refreshAppUser();
//   }, [refreshAppUser]);

//   const handleChangePassword = async (
//     current: string,
//     next: string,
//     confirm: string,
//   ) => {
//     await fbChangePassword(current, next, confirm);
//     if (auth.user?.email) {
//       await clearMustChangePassword(auth.user.email);
//       await refreshAppUser();
//     }
//   };

//   const value: AuthContextType = {
//     ...auth,
//     appUser,
//     mustChangePassword: !!appUser?.mustChangePassword,
//     refreshAppUser,
//     signIn,
//     signOut,
//     changePassword: handleChangePassword,
//   };

//   return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
// }

// export function useAuthContext() {
//   const ctx = useContext(AuthContext);
//   if (!ctx) throw new Error("useAuthContext must be used within AuthProvider");
//   return ctx;
// }
