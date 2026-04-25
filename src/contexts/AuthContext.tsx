import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import { signIn, signUp, signOut, signInWithGoogle, changePassword as fbChangePassword } from "@/lib/firebase-auth";
import { getAppUserByEmail, clearMustChangePassword, type AppUser } from "@/lib/firebase-users";
import type { User } from "firebase/auth";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isConfigured: boolean;
  appUser: AppUser | null;
  mustChangePassword: boolean;
  refreshAppUser: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<any>;
  signUp: (email: string, password: string) => Promise<any>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<any>;
  changePassword: (current: string, next: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const [appUser, setAppUser] = useState<AppUser | null>(null);

  const refreshAppUser = useCallback(async () => {
    if (!auth.user?.email) {
      setAppUser(null);
      return;
    }
    try {
      const profile = await getAppUserByEmail(auth.user.email);
      setAppUser(profile);
    } catch {
      setAppUser(null);
    }
  }, [auth.user?.email]);

  useEffect(() => {
    refreshAppUser();
  }, [refreshAppUser]);

  const handleChangePassword = async (current: string, next: string) => {
    await fbChangePassword(current, next);
    if (auth.user?.email) {
      await clearMustChangePassword(auth.user.email);
      await refreshAppUser();
    }
  };

  const value: AuthContextType = {
    ...auth,
    appUser,
    mustChangePassword: !!appUser?.mustChangePassword,
    refreshAppUser,
    signIn,
    signUp,
    signOut,
    signInWithGoogle,
    changePassword: handleChangePassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext must be used within AuthProvider");
  return ctx;
}
