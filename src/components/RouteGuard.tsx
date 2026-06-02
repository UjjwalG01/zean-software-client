import { useLocation, Navigate } from "react-router-dom";
import { useMyPermissions, canView } from "@/hooks/use-permissions";

// Maps URL prefix → permission page key (same keys as AppSidebar items)
const ROUTE_KEYS: { prefix: string; key: string }[] = [
  { prefix: "/audit-logs", key: "audit-logs" },
  { prefix: "/members", key: "members" },
  { prefix: "/bookings", key: "bookings" },
  { prefix: "/attendance", key: "attendance" },
  { prefix: "/transactions", key: "transactions" },
  { prefix: "/inventory", key: "inventory" },
  { prefix: "/reports", key: "reports" },
  { prefix: "/forecast", key: "forecast" },
  { prefix: "/setup/general", key: "general" },
  { prefix: "/setup/outlets", key: "outlets" },
  { prefix: "/setup/service-types", key: "service-types" },
  { prefix: "/setup/plans", key: "plans" },
  { prefix: "/setup/stores", key: "stores" },
  { prefix: "/setup/item-groups", key: "item-groups" },
  { prefix: "/setup/charge-heads", key: "charge-heads" },
  { prefix: "/setup/users", key: "users" },
  { prefix: "/setup/email-templates", key: "email-templates" },
  { prefix: "/setup/settings", key: "settings" },
  { prefix: "/", key: "dashboard" },
];

function pageKeyForPath(path: string): string {
  const hit = ROUTE_KEYS.find((r) => (r.prefix === "/" ? path === "/" : path.startsWith(r.prefix)));
  return hit?.key || "dashboard";
}

function firstAllowedRoute(perms: any): string {
  if (!perms || perms.isAdmin) return "/";
  for (const r of ROUTE_KEYS) {
    if (perms.perms?.[r.key]?.view) return r.prefix === "/" ? "/" : r.prefix;
  }
  return "/";
}

/** Redirects users without `view` on the current page to their first allowed page. */
export function RouteGuard({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const { data: myPerms, isLoading } = useMyPermissions();

  if (isLoading) return <>{children}</>;
  const key = pageKeyForPath(pathname);
  if (canView(myPerms, key)) return <>{children}</>;

  const dest = firstAllowedRoute(myPerms);
  if (dest === pathname) return <>{children}</>;
  return <Navigate to={dest} replace />;
}
