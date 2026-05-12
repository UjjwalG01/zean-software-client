import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { getOutlets, type Outlet } from "@/lib/firebase-outlets";

interface OutletCtx {
  outlets: Outlet[];
  selected: Outlet | null;
  setSelected: (o: Outlet | null) => void;
  isLoading: boolean;
  pickerOpen: boolean;
  setPickerOpen: (v: boolean) => void;
}

const Ctx = createContext<OutletCtx | null>(null);
const STORAGE_KEY = "vitafit.selectedOutletId";

export function OutletProvider({ children }: { children: ReactNode }) {
  const { data: outlets = [], isLoading } = useQuery({
    queryKey: ["outlets"],
    queryFn: getOutlets,
  });

  const [selectedId, setSelectedId] = useState<string | null>(() =>
    typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null
  );
  const [pickerOpen, setPickerOpen] = useState(false);

  const active = outlets.filter((o) => o.active);
  const selected = active.find((o) => o.id === selectedId) || null;

  // Auto-select if only one
  useEffect(() => {
    if (!isLoading && active.length === 1 && !selected) {
      setSelectedId(active[0].id);
      localStorage.setItem(STORAGE_KEY, active[0].id);
    }
  }, [isLoading, active.length, selected]);

  const setSelected = (o: Outlet | null) => {
    setSelectedId(o?.id || null);
    if (o?.id) localStorage.setItem(STORAGE_KEY, o.id);
    else localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <Ctx.Provider value={{ outlets: active, selected, setSelected, isLoading, pickerOpen, setPickerOpen }}>
      {children}
    </Ctx.Provider>
  );
}

export function useOutlet() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useOutlet must be used inside OutletProvider");
  return ctx;
}
