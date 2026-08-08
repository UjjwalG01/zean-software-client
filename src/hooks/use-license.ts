import { useCallback, useEffect, useState } from "react";
import {
  activateLicense,
  checkStoredLicense,
  type LicenseState,
} from "@/lib/license";

interface UseLicenseResult {
  state: LicenseState | null;
  loading: boolean;
  isValid: boolean;
  refresh: () => Promise<LicenseState>;
  activate: (key: string) => Promise<LicenseState>;
}

/** Resolves the installation license on mount and exposes renewal actions. */
export function useLicense(): UseLicenseResult {
  const [state, setState] = useState<LicenseState | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const next = await checkStoredLicense();
    setState(next);
    setLoading(false);
    return next;
  }, []);

  const activate = useCallback(async (key: string) => {
    const next = await activateLicense(key);
    setState(next);
    setLoading(false);
    return next;
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    state,
    loading,
    isValid: state?.status === "active",
    refresh,
    activate,
  };
}
