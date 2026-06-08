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
  // legacy aliases still passed by older call sites
  | "Users";

export interface AuditEntry {
  module: AuditModule | string;
  /** Optional slug from `modules` table — used to populate audit_logs.module_id. */
  moduleSlug?: string;
  /** Entity type label (e.g. "member", "booking", "payment") — used to build descriptions. */
  entityType?: string;
  action: string; // e.g. "create", "update", "cancel", "void", "settle"
  entityId?: string;
  oldValue?: any;
  newValue?: any;
}

/** Resolve module name → canonical slug from the modules registry. */
function slugForModuleName(name: string): string | undefined {
  const hit = FALLBACK_MODULES.find((m) => m.name.toLowerCase() === name.toLowerCase());
  return hit?.slug;
}

/** Map entity types written by services back to a module slug. */
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

/**
 * Best-effort audit log writer. Failures are swallowed so they never break
 * the user flow; we only console.warn so we still notice in dev.
 */
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const slug =
      entry.moduleSlug ||
      (entry.module ? slugForModuleName(String(entry.module)) : undefined) ||
      (entry.entityType ? ENTITY_TO_SLUG[entry.entityType.toLowerCase()] : undefined);
    const moduleName = slug ? moduleNameForSlug(slug) : String(entry.module || "");
    const module_id = slug ? await getModuleIdBySlug(slug) : null;
    await supabase.from("audit_logs").insert({
      actor_id: user?.id ?? null,
      user_email: user?.email ?? null,
      module: moduleName,
      module_id,
      action: entry.action,
      entity_id: entry.entityId ?? null,
      old_value: entry.oldValue ?? null,
      new_value: entry.newValue ?? null,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[audit] failed to log", entry, e);
  }
}

export interface AuditRow {
  id: string;
  ts: string;
  user_email: string | null;
  module: string;
  action: string;
  entity_id: string | null;
  description: string;
}

function buildDescription(
  module: string,
  action: string,
  entityId: string | null,
  user: string | null,
  newValue: any,
): string {
  const who = user || "system";
  const what = entityId ? ` #${entityId.slice(0, 8)}` : "";
  const extra =
    newValue && typeof newValue === "object"
      ? newValue.name || newValue.title || newValue.amount
        ? ` (${newValue.name || newValue.title || newValue.amount})`
        : ""
      : "";
  return `${who} ${action}d a ${module.toLowerCase()} record${what}${extra}`.trim();
}

export async function listAuditLogs(filters: {
  module?: string;
  action?: string;
  from?: string;
  to?: string;
  search?: string;
  limit?: number;
}): Promise<AuditRow[]> {
  // Only request the fields the UI actually needs.
  let q = supabase
    .from("audit_logs")
    .select("id, ts, user_email, module, action, entity_id, new_value")
    .order("ts", { ascending: false })
    .limit(filters.limit ?? 500);
  if (filters.module && filters.module !== "all") q = q.eq("module", filters.module);
  if (filters.action && filters.action !== "all") q = q.eq("action", filters.action);
  if (filters.from) q = q.gte("ts", filters.from);
  if (filters.to) q = q.lte("ts", filters.to);
  const { data, error } = await q;
  if (error) {
    // eslint-disable-next-line no-console
    console.warn("[audit] list failed", error.message);
    return [];
  }
  let rows = (data || []).map((r: any) => ({
    id: r.id,
    ts: r.ts,
    user_email: r.user_email,
    module: r.module,
    action: r.action,
    entity_id: r.entity_id,
    description: buildDescription(r.module, r.action, r.entity_id, r.user_email, r.new_value),
  })) as AuditRow[];
  if (filters.search) {
    const s = filters.search.toLowerCase();
    rows = rows.filter(
      (r) =>
        (r.user_email || "").toLowerCase().includes(s) ||
        (r.entity_id || "").toLowerCase().includes(s) ||
        (r.action || "").toLowerCase().includes(s) ||
        (r.description || "").toLowerCase().includes(s),
    );
  }
  return rows;
}
