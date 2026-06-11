// Supabase-backed app user helpers.
// File name is kept for compatibility with existing imports.

import { supabase } from "./supabase";

export type UserRole = "admin" | "manager" | "staff" | "viewer";

export interface AppUser {
  id: string;
  uid?: string;
  username: string;
  email: string;
  fullName: string;
  phone?: string;
  address?: string;
  role: UserRole;
  /** Custom role id from RolesManager. When set, this is the actual assigned permission profile. */
  customRoleId?: string;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt?: string;
  createdBy?: string;
}

const SYSTEM_ROLES: UserRole[] = ["admin", "manager", "staff", "viewer"];

function mapRole(role?: string): UserRole {
  if (role === "admin" || role === "manager" || role === "staff" || role === "client") return role;
  return role === "member" ? "viewer" : "staff";
}

function dbRole(role: UserRole | string): "admin" | "manager" | "staff" | "member" | "client" {
  if (role === "admin" || role === "manager" || role === "staff") return role;
  if (role === "viewer") return "member";
  return "staff";
}

function mapRow(r: any): AppUser {
  const extras = r.extras && typeof r.extras === "object" ? r.extras : {};
  return {
    id: r.id,
    uid: r.id,
    username: extras.username || r.email?.split("@")[0] || "",
    email: r.email || "",
    fullName: r.display_name || "",
    phone: r.phone || "",
    address: extras.address || "",
    role: mapRole(r.role),
    customRoleId: extras.customRoleId || "",
    isActive: r.active !== false,
    mustChangePassword: extras.mustChangePassword !== false,
    createdAt: r.created_at || "",
    createdBy: extras.createdBy || "",
  };
}

async function syncRole(userId: string, role: UserRole | string) {
  await supabase.from("user_roles").delete().eq("user_id", userId);
  const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: dbRole(role) });
  if (error) throw error;
}

export async function getAppUsers(): Promise<AppUser[]> {
  const { data, error } = await supabase.from("app_users").select("*").order("created_at", { ascending: false });
  if (error) {
    console.warn("[app_users] read failed:", error.message);
    return [];
  }
  const ids = (data || []).map((r: any) => r.id);
  const { data: roles } = ids.length
    ? await supabase.from("user_roles").select("user_id, role").in("user_id", ids)
    : { data: [] as any[] };
  const roleByUser = new Map((roles || []).map((r: any) => [r.user_id, r.role]));
  return (data || []).map((r: any) => mapRow({ ...r, role: roleByUser.get(r.id) }));
}

export async function getAppUserByEmail(email: string): Promise<AppUser | null> {
  const { data, error } = await supabase.from("app_users").select("*").eq("email", email).maybeSingle();
  if (error) {
    console.warn("[app_users] read one failed:", error.message);
    return null;
  }
  if (!data) return null;
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.id).limit(1);
  return mapRow({ ...data, role: roles?.[0]?.role });
}

export async function createAppUserRecord(data: Omit<AppUser, "id" | "createdAt">): Promise<string> {
  const id = data.uid;
  if (!id) throw new Error("Missing Supabase auth user id");
  const { error } = await supabase.from("app_users").upsert(
    {
      id,
      email: data.email,
      display_name: data.fullName,
      phone: data.phone || null,
      active: data.isActive !== false,
      extras: {
        username: data.username,
        address: data.address || "",
        mustChangePassword: data.mustChangePassword !== false,
        customRoleId: data.customRoleId || "",
      },
    },
    { onConflict: "id" },
  );
  if (error) throw error;
  await syncRole(id, data.role);
  return id;
}

export async function updateAppUser(id: string, data: Partial<AppUser> & { customRoleId?: string }): Promise<void> {
  const current = (await getAppUsers()).find((u) => u.id === id);
  const extras = {
    username: current?.username || "",
    address: current?.address || "",
    mustChangePassword: current?.mustChangePassword ?? true,
    customRoleId: current?.customRoleId || "",
  } as any;
  const payload: Record<string, any> = { updated_at: new Date().toISOString() };
  if (data.email !== undefined) payload.email = data.email;
  if (data.fullName !== undefined) payload.display_name = data.fullName;
  if (data.phone !== undefined) payload.phone = data.phone;
  if (data.isActive !== undefined) payload.active = data.isActive;
  if (data.username !== undefined) extras.username = data.username;
  if (data.address !== undefined) extras.address = data.address;
  if (data.mustChangePassword !== undefined) extras.mustChangePassword = data.mustChangePassword;
  if (data.customRoleId !== undefined) extras.customRoleId = data.customRoleId;
  payload.extras = extras;
  const { error } = await supabase.from("app_users").update(payload).eq("id", id);
  if (error) throw error;
  if (data.role) await syncRole(id, data.role);
}

export async function deleteAppUser(id: string): Promise<void> {
  const { error } = await supabase.from("app_users").delete().eq("id", id);
  if (error) throw error;
}

export async function clearMustChangePassword(email: string): Promise<void> {
  const user = await getAppUserByEmail(email);
  if (user) await updateAppUser(user.id, { mustChangePassword: false });
}
