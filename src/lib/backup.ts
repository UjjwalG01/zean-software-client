// Full-property backup helper. Exports all tables for a given outlet (and the
// global lookup tables) as a single downloadable JSON file.

import { supabase } from "./supabase";

const OUTLET_SCOPED = [
  "members",
  "bookings",
  "payments",
  "attendance",
  "charges",
  "services",
  "inv_items",
  "inv_movements",
] as const;

const GLOBAL = [
  "outlets",
  "service_types",
  "membership_plans",
  "membership_plan_prices",
  "plan_durations",
  "discount_rules",
  "company_settings",
  "inv_stores",
  "inv_item_groups",
  "audit_log",
  "app_users",
  "user_roles",
] as const;

export interface BackupBundle {
  exportedAt: string;
  outletId: string | null;
  schemaVersion: 1;
  tables: Record<string, unknown[]>;
}

async function fetchTable(table: string, outletId?: string | null): Promise<unknown[]> {
  let q = supabase.from(table).select("*");
  if (outletId) {
    try {
      const filtered = q.eq("outlet_id", outletId);
      const { data, error } = await filtered;
      if (!error) return data || [];
    } catch {
      /* table has no outlet_id column — fall through */
    }
  }
  const { data, error } = await supabase.from(table).select("*");
  if (error) {
    // eslint-disable-next-line no-console
    console.warn(`[backup] ${table} failed:`, error.message);
    return [];
  }
  return data || [];
}

export async function exportPropertyBackup(outletId: string | null): Promise<BackupBundle> {
  const scoped = await Promise.all(
    OUTLET_SCOPED.map(async (t) => [t, await fetchTable(t, outletId)] as const),
  );
  const global = await Promise.all(
    GLOBAL.map(async (t) => [t, await fetchTable(t, null)] as const),
  );

  const tables: Record<string, unknown[]> = {};
  for (const [name, rows] of [...scoped, ...global]) tables[name] = rows;

  return {
    exportedAt: new Date().toISOString(),
    outletId,
    schemaVersion: 1,
    tables,
  };
}

export function downloadBackup(bundle: BackupBundle, label: string): void {
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const date = new Date().toISOString().slice(0, 10);
  const slug = (label || "property").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  a.download = `vitafit-backup-${slug || "property"}-${date}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
