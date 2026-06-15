import { supabase } from "./supabase";
import { getModuleIdBySlug, FALLBACK_MODULES } from "./modules";

export type AuditModule =
  | "Dashboard"
  | "Members"
  | "Bookings"
  | "Attendance"
  | "Transactions"
  | "Inventory"
  | "Reports"
  | "Forecast"
  | "Audit Logs"
  | "General Setup"
  | "Outlets"
  | "Service Types"
  | "Plans & Services"
  | "Stores"
  | "Item Groups"
  | "Charge Heads"
  | "Users & Roles"
  | "Email Templates"
  | "Settings"
  | "Users";

export interface AuditEntry {
  module: AuditModule | string;
  moduleSlug?: string;
  entityType?: string;
  action: string;
  entityId?: string;
  outletId?: string | null;
  outletName?: string | null;
  oldValue?: any;
  newValue?: any;
}

function slugForModuleName(name: string): string | undefined {
  const hit = FALLBACK_MODULES.find((m) => m.name.toLowerCase() === name.toLowerCase());
  return hit?.slug;
}

const ENTITY_TO_SLUG: Record<string, string> = {
  member: "members",
  booking: "bookings",
  payment: "transactions",
  transaction: "transactions",
  charge: "transactions",
  attendance: "attendance",
  checkin: "attendance",
  service: "service-types",
  membership_plan: "plans",
  plan: "plans",
  outlet: "outlets",
  store: "stores",
  item_group: "item-groups",
  charge_head: "charge-heads",
  email_template: "email-templates",
  user: "users",
  role: "users",
  setting: "settings",
  inventory_item: "inventory",
};

function moduleNameForSlug(slug: string): string {
  return FALLBACK_MODULES.find((m) => m.slug === slug)?.name || slug;
}

async function resolveActiveOutlet(): Promise<{ id: string | null; name: string | null }> {
  try {
    const id = typeof window !== "undefined" ? window.localStorage.getItem("vitafit.selectedOutletId") : null;
    if (!id) return { id: null, name: null };
    const { data } = await supabase.from("outlets").select("name").eq("id", id).maybeSingle();

    return { id, name: (data as any)?.name || null };
  } catch {
    return { id: null, name: null };
  }
}

const { data: { user } } = await supabase.auth.getUser();
const { data: app_user_data, error } = await supabase
  .from("app_users")
  .select("display_name, extras")
  .eq("id", user.id) // Replace targetUserId with your variable containing the ID
  .single();

// console.log(username)
/**
 * Writes logs to the database using exact matching schema properties.
 */
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    const slug =
      entry.moduleSlug ||
      (entry.module ? slugForModuleName(String(entry.module)) : undefined) ||
      (entry.entityType ? ENTITY_TO_SLUG[entry.entityType.toLowerCase()] : undefined);

    const moduleName = slug ? moduleNameForSlug(slug) : String(entry.module || "General");
    const module_id = slug ? await getModuleIdBySlug(slug) : null;

    const outlet = entry.outletId
      ? { id: entry.outletId, name: entry.outletName || null }
      : await resolveActiveOutlet();

    const actorEmail = user?.email ?? null;
    const currentTs = new Date().toISOString();
    const outletLabel = outlet.name || "app";
    // const userFullName = user?.user_metadata?.display_name || user?.user_metadata?.first_name || null
    const userFullName = app_user_data.display_name;
    const { username } = app_user_data.extras;

    const inferredEntityType = entry.entityType || slug || moduleName.toLowerCase().replace(/\s+/g, '-');
    const generatedDescription = `${userFullName || "system"} ${entry.action}d in ${inferredEntityType} inside the ${outletLabel}`;

    await supabase.from("audit_logs").insert({
      actor_id: user?.id ?? null,
      actor_email: actorEmail, // Matches table layout metric
      user_id: user?.id ?? null,
      username: username || user?.email?.split("@")[0] || null,
      user_full_name: userFullName,
      entity_type: inferredEntityType,
      module: moduleName,
      module_name: moduleName,
      module_id,
      action: entry.action,
      entity_id: entry.entityId ?? null,
      old_value: entry.oldValue ?? null,
      outlet_name: outlet.name || "No Outlet",
      ts: currentTs, // Matches schema 'ts' requirement
      new_value: {
        ...(entry.newValue && typeof entry.newValue === "object" ? entry.newValue : { value: entry.newValue }),
        __outletId: outlet.id,
        __outletName: outlet.name,
        __description: generatedDescription,
        __ts: currentTs
      },
    });
  } catch (e) {
    console.warn("[audit] failed to log", entry, e);
  }
}

export interface AuditRow {
  id: string;
  ts: string; // Synced with schema database column
  actor_email: string | null;
  user_full_name: string | null;
  module: string | null;
  action: string;
  entity_id: string | null;
  outlet_name: string | null;
  description: string;
}

export async function listAuditLogs(filters: {
  module?: string;
  action?: string;
  from?: string;
  to?: string;
  search?: string;
  limit?: number;
}): Promise<AuditRow[]> {
  let q = supabase
    .from("audit_logs")
    .select("id, ts, actor_email, user_full_name, module, action, entity_id, outlet_name, new_value")
    .order("ts", { ascending: false })
    .limit(filters.limit ?? 300);

  if (filters.module && filters.module !== "all") q = q.eq("module", filters.module);
  if (filters.action && filters.action !== "all") q = q.eq("action", filters.action);
  if (filters.from) q = q.gte("ts", filters.from);
  if (filters.to) q = q.lte("ts", filters.to);

  const { data, error } = await q;
  if (error) {
    console.warn("[audit] list failed", error.message);
    return [];
  }

  let rows = (data || []).map((r: any) => {
    const descriptionText = r.new_value?.__description
      || `${r.user_full_name || "system"} ${r.action}dj in ${r.module || "—"}`;

    return {
      id: r.id,
      ts: r.ts,
      actor_email: r.actor_email,
      user_full_name: r.user_full_name,
      module: r.module,
      action: r.action,
      entity_id: r.entity_id,
      outlet_name: r.outlet_name,
      description: descriptionText
    };
  }) as AuditRow[];

  if (filters.search) {
    const s = filters.search.toLowerCase();
    rows = rows.filter(
      (r) =>
        (r.actor_email || "").toLowerCase().includes(s) ||
        (r.user_full_name || "").toLowerCase().includes(s) ||
        (r.entity_id || "").toLowerCase().includes(s) ||
        (r.action || "").toLowerCase().includes(s) ||
        (r.description || "").toLowerCase().includes(s),
    );
  }

  return rows;
}