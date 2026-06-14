// Supabase-backed data service layer.
// File name is kept for compatibility with existing imports; no Firestore writes happen here.

import { supabase } from "./supabase";
import type {
  Member,
  Booking,
  Transaction,
  MemberTier,
  MemberStatus,
  ServiceType,
  PaymentMethod,
  BookingStatus,
} from "./mock-data";
import { toIsoDayInTz, dayToTimestampInTz, nowIso } from "./tz";



const avatarUrl = (seed: string) =>
  `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed || "member")}`;

function dateOnly(value: any): string {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (typeof value === "string" && value.includes("T")) {
    // Render in the active TZ so DB timestamps don't shift the calendar day.
    return toIsoDayInTz(value);
  }
  try {
    return toIsoDayInTz(new Date(value));
  } catch {
    return "";
  }
}

function timeOnly(value: any): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 5);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function at(date?: string, time?: string): string {
  const d = date || toIsoDayInTz(new Date());
  const t = time || "00:00";
  // Anchor as local wall-clock; using the existing helper avoids UTC day-flip.
  return dayToTimestampInTz(d).replace(/T\d{2}:\d{2}:\d{2}/, `T${t}:00`);
}

async function maybeAudit(action: string, entityType: string, entityId: string, oldValue?: any, newValue?: any) {
  try {
    await addAuditLog(null, action, entityType, entityId, oldValue, newValue);
  } catch {
    /* audit must never block CRUD */
  }
}

function throwDb(error: any, table: string): never {
  const message = error?.message || String(error);
  if (/row-level security|RLS/i.test(message)) {
    throw new Error(
      `${table}: Supabase RLS blocked this save. Run db/0003_supabase_crud_policies.sql or sign in with a Supabase admin user.`,
    );
  }
  if (/column .* does not exist|schema cache/i.test(message)) {
    throw new Error(
      `${table}: Supabase schema is missing a required column. Run db/0003_supabase_crud_policies.sql, then refresh the app.`,
    );
  }
  throw error;
}

// ─── Members ────────────────────────────────────────────────────────
const EXTRA_KEYS = [
  "firstName",
  "middleName",
  "lastName",
  "dob",
  "gender",
  "nationality",
  "religion",
  "maritalStatus",
  "residenceStatus",
  "nationalId",
  "tinNo",
  "fatherName",
  "occupation",
  "officeName",
  "officeAddress",
  "permanentAddress",
  "temporaryAddress",
  "contactAlt",
  "bloodGroup",
  "height",
  "weight",
  "chest",
  "arms",
  "thigh",
  "waistInch",
  "hipInch",
  "shoulder",
  "heartStroke",
  "breathingDifficulty",
  "skinDisease",
  "doctorName",
  "doctorContact",
  "emergencyName",
  "emergencyContactNum",
  "notifyPhone",
  "notifyEmail",
  "notifySMS",
  "timeSlot",
  "packages",
] as const;

function mapMemberRow(r: any): Member {
  const prefs = r.preferences && typeof r.preferences === "object" ? r.preferences : {};
  const extras = r.extras && typeof r.extras === "object" ? r.extras : {};
  const services = Array.isArray(r.services) ? r.services : Array.isArray(prefs.services) ? prefs.services : [];
  const base: any = {
    id: r.id,
    name: r.full_name || prefs.name || "",
    email: r.email || "",
    phone: r.phone || "",
    avatar: r.avatar_url || prefs.avatar || avatarUrl(r.full_name || r.email || r.id),
    tier: (r.tier || "Basic") as MemberTier,
    services: services as ServiceType[],
    status: (r.status || "active").replace(/^./, (c: string) => c.toUpperCase()) as MemberStatus,
    joinDate: dateOnly(r.join_date),
    expiryDate: dateOnly(r.expiry_date),
    plan: r.plan || prefs.plan || "Monthly",
    address: r.address || prefs.address || "",
    emergencyContact: r.emergency_contact || prefs.emergencyContact || "",
    preferences: Array.isArray(prefs.preferences) ? prefs.preferences : [],
    openingBalance: Number(r.opening_balance ?? prefs.openingBalance ?? 0),
    totalPaid: Number(r.total_paid ?? prefs.totalPaid ?? 0),
    dueAmount: Number(r.due_amount ?? prefs.dueAmount ?? 0),
    membershipYears: Number(r.membership_years ?? prefs.membershipYears ?? 0),
    discount: Number(r.discount ?? prefs.discount ?? 0),
    autoRenew: Boolean(r.auto_renew ?? prefs.autoRenew ?? false),
    outletId: r.outlet_id || extras.outletId || "",
    grcNo: r.grc_no || "",
  };
  for (const k of EXTRA_KEYS) base[k] = extras[k];
  return base as Member;
}


function memberPayload(data: Partial<Member>) {
  const fullName = data.name || [data.firstName, data.middleName, data.lastName].filter(Boolean).join(" ").trim();
  const prefs = {
    preferences: data.preferences || [],
    plan: data.plan || "Monthly",
    address: data.address || "",
    emergencyContact: data.emergencyContact || "",
    openingBalance: data.openingBalance || 0,
    totalPaid: data.totalPaid || 0,
    dueAmount: data.dueAmount || 0,
    membershipYears: data.membershipYears || 0,
    discount: data.discount || 0,
    autoRenew: data.autoRenew || false,
    services: data.services || [],
  };
  const extras: Record<string, any> = {};
  for (const k of EXTRA_KEYS) if ((data as any)[k] !== undefined) extras[k] = (data as any)[k];
  return {
    full_name: fullName,
    email: data.email || null,
    phone: data.phone || null,
    avatar_url: (data as any).avatar || null,
    tier: data.tier || "Basic",
    status: (data.status || "Active").toLowerCase(),
    join_date: data.joinDate || new Date().toISOString(),
    expiry_date: data.expiryDate || null,
    outlet_id: data.outletId || null,
    grc_no: data.grcNo || null,
    preferences: prefs,
    extras,
  };
}

export async function getMembers(filters?: {
  tier?: MemberTier;
  status?: MemberStatus;
  service?: ServiceType;
}): Promise<Member[]> {
  let q = supabase.from("members").select("*").order("created_at", { ascending: false });
  if (filters?.tier) q = q.eq("tier", filters.tier);
  if (filters?.status) q = q.eq("status", filters.status.toLowerCase());
  const { data, error } = await q;
  if (error) {
    console.warn("[members] read failed:", error.message);
    return [];
  }
  let results = (data || []).map(mapMemberRow);
  if (filters?.service) results = results.filter((m) => m.services.includes(filters.service!));
  return results;
}

export async function getMember(id: string): Promise<Member | null> {
  const { data, error } = await supabase.from("members").select("*").eq("id", id).maybeSingle();
  if (error) {
    console.warn("[members] read one failed:", error.message);
    return null;
  }
  return data ? mapMemberRow(data) : null;
}

/**
 * Generate a unique member code: `M` + YY + 5-digit sequence (e.g. M2600001).
 *
 * Preferred path: db/schema.sql installs a sequence + BEFORE INSERT trigger
 * that assigns this automatically when `member_code` is null. For older
 * databases (without the trigger) this client-side fallback queries the
 * highest existing code for the current year and increments it.
 */
export async function generateMemberCode(): Promise<string> {
  const yy = String(new Date().getFullYear() % 100).padStart(2, "0");
  const prefix = `M${yy}`;
  try {
    // Try the new column first (db/schema.sql).
    const { data, error } = await supabase
      .from("members")
      .select("member_code")
      .like("member_code", `${prefix}%`)
      .order("member_code", { ascending: false })
      .limit(1);
    if (!error && data && data.length) {
      const last = (data[0] as any).member_code as string;
      const n = parseInt(last.slice(prefix.length), 10);
      if (!Number.isNaN(n)) return `${prefix}${String(n + 1).padStart(5, "0")}`;
    }
  } catch {
    /* column may not exist on legacy DBs — fall through */
  }
  // Legacy fallback: use grc_no or total count
  const { count } = await supabase.from("members").select("id", { count: "exact", head: true });
  return `${prefix}${String((count || 0) + 1).padStart(5, "0")}`;
}

/** Back-compat shim — older code still imports generateGRCNumber. */
export const generateGRCNumber = async (_outletId?: string, _outletCode?: string) => generateMemberCode();

/** Upload member profile photo to storage bucket `members` and return its public URL. */
export async function uploadMemberAvatar(key: string, file: File): Promise<string> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${key}/photo-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("members").upload(path, file, {
    cacheControl: "3600",
    upsert: true,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  return supabase.storage.from("members").getPublicUrl(path).data.publicUrl;
}

export async function addMember(data: Partial<Member>): Promise<string> {
  const { data: row, error } = await supabase.from("members").insert(memberPayload(data)).select("id").single();
  if (error) throwDb(error, "members");
  await maybeAudit("create", "member", row.id, null, data);
  return row.id;
}

export async function updateMember(id: string, data: Partial<Record<string, any>>): Promise<void> {
  const current = await getMember(id);
  const payload: Record<string, any> = { updated_at: new Date().toISOString() };
  if (data.name !== undefined) payload.full_name = data.name;
  if (data.email !== undefined) payload.email = data.email;
  if (data.phone !== undefined) payload.phone = data.phone;
  if (data.tier !== undefined) payload.tier = data.tier;
  if (data.status !== undefined) payload.status = String(data.status).toLowerCase();
  if (data.joinDate !== undefined) payload.join_date = data.joinDate;
  if (data.expiryDate !== undefined) payload.expiry_date = data.expiryDate;
  if (data.avatar !== undefined) payload.avatar_url = data.avatar;
  if (data.outletId !== undefined) payload.outlet_id = data.outletId || null;
  if (data.grcNo !== undefined) payload.grc_no = data.grcNo;
  const prefs = {
    ...(current
      ? {
        preferences: current.preferences,
        plan: current.plan,
        address: current.address,
        emergencyContact: current.emergencyContact,
        services: current.services,
        autoRenew: current.autoRenew,
      }
      : {}),
  } as any;
  for (const k of [
    "preferences",
    "plan",
    "address",
    "emergencyContact",
    "services",
    "openingBalance",
    "totalPaid",
    "dueAmount",
    "membershipYears",
    "discount",
    "autoRenew",
  ]) {
    if (data[k] !== undefined) prefs[k] = data[k];
  }
  if (Object.keys(prefs).length) payload.preferences = prefs;
  // extras merge
  const extras: Record<string, any> = {};
  let touched = false;
  for (const k of EXTRA_KEYS)
    if (data[k] !== undefined) {
      extras[k] = data[k];
      touched = true;
    }
  if (touched) {
    const merged = { ...((current as any) || {}) };
    for (const k of EXTRA_KEYS) if (extras[k] === undefined) extras[k] = merged[k];
    payload.extras = extras;
  }
  const { error } = await supabase.from("members").update(payload).eq("id", id);
  if (error) throwDb(error, "members");
  await maybeAudit("update", "member", id, current, data);
}

export async function deleteMember(id: string): Promise<void> {
  const { error } = await supabase.from("members").delete().eq("id", id);
  if (error) throwDb(error, "members");
  await maybeAudit("delete", "member", id, null, null);
}

// ─── Bookings ───────────────────────────────────────────────────────
function mapBookingRow(r: any): Booking {
  const notes = (() => {
    try {
      return r.notes ? JSON.parse(r.notes) : {};
    } catch {
      return {};
    }
  })();
  return {
    id: r.id,
    memberId: r.member_id || "",
    memberName: r.member_name || "",
    service: (notes.service || r.service_type || "Gym") as ServiceType,
    className: r.service_name || notes.className || "",
    date: dateOnly(r.start_at),
    startTime: timeOnly(r.start_at),
    endTime: timeOnly(r.end_at),
    status: (r.status || "Pending").replace(/^./, (c: string) => c.toUpperCase()) as BookingStatus,
    instructor: notes.instructor || "",
    outletId: r.outlet_id || null,
  } as any;
}

export async function getBookings(filters?: { service?: ServiceType }): Promise<Booking[]> {
  const { data, error } = await supabase.from("bookings").select("*").order("start_at", { ascending: true });
  if (error) {
    console.warn("[bookings] read failed:", error.message);
    return [];
  }
  let rows = (data || []).map(mapBookingRow);
  if (filters?.service) rows = rows.filter((b) => b.service === filters.service);
  return rows;
}

export async function addBooking(data: Partial<Booking> & { outletId?: string }): Promise<string> {
  const { data: row, error } = await supabase
    .from("bookings")
    .insert({
      member_id: data.memberId || null,
      member_name: data.memberName || null,
      service_name: data.className || data.service || null,
      outlet_id: data.outletId || null,
      start_at: at(data.date, data.startTime),
      end_at: at(data.date, data.endTime || data.startTime),
      status: (data.status || "Pending").toLowerCase(),
      notes: JSON.stringify({
        service: data.service || "Gym",
        className: data.className || "",
        instructor: data.instructor || "",
      }),
    })
    .select("id")
    .single();
  if (error) throwDb(error, "bookings");
  await maybeAudit("create", "booking", row.id, null, data);
  return row.id;
}

export async function updateBooking(id: string, data: Partial<Record<string, any>>): Promise<void> {
  const patch: Record<string, any> = { updated_at: new Date().toISOString() };
  if (data.memberId !== undefined) patch.member_id = data.memberId || null;
  if (data.memberName !== undefined) patch.member_name = data.memberName;
  if (data.className !== undefined) patch.service_name = data.className;
  if (data.outletId !== undefined) patch.outlet_id = data.outletId || null;
  if (data.date !== undefined || data.startTime !== undefined) patch.start_at = at(data.date, data.startTime);
  if (data.date !== undefined || data.endTime !== undefined)
    patch.end_at = at(data.date, data.endTime || data.startTime);
  if (data.status !== undefined) patch.status = String(data.status).toLowerCase();
  if (data.service !== undefined || data.instructor !== undefined || data.className !== undefined)
    patch.notes = JSON.stringify({ service: data.service, instructor: data.instructor, className: data.className });
  const { error } = await supabase.from("bookings").update(patch).eq("id", id);
  if (error) throwDb(error, "bookings");
  await maybeAudit("update", "booking", id, null, data);
}

export async function deleteBooking(id: string): Promise<void> {
  const { error } = await supabase.from("bookings").delete().eq("id", id);
  if (error) throwDb(error, "bookings");
  await maybeAudit("delete", "booking", id, null, null);
}

// ─── Transactions / Payments ────────────────────────────────────────
function mapPaymentRow(r: any): Transaction {
  const meta = r.meta && typeof r.meta === "object" ? r.meta : {};
  const isVoided = r.voided === true || r.status === "voided";
  return {
    id: r.id,
    memberId: r.member_id || "",
    memberName: r.member_name || "",
    amount: Number(r.amount || 0),
    vat: Number(r.vat_amount || 0),
    total: Number(r.total || 0),
    method: (r.method || "cash") as PaymentMethod,
    type: meta.type || "Payment",
    date: dateOnly(r.paid_at),
    description: r.description || "",
    receiptNo: r.receipt_no || "",
    serviceType: r.service_type || undefined,
    status: (isVoided ? "voided" : r.status === "pending" ? "pending" : "paid") as any,
    bookingId: meta.bookingId || undefined,
    voided: isVoided,
    voidReason: r.void_reason || undefined,
    voidedAt: r.voided_at || undefined,
    chargeHead: r.charge_head || undefined,
    chargeRowId: r.settled_charge_id || meta.chargeRowId || undefined,
    discount: Number(r.discount || 0),
    outletId: r.outlet_id || undefined,
  } as Transaction;
}

export async function getTransactions(): Promise<Transaction[]> {
  const { data, error } = await supabase.from("payments").select("*").order("paid_at", { ascending: false });
  if (error) {
    console.warn("[payments] read failed:", error.message);
    return [];
  }
  return (data || []).map(mapPaymentRow);
}

export async function addTransaction(data: Partial<Transaction>): Promise<string> {
  // Prices are VAT-INCLUSIVE. `amount` is the gross total; derive the embedded VAT.
  const gross = Number(data.amount || 0);
  const net = Math.round((gross / 1.13) * 100) / 100;
  const vat = Math.round((gross - net) * 100) / 100;
  const status = data.status === "pending" ? "pending" : "paid";
  const insertRow: any = {
    receipt_no: data.receiptNo || `${INVOICE_PREFIX}-${Date.now()}`,
    member_id: data.memberId || null,
    member_name: data.memberName || null,
    amount: net,
    vat_amount: vat,
    total: gross,
    discount: Number((data as any).discount || 0),
    method: data.method || "cash",
    service_type: data.serviceType || null,
    description: data.description || "",
    paid_at: data.date ? dayToTimestampInTz(data.date) : nowIso(),
    created_at: nowIso(),
    status,
    outlet_id: (data as any).outletId || null,
    settled_charge_id: (data as any).chargeRowId || null,
    meta: {
      type: data.type || "Payment",
      bookingId: data.bookingId || null,
      chargeRowId: (data as any).chargeRowId || null,
      isSettlement: (data as any).isSettlement || false,
    },
  };
  const { data: row, error } = await supabase
    .from("payments")
    .insert(insertRow)
    .select("id")
    .single();
  if (error) throwDb(error, "payments");
  await maybeAudit("create", "payment", row.id, null, data);
  return row.id;
}

export async function updateTransaction(id: string, data: Partial<Transaction>): Promise<void> {
  const patch: any = {};
  if (data.method !== undefined) patch.method = data.method;
  if (data.status !== undefined) patch.status = data.status === "voided" ? "voided" : data.status;
  if (data.description !== undefined) patch.description = data.description;
  if (data.date !== undefined) patch.paid_at = dayToTimestampInTz(data.date);
  if ((data as any).voided !== undefined) patch.voided = (data as any).voided;
  if ((data as any).voidReason !== undefined) patch.void_reason = (data as any).voidReason;
  if ((data as any).voidedAt !== undefined) patch.voided_at = (data as any).voidedAt;
  if (data.amount !== undefined) patch.amount = data.amount;
  if (data.vat !== undefined) patch.vat_amount = data.vat;
  if (data.total !== undefined) patch.total = data.total;
  if ((data as any).discount !== undefined) patch.discount = (data as any).discount;
  const { error } = await supabase.from("payments").update(patch).eq("id", id);
  if (error) throwDb(error, "payments");
  await maybeAudit("update", "payment", id, null, data);
}

// ─── Services ───────────────────────────────────────────────────────
export interface FirestoreService {
  id: string;
  name: string;
  type: string;
  duration: number;
  price: number;
  isActive: boolean;
  description?: string;
  capacity?: number;
  instructor?: string;
  outletId?: string;
  requiresInstructor?: boolean;
}

function mapServiceRow(r: any): FirestoreService {
  const meta = (() => {
    try {
      return r.description?.startsWith("{") ? JSON.parse(r.description) : {};
    } catch {
      return {};
    }
  })();
  return {
    id: r.id,
    name: r.name || "",
    type: r.service_type || "Gym",
    duration: Number(r.duration_min || 0),
    price: Number(r.price || 0),
    isActive: r.active !== false,
    description: meta.description || r.description || "",
    capacity: Number(meta.capacity || 0),
    instructor: meta.instructor || "",
    outletId: meta.outletId || "",
    requiresInstructor: meta.requiresInstructor === true,
  };
}

export async function getServices(filters?: { outletId?: string }): Promise<FirestoreService[]> {
  const { data, error } = await supabase.from("services").select("*").order("name", { ascending: true });
  if (error) {
    console.warn("[services] read failed:", error.message);
    return [];
  }
  let rows = (data || []).map(mapServiceRow);
  if (filters?.outletId) rows = rows.filter((s) => s.outletId === filters.outletId);
  return rows;
}

function encodeServiceMeta(data: Partial<FirestoreService>) {
  return JSON.stringify({
    description: data.description || "",
    capacity: data.capacity || 1,
    instructor: data.instructor || "",
    outletId: data.outletId || "",
    requiresInstructor: data.requiresInstructor === true,
  });
}

export async function addService(data: Partial<FirestoreService>): Promise<string> {
  const { data: row, error } = await supabase
    .from("services")
    .insert({
      name: data.name || "",
      service_type: data.type || "Gym",
      duration_min: data.duration || 60,
      price: data.price || 0,
      active: data.isActive !== false,
      description: encodeServiceMeta(data),
    })
    .select("id")
    .single();
  if (error) throwDb(error, "services");
  return row.id;
}

export async function updateService(id: string, data: Partial<Record<string, any>>): Promise<void> {
  const patch: Record<string, any> = {};
  if (data.name !== undefined) patch.name = data.name;
  if (data.type !== undefined) patch.service_type = data.type;
  if (data.duration !== undefined) patch.duration_min = data.duration;
  if (data.price !== undefined) patch.price = data.price;
  if (data.isActive !== undefined) patch.active = data.isActive;
  if (
    data.description !== undefined ||
    data.capacity !== undefined ||
    data.instructor !== undefined ||
    data.outletId !== undefined ||
    data.requiresInstructor !== undefined
  ) {
    patch.description = encodeServiceMeta(data as Partial<FirestoreService>);
  }
  const { error } = await supabase.from("services").update(patch).eq("id", id);
  if (error) throwDb(error, "services");
}

export async function deleteService(id: string): Promise<void> {
  const { error } = await supabase.from("services").delete().eq("id", id);
  if (error) throwDb(error, "services");
}

// ─── Membership Plans ───────────────────────────────────────────────
export interface FirestoreMembershipPlan {
  id: string;
  name: string;
  tier: string;
  price: number;
  yearlyPrice?: number;
  longTermPrice?: number;
  durationInMonths?: number;
  membershipTypeId?: string;
  includes?: string;
  autoRenew?: boolean;
}

function mapPlanRow(r: any): FirestoreMembershipPlan {
  const meta = (() => {
    try {
      return r.description?.startsWith("{") ? JSON.parse(r.description) : {};
    } catch {
      return {};
    }
  })();
  return {
    id: r.id,
    name: r.name || "",
    tier: r.tier || "Basic",
    price: Number(r.price || 0),
    yearlyPrice: Number(meta.yearlyPrice || 0),
    longTermPrice: Number(meta.longTermPrice || 0),
    durationInMonths: Math.round(Number(r.duration_days || 30) / 30),
    membershipTypeId: meta.membershipTypeId || "",
    includes: meta.includes || r.description || "",
    autoRenew: Boolean(meta.autoRenew || false),
  };
}

export async function getMembershipPlans(): Promise<FirestoreMembershipPlan[]> {
  const { data, error } = await supabase.from("membership_plans").select("*").order("price", { ascending: true });
  if (error) {
    console.warn("[membership_plans] read failed:", error.message);
    return [];
  }
  return (data || []).map(mapPlanRow);
}

export async function addMembershipPlan(data: Partial<FirestoreMembershipPlan>): Promise<string> {
  const { data: row, error } = await supabase
    .from("membership_plans")
    .insert({
      name: data.name || data.tier || "Plan",
      tier: data.tier || "Basic",
      price: data.price || 0,
      duration_days: (data.durationInMonths || 1) * 30,
      active: true,
      description: JSON.stringify({
        yearlyPrice: data.yearlyPrice || 0,
        longTermPrice: data.longTermPrice || 0,
        includes: data.includes || "",
        autoRenew: data.autoRenew || false,
        membershipTypeId: data.membershipTypeId || "",
      }),
    })
    .select("id")
    .single();
  if (error) throwDb(error, "membership_plans");
  return row.id;
}

export async function updateMembershipPlan(id: string, data: Partial<Record<string, any>>): Promise<void> {
  const current = (await getMembershipPlans()).find((p) => p.id === id);
  const patch: Record<string, any> = {};
  if (data.name !== undefined) patch.name = data.name;
  if (data.tier !== undefined) patch.tier = data.tier;
  if (data.price !== undefined) patch.price = data.price;
  if (data.durationInMonths !== undefined) patch.duration_days = data.durationInMonths * 30;
  const meta = {
    yearlyPrice: current?.yearlyPrice || 0,
    longTermPrice: current?.longTermPrice || 0,
    includes: current?.includes || "",
    autoRenew: current?.autoRenew || false,
    membershipTypeId: current?.membershipTypeId || "",
    ...data,
  };
  patch.description = JSON.stringify(meta);
  const { error } = await supabase.from("membership_plans").update(patch).eq("id", id);
  if (error) throwDb(error, "membership_plans");
}

export async function deleteMembershipPlan(id: string): Promise<void> {
  const { error } = await supabase.from("membership_plans").delete().eq("id", id);
  if (error) throwDb(error, "membership_plans");
}

// ─── Dashboard Stats ────────────────────────────────────────────────
export async function getDashboardStats() {
  const [members, bookings, transactions, checkIns] = await Promise.all([
    getMembers(),
    getBookings(),
    getTransactions(),
    getCheckIns(),
  ]);
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const todayKey = now.toISOString().split("T")[0];
  const inMonth = (d: string) => d && new Date(d) >= startOfMonth;
  const currRevenue = transactions.filter((t) => inMonth(t.date)).reduce((s, t) => s + t.total, 0);
  return {
    totalMembers: members.length,
    activeMembers: members.filter((m) => m.status === "Active").length,
    membersChange: members.filter((m) => inMonth(m.joinDate)).length,
    monthlyRevenue: currRevenue,
    revenueChange: 0,
    activeBookings: bookings.filter((b) => ["Confirmed", "Pending"].includes(b.status)).length,
    bookingsChange: 0,
    todayCheckins: checkIns.filter((c) => c.date === todayKey).length,
    checkinsChange: 0,
  };
}

// ─── Company Settings ───────────────────────────────────────────────
function mapSettingsRow(row: any): Record<string, string> {
  const extras = row?.extras && typeof row.extras === "object" ? row.extras : {};
  return {
    ...extras,
    companyName: row?.company_name || extras.companyName || ".............",
    companyAddress: row?.address || extras.companyAddress || "",
    companyPhone: row?.phone || extras.companyPhone || "",
    companyEmail: row?.email || extras.companyEmail || "",
    logoUrl: row?.logo_url || extras.logoUrl || "",
    vatNo: row?.vat_no || extras.vatNo || "",
    panNumber: extras.panNumber || row?.vat_no || "",
    currency: row?.currency || extras.currency || "NPR",
    vatRate: String(row?.vat_rate ?? extras.vatRate ?? "13"),
    maxOutlets: row?.max_outlets || extras.maxOutlets || "unlimited",
    resendEndpoint: row?.resend_endpoint || extras.resendEndpoint || "",
  };
}

export async function getCompanySettings(): Promise<Record<string, string>> {
  const { data, error } = await supabase.from("company_settings").select("*").eq("id", "main").maybeSingle();
  if (error) {
    console.warn("[company_settings] read failed:", error.message);
    return {};
  }
  return mapSettingsRow(data || {});
}

export async function setCompanySetting(key: string, value: string): Promise<void> {
  await saveCompanySettings({ [key]: value });
}

export async function saveCompanySettings(settings: Record<string, string>): Promise<void> {
  const { data: existing } = await supabase.from("company_settings").select("*").eq("id", "main").maybeSingle();
  const extras = { ...(existing?.extras && typeof existing.extras === "object" ? existing.extras : {}) } as Record<
    string,
    string
  >;
  const payload: Record<string, any> = { id: "main", updated_at: new Date().toISOString() };
  for (const [key, value] of Object.entries(settings)) {
    if (key === "companyName") payload.company_name = value;
    else if (key === "companyAddress") payload.address = value;
    else if (key === "companyPhone") payload.phone = value;
    else if (key === "companyEmail") payload.email = value;
    else if (key === "logoUrl") payload.logo_url = value;
    else if (key === "vatNo" || key === "panNumber") {
      payload.vat_no = value;
      extras[key] = value;
    } else if (key === "currency") payload.currency = value;
    else if (key === "vatRate") payload.vat_rate = Number(value) || 13;
    else if (key === "maxOutlets") payload.max_outlets = value;
    else if (key === "resendEndpoint") payload.resend_endpoint = value;
    else extras[key] = value;
  }
  payload.extras = extras;
  const { error } = await supabase.from("company_settings").upsert(payload, { onConflict: "id" });
  if (error) throwDb(error, "company_settings");
}

// ─── Check-ins ──────────────────────────────────────────────────────
export async function addCheckIn(memberId: string): Promise<string> {
  return addCheckInRecord({ memberId, memberName: "", date: new Date().toISOString().split("T")[0] });
}

export interface CheckInRecord {
  id: string;
  memberId: string;
  memberName: string;
  date: string;
  checkInTime: string;
  checkOutTime?: string;
}

export async function getCheckIns(): Promise<CheckInRecord[]> {
  const { data, error } = await supabase.from("check_ins").select("*").order("check_in_at", { ascending: false });
  if (error) {
    console.warn("[check_ins] read failed:", error.message);
    return [];
  }
  return (data || []).map((r: any) => ({
    id: r.id,
    memberId: r.member_id || "",
    memberName: r.member_name || "",
    date: dateOnly(r.check_in_at),
    checkInTime: timeOnly(r.check_in_at),
    checkOutTime: r.check_out_at ? timeOnly(r.check_out_at) : undefined,
  }));
}

export async function addCheckInRecord(data: { memberId: string; memberName: string; date: string }): Promise<string> {
  const { data: row, error } = await supabase
    .from("check_ins")
    .insert({
      member_id: data.memberId || null,
      member_name: data.memberName || null,
      check_in_at: at(data.date, new Date().toTimeString().slice(0, 5)),
    })
    .select("id")
    .single();
  if (error) throwDb(error, "check_ins");
  return row.id;
}

// ─── Discount Rules ─────────────────────────────────────────────────
export interface DiscountRule {
  years: number;
  discount: number;
}

export async function getDiscountRules(): Promise<DiscountRule[]> {
  const { data, error } = await supabase
    .from("company_settings")
    .select("discount_rules, extras")
    .eq("id", "main")
    .maybeSingle();
  if (error) {
    console.warn("[discount_rules] read failed:", error.message);
    return [];
  }
  if (Array.isArray(data?.discount_rules)) return data.discount_rules as DiscountRule[];
  try {
    return data?.extras?.discountRules ? JSON.parse(data.extras.discountRules) : [];
  } catch {
    return [];
  }
}

export async function saveDiscountRules(rules: DiscountRule[]): Promise<void> {
  const { error } = await supabase
    .from("company_settings")
    .upsert({ id: "main", discount_rules: rules, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) throwDb(error, "company_settings");
}

// ─── Audit Log ──────────────────────────────────────────────────────
import { logAudit as _logAudit } from "./audit-log";
import { INVOICE_PREFIX } from "./settings";

export async function addAuditLog(
  _userId: string | null,
  action: string,
  entityType: string,
  entityId: string,
  oldValue?: any,
  newValue?: any,
): Promise<void> {
  await _logAudit({
    module: entityType, // resolved via ENTITY_TO_SLUG inside logAudit
    entityType,
    action,
    entityId,
    oldValue,
    newValue,
  });
}
