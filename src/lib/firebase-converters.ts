/**
 * Converts Firestore documents to the existing mock-data interfaces
 * so the UI receives data in the exact same shape it currently expects.
 */
import type { DocumentData, QueryDocumentSnapshot } from "firebase/firestore";
import type { Member, Booking, Transaction, MemberTier, ServiceType, MemberStatus, PaymentMethod, BookingStatus } from "./mock-data";

const avatarUrl = (seed: string) => `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;

export function firestoreMemberToMember(doc: QueryDocumentSnapshot<DocumentData>): Member {
  const d = doc.data();
  const name = `${d.firstName} ${d.lastName}`;
  return {
    id: doc.id,
    name,
    email: d.email || "",
    phone: d.phone || "",
    avatar: d.avatar || avatarUrl(d.firstName?.toLowerCase() || doc.id),
    tier: (d.tier || "Basic") as MemberTier,
    services: (d.services || []) as ServiceType[],
    status: (d.status || "Active") as MemberStatus,
    joinDate: d.joiningDate ? toDateString(d.joiningDate) : "",
    expiryDate: d.expiryDate ? toDateString(d.expiryDate) : "",
    plan: d.plan || "Monthly",
    address: d.address || "",
    emergencyContact: d.emergencyContactNum || "",
    preferences: d.preferences ? (typeof d.preferences === "string" ? d.preferences.split(",").map((s: string) => s.trim()) : d.preferences) : [],
    openingBalance: d.openingBalance || 0,
    totalPaid: d.totalPaid || 0,
    dueAmount: d.dueAmount || 0,
    membershipYears: d.loyaltyYears || 0,
    discount: d.discount || 0,
    autoRenew: d.autoRenew || false,
  };
}

export function firestoreBookingToBooking(doc: QueryDocumentSnapshot<DocumentData>): Booking {
  const d = doc.data();
  return {
    id: doc.id,
    memberId: d.memberId || "",
    memberName: d.memberName || "",
    service: (d.service || d.serviceType || "Gym") as ServiceType,
    className: d.className || d.serviceName || "",
    date: d.bookingDate ? toDateString(d.bookingDate) : "",
    startTime: d.startTime ? toTimeString(d.startTime) : "",
    endTime: d.endTime ? toTimeString(d.endTime) : "",
    status: (d.status || "Pending") as BookingStatus,
    instructor: d.instructor || "",
  };
}

export function firestoreTransactionToTransaction(doc: QueryDocumentSnapshot<DocumentData>): Transaction {
  const d = doc.data();
  const amount = d.amount || 0;
  const vat = d.vatAmount || d.vat || Math.round(amount * 0.13);
  return {
    id: doc.id,
    memberId: d.memberId || "",
    memberName: d.memberName || "",
    amount,
    vat,
    total: d.totalAmount || d.total || amount + vat,
    method: (d.paymentMethod || d.method || "Cash") as PaymentMethod,
    type: d.type || "Payment",
    date: d.paymentDate ? toDateString(d.paymentDate) : d.date || "",
    description: d.description || "",
    receiptNo: d.receiptNo || d.transactionRef || "",
    serviceType: d.serviceType || undefined,
  };
}

// Helpers
function toDateString(val: any): string {
  if (typeof val === "string") return val.split("T")[0];
  if (val?.toDate) return val.toDate().toISOString().split("T")[0];
  if (val instanceof Date) return val.toISOString().split("T")[0];
  return "";
}

function toTimeString(val: any): string {
  if (typeof val === "string") {
    if (val.includes("T")) return val.split("T")[1]?.substring(0, 5) || val;
    return val.substring(0, 5);
  }
  if (val?.toDate) {
    const d = val.toDate();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  return "";
}
