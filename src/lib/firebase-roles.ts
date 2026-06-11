// Custom roles + permissions — Supabase-backed.
// Tables: custom_roles, role_permissions, user_role_assignments (see migration).
import { supabase } from "./supabase";

export type RoleRights = { view: boolean; add: boolean; change: boolean; trash: boolean };
export type RolePermissions = Record<string, RoleRights>;
export interface CustomRole {
  id: string;
  name: string;
  description?: string;
  isAdmin: boolean;
  active: boolean;
  permissions: RolePermissions;
}

function emptyRights(): RoleRights { return { view: false, add: false, change: false, trash: false }; }

function mapPermRow(rows: any[]): RolePermissions {
  const out: RolePermissions = {};
  for (const r of rows || []) {
    out[r.page_key] = {
      view: !!r.can_view, add: !!r.can_create, change: !!r.can_edit, trash: !!r.can_delete,
    };
  }
  return out;
}

export async function listCustomRoles(): Promise<CustomRole[]> {
  const { data: roles, error } = await supabase.from("custom_roles").select("*").order("name");
  if (error) { console.warn("[custom_roles] read failed:", error.message); return []; }
  const ids = (roles || []).map((r: any) => r.id);
  const { data: perms } = ids.length
    ? await supabase.from("role_permissions").select("*").in("role_id", ids)
    : { data: [] as any[] };
  const byRole = new Map<string, any[]>();
  (perms || []).forEach((p: any) => {
    const arr = byRole.get(p.role_id) || []; arr.push(p); byRole.set(p.role_id, arr);
  });
  return (roles || []).map((r: any) => ({
    id: r.id, name: r.name, description: r.description || "",
    isAdmin: !!r.is_admin, active: r.active !== false,
    permissions: mapPermRow(byRole.get(r.id) || []),
  }));
}

export async function saveCustomRole(role: Omit<CustomRole, "id"> & { id?: string }): Promise<string> {
  let id = role.id;
  if (id) {
    const { error } = await supabase.from("custom_roles").update({
      name: role.name, description: role.description || null,
      is_admin: role.isAdmin, active: role.active,
    }).eq("id", id);
    if (error) throw error;
  } else {
    const { data, error } = await supabase.from("custom_roles").insert({
      name: role.name, description: role.description || null,
      is_admin: role.isAdmin, active: role.active,
    }).select("id").single();
    if (error) throw error;
    id = data.id;
  }
  // Replace permissions
  await supabase.from("role_permissions").delete().eq("role_id", id);
  const rows = Object.entries(role.permissions).map(([page_key, r]) => ({
    role_id: id, page_key, can_view: r.view, can_create: r.add, can_edit: r.change, can_delete: r.trash,
  })).filter((r) => r.can_view || r.can_create || r.can_edit || r.can_delete);
  if (rows.length) {
    const { error } = await supabase.from("role_permissions").insert(rows);
    if (error) throw error;
  }
  return id!;
}

export async function deleteCustomRole(id: string): Promise<void> {
  const { error } = await supabase.from("custom_roles").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Assign a role to a user, optionally scoped to outlets. When `outletIds` is
 * empty, a single row with outlet_id=NULL is inserted (= "all outlets").
 */
export async function assignRoleToUser(userId: string, roleId: string, outletIds: string[] = []): Promise<void> {
  // Remove existing assignments for this user, then insert fresh ones.
  await supabase.from("user_role_assignments").delete().eq("user_id", userId);
  const rows = outletIds.length
    ? outletIds.map((oid) => ({ user_id: userId, role_id: roleId, outlet_id: oid, assigned_at: new Date().toISOString() }))
    : [{ user_id: userId, role_id: roleId, outlet_id: null, assigned_at: new Date().toISOString() }];
  const { error } = await supabase.from("user_role_assignments").insert(rows);
  if (error) throw error;
}

export async function getUserAssignedRoleId(userId: string): Promise<string | null> {
  const { data, error } = await supabase.from("user_role_assignments")
    .select("role_id").eq("user_id", userId).limit(1).maybeSingle();
  if (error || !data) return null;
  return data.role_id;
}

export async function getUserAssignedOutlets(userId: string): Promise<string[]> {
  const { data } = await supabase.from("user_role_assignments")
    .select("outlet_id").eq("user_id", userId);
  return (data || []).map((r: any) => r.outlet_id).filter(Boolean) as string[];
}

export async function getUserPermissions(userId: string): Promise<{ isAdmin: boolean; perms: RolePermissions; outletIds: string[] }> {
  const roleId = await getUserAssignedRoleId(userId);
  if (!roleId) return { isAdmin: false, perms: {}, outletIds: [] };
  const { data: role } = await supabase.from("custom_roles").select("is_admin").eq("id", roleId).maybeSingle();
  const outletIds = await getUserAssignedOutlets(userId);
  if (role?.is_admin) return { isAdmin: true, perms: {}, outletIds };
  const { data: perms } = await supabase.from("role_permissions").select("*").eq("role_id", roleId);
  return { isAdmin: false, perms: mapPermRow(perms || []), outletIds };
}

export { emptyRights };
