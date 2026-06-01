import { supabase } from "./supabase";

export type AuditModule = "Members" | "Bookings" | "Transactions" | "Users" | "Settings";

export interface AuditEntry {
  module: AuditModule;
  action: string;        // e.g. "create", "update", "cancel", "void", "settle"
  entityId?: string;
  oldValue?: any;
  newValue?: any;
}

/**
 * Best-effort audit log writer. Failures are swallowed so they never break
 * the user flow; we only console.warn so we still notice in dev.
 */
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("audit_logs").insert({
      user_id: user?.id ?? null,
      user_email: user?.email ?? null,
      module: entry.module,
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
  user_id: string | null;
  user_email: string | null;
  module: string;
  action: string;
  entity_id: string | null;
  old_value: any;
  new_value: any;
}

export async function listAuditLogs(filters: {
  module?: string;
  action?: string;
  from?: string;
  to?: string;
  search?: string;
  limit?: number;
}): Promise<AuditRow[]> {
  let q = supabase.from("audit_logs").select("*").order("ts", { ascending: false }).limit(filters.limit ?? 500);
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
  let rows = (data || []) as AuditRow[];
  if (filters.search) {
    const s = filters.search.toLowerCase();
    rows = rows.filter((r) =>
      (r.user_email || "").toLowerCase().includes(s) ||
      (r.entity_id || "").toLowerCase().includes(s) ||
      (r.action || "").toLowerCase().includes(s)
    );
  }
  return rows;
}
