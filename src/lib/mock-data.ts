export type MemberTier = "Basic" | "Silver" | "Gold" | "Platinum";
export type ServiceType = "Events" | "Fitness" | "Health" | "Membership" | "Sports" | "Wellness";
export type PaymentStatus = "pending" | "unpaid" | "paid" | "voided" | "settled" | "overpaid" | "cancelled" | "completed";
export type MemberStatus = "Active" | "Expired" | "Expiring" | "Inactive";
export type PaymentMethod = "cash" | "card" | "esewa" | "bank_transfer" | "mobile_wallet" | "cheque" | "other";
export type BookingStatus =
  | "Confirmed"
  | "Waitlisted"
  | "NotFixed"
  | "Completed"
  | "Cancelled";

export interface Member {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar: string;
  tier: MemberTier;
  services: ServiceType[];
  status: MemberStatus;
  joinDate: string;
  expiryDate: string;
  plan: string;
  address: string;
  emergencyContact: string;
  preferences: string[];
  openingBalance: number;
  totalPaid: number;
  dueAmount: number;
  membershipYears: number;
  discount: number;
  autoRenew: boolean;
  // Extended GRC fields (all optional)
  firstName?: string;
  middleName?: string;
  lastName?: string;
  dob?: string;
  gender?: string;
  nationality?: string;
  religion?: string;
  maritalStatus?: string;
  residenceStatus?: string;
  nationalId?: string;
  tinNo?: string;
  fatherName?: string;
  occupation?: string;
  officeName?: string;
  officeAddress?: string;
  permanentAddress?: string;
  temporaryAddress?: string;
  contactAlt?: string;
  bloodGroup?: string;
  height?: string;
  weight?: string;
  chest?: string;
  arms?: string;
  thigh?: string;
  waistInch?: string;
  hipInch?: string;
  shoulder?: string;
  heartStroke?: boolean;
  breathingDifficulty?: string;
  skinDisease?: string;
  doctorName?: string;
  doctorContact?: string;
  emergencyName?: string;
  emergencyContactNum?: string;
  notifyPhone?: boolean;
  notifyEmail?: boolean;
  notifySMS?: boolean;

  packages?: string[];
  outletId?: string;
  grcNo?: string;
}

export interface Booking {
  id: string;
  memberId: string;
  memberName: string;
  service: ServiceType;
  serviceId?: string;
  serviceType?: string;
  className: string;
  date: string;
  startTime: string;
  endTime: string;
  status: PaymentStatus;
  instructor: string;
  bookingStatus: BookingStatus;
  employeeId?: string;
  memberPackageId?: string;
  moduleId?: string;
  outletId?: string | null;
  originalRate?: number;
  rate?: number;
  discountAmount?: number;
  discountReason?: string;
  cancelReason?: string;
  cancelledAt?: string;
  amendedFrom?: string;
  notes?: string;
}

export interface Transaction {
  id: string;
  memberId: string;
  memberName: string;
  amount: number;
  vat: number;
  total: number;
  method: PaymentMethod;
  type: "Payment" | "Advance" | "Renewal" | "Registration" | "Charge" | "Refund";
  date: string;
  description: string;
  receiptNo: string;
  serviceType?: ServiceType;
  status?: PaymentStatus;
  bookingId?: string;
  chargeHead?: string;
  voided?: boolean;
  voidReason?: string;
  voidedAt?: string;
  /** Discount applied at settlement that reduces what the member owes. */
  discount?: number;
  /** Outlet that recorded this transaction (drives Revenue by Outlet). */
  outletId?: string;
  /** Bookings → charge → payment linkage */
  linkedBookingId?: string;
  linkedChargeIds?: string[];
  /** Row id in the dedicated `charges` table (when this tx mirrors a charge row). */
  chargeRowId?: string;
  /** Marks settlement-type Payments so the ledger can label them correctly. */
  isSettlement?: boolean;
  createdAt?: string;
  createdBy?: string;
}

export interface AttendanceRecord {
  id: string;
  memberId: string;
  date: string;
  checkIn: string;
  checkOut: string | null;
  service: ServiceType;
}

export interface ExpiryAlert {
  memberId: string;
  memberName: string;
  tier: MemberTier;
  expiryDate: string;
  daysLeft: number;
  avatar: string;
}

const avatarUrl = (seed: string) => `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;

export const members: Member[] = [
  { id: "M001", name: "Aarav Sharma", email: "aarav@email.com", phone: "+977-9841000001", avatar: avatarUrl("aarav"), tier: "Platinum", services: ["Membership", "Health", "Fitness", "Wellness"], status: "Active", joinDate: "2020-01-15", expiryDate: "2035-01-15", plan: "15-Year", address: "Kathmandu, Nepal", emergencyContact: "+977-9841000010", preferences: ["Yoga", "Steam Bath"], openingBalance: 0, totalPaid: 450000, dueAmount: 0, membershipYears: 6, discount: 20, autoRenew: true },
  { id: "M002", name: "Priya Thapa", email: "priya@email.com", phone: "+977-9841000002", avatar: avatarUrl("priya"), tier: "Gold", services: ["Membership", "Health"], status: "Active", joinDate: "2022-03-01", expiryDate: "2026-03-01", plan: "Yearly", address: "Lalitpur, Nepal", emergencyContact: "+977-9841000020", preferences: ["Pilates", "Hot Stone Massage"], openingBalance: 0, totalPaid: 96000, dueAmount: 0, membershipYears: 4, discount: 10, autoRenew: true },
];

export const bookings: Booking[] = [
  { id: "B001", memberId: "M001", memberName: "Aarav Sharma", service: "Membership", className: "Morning Power Yoga", date: "2026-03-26", startTime: "06:00", endTime: "07:00", status: "pending", bookingStatus: "Confirmed", instructor: "Trainer Ravi" },
  { id: "B012", memberId: "M016", memberName: "Sarita Dangol", service: "Health", className: "Water Aerobics", date: "2026-03-30", startTime: "08:00", endTime: "09:00", status: "pending", bookingStatus: "Confirmed", instructor: "Coach Anil" },
];

export const transactions: Transaction[] = [
  { id: "T001", memberId: "M001", memberName: "Aarav Sharma", amount: 40909, vat: 5318, total: 46227, method: "card", type: "Renewal", date: "2026-01-15", description: "Platinum 15-Year Renewal", receiptNo: "VFC-2026-001", status: "paid" },
  // Charging-first demo rows
];

export const expiryAlerts: ExpiryAlert[] = members
  .filter((m) => m.status === "Expiring")
  .map((m) => {
    const expiry = new Date(m.expiryDate);
    const now = new Date("2026-03-26");
    const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return { memberId: m.id, memberName: m.name, tier: m.tier, expiryDate: m.expiryDate, daysLeft, avatar: m.avatar };
  })
  .sort((a, b) => a.daysLeft - b.daysLeft);

export const dashboardStats = {
  totalMembers: members.length,
  activeMembers: members.filter((m) => m.status === "Active").length,
  monthlyRevenue: 285000,
  revenueChange: 12.5,
  activeBookings: bookings.filter((b) => b.status === "unpaid" || b.status === "pending").length,
  bookingsChange: 8.3,
  todayCheckins: 47,
  checkinsChange: -3.2,
};

export const revenueData = [
  { month: "Jan", revenue: 245000 }, { month: "Feb", revenue: 268000 }, { month: "Mar", revenue: 285000 },
  { month: "Apr", revenue: 310000 }, { month: "May", revenue: 295000 }, { month: "Jun", revenue: 320000 },
  { month: "Jul", revenue: 340000 }, { month: "Aug", revenue: 355000 }, { month: "Sep", revenue: 330000 },
  { month: "Oct", revenue: 310000 }, { month: "Nov", revenue: 290000 }, { month: "Dec", revenue: 380000 },
];

export const serviceBreakdown = [
  { name: "Membership", value: 45, fill: "hsl(38, 92%, 50%)" },
  { name: "Fitness", value: 25, fill: "hsl(280, 60%, 55%)" },
  { name: "Health", value: 15, fill: "hsl(15, 80%, 55%)" },
  { name: "Sports", value: 15, fill: "hsl(200, 80%, 50%)" },
  { name: "Wellness", value: 34, fill: "hsl(160, 60%, 50%)" },
  { name: "Events", value: 76, fill: "hsl(10, 60%, 50%)" },
];

export const tierColors: Record<MemberTier, string> = {
  Basic: "bg-muted text-muted-foreground",
  Silver: "bg-secondary text-secondary-foreground",
  Gold: "bg-primary/20 text-primary border border-primary/30",
  Platinum: "bg-success/20 text-success border border-success/30",
};

// export const serviceColors: Record<ServiceType, string> = {
//   Membership: "bg-primary/20 text-primary",
//   Spa: "bg-spa/20 text-spa",
//   Sauna: "bg-sauna/20 text-sauna",
//   Swimming: "bg-swimming/20 text-swimming",
// };

export const statusColors: Record<MemberStatus, string> = {
  Active: "bg-success/20 text-success",
  Expired: "bg-destructive/20 text-destructive",
  Expiring: "bg-warning/20 text-warning",
  Inactive: "bg-muted text-muted-foreground",
};

/** Colors for transaction status badges (incl. derived `overpaid`). */
export const transactionStatusColors: Record<string, string> = {
  paid: "bg-success/20 text-success",
  settled: "bg-success/20 text-success",
  pending: "bg-amber-500/20 text-amber-400",
  unpaid: "bg-amber-500/20 text-amber-400",
  voided: "bg-destructive/20 text-destructive",
  overpaid: "bg-amber-400/20 text-amber-300",
};

export function formatNPR(amount: number): string {
  return `NPR ${amount.toLocaleString("en-NP")}`;
}
