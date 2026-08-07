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
import { toIsoDayInTz, dayToTimestampInTz, nowIso, getAppTimezone, wallTimeToUtcIso } from "./tz";
import { getSystemTodayStr, getSystemNowDate } from "./timeUtils";
import { logAudit as _logAudit } from "./audit-log";
import { INVOICE_PREFIX } from "./settings";
import { shouldBreakdownVat } from "./vat";
import { buildAmounts, toMoneyColumns, buildBookingRates } from "./money";

import { CheckInRecord } from "@/hooks/use-firestore";
import { generateNextBillNumber } from "./helper";


const avatarUrl = (seed: string) =>
  `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed || "member")}`;

function dateOnly(value: any): string {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (typeof value === "string" && value.includes("T")) {
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
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: getAppTimezone(),
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
      .formatToParts(d)
      .reduce<Record<string, string>>((acc, p) => {
        if (p.type !== "literal") acc[p.type] = p.value;
        return acc;
      }, {});
    return `${parts.hour || "00"}:${parts.minute || "00"}`;
  } catch {
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
}

function at(date?: string, time?: string): string {
  const d = date || toIsoDayInTz(getSystemNowDate());
  let t = time;
  if (!t) {
    try {
      const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: getAppTimezone(),
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
        .formatToParts(getSystemNowDate())
        .reduce<Record<string, string>>((acc, p) => {
          if (p.type !== "literal") acc[p.type] = p.value;
          return acc;
        }, {});
      t = `${parts.hour || "00"}:${parts.minute || "00"}`;
    } catch {
      t = "00:00";
    }
  }
  // Use wallTimeToUtcIso for proper timezone conversion instead of string replacement
  return wallTimeToUtcIso(d, t, getAppTimezone());
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
  "residenceStatus",
  "nationalId",
  "tinNo",
  "fatherName",
  "arms",
  "thigh",
  "waistInch",
  "hipInch",
  "shoulder",
  "doctorName",
  "doctorContact",
  "notifyPhone",
  "notifyEmail",
  "notifySMS",
  "packages",
] as const;

function toBool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (value == null) return false;
  const s = String(value).trim().toLowerCase();
  return s === "true" || s === "yes" || s === "1" || s === "y";
}

function splitFullName(full?: string): { firstName: string; middleName: string; lastName: string } {
  const parts = String(full || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return { firstName: "", middleName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], middleName: "", lastName: "" };
  if (parts.length === 2) return { firstName: parts[0], middleName: "", lastName: parts[1] };
  return {
    firstName: parts[0],
    middleName: parts.slice(1, -1).join(" "),
    lastName: parts[parts.length - 1],
  };
}

function mapMemberRow(r: any): Member {
  const extras = r.extras && typeof r.extras === "object" ? r.extras : {};
  const address = r.address && typeof r.address === "object" ? r.address : {};
  const emergency = r.emergency_contact && typeof r.emergency_contact === "object" ? r.emergency_contact : {};
  const physical = r.physical && typeof r.physical === "object" ? r.physical : {};
  const medical = r.medical && typeof r.medical === "object" ? r.medical : {};
  const services = Array.isArray(r.services) ? r.services : Array.isArray(extras.services) ? extras.services : [];

  const fullName = r.full_name || extras.name || "";
  const nameParts = splitFullName(fullName);
  const legacyAddress = typeof r.address === "string" ? r.address : "";

  // Extract preferences array cleanly
  const preferencesArray = Array.isArray(r.preferences)
    ? r.preferences
    : Array.isArray(r.preferences?.preferences)
      ? r.preferences.preferences
      : [];

  const base: any = {
    id: r.id,
    memberCode: r.member_code || "",
    name: fullName,
    email: r.email || "",
    phone: r.phone || "",
    avatar: r.avatar_url || extras.avatar || avatarUrl(fullName || r.email || r.id),
    tier: (r.tier || "Basic") as MemberTier,
    services: services as ServiceType[],
    status: (r.status || "active").replace(/^./, (c: string) => c.toUpperCase()) as MemberStatus,
    joinDate: dateOnly(r.join_date),
    expiryDate: dateOnly(r.expiry_date),

    // Read exclusively from extras column (or root fallback)
    plan: extras.plan || r.plan || "Monthly",
    membershipYears: Number(extras.membershipYears ?? r.membership_years ?? 0),
    autoRenew: Boolean(extras.autoRenew ?? r.auto_renew ?? false),

    planId: r.plan_id || "",
    maritalStatus: r.marital_status || extras.maritalStatus || "",
    address:
      address.permanent ||
      address.temporary ||
      legacyAddress ||
      (typeof extras.address === "string" ? extras.address : "") ||
      "",
    emergencyContact: emergency.phone || extras.emergencyContact || "",
    preferences: preferencesArray,

    // Read directly from dedicated database columns
    openingBalance: Number(r.opening_balance ?? 0),
    totalPaid: Number(r.total_paid ?? 0),
    dueAmount: Number(r.due_amount ?? 0),
    discount: Number(r.discount ?? 0),

    outletId: r.outlet_id || extras.outletId || "",
    grcNo: r.grc_no || "",

    firstName: extras.firstName ?? nameParts.firstName,
    middleName: extras.middleName ?? nameParts.middleName,
    lastName: extras.lastName ?? nameParts.lastName,
    dob: dateOnly(r.dob) || extras.dob || "",
    gender: r.gender || extras.gender || "",
    nationality: r.nationality || extras.nationality || "",
    religion: r.religion || extras.religion || "",
    occupation: r.occupation || extras.occupation || "",
    officeName: r.office_name || extras.officeName || "",
    officeAddress: r.office_address || extras.officeAddress || "",
    contactAlt: r.contact_alt || extras.contactAlt || "",

    permanentAddress: address.permanent ?? extras.permanentAddress ?? "",
    temporaryAddress: address.temporary ?? extras.temporaryAddress ?? "",
    emergencyName: emergency.name ?? extras.emergencyName ?? "",
    emergencyContactNum: emergency.phone ?? extras.emergencyContactNum ?? "",
    emergencyAddress: emergency.address ?? extras.emergencyAddress ?? "",

    chest: physical.chest ?? extras.chest ?? "",
    height: physical.height ?? extras.height ?? "",
    weight: physical.weight ?? extras.weight ?? "",
    bloodGroup: physical.blood_group ?? extras.bloodGroup ?? "",

    heartStroke: typeof medical.heart_stroke === "boolean" ? medical.heart_stroke : toBool(extras.heartStroke),
    skinDisease: typeof medical.skin_disease === "boolean" ? medical.skin_disease : toBool(extras.skinDisease),
    breathingDifficulty:
      typeof medical.breathing_difficulty === "boolean"
        ? medical.breathing_difficulty
        : toBool(extras.breathingDifficulty),
  };

  for (const k of EXTRA_KEYS) if (base[k] === undefined) base[k] = extras[k];
  return base as Member;
}

function memberPayload(data: Partial<Member>): Record<string, any> {
  const fullName = data.name || [data.firstName, data.middleName, data.lastName].filter(Boolean).join(" ").trim();
  const preferencesList = Array.isArray(data.preferences) ? data.preferences : [];

  // Pack ONLY plan, membershipYears, autoRenew (and EXTRA_KEYS) into extras
  const extras: Record<string, any> = {
    plan: data.plan || "Monthly",
    membershipYears: data.membershipYears || 0,
    autoRenew: Boolean(data.autoRenew),
  };
  for (const k of EXTRA_KEYS) if ((data as any)[k] !== undefined) extras[k] = (data as any)[k];

  const payload: Record<string, any> = {
    full_name: fullName,
    email: data.email || null,
    phone: data.phone || null,
    avatar_url: (data as any).avatar || null,
    tier: data.tier || "Basic",
    status: (data.status || "Active").toLowerCase(),
    join_date: data.joinDate || nowIso(),
    expiry_date: data.expiryDate || null,
    outlet_id: data.outletId || null,
    grc_no: data.grcNo || null,
    plan_id: (data as any).planId || null,
    marital_status: (data as any).maritalStatus || null,
    dob: data.dob || null,
    gender: data.gender || null,
    nationality: data.nationality || null,
    religion: data.religion || null,
    occupation: data.occupation || null,
    office_name: data.officeName || null,
    office_address: data.officeAddress || null,
    contact_alt: data.contactAlt || null,



    // Dedicated JSON array column
    preferences: preferencesList,
    // member_preferences: preferencesList,

    address: {
      permanent: data.permanentAddress || "",
      temporary: data.temporaryAddress || "",
    },
    emergency_contact: {
      name: data.emergencyName || "",
      phone: (data as any).emergencyContactNum || data.emergencyContact || "",
      address: (data as any).emergencyAddress || "",
    },
    physical: {
      chest: data.chest || "",
      height: data.height || "",
      weight: data.weight || "",
      blood_group: data.bloodGroup || "",
    },
    medical: {
      heart_stroke: toBool((data as any).heartStroke),
      skin_disease: toBool((data as any).skinDisease),
      breathing_difficulty: toBool((data as any).breathingDifficulty),
    },

    // Dedicated database columns
    opening_balance: data.openingBalance || 0,
    total_paid: data.totalPaid || 0,
    due_amount: data.dueAmount || 0, // Fixed due_mount typo
    discount: data.discount || 0,
    services: data.services || [],

    // Extras JSON column containing plan, membershipYears, autoRenew
    extras: extras,
  };

  if ((data as any).memberCode) payload.member_code = (data as any).memberCode;
  return payload;
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

export async function generateMemberCode(): Promise<string> {
  const yy = String(getSystemNowDate().getFullYear() % 100).padStart(2, "0");
  const prefix = `M${yy}`;
  try {
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
    /* fall through */
  }
  const { count } = await supabase.from("members").select("id", { count: "exact", head: true });
  return `${prefix}${String((count || 0) + 1).padStart(5, "0")}`;
}

export const generateGRCNumber = async (_outletId?: string, _outletCode?: string) => generateMemberCode();

/**
 * Upload a member avatar into the PRIVATE `members` bucket and return the
 * storage object path (not a public URL). Persist the returned string to
 * `members.avatar_url`; render it via `getMemberAvatarSignedUrl` /
 * `useMemberAvatar` from `@/lib/member-avatar`.
 */
export async function uploadMemberAvatar(key: string, file: File): Promise<string> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${key}/photo-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("members").upload(path, file, {
    cacheControl: "3600",
    upsert: true,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  return path;
}

export async function addMember(data: Partial<Member>): Promise<string> {
  const { data: row, error } = await supabase.from("members").insert(memberPayload(data)).select("id").single();
  if (error) throwDb(error, "members");
  await maybeAudit("create", "member", row.id, null, data);
  return row.id;
}

export async function updateMember(id: string, data: Partial<Record<string, any>>): Promise<void> {
  const current = await getMember(id);
  const payload: Record<string, any> = { updated_at: nowIso() };

  // 1. Direct database columns for financials & services
  if (data.openingBalance !== undefined) payload.opening_balance = data.openingBalance;
  if (data.totalPaid !== undefined) payload.total_paid = data.totalPaid;
  if (data.dueAmount !== undefined) payload.due_amount = data.dueAmount;
  if (data.discount !== undefined) payload.discount = data.discount;
  if (data.services !== undefined) payload.services = data.services;

  // 2. Preferences column updated strictly as an array
  if (data.preferences !== undefined && Array.isArray(data.preferences)) {
    payload.preferences = data.preferences;
    // payload.member_preferences = data.preferences;
  }

  // 3. Scalar columns mapping
  const scalarCols: Record<string, string> = {
    name: "full_name",
    email: "email",
    phone: "phone",
    avatar: "avatar_url",
    tier: "tier",
    outletId: "outlet_id",
    grcNo: "grc_no",
    memberCode: "member_code",
    planId: "plan_id",
    maritalStatus: "marital_status",
    dob: "dob",
    gender: "gender",
    nationality: "nationality",
    religion: "religion",
    occupation: "occupation",
    officeName: "office_name",
    officeAddress: "office_address",
    contactAlt: "contact_alt",
  };
  for (const [k, col] of Object.entries(scalarCols)) {
    if (data[k] !== undefined) payload[col] = data[k] === "" ? null : data[k];
  }

  if (data.status !== undefined) payload.status = String(data.status).toLowerCase();
  if (data.joinDate !== undefined) payload.join_date = data.joinDate;
  if (data.expiryDate !== undefined) payload.expiry_date = data.expiryDate;

  // 4. Name construction fallback
  if (
    data.name === undefined &&
    (data.firstName !== undefined || data.middleName !== undefined || data.lastName !== undefined)
  ) {
    const fn = data.firstName ?? current?.firstName ?? "";
    const mn = data.middleName ?? current?.middleName ?? "";
    const ln = data.lastName ?? current?.lastName ?? "";
    payload.full_name = [fn, mn, ln].filter(Boolean).join(" ").trim();
  }

  // 5. Nested JSON objects (Address, Emergency Contact, Physical, Medical)
  if (data.permanentAddress !== undefined || data.temporaryAddress !== undefined) {
    payload.address = {
      permanent: data.permanentAddress ?? current?.permanentAddress ?? "",
      temporary: data.temporaryAddress ?? current?.temporaryAddress ?? "",
    };
  }

  if (
    data.emergencyName !== undefined ||
    data.emergencyContactNum !== undefined ||
    data.emergencyContact !== undefined ||
    data.emergencyAddress !== undefined ||
    data.emergencyPhone !== undefined
  ) {
    payload.emergency_contact = {
      name: data.emergencyName ?? current?.emergencyName ?? "",
      phone:
        data.emergencyContactNum ??
        data.emergencyPhone ??
        data.emergencyContact ??
        current?.emergencyContactNum ??
        current?.emergencyContact ??
        "",
      address: data.emergencyAddress ?? (current as any)?.emergencyAddress ?? "",
    };
  }

  if (
    data.chest !== undefined ||
    data.height !== undefined ||
    data.weight !== undefined ||
    data.bloodGroup !== undefined
  ) {
    payload.physical = {
      chest: data.chest ?? current?.chest ?? "",
      height: data.height ?? current?.height ?? "",
      weight: data.weight ?? current?.weight ?? "",
      blood_group: data.bloodGroup ?? current?.bloodGroup ?? "",
    };
  }

  if (data.heartStroke !== undefined || data.skinDisease !== undefined || data.breathingDifficulty !== undefined) {
    payload.medical = {
      heart_stroke: toBool(data.heartStroke ?? current?.heartStroke),
      skin_disease: toBool(data.skinDisease ?? current?.skinDisease),
      breathing_difficulty: toBool(data.breathingDifficulty ?? current?.breathingDifficulty),
    };
  }

  // 6. Extras JSON column logic (strictly handles plan, membershipYears, autoRenew, and EXTRA_KEYS)
  const extrasKeys = ["plan", "membershipYears", "autoRenew", ...EXTRA_KEYS];
  const extras: Record<string, any> = {};
  let extrasTouched = false;

  for (const k of extrasKeys) {
    if (data[k] !== undefined) {
      extras[k] = data[k];
      extrasTouched = true;
    }
  }

  if (extrasTouched) {
    // Retain existing values from current record for untouched keys
    for (const k of extrasKeys) {
      if (extras[k] === undefined && (current as any)?.[k] !== undefined) {
        extras[k] = (current as any)[k];
      }
    }
    payload.extras = extras;
  }

  // 7. Supabase Update & Audit
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
export function dbBookingStatusToDisplay(raw: unknown): BookingStatus {
  const s = String(raw || "")
    .toLowerCase()
    .replace(/[\s_]+/g, "-");
  if (s === "wait-listed" || s === "waitlisted") return "wait-listed" as BookingStatus;
  if (s === "not-fixed" || s === "notfixed") return "not-fixed" as BookingStatus;
  if (s === "provisional") return "provisional" as BookingStatus;
  if (s === "pending") return "pending" as BookingStatus;
  return "confirmed" as BookingStatus;
}

export function displayBookingStatusToDb(value: unknown): string {
  const s = String(value || "")
    .toLowerCase()
    .replace(/[\s_]+/g, "-");
  if (s === "waitlisted" || s === "wait-listed") return "wait-listed";
  if (s === "notfixed" || s === "not-fixed") return "not-fixed";
  if (s === "provisional") return "provisional";
  if (s === "pending") return "pending";
  return "confirmed";
}

const LIFECYCLE_VALUES = ["pending", "confirmed", "completed", "cancelled", "no_show"] as const;

export function dbLifecycleStatusToDisplay(raw: unknown): string {
  const s = String(raw ?? "").toLowerCase();
  return (LIFECYCLE_VALUES as readonly string[]).includes(s) ? s : "pending";
}

export function assertLifecycle(raw: unknown): string | undefined {
  if (raw === null || raw === undefined) return undefined;
  const s = String(raw).toLowerCase();
  if (!s) return undefined;
  return (LIFECYCLE_VALUES as readonly string[]).includes(s) ? s : undefined;
}

function dbPaymentStatusToDisplay(raw: unknown): string {
  const s = String(raw || "").toLowerCase();
  const validFinancialStatuses = ["pending", "unpaid", "paid", "voided", "settled", "overpaid"];
  return validFinancialStatuses.includes(s) ? s : "pending";
}


function mapBookingRow(r: any): Booking {
  const notesFallback = (() => {
    try {
      return r.notes && r.notes.trim().startsWith("{") ? JSON.parse(r.notes) : {};
    } catch {
      return {};
    }
  })();

  return {
    id: r.id,
    memberId: r.member_id || "",
    memberName: r.member_name || "",
    serviceId: r.service_id || "",
    service: (r.service_type || notesFallback.service || "Fitness") as ServiceType,
    serviceType: r.service_type || notesFallback.service || "",
    className: r.class_name || r.service_name || notesFallback.className || "",
    instructor: r.instructor || notesFallback.instructor || "",
    employeeId: r.employee_id || "",
    memberPackageId: r.member_package_id || "",
    moduleId: r.module_id || "",
    outletId: r.outlet_id || null,
    date: dateOnly(r.start_at ?? r.start_time),
    startTime: timeOnly(r.start_time ?? r.start_at),
    endTime: timeOnly(r.end_time ?? r.end_at),
    status: dbPaymentStatusToDisplay(r.status),
    bookingStatus: dbBookingStatusToDisplay(r.booking_status),
    originalRate: Number(r.original_rate ?? 0),
    rate: Number(r.rate ?? 0),
    discountAmount: Number(r.discount_amount ?? 0),
    discountReason: r.discount_reason || "",
    cancelReason: r.cancel_reason || "",
    cancelledAt: r.cancelled_at || "",
    amendedFrom: r.amended_from || "",
    notes: typeof r.notes === "string" && !r.notes.trim().startsWith("{") ? r.notes : "",
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
  const startTs = at(data.date, data.startTime);
  const endTs = at(data.date, data.endTime || data.startTime);

  const insertRow: Record<string, any> = {
    member_id: data.memberId || null,
    member_name: data.memberName || null,
    service_id: (data as any).serviceId || null,
    service_name: data.className || (data as any).serviceName || null,
    service_type: data.service || (data as any).serviceType || null,
    class_name: data.className || null,
    instructor: data.instructor || null,
    employee_id: (data as any).employeeId || null,
    member_package_id: (data as any).memberPackageId || null,
    module_id: (data as any).moduleId || null,
    outlet_id: data.outletId || null,
    start_at: startTs,
    end_at: endTs,
    start_time: startTs,
    end_time: endTs,
    ...(() => {
      // Rates are split once, by the global money controller.
      // POS (health/fitness) never discounts at booking time → rate = original.
      const list = (data as any).originalRate ?? (data as any).rate ?? 0;
      const charged = (data as any).rate ?? list;
      return buildBookingRates(Number(list), Number(charged));
    })(),

    discount_reason: (data as any).discountReason || null,
    status: data.status || "pending",
    booking_status: displayBookingStatusToDb(data.bookingStatus || "confirmed"),
    notes: typeof (data as any).notes === "string" ? (data as any).notes : null,
  };

  const { data: row, error } = await supabase.from("bookings").insert(insertRow).select("id").single();
  if (error) throwDb(error, "bookings");
  await maybeAudit("create", "booking", row.id, null, data);
  return row.id;
}

export async function updateBooking(id: string, data: Partial<Record<string, any>>): Promise<void> {
  const patch: Record<string, any> = { updated_at: nowIso() };

  // 1. Scalar Direct Mappings
  if (data.memberId !== undefined) patch.member_id = data.memberId || null;
  if (data.memberName !== undefined) patch.member_name = data.memberName || null;
  if (data.serviceId !== undefined) patch.service_id = data.serviceId || null;
  if (data.employeeId !== undefined) patch.employee_id = data.employeeId || null;
  if (data.memberPackageId !== undefined) patch.member_package_id = data.memberPackageId || null;
  if (data.moduleId !== undefined) patch.module_id = data.moduleId || null;
  if (data.outletId !== undefined) patch.outlet_id = data.outletId || null;
  if (data.className !== undefined) {
    patch.class_name = data.className || null;
    patch.service_name = data.className || null;
  }
  if (data.instructor !== undefined) patch.instructor = data.instructor || null;
  if (data.notes !== undefined) patch.notes = data.notes || null;
  if (data.service !== undefined) patch.service_type = data.service || null;
  if (data.originalRate !== undefined) patch.original_rate = Number(data.originalRate || 0);
  if (data.rate !== undefined) patch.rate = Number(data.rate || 0);
  if (data.discountAmount !== undefined) patch.discount_amount = Number(data.discountAmount || 0);
  if (data.discountReason !== undefined) patch.discount_reason = data.discountReason || null;
  if (data.cancelReason !== undefined) patch.cancel_reason = data.cancelReason || null;
  if (data.cancelledAt !== undefined) patch.cancelled_at = data.cancelledAt || null;

  // 2. Safe Timestamp Computations (Avoids shifting existing values)
  if (data.date !== undefined || data.startTime !== undefined || data.endTime !== undefined) {
    const { data: current } = await supabase.from("bookings").select("start_at, end_at").eq("id", id).maybeSingle();
    const fallbackDate = current ? dateOnly(current.start_at) : toIsoDayInTz(getSystemNowDate());
    const fallbackStart = current ? timeOnly(current.start_at) : "00:00";
    const fallbackEnd = current ? timeOnly(current.end_at) : fallbackStart;

    const targetDate = data.date !== undefined ? data.date : fallbackDate;
    const targetStart = data.startTime !== undefined ? data.startTime : fallbackStart;
    const targetEnd = data.endTime !== undefined ? data.endTime : fallbackEnd;

    const startTs = at(targetDate, targetStart);
    const endTs = at(targetDate, targetEnd);

    patch.start_at = startTs;
    patch.start_time = startTs;
    patch.end_at = endTs;
    patch.end_time = endTs;
  }

  if (data.status !== undefined) patch.status = data.status;
  if (data.bookingStatus !== undefined) patch.booking_status = displayBookingStatusToDb(data.bookingStatus);

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
    isSettlement:
      r.kind === "settlement" || !!r.settled_charge_id || meta.isSettlement === true,
    discount: Number(r.discount || 0),
    outletId: r.outlet_id || undefined,
    createdBy: r.created_by || undefined,

  } as Transaction;
}

/**
 * Map a row of the canonical `charges` table (the debit / sales side) into the
 * legacy `Transaction` shape consumed by the UI.
 */
function mapChargeRow(r: any): Transaction {
  const meta = r.meta && typeof r.meta === "object" ? r.meta : {};
  const isVoided = meta.voided === true;
  return {
    id: r.id,
    memberId: r.member_id || "",
    memberName: r.member_name || "",
    amount: Number(r.amount || 0),
    vat: Number(r.vat_amount || 0),
    total: Number(r.total || 0),
    method: (r.method || "cash") as PaymentMethod,
    type: "Charge",
    date: dateOnly(r.paid_at || r.created_at),
    description: r.description || r.charge_head || "",
    receiptNo: r.receipt_no || "",
    serviceType: r.charge_head || undefined,
    status: (isVoided ? "voided" : r.status === "paid" ? "paid" : "pending") as any,
    bookingId: meta.bookingId || undefined,
    voided: isVoided,
    voidReason: meta.voidReason || undefined,
    chargeHead: r.charge_head || undefined,
    // A charge row is its own canonical charge reference.
    chargeRowId: r.id,
    discount: Number(r.discount || 0),
    outletId: r.outlet_id || undefined,
    createdBy: r.created_by || undefined,
  } as Transaction;
}

/**
 * Unified transaction feed.
 *
 * Debits come from `charges` (created the moment a booking / POS order / manual
 * charge is raised — this is "sales"), credits come from `payments` (created
 * only when money is actually collected). Legacy `Charge`-typed payment mirrors
 * are filtered out so nothing is counted twice.
 */
export async function getTransactions(): Promise<Transaction[]> {
  const [paymentsRes, chargesRes] = await Promise.all([
    supabase.from("payments").select("*").order("paid_at", { ascending: false }),
    supabase.from("charges").select("*").order("created_at", { ascending: false }),
  ]);

  if (paymentsRes.error) console.warn("[payments] read failed:", paymentsRes.error.message);
  if (chargesRes.error) console.warn("[charges] read failed:", chargesRes.error.message);

  const payments = (paymentsRes.data || [])
    .filter((r: any) => (r?.meta?.type || "Payment") !== "Charge")
    .map(mapPaymentRow);
  const charges = (chargesRes.data || []).map(mapChargeRow);

  return [...charges, ...payments].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

/** True when `id` belongs to the `charges` table (rather than `payments`). */
async function isChargeRow(id: string): Promise<boolean> {
  const { data } = await supabase.from("charges").select("id").eq("id", id).maybeSingle();
  return !!data;
}

/** Insert a credit-side row into `payments`. */
async function insertPaymentRow(data: Partial<Transaction>): Promise<string> {
  const gross = Number(data.amount || 0);
  const breakdown = shouldBreakdownVat(data.type as any, (data as any).isSettlement);
  const money = toMoneyColumns(
    buildAmounts({
      gross,
      discount: Number((data as any).discount || 0),
      breakdownVat: breakdown,
    }),
  );

  const status = data.status === "pending" ? "pending" : "paid";
  const insertRow: any = {
    receipt_no: data.receiptNo || generateNextBillNumber("FPC"),
    member_id: data.memberId || null,
    member_name: data.memberName || null,
    ...money,

    method: data.method || "cash",
    service_type: data.serviceType || null,
    description: data.description || "",
    paid_at: data.date ? dayToTimestampInTz(data.date) : nowIso(),
    created_at: nowIso(),
    status,
    outlet_id: (data as any).outletId || null,
    settled_charge_id: (data as any).chargeRowId || null,
    created_by: (data as any).createdBy || null,
    meta: {
      type: data.type || "Payment",
      bookingId: data.bookingId || null,
      chargeRowId: (data as any).chargeRowId || null,
      isSettlement: (data as any).isSettlement || false,
    },
  };

  const { data: row, error } = await supabase.from("payments").insert(insertRow).select("id").single();
  if (error) throwDb(error, "payments");
  await maybeAudit("create", "payment", row.id, null, data);
  return row.id;
}

/**
 * Write a transaction.
 *
 * `type === "Charge"` → `charges` (sales / due). Money is NOT considered
 * received; the member's balance goes up until a payment settles it.
 * Anything else → `payments` (money received).
 * A charge explicitly flagged as already paid also books the matching payment.
 */
export async function addTransaction(data: Partial<Transaction>): Promise<string> {
  const isCharge = String(data.type || "") === "Charge";
  if (!isCharge) return insertPaymentRow(data);

  const gross = Number(data.total || data.amount || 0);
  const settled = data.status === "paid" || (data.status as any) === "completed";
  // A charge is raised at full billed value — discounts belong to settlement.
  const money = toMoneyColumns(buildAmounts({ gross }));

  // Idempotency: never raise a second live charge for the same booking.
  const bookingId = (data as any).bookingId || null;
  if (bookingId) {
    const { data: existing } = await supabase
      .from("charges")
      .select("id, meta")
      .eq("meta->>bookingId", bookingId)
      .limit(1)
      .maybeSingle();
    if (existing && !(existing as any).meta?.voided) return (existing as any).id;
  }

  const chargeRow: any = {
    member_id: data.memberId || null,
    member_name: data.memberName || null,
    charge_head: (data as any).chargeHead || data.serviceType || "Charge",
    description: data.description || (data as any).className || "",
    ...money,
    status: settled ? "paid" : "unpaid",
    method: data.method || null,
    receipt_no: data.receiptNo || generateNextBillNumber("CHG"),
    paid_at: settled ? (data.date ? dayToTimestampInTz(data.date) : nowIso()) : null,
    created_at: data.date ? dayToTimestampInTz(data.date) : nowIso(),
    outlet_id: (data as any).outletId || null,
    created_by: (data as any).createdBy || null,
    meta: {
      type: bookingId ? "booking" : "manual",
      bookingId,
      bookingIds: (data as any).bookingIds || null,
      outletId: (data as any).outletId || null,
    },
  };

  // Always land the debit first as `unpaid`; settlement (if any) goes through
  // the atomic RPC so the credit row and booking lifecycle stay in lockstep.
  chargeRow.status = "unpaid";
  chargeRow.paid_at = null;
  chargeRow.discount = 0;
  chargeRow.total = chargeRow.amt_after_vat;

  const { data: row, error } = await supabase.from("charges").insert(chargeRow).select("id").single();
  if (error) throwDb(error, "charges");
  await maybeAudit("create", "charge", row.id, null, data);


  if (settled) {
    await settleCharge(row.id, {
      method: (data.method || "cash") as string,
      discount: Number((data as any).discount || 0),
      paidOn: data.date,
      note: data.description,
    });
  }


  return row.id;
}


/**
 * Settle a charge atomically (server side).
 *
 * The `settle_charge` RPC locks the charge row, refuses a second settlement,
 * inserts the single credit row in `payments` and closes every booking carried
 * by the charge. A partial unique index on `payments.settled_charge_id`
 * guarantees a duplicate can never land, even under concurrent clicks.
 */
export async function settleCharge(
  chargeId: string,
  opts: { method?: string; discount?: number; paidOn?: string; note?: string } = {},
): Promise<string> {
  const { data, error } = await supabase.rpc("settle_charge", {
    p_charge_id: chargeId,
    p_method: opts.method || "cash",
    p_discount: Number(opts.discount || 0),
    p_paid_on: opts.paidOn || null,
    p_note: opts.note || null,
  });
  if (error) {
    if (/ALREADY_SETTLED/i.test(error.message)) {
      throw new Error("This bill is already settled. Void it first to re-settle.");
    }
    if (/CHARGE_VOIDED/i.test(error.message)) {
      throw new Error("This charge is voided and cannot be settled.");
    }
    if (/duplicate key|payments_one_live_settlement/i.test(error.message)) {
      throw new Error("A settlement already exists for this bill.");
    }
    throwDb(error, "settle_charge");
  }
  await maybeAudit("update", "charge", chargeId, null, { settled: true, ...opts });
  return String(data);
}

/** Void a settlement payment and re-open its charge + bookings. */
export async function voidPayment(paymentId: string, reason?: string): Promise<void> {
  const { error } = await supabase.rpc("void_payment", {
    p_payment_id: paymentId,
    p_reason: reason || null,
  });
  if (error) {
    if (/ALREADY_VOIDED/i.test(error.message)) throw new Error("This payment is already voided.");
    throwDb(error, "void_payment");
  }
  await maybeAudit("update", "payment", paymentId, null, { voided: true, reason });
}

/**
 * Update a transaction. Routes to `charges` or `payments` depending on where
 * the row actually lives. Settling a charge is delegated to the `settle_charge`
 * RPC so the credit row and the booking lifecycle move in one transaction.
 */
export async function updateTransaction(id: string, data: Partial<Transaction>): Promise<void> {
  if (await isChargeRow(id)) {
    const { data: current } = await supabase.from("charges").select("*").eq("id", id).maybeSingle();
    const nextStatus = String(data.status ?? "");
    const settling = nextStatus === "paid" || nextStatus === "completed";
    const voiding = nextStatus === "voided" || (data as any).voided === true;

    if (settling && !voiding) {
      await settleCharge(id, {
        method: (data.method || current?.method || "cash") as string,
        discount: Number((data as any).discount ?? current?.discount ?? 0),
        paidOn: data.date,
        note: data.description,
      });
      return;
    }

    const patch: any = {};
    if (data.method !== undefined) patch.method = data.method;
    if (data.description !== undefined) patch.description = data.description;
    if (data.date !== undefined) patch.paid_at = dayToTimestampInTz(data.date);
    if (data.amount !== undefined) patch.amount = data.amount;
    if (data.vat !== undefined) patch.vat_amount = data.vat;
    if (data.total !== undefined) patch.total = data.total;
    if ((data as any).discount !== undefined) patch.discount = (data as any).discount;
    if (data.receiptNo !== undefined) patch.receipt_no = data.receiptNo;
    if (nextStatus === "pending") patch.status = "unpaid";
    if (voiding) {
      patch.meta = {
        ...(current?.meta && typeof current.meta === "object" ? current.meta : {}),
        voided: true,
        voidReason: (data as any).voidReason || null,
        voidedAt: (data as any).voidedAt || nowIso(),
      };
    }

    const { error } = await supabase.from("charges").update(patch).eq("id", id);
    if (error) throwDb(error, "charges");
    await maybeAudit("update", "charge", id, null, data);
    return;
  }

  // Payment rows: voiding goes through the RPC so the charge re-opens too.
  if (String(data.status ?? "") === "voided" || (data as any).voided === true) {
    await voidPayment(id, (data as any).voidReason);
    return;
  }


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
    type: r.service_type || "Fitness",
    duration: Number(r.duration_min || 0),
    price: Number(r.price || 0),
    isActive: r.active !== false,
    description: meta.description || r.description || "",
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

// ─── Plan Durations ───────────────────────────────
export interface PlanDuration {
  id: string;
  months: number;
  name: string;
  sortOrder: number;
  active: boolean;
}

function mapDurationRow(r: any): PlanDuration {
  return {
    id: r.id,
    months: Number(r.months || 0),
    name: r.name || "",
    sortOrder: Number(r.sort_order || 0),
    active: r.active !== false,
  };
}

export async function getPlanDurations(): Promise<PlanDuration[]> {
  const { data, error } = await supabase
    .from("plan_durations")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("months", { ascending: true });
  if (error) {
    console.warn("[plan_durations] read failed:", error.message);
    return [];
  }
  return (data || []).map(mapDurationRow);
}

export async function addPlanDuration(data: Partial<PlanDuration>): Promise<string> {
  const { data: row, error } = await supabase
    .from("plan_durations")
    .insert({
      months: Number(data.months || 1),
      name: data.name || `${data.months} months`,
      sort_order: Number(data.sortOrder || 0),
      active: data.active !== false,
    })
    .select("id")
    .single();
  if (error) throwDb(error, "plan_durations");
  return row.id;
}

export async function updatePlanDuration(id: string, data: Partial<PlanDuration>): Promise<void> {
  const patch: Record<string, any> = {};
  if (data.months !== undefined) patch.months = Number(data.months);
  if (data.name !== undefined) patch.name = data.name;
  if (data.sortOrder !== undefined) patch.sort_order = Number(data.sortOrder);
  if (data.active !== undefined) patch.active = data.active;
  const { error } = await supabase.from("plan_durations").update(patch).eq("id", id);
  if (error) throwDb(error, "plan_durations");
}

export async function deletePlanDuration(id: string): Promise<void> {
  const { error } = await supabase.from("plan_durations").delete().eq("id", id);
  if (error) throwDb(error, "plan_durations");
}

// ─── Membership Plans ───────────────────────────────────────────────
export interface MembershipPlanPrice {
  durationId: string;
  price: number;
  months?: number;
  name?: string;
}

export interface FirestoreMembershipPlan {
  id: string;
  name: string;
  tier: string;
  durationMonths: number;
  includedServices: string[];
  autoRenew: boolean;
  autoDiscount: boolean;
  prices: MembershipPlanPrice[];
  price: number;
  yearlyPrice?: number;
  longTermPrice?: number;
  // includes?: string;
  durationInMonths?: number;
  moduleId?: string;
}

function mapPlanRow(r: any, durations: PlanDuration[]): FirestoreMembershipPlan {
  const meta = (() => {
    try {
      return typeof r.description === "string" && r.description.startsWith("{") ? JSON.parse(r.description) : {};
    } catch {
      return {};
    }
  })();

  const includedFromCol: string[] = Array.isArray(r.included_services) ? r.included_services : [];
  const legacyIncludes: string =
    meta.includes ||
    (typeof r.description === "string" && !r.description.startsWith("{") ? r.description : "") ||
    r.includes ||
    "";
  const includedServices =
    includedFromCol.length > 0
      ? includedFromCol
      : legacyIncludes
        ? legacyIncludes
          .split(/[+,]/)
          .map((s: string) => s.trim())
          .filter(Boolean)
        : [];

  const priceRows: any[] = Array.isArray(r.membership_plan_prices) ? r.membership_plan_prices : [];
  const prices: MembershipPlanPrice[] = priceRows
    .map((pr) => {
      const d = durations.find((x) => x.id === pr.duration_id);
      return {
        durationId: pr.duration_id,
        months: d?.months || 0,
        name: d?.name || "",
        price: Number(pr.price || 0),
      };
    })
    .sort((a, b) => a.months - b.months);

  const durationMonths = Number(r.duration_months ?? Math.round(Number(r.duration_days || 30) / 30));
  const headlinePrice = prices.length > 0 ? prices[0].price : Number(r.price || 0);

  return {
    id: r.id,
    name: r.name || "",
    tier: r.tier || "Basic",
    durationMonths,
    includedServices,
    autoRenew: Boolean(r.auto_renew ?? meta.autoRenew ?? false),
    autoDiscount: Boolean(r.auto_discount ?? meta.autoDiscount ?? false),
    prices,
    price: headlinePrice,
    yearlyPrice: Number(r.yearly_price || meta.yearlyPrice || 0),
    longTermPrice: Number(r.long_term_price || meta.longTermPrice || 0),
    // includes: includedServices.join(" + "),
    durationInMonths: durationMonths,
    moduleId: r.module_id || undefined,
  };
}

export async function getMembershipPlans(): Promise<FirestoreMembershipPlan[]> {
  const durations = await getPlanDurations();
  const { data, error } = await supabase
    .from("membership_plans")
    .select("*, membership_plan_prices(*)")
    .order("price", { ascending: true });
  if (error) {
    console.warn("[membership_plans] read failed:", error.message);
    return [];
  }
  return (data || []).map((r) => mapPlanRow(r, durations));
}

async function syncPlanPrices(planId: string, prices: MembershipPlanPrice[] | undefined): Promise<void> {
  if (!Array.isArray(prices)) return;
  const { data: existing } = await supabase
    .from("membership_plan_prices")
    .select("id, duration_id")
    .eq("plan_id", planId);
  const existingByDuration = new Map<string, string>();
  (existing || []).forEach((row: any) => existingByDuration.set(row.duration_id, row.id));

  const keepDurationIds = new Set<string>();
  for (const p of prices) {
    if (!p.durationId) continue;
    keepDurationIds.add(p.durationId);
    const existingId = existingByDuration.get(p.durationId);
    if (existingId) {
      await supabase
        .from("membership_plan_prices")
        .update({ price: Number(p.price || 0) })
        .eq("id", existingId);
    } else {
      await supabase
        .from("membership_plan_prices")
        .insert({ plan_id: planId, duration_id: p.durationId, price: Number(p.price || 0) });
    }
  }
  const toDelete = (existing || []).filter((row: any) => !keepDurationIds.has(row.duration_id));
  if (toDelete.length > 0) {
    await supabase
      .from("membership_plan_prices")
      .delete()
      .in(
        "id",
        toDelete.map((r: any) => r.id),
      );
  }
}

export async function addMembershipPlan(data: Partial<FirestoreMembershipPlan>): Promise<string> {
  const headline = (data.prices && data.prices[0]?.price) || data.price || 0;
  const durationMonths = data.durationMonths || data.durationInMonths || 1;
  const { data: row, error } = await supabase
    .from("membership_plans")
    .insert({
      name: data.name || data.tier || "Plan",
      tier: data.tier || "Basic",
      price: headline,
      duration_days: durationMonths * 30,
      duration_months: durationMonths,
      included_services: data.includedServices || [],
      auto_renew: !!data.autoRenew,
      auto_discount: !!data.autoDiscount,
      active: true,
    })
    .select("id")
    .single();
  if (error) throwDb(error, "membership_plans");
  await syncPlanPrices(row.id, data.prices);
  return row.id;
}

export async function updateMembershipPlan(id: string, data: Partial<Record<string, any>>): Promise<void> {
  const patch: Record<string, any> = {};
  if (data.name !== undefined) patch.name = data.name;
  if (data.tier !== undefined) patch.tier = data.tier;
  if (data.durationMonths !== undefined) {
    patch.duration_months = Number(data.durationMonths);
    patch.duration_days = Number(data.durationMonths) * 30;
  }
  if (data.includedServices !== undefined) patch.included_services = data.includedServices;
  if (data.autoRenew !== undefined) patch.auto_renew = !!data.autoRenew;
  if (data.autoDiscount !== undefined) patch.auto_discount = !!data.autoDiscount;
  if (Array.isArray(data.prices) && data.prices.length > 0) {
    patch.price = Number(data.prices[0].price || 0);
  } else if (data.price !== undefined) {
    patch.price = Number(data.price);
  }
  if (Object.keys(patch).length > 0) {
    const { error } = await supabase.from("membership_plans").update(patch).eq("id", id);
    if (error) throwDb(error, "membership_plans");
  }
  if (data.prices !== undefined) {
    await syncPlanPrices(id, data.prices);
  }
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
  const todayKey = toIsoDayInTz(getSystemNowDate());
  const startOfMonthKey = `${todayKey.slice(0, 8)}01`;
  const inMonth = (d: string) => d && d >= startOfMonthKey;
  const currRevenue = transactions.filter((t) => inMonth(t.date)).reduce((s, t) => s + t.total, 0);
  return {
    totalMembers: members.length,
    activeMembers: members.filter((m) => m.status === "Active").length,
    membersChange: members.filter((m) => inMonth(m.joinDate)).length,
    monthlyRevenue: currRevenue,
    revenueChange: 0,
    activeBookings: bookings.filter((b) => ["confirmed", "Wait-listed"].includes(b.bookingStatus)).length,
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
    // 1. Legacy camelCase mappings (keeps compatibility with any other parts of the app)
    companyName: row?.company_name || extras.companyName || "",
    companyAddress: row?.address || extras.companyAddress || "",
    companyPhone: row?.phone || extras.companyPhone || "",
    companyEmail: row?.email || extras.companyEmail || "",
    logoUrl: row?.logo_url || extras.logoUrl || "",
    vatNo: row?.vat_no || extras.vatNo || "",
    panNumber: extras.panNumber || row?.vat_no || "",
    vatRate: String(row?.vat_rate ?? extras.vatRate ?? "13"),
    maxOutlets: row?.max_outlets || extras.maxOutlets || "unlimited",
    resendEndpoint: row?.resend_endpoint || extras.resendEndpoint || "",

    // 2. Direct database columns expected by your original frontend file
    id: row?.id || "main",
    company_name: row?.company_name || "",
    address: row?.address || "",
    phone: row?.phone || "",
    email: row?.email || "",
    logo_url: row?.logo_url || "",
    vat_no: row?.vat_no || "",
    currency: row?.currency || extras.currency || "NPR",
    vat_rate: row?.vat_rate !== undefined ? row.vat_rate : (extras.vatRate ? Number(extras.vatRate) : 13),
    max_outlets: row?.max_outlets || "unlimited",
    resend_endpoint: row?.resend_endpoint || "",

    // 3. Nested object explicitly returned for your component's destructuring (const extras = settings.extras || {})
    extras: extras,
  };
}

export async function getCompanySettings(): Promise<Record<string, any>> {
  const { data, error } = await supabase.from("company_settings").select("*").eq("id", "main").maybeSingle();
  if (error) {
    console.warn("[company_settings] read failed:", error.message);
    return {};
  }
  return mapSettingsRow(data || {});
}

export async function setCompanySetting(key: string, value: any): Promise<void> {
  await saveCompanySettings({ [key]: value });
}

export async function saveCompanySettings(settings: Record<string, any>): Promise<void> {
  const { data: existing } = await supabase.from("company_settings").select("*").eq("id", "main").maybeSingle();

  // 1. Initialize extras with existing data
  let extras = { ...(existing?.extras && typeof existing.extras === "object" ? existing.extras : {}) } as Record<
    string,
    any
  >;

  const payload: Record<string, any> = { id: "main", updated_at: nowIso() };

  // 2. Loop and map both snake_case (DB format) and camelCase inputs cleanly
  for (const [key, value] of Object.entries(settings)) {
    if (key === "company_name" || key === "companyName") {
      payload.company_name = value;
    } else if (key === "address" || key === "companyAddress") {
      payload.address = value;
    } else if (key === "phone" || key === "companyPhone") {
      payload.phone = value;
    } else if (key === "email" || key === "companyEmail") {
      payload.email = value;
    } else if (key === "logo_url" || key === "logoUrl") {
      payload.logo_url = value;
    } else if (key === "vat_no" || key === "vatNo" || key === "panNumber") {
      payload.vat_no = value; // Fixed: Removed explicit assignment to extras[key]
    } else if (key === "currency") {
      payload.currency = value;
    } else if (key === "vat_rate" || key === "vatRate") {
      payload.vat_rate = typeof value === "number" ? value : (Number(value) || 13);
    } else if (key === "max_outlets" || key === "maxOutlets") {
      payload.max_outlets = value;
    } else if (key === "resend_endpoint" || key === "resendEndpoint") {
      payload.resend_endpoint = value;
    } else if (key === "extras") {
      // Fixed: If an explicit extras object is passed, merge its entries instead of double-nesting it
      if (value && typeof value === "object") {
        extras = { ...extras, ...value };
      }
    } else if (key !== "id" && key !== "updated_at") {
      // Catch-all for actual miscellaneous configuration parameters
      extras[key] = value;
    }
  }

  // 3. Absolute Sanity Clean up: Ensure no columns ever leak into the JSONB extras payload
  const tableColumns = [
    "id", "company_name", "companyName", "address", "companyAddress",
    "phone", "companyPhone", "email", "companyEmail", "logo_url", "logoUrl",
    "vat_no", "vatNo", "panNumber", "currency", "vat_rate", "vatRate",
    "max_outlets", "maxOutlets", "resend_endpoint", "resendEndpoint", "extras"
  ];
  tableColumns.forEach((col) => delete extras[col]);

  payload.extras = extras;

  const { error } = await supabase.from("company_settings").upsert(payload, { onConflict: "id" });
  if (error) throwDb(error, "company_settings");
}
// ─── Check-ins ──────────────────────────────────────────────────────
export async function addCheckIn(memberId: string): Promise<string> {
  return addCheckInRecord({ memberId, memberName: "", date: getSystemTodayStr() });
}

// export interface CheckInRecord {
//   id: string;
//   memberId: string;
//   memberName: string;
//   date: string;
//   checkInTime: string;
//   checkOutTime?: string;
// }

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
    status: r.status,
  }));
}

export async function addCheckInRecord(data: { memberId: string; memberName: string; date: string }): Promise<string> {
  const { data: row, error } = await supabase
    .from("check_ins")
    .insert({
      member_id: data.memberId || null,
      member_name: data.memberName || null,
      check_in_at: at(data.date),
      status: "verified"
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
    .upsert({ id: "main", discount_rules: rules, updated_at: nowIso() }, { onConflict: "id" });
  if (error) throwDb(error, "company_settings");
}

export async function addAuditLog(
  _userId: string | null,
  action: string,
  entityType: string,
  entityId: string,
  oldValue?: any,
  newValue?: any,
): Promise<void> {
  await _logAudit({
    module: entityType,
    entityType,
    action,
    entityId,
    oldValue,
    newValue,
  });
}
