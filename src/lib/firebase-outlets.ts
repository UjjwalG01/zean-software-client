// Outlets + Service Types — Supabase-backed.
// File name kept as "firebase-outlets" for back-compat with existing imports;
// the implementation now talks to Supabase (tables: outlets, service_types).

import { supabase } from "./supabase";

// ─── Service Types ──────────────────────────────────────────────────
export interface ServiceTypeDoc {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  color?: string;
  /** Optional — kept for back-compat with old card images. UI no longer edits it. */
  defaultImage?: string;
  active: boolean;
}

function slugify(s: string): string {
  return (s || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function mapServiceTypeRow(r: any): ServiceTypeDoc {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    icon: r.icon || "",
    color: r.color || "#f5b300",
    defaultImage: r.default_image || "",
    active: r.active !== false,
  };
}

export async function getServiceTypes(): Promise<ServiceTypeDoc[]> {
  const { data, error } = await supabase
    .from("service_types")
    .select("*")
    .order("name", { ascending: true });
  if (error) { console.warn("[service_types] read failed:", error.message); return []; }
  return (data || []).map(mapServiceTypeRow);
}

/** Defaults are seeded by db/0001_init.sql — kept as a no-op for back-compat. */
export async function seedDefaultServiceTypes(): Promise<void> {
  return;
}

export async function addServiceType(data: Partial<ServiceTypeDoc>): Promise<string> {
  const slug = data.slug ? slugify(data.slug) : slugify(data.name || "");
  if (!slug) throw new Error("Service type name is required");
  const { data: row, error } = await supabase
    .from("service_types")
    .insert({
      name: data.name || slug,
      slug,
      color: data.color || "#f5b300",
      icon: data.icon || null,
      active: data.active !== false,
    })
    .select("id")
    .single();
  if (error) throw error;
  return row.id;
}

export async function updateServiceType(id: string, data: Partial<ServiceTypeDoc>): Promise<void> {
  const patch: any = {};
  if (data.name !== undefined) patch.name = data.name;
  if (data.color !== undefined) patch.color = data.color;
  if (data.icon !== undefined) patch.icon = data.icon;
  if (data.active !== undefined) patch.active = data.active;
  const { error } = await supabase.from("service_types").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteServiceType(id: string): Promise<void> {
  const { error } = await supabase.from("service_types").delete().eq("id", id);
  if (error) throw error;
}

// ─── Outlets ────────────────────────────────────────────────────────
export interface Outlet {
  id: string;
  name: string;
  description?: string;
  serviceTypes: string[]; // service-type slugs
  imageUrl?: string;
  color?: string;
  // Address
  address?: string;       // legacy single-line
  country?: string;
  state?: string;
  city?: string;
  street?: string;
  zip?: string;
  tel1?: string;
  tel2?: string;
  mobile?: string;
  phone?: string;         // alias of tel1 for back-compat
  email?: string;
  website?: string;
  // Outlet card
  outletCode?: string;
  costCenter?: string;
  outletType?: string;    // REGULAR / SPA / GYM ...
  effectiveFrom?: string; // YYYY-MM-DD
  // Flags
  active: boolean;
  showRoomGuest?: boolean;
  realTimeSales?: boolean;
  enableMembership?: boolean;
  allowBillDateChange?: boolean;
  isTicketing?: boolean;
  createdAt?: string;
}

function mapOutletRow(r: any): Outlet {
  return {
    id: r.id,
    name: r.name || "",
    description: r.description || "",
    serviceTypes: Array.isArray(r.service_types) ? r.service_types : [],
    imageUrl: r.image_url || "",
    color: r.color || "#f5b300",
    address: r.address || "",
    country: r.country || "",
    state: r.state || "",
    city: r.city || "",
    street: r.street || "",
    zip: r.zip || "",
    tel1: r.tel1 || "",
    tel2: r.tel2 || "",
    mobile: r.mobile || "",
    phone: r.tel1 || r.phone || "",
    email: r.email || "",
    website: r.website || "",
    outletCode: r.outlet_code || "",
    costCenter: r.cost_center || "",
    outletType: r.outlet_type || "",
    effectiveFrom: r.effective_from || "",
    active: r.active !== false,
    showRoomGuest: r.show_room_guest !== false,
    realTimeSales: !!r.real_time_sales,
    enableMembership: !!r.enable_membership,
    allowBillDateChange: !!r.allow_bill_date_change,
    isTicketing: !!r.is_ticketing,
    createdAt: r.created_at || "",
  };
}

function toOutletPayload(d: Partial<Outlet>): Record<string, any> {
  const p: Record<string, any> = {};
  if (d.name !== undefined) p.name = d.name;
  if (d.description !== undefined) p.description = d.description;
  if (d.serviceTypes !== undefined) p.service_types = d.serviceTypes;
  if (d.imageUrl !== undefined) p.image_url = d.imageUrl;
  if (d.color !== undefined) p.color = d.color;
  if (d.address !== undefined) p.address = d.address;
  if (d.country !== undefined) p.country = d.country;
  if (d.state !== undefined) p.state = d.state;
  if (d.city !== undefined) p.city = d.city;
  if (d.street !== undefined) p.street = d.street;
  if (d.zip !== undefined) p.zip = d.zip;
  if (d.tel1 !== undefined) p.tel1 = d.tel1;
  if (d.tel2 !== undefined) p.tel2 = d.tel2;
  if (d.mobile !== undefined) p.mobile = d.mobile;
  if (d.phone !== undefined && d.tel1 === undefined) p.tel1 = d.phone;
  if (d.email !== undefined) p.email = d.email;
  if (d.website !== undefined) p.website = d.website;
  if (d.outletCode !== undefined) p.outlet_code = d.outletCode;
  if (d.costCenter !== undefined) p.cost_center = d.costCenter;
  if (d.outletType !== undefined) p.outlet_type = d.outletType;
  if (d.effectiveFrom !== undefined) p.effective_from = d.effectiveFrom || null;
  if (d.active !== undefined) p.active = d.active;
  if (d.showRoomGuest !== undefined) p.show_room_guest = d.showRoomGuest;
  if (d.realTimeSales !== undefined) p.real_time_sales = d.realTimeSales;
  if (d.enableMembership !== undefined) p.enable_membership = d.enableMembership;
  if (d.allowBillDateChange !== undefined) p.allow_bill_date_change = d.allowBillDateChange;
  if (d.isTicketing !== undefined) p.is_ticketing = d.isTicketing;
  return p;
}

export async function getOutlets(): Promise<Outlet[]> {
  const { data, error } = await supabase
    .from("outlets")
    .select("*")
    .order("name", { ascending: true });
  if (error) { console.warn("[outlets] read failed:", error.message); return []; }
  return (data || []).map(mapOutletRow);
}

export async function addOutlet(data: Partial<Outlet>): Promise<string> {
  const payload = toOutletPayload({ active: true, ...data });
  const { data: row, error } = await supabase
    .from("outlets")
    .insert(payload)
    .select("id")
    .single();
  if (error) throw error;
  return row.id;
}

export async function updateOutlet(id: string, data: Partial<Outlet>): Promise<void> {
  const { error } = await supabase.from("outlets").update(toOutletPayload(data)).eq("id", id);
  if (error) throw error;
}

export async function deleteOutlet(id: string): Promise<void> {
  const { error } = await supabase.from("outlets").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Upload an outlet cover image to the `outlets` Supabase storage bucket
 * and return the public URL. Bucket must exist and be public.
 */
export async function uploadOutletImage(outletKey: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${outletKey}/cover-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("outlets").upload(path, file, {
    cacheControl: "3600",
    upsert: true,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("outlets").getPublicUrl(path);
  return data.publicUrl;
}
