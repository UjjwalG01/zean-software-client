// App modules registry. Read from the `modules` Supabase table when available;
// otherwise fall back to a hardcoded list so the UI never breaks. Used by
// Role Management, Audit Logs filters and RouteGuard.
import { supabase } from "./supabase";

export interface AppModule {
  id: string;
  name: string;
  slug: string;
  route: string | null;
  icon: string | null;
  parentId: string | null;
  orderIndex: number;
  active: boolean;
}

/** Hardcoded fallback — mirrors the DB seed in 2026-06-03 migration. */
export const FALLBACK_MODULES: AppModule[] = [
  ["Dashboard","dashboard","/",10],
  ["Members","members","/members",20],
  ["Bookings","bookings","/bookings",30],
  ["Attendance","attendance","/attendance",40],
  ["Transactions","transactions","/transactions",50],
  ["Inventory","inventory","/inventory",60],
  ["Reports","reports","/reports",70],
  ["Forecast","forecast","/forecast",80],
  ["Audit Logs","audit-logs","/audit-logs",90],
  ["General Setup","general","/setup/general",200],
  ["Outlets","outlets","/setup/outlets",210],
  ["Service Types","service-types","/setup/service-types",220],
  ["Plans & Services","plans","/setup/plans",230],
  ["Stores","stores","/setup/stores",240],
  ["Item Groups","item-groups","/setup/item-groups",250],
  ["Charge Heads","charge-heads","/setup/charge-heads",260],
  ["Users & Roles","users","/setup/users",270],
  ["Email Templates","email-templates","/setup/email-templates",280],
  ["Settings","settings","/setup/settings",290],
].map(([name, slug, route, order]) => ({
  id: slug as string,
  name: name as string,
  slug: slug as string,
  route: route as string,
  icon: null,
  parentId: null,
  orderIndex: order as number,
  active: true,
}));

let cache: AppModule[] | null = null;
let slugIndex: Map<string, string> | null = null;

export async function getModules(): Promise<AppModule[]> {
  if (cache) return cache;
  try {
    const { data, error } = await supabase
      .from("modules")
      .select("*")
      .eq("active", true)
      .order("order_index", { ascending: true });
    if (error || !data || data.length === 0) {
      cache = FALLBACK_MODULES;
    } else {
      cache = data.map((r: any) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        route: r.route,
        icon: r.icon,
        parentId: r.parent_id,
        orderIndex: r.order_index ?? 0,
        active: r.active !== false,
      }));
    }
  } catch {
    cache = FALLBACK_MODULES;
  }
  slugIndex = new Map(cache.map((m) => [m.slug, m.id]));
  return cache;
}

/** Returns the DB id of a module by slug, or null if not found / fallback mode. */
export async function getModuleIdBySlug(slug: string): Promise<string | null> {
  if (!slugIndex) await getModules();
  const id = slugIndex?.get(slug) || null;
  // In fallback mode ids equal slugs — those are NOT real uuids, return null
  // so audit log inserts don't violate FK.
  if (id && id === slug) return null;
  return id;
}

/** SETUP-group slugs (used by RolesManager grouping). */
export const SETUP_SLUGS = new Set([
  "general","outlets","service-types","plans","stores","item-groups",
  "charge-heads","users","email-templates","settings",
]);
