import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/inventory", label: "Product Catalog" },
  { to: "/inventory/movements", label: "Stock Movements" },
  { to: "/inventory/analytics", label: "Analytics" },
];

/**
 * Route-driven tab bar shared by the three inventory screens.
 * Mirrors the shadcn `TabsList` styling so the premium dark/gold theme is kept.
 */
export function InventoryTabsNav() {
  const { pathname } = useLocation();
  return (
    <div className="inline-flex h-10 items-center justify-center rounded-md bg-muted/50 p-1 text-muted-foreground">
      {TABS.map((t) => {
        const active = pathname === t.to;
        return (
          <NavLink
            key={t.to}
            to={t.to}
            className={cn(
              "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all",
              active
                ? "bg-background text-foreground shadow-sm"
                : "hover:text-foreground",
            )}
          >
            {t.label}
          </NavLink>
        );
      })}
    </div>
  );
}
