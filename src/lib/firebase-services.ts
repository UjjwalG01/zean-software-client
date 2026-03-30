import {
  collection, getDocs, getDoc, doc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, type QueryConstraint, setDoc,
  Timestamp,
} from "firebase/firestore";
import { getFirestoreDb } from "./firebase";
import { firestoreMemberToMember, firestoreBookingToBooking, firestoreTransactionToTransaction } from "./firebase-converters";
import type { Member, Booking, Transaction, MemberTier, MemberStatus, ServiceType } from "./mock-data";

// ─── Members ────────────────────────────────────────────────────────
export async function getMembers(filters?: {
  tier?: MemberTier;
  status?: MemberStatus;
  service?: ServiceType;
}): Promise<Member[]> {
  const db = getFirestoreDb();
  const constraints: QueryConstraint[] = [];
  if (filters?.tier) constraints.push(where("tier", "==", filters.tier));
  if (filters?.status) constraints.push(where("status", "==", filters.status));

  const q = constraints.length > 0
    ? query(collection(db, "members"), ...constraints)
    : collection(db, "members");

  const snap = await getDocs(q);
  let results = snap.docs.map(firestoreMemberToMember);

  if (filters?.service) {
    results = results.filter((m) => m.services.includes(filters.service!));
  }
  return results;
}

export async function getMember(id: string): Promise<Member | null> {
  const db = getFirestoreDb();
  const snap = await getDoc(doc(db, "members", id));
  if (!snap.exists()) return null;
  return firestoreMemberToMember(snap as any);
}

export async function addMember(data: Partial<Member>): Promise<string> {
  const db = getFirestoreDb();
  const ref = await addDoc(collection(db, "members"), {
    firstName: data.name?.split(" ")[0] || "",
    lastName: data.name?.split(" ").slice(1).join(" ") || "",
    email: data.email || "",
    phone: data.phone || "",
    address: data.address || "",
    emergencyContactNum: data.emergencyContact || "",
    tier: data.tier || "Basic",
    services: data.services || [],
    status: "Active",
    plan: data.plan || "Monthly",
    joiningDate: Timestamp.now(),
    autoRenew: data.autoRenew || false,
    loyaltyYears: 0,
    totalPaid: 0,
    dueAmount: 0,
    openingBalance: 0,
    discount: 0,
    preferences: data.preferences?.join(", ") || "",
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return ref.id;
}

export async function updateMember(id: string, data: Partial<Record<string, any>>): Promise<void> {
  const db = getFirestoreDb();
  await updateDoc(doc(db, "members", id), { ...data, updatedAt: Timestamp.now() });
}

export async function deleteMember(id: string): Promise<void> {
  const db = getFirestoreDb();
  await deleteDoc(doc(db, "members", id));
}

// ─── Bookings ───────────────────────────────────────────────────────
export async function getBookings(filters?: { service?: ServiceType }): Promise<Booking[]> {
  const db = getFirestoreDb();
  const constraints: QueryConstraint[] = [];
  if (filters?.service) constraints.push(where("service", "==", filters.service));

  const q = constraints.length > 0
    ? query(collection(db, "bookings"), ...constraints)
    : collection(db, "bookings");

  const snap = await getDocs(q);
  return snap.docs.map(firestoreBookingToBooking);
}

export async function addBooking(data: Partial<Booking>): Promise<string> {
  const db = getFirestoreDb();
  const ref = await addDoc(collection(db, "bookings"), {
    memberId: data.memberId || "",
    memberName: data.memberName || "",
    service: data.service || "Gym",
    className: data.className || "",
    bookingDate: data.date || "",
    startTime: data.startTime || "",
    endTime: data.endTime || "",
    status: data.status || "Pending",
    instructor: data.instructor || "",
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return ref.id;
}

export async function updateBooking(id: string, data: Partial<Record<string, any>>): Promise<void> {
  const db = getFirestoreDb();
  await updateDoc(doc(db, "bookings", id), { ...data, updatedAt: Timestamp.now() });
}

export async function deleteBooking(id: string): Promise<void> {
  const db = getFirestoreDb();
  await deleteDoc(doc(db, "bookings", id));
}

// ─── Transactions / Payments ────────────────────────────────────────
export async function getTransactions(): Promise<Transaction[]> {
  const db = getFirestoreDb();
  const snap = await getDocs(collection(db, "payments"));
  return snap.docs.map(firestoreTransactionToTransaction);
}

export async function addTransaction(data: Partial<Transaction>): Promise<string> {
  const db = getFirestoreDb();
  const amount = data.amount || 0;
  const vat = Math.round(amount * 0.13);
  const ref = await addDoc(collection(db, "payments"), {
    memberId: data.memberId || "",
    memberName: data.memberName || "",
    amount,
    vatAmount: vat,
    totalAmount: amount + vat,
    paymentMethod: data.method || "Cash",
    type: data.type || "Payment",
    paymentDate: data.date || new Date().toISOString().split("T")[0],
    description: data.description || "",
    receiptNo: data.receiptNo || `VFC-${Date.now()}`,
    status: "Completed",
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return ref.id;
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
}

export async function getServices(): Promise<FirestoreService[]> {
  const db = getFirestoreDb();
  const snap = await getDocs(collection(db, "services"));
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      name: data.name || "",
      type: data.type || "Gym",
      duration: data.duration || 0,
      price: data.price || 0,
      isActive: data.isActive !== false,
      description: data.description || "",
      capacity: data.capacity || 0,
      instructor: data.instructor || "",
    };
  });
}

export async function addService(data: Partial<FirestoreService>): Promise<string> {
  const db = getFirestoreDb();
  const ref = await addDoc(collection(db, "services"), {
    name: data.name || "",
    type: data.type || "Gym",
    duration: data.duration || 60,
    price: data.price || 0,
    isActive: data.isActive !== false,
    description: data.description || "",
    capacity: data.capacity || 1,
    instructor: data.instructor || "",
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return ref.id;
}

export async function updateService(id: string, data: Partial<Record<string, any>>): Promise<void> {
  const db = getFirestoreDb();
  await updateDoc(doc(db, "services", id), { ...data, updatedAt: Timestamp.now() });
}

export async function deleteService(id: string): Promise<void> {
  const db = getFirestoreDb();
  await deleteDoc(doc(db, "services", id));
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

export async function getMembershipPlans(): Promise<FirestoreMembershipPlan[]> {
  const db = getFirestoreDb();
  const snap = await getDocs(collection(db, "membershipPlans"));
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      name: data.name || "",
      tier: data.tier || "Basic",
      price: data.price || 0,
      yearlyPrice: data.yearlyPrice || 0,
      longTermPrice: data.longTermPrice || 0,
      durationInMonths: data.durationInMonths || 1,
      membershipTypeId: data.membershipTypeId || "",
      includes: data.includes || "",
      autoRenew: data.autoRenew || false,
    };
  });
}

export async function addMembershipPlan(data: Partial<FirestoreMembershipPlan>): Promise<string> {
  const db = getFirestoreDb();
  const ref = await addDoc(collection(db, "membershipPlans"), {
    name: data.name || "",
    tier: data.tier || "Basic",
    price: data.price || 0,
    yearlyPrice: data.yearlyPrice || 0,
    longTermPrice: data.longTermPrice || 0,
    durationInMonths: data.durationInMonths || 1,
    membershipTypeId: data.membershipTypeId || "",
    includes: data.includes || "",
    autoRenew: data.autoRenew || false,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return ref.id;
}

export async function updateMembershipPlan(id: string, data: Partial<Record<string, any>>): Promise<void> {
  const db = getFirestoreDb();
  await updateDoc(doc(db, "membershipPlans", id), { ...data, updatedAt: Timestamp.now() });
}

export async function deleteMembershipPlan(id: string): Promise<void> {
  const db = getFirestoreDb();
  await deleteDoc(doc(db, "membershipPlans", id));
}

// ─── Dashboard Stats ────────────────────────────────────────────────
export async function getDashboardStats() {
  const [membersSnap, bookingsSnap, paymentsSnap] = await Promise.all([
    getDocs(collection(getFirestoreDb(), "members")),
    getDocs(collection(getFirestoreDb(), "bookings")),
    getDocs(collection(getFirestoreDb(), "payments")),
  ]);

  const allMembers = membersSnap.docs.map(firestoreMemberToMember);
  const allBookings = bookingsSnap.docs.map(firestoreBookingToBooking);
  const allTransactions = paymentsSnap.docs.map(firestoreTransactionToTransaction);

  const activeMembers = allMembers.filter((m) => m.status === "Active").length;
  const monthlyRevenue = allTransactions.reduce((sum, t) => sum + t.total, 0);
  const activeBookings = allBookings.filter((b) => b.status === "Confirmed" || b.status === "Pending").length;

  return {
    totalMembers: allMembers.length,
    activeMembers,
    monthlyRevenue,
    revenueChange: 0,
    activeBookings,
    bookingsChange: 0,
    todayCheckins: 0,
    checkinsChange: 0,
  };
}

// ─── Company Settings ───────────────────────────────────────────────
export async function getCompanySettings(): Promise<Record<string, string>> {
  const db = getFirestoreDb();
  const snap = await getDocs(collection(db, "companySettings"));
  const settings: Record<string, string> = {};
  snap.docs.forEach((d) => {
    const data = d.data();
    settings[data.key] = data.value;
  });
  return settings;
}

export async function setCompanySetting(key: string, value: string, type = "string"): Promise<void> {
  const db = getFirestoreDb();
  await setDoc(doc(db, "companySettings", key), {
    key, value, type,
    updatedAt: Timestamp.now(),
  });
}

export async function saveCompanySettings(settings: Record<string, string>): Promise<void> {
  const promises = Object.entries(settings).map(([key, value]) => setCompanySetting(key, value));
  await Promise.all(promises);
}

// ─── Check-ins ──────────────────────────────────────────────────────
export async function addCheckIn(memberId: string): Promise<string> {
  const db = getFirestoreDb();
  const ref = await addDoc(collection(db, "checkIns"), {
    memberId,
    checkInTime: Timestamp.now(),
    checkOutTime: null,
    manualEntry: false,
    createdAt: Timestamp.now(),
  });
  return ref.id;
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
  const db = getFirestoreDb();
  const snap = await getDocs(collection(db, "checkIns"));
  return snap.docs.map((d) => {
    const data = d.data();
    const checkInTs = data.checkInTime?.toDate?.() || new Date();
    return {
      id: d.id,
      memberId: data.memberId || "",
      memberName: data.memberName || "",
      date: data.date || checkInTs.toISOString().split("T")[0],
      checkInTime: checkInTs.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      checkOutTime: data.checkOutTime?.toDate?.()?.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) || undefined,
    };
  });
}

export async function addCheckInRecord(data: { memberId: string; memberName: string; date: string }): Promise<string> {
  const db = getFirestoreDb();
  const ref = await addDoc(collection(db, "checkIns"), {
    memberId: data.memberId,
    memberName: data.memberName,
    date: data.date,
    checkInTime: Timestamp.now(),
    checkOutTime: null,
    manualEntry: false,
    createdAt: Timestamp.now(),
  });
  return ref.id;
}

// ─── Discount Rules ─────────────────────────────────────────────────
export interface DiscountRule {
  years: number;
  discount: number;
}

export async function getDiscountRules(): Promise<DiscountRule[]> {
  const db = getFirestoreDb();
  const snap = await getDocs(query(collection(db, "companySettings"), where("key", "==", "discountRules")));
  if (snap.empty) return [];
  const data = snap.docs[0].data();
  try {
    return JSON.parse(data.value) as DiscountRule[];
  } catch {
    return [];
  }
}

export async function saveDiscountRules(rules: DiscountRule[]): Promise<void> {
  const db = getFirestoreDb();
  await setDoc(doc(db, "companySettings", "discountRules"), {
    key: "discountRules",
    value: JSON.stringify(rules),
    type: "json",
    updatedAt: Timestamp.now(),
  });
}

// ─── Audit Log ──────────────────────────────────────────────────────
export async function addAuditLog(userId: string | null, action: string, entityType: string, entityId: string, oldValue?: any, newValue?: any): Promise<void> {
  const db = getFirestoreDb();
  await addDoc(collection(db, "auditLogs"), {
    userId,
    action,
    entityType,
    entityId,
    oldValue: oldValue ? JSON.stringify(oldValue) : null,
    newValue: newValue ? JSON.stringify(newValue) : null,
    timestamp: Timestamp.now(),
  });
}
