export type MemberTier = "Basic" | "Silver" | "Gold" | "Platinum";
export type ServiceType = "Gym" | "Spa" | "Sauna" | "Swimming";
export type MemberStatus = "Active" | "Expired" | "Expiring" | "Inactive";
export type PaymentMethod = "Cash" | "Card" | "Esewa" | "Bank Transfer" | "Mobile Wallet";
export type BookingStatus = "Confirmed" | "Pending" | "Cancelled" | "Completed";

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
  timeSlot?: string;
  packages?: string[];
  outletId?: string;
  grcNo?: string;
}

export interface Booking {
  id: string;
  memberId: string;
  memberName: string;
  service: ServiceType;
  className: string;
  date: string;
  startTime: string;
  endTime: string;
  status: BookingStatus;
  instructor: string;
}

export interface Transaction {
  id: string;
  memberId: string;
  memberName: string;
  amount: number;
  vat: number;
  total: number;
  method: PaymentMethod;
  type: "Payment" | "Advance" | "Renewal" | "Registration" | "Charge";
  date: string;
  description: string;
  receiptNo: string;
  serviceType?: ServiceType;
  status?: "paid" | "pending" | "unpaid" | "voided";
  bookingId?: string;
  chargeHead?: string;
  voided?: boolean;
  voidReason?: string;
  voidedAt?: string;
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
  { id: "M001", name: "Aarav Sharma", email: "aarav@email.com", phone: "+977-9841000001", avatar: avatarUrl("aarav"), tier: "Platinum", services: ["Gym", "Spa", "Sauna", "Swimming"], status: "Active", joinDate: "2020-01-15", expiryDate: "2035-01-15", plan: "15-Year", address: "Kathmandu, Nepal", emergencyContact: "+977-9841000010", preferences: ["Yoga", "Steam Bath"], openingBalance: 0, totalPaid: 450000, dueAmount: 0, membershipYears: 6, discount: 20, autoRenew: true },
  { id: "M002", name: "Priya Thapa", email: "priya@email.com", phone: "+977-9841000002", avatar: avatarUrl("priya"), tier: "Gold", services: ["Gym", "Spa"], status: "Active", joinDate: "2022-03-01", expiryDate: "2026-03-01", plan: "Yearly", address: "Lalitpur, Nepal", emergencyContact: "+977-9841000020", preferences: ["Pilates", "Hot Stone Massage"], openingBalance: 0, totalPaid: 96000, dueAmount: 0, membershipYears: 4, discount: 10, autoRenew: true },
  { id: "M003", name: "Bikash Gurung", email: "bikash@email.com", phone: "+977-9841000003", avatar: avatarUrl("bikash"), tier: "Silver", services: ["Gym", "Swimming"], status: "Expiring", joinDate: "2023-06-15", expiryDate: "2026-04-10", plan: "Yearly", address: "Pokhara, Nepal", emergencyContact: "+977-9841000030", preferences: ["Weight Training"], openingBalance: 5000, totalPaid: 36000, dueAmount: 5000, membershipYears: 3, discount: 5, autoRenew: false },
  { id: "M004", name: "Sita Rai", email: "sita@email.com", phone: "+977-9841000004", avatar: avatarUrl("sita"), tier: "Platinum", services: ["Gym", "Spa", "Sauna"], status: "Active", joinDate: "2019-11-01", expiryDate: "2034-11-01", plan: "15-Year", address: "Bhaktapur, Nepal", emergencyContact: "+977-9841000040", preferences: ["Zumba", "Aromatherapy"], openingBalance: 0, totalPaid: 500000, dueAmount: 0, membershipYears: 7, discount: 20, autoRenew: true },
  { id: "M005", name: "Ramesh Adhikari", email: "ramesh@email.com", phone: "+977-9841000005", avatar: avatarUrl("ramesh"), tier: "Basic", services: ["Gym"], status: "Active", joinDate: "2025-01-01", expiryDate: "2026-01-01", plan: "Yearly", address: "Kathmandu, Nepal", emergencyContact: "+977-9841000050", preferences: ["Cardio"], openingBalance: 0, totalPaid: 12000, dueAmount: 0, membershipYears: 1, discount: 0, autoRenew: false },
  { id: "M006", name: "Anita Basnet", email: "anita@email.com", phone: "+977-9841000006", avatar: avatarUrl("anita"), tier: "Gold", services: ["Gym", "Spa", "Swimming"], status: "Active", joinDate: "2021-07-20", expiryDate: "2026-07-20", plan: "Yearly", address: "Kathmandu, Nepal", emergencyContact: "+977-9841000060", preferences: ["Swimming Laps", "Deep Tissue Massage"], openingBalance: 0, totalPaid: 144000, dueAmount: 0, membershipYears: 5, discount: 15, autoRenew: true },
  { id: "M007", name: "Deepak Maharjan", email: "deepak@email.com", phone: "+977-9841000007", avatar: avatarUrl("deepak"), tier: "Silver", services: ["Gym", "Sauna"], status: "Expired", joinDate: "2023-02-01", expiryDate: "2025-02-01", plan: "Yearly", address: "Lalitpur, Nepal", emergencyContact: "+977-9841000070", preferences: ["CrossFit"], openingBalance: 2000, totalPaid: 24000, dueAmount: 8000, membershipYears: 2, discount: 5, autoRenew: false },
  { id: "M008", name: "Kabita Shrestha", email: "kabita@email.com", phone: "+977-9841000008", avatar: avatarUrl("kabita"), tier: "Gold", services: ["Spa", "Sauna"], status: "Active", joinDate: "2022-09-10", expiryDate: "2026-09-10", plan: "Yearly", address: "Kathmandu, Nepal", emergencyContact: "+977-9841000080", preferences: ["Facial", "Sauna Sessions"], openingBalance: 0, totalPaid: 72000, dueAmount: 0, membershipYears: 4, discount: 10, autoRenew: true },
  { id: "M009", name: "Sunil Tamang", email: "sunil@email.com", phone: "+977-9841000009", avatar: avatarUrl("sunil"), tier: "Basic", services: ["Gym"], status: "Expiring", joinDate: "2025-03-01", expiryDate: "2026-04-05", plan: "Monthly", address: "Bhaktapur, Nepal", emergencyContact: "+977-9841000090", preferences: ["Boxing"], openingBalance: 0, totalPaid: 3000, dueAmount: 3000, membershipYears: 1, discount: 0, autoRenew: false },
  { id: "M010", name: "Manju Karki", email: "manju@email.com", phone: "+977-9841000010", avatar: avatarUrl("manju"), tier: "Platinum", services: ["Gym", "Spa", "Sauna", "Swimming"], status: "Active", joinDate: "2018-05-01", expiryDate: "2033-05-01", plan: "15-Year", address: "Pokhara, Nepal", emergencyContact: "+977-9841000100", preferences: ["Yoga", "Meditation"], openingBalance: 0, totalPaid: 550000, dueAmount: 0, membershipYears: 8, discount: 20, autoRenew: true },
  { id: "M011", name: "Raju Poudel", email: "raju@email.com", phone: "+977-9841000011", avatar: avatarUrl("raju"), tier: "Silver", services: ["Gym", "Swimming"], status: "Active", joinDate: "2024-01-15", expiryDate: "2027-01-15", plan: "Yearly", address: "Kathmandu, Nepal", emergencyContact: "+977-9841000110", preferences: ["Strength Training"], openingBalance: 0, totalPaid: 40000, dueAmount: 0, membershipYears: 2, discount: 5, autoRenew: true },
  { id: "M012", name: "Sunita Lama", email: "sunita@email.com", phone: "+977-9841000012", avatar: avatarUrl("sunita"), tier: "Gold", services: ["Gym", "Spa"], status: "Active", joinDate: "2021-11-01", expiryDate: "2026-11-01", plan: "Yearly", address: "Lalitpur, Nepal", emergencyContact: "+977-9841000120", preferences: ["Aerobics"], openingBalance: 0, totalPaid: 100000, dueAmount: 0, membershipYears: 5, discount: 15, autoRenew: true },
  { id: "M013", name: "Gopal KC", email: "gopal@email.com", phone: "+977-9841000013", avatar: avatarUrl("gopal"), tier: "Basic", services: ["Swimming"], status: "Active", joinDate: "2025-02-01", expiryDate: "2026-02-01", plan: "Monthly", address: "Kathmandu, Nepal", emergencyContact: "+977-9841000130", preferences: ["Leisure Swimming"], openingBalance: 0, totalPaid: 5000, dueAmount: 2000, membershipYears: 1, discount: 0, autoRenew: false },
  { id: "M014", name: "Nisha Bhandari", email: "nisha@email.com", phone: "+977-9841000014", avatar: avatarUrl("nisha"), tier: "Platinum", services: ["Gym", "Spa", "Swimming"], status: "Active", joinDate: "2020-06-15", expiryDate: "2035-06-15", plan: "15-Year", address: "Bhaktapur, Nepal", emergencyContact: "+977-9841000140", preferences: ["HIIT", "Swedish Massage"], openingBalance: 0, totalPaid: 480000, dueAmount: 0, membershipYears: 6, discount: 20, autoRenew: true },
  { id: "M015", name: "Prakash Neupane", email: "prakash@email.com", phone: "+977-9841000015", avatar: avatarUrl("prakash"), tier: "Silver", services: ["Gym"], status: "Expired", joinDate: "2023-08-01", expiryDate: "2025-08-01", plan: "Yearly", address: "Kathmandu, Nepal", emergencyContact: "+977-9841000150", preferences: ["Functional Training"], openingBalance: 3000, totalPaid: 18000, dueAmount: 6000, membershipYears: 2, discount: 5, autoRenew: false },
  { id: "M016", name: "Sarita Dangol", email: "sarita@email.com", phone: "+977-9841000016", avatar: avatarUrl("sarita"), tier: "Gold", services: ["Gym", "Sauna", "Swimming"], status: "Active", joinDate: "2022-04-20", expiryDate: "2026-04-20", plan: "Yearly", address: "Lalitpur, Nepal", emergencyContact: "+977-9841000160", preferences: ["Water Aerobics"], openingBalance: 0, totalPaid: 88000, dueAmount: 0, membershipYears: 4, discount: 10, autoRenew: true },
  { id: "M017", name: "Kiran Magar", email: "kiran@email.com", phone: "+977-9841000017", avatar: avatarUrl("kiran"), tier: "Basic", services: ["Gym"], status: "Active", joinDate: "2025-03-15", expiryDate: "2026-03-15", plan: "Monthly", address: "Pokhara, Nepal", emergencyContact: "+977-9841000170", preferences: ["Treadmill"], openingBalance: 0, totalPaid: 3000, dueAmount: 0, membershipYears: 1, discount: 0, autoRenew: true },
  { id: "M018", name: "Laxmi Ghimire", email: "laxmi@email.com", phone: "+977-9841000018", avatar: avatarUrl("laxmi"), tier: "Silver", services: ["Spa", "Sauna"], status: "Expiring", joinDate: "2023-10-01", expiryDate: "2026-04-08", plan: "Yearly", address: "Kathmandu, Nepal", emergencyContact: "+977-9841000180", preferences: ["Relaxation"], openingBalance: 0, totalPaid: 32000, dueAmount: 4000, membershipYears: 3, discount: 5, autoRenew: false },
  { id: "M019", name: "Arjun Dahal", email: "arjun@email.com", phone: "+977-9841000019", avatar: avatarUrl("arjun"), tier: "Gold", services: ["Gym", "Spa", "Swimming"], status: "Active", joinDate: "2021-12-01", expiryDate: "2026-12-01", plan: "Yearly", address: "Kathmandu, Nepal", emergencyContact: "+977-9841000190", preferences: ["Personal Training"], openingBalance: 0, totalPaid: 130000, dueAmount: 0, membershipYears: 5, discount: 15, autoRenew: true },
  { id: "M020", name: "Puja Pandey", email: "puja@email.com", phone: "+977-9841000020", avatar: avatarUrl("puja"), tier: "Platinum", services: ["Gym", "Spa", "Sauna", "Swimming"], status: "Active", joinDate: "2019-03-01", expiryDate: "2034-03-01", plan: "15-Year", address: "Lalitpur, Nepal", emergencyContact: "+977-9841000200", preferences: ["Kickboxing", "Thai Massage"], openingBalance: 0, totalPaid: 520000, dueAmount: 0, membershipYears: 7, discount: 20, autoRenew: true },
  { id: "M021", name: "Binod Sapkota", email: "binod@email.com", phone: "+977-9841000021", avatar: avatarUrl("binod"), tier: "Basic", services: ["Gym"], status: "Expired", joinDate: "2024-06-01", expiryDate: "2025-06-01", plan: "Yearly", address: "Bhaktapur, Nepal", emergencyContact: "+977-9841000210", preferences: ["Free Weights"], openingBalance: 1000, totalPaid: 10000, dueAmount: 4000, membershipYears: 1, discount: 0, autoRenew: false },
  { id: "M022", name: "Gita Manandhar", email: "gita@email.com", phone: "+977-9841000022", avatar: avatarUrl("gita"), tier: "Gold", services: ["Gym", "Spa"], status: "Expiring", joinDate: "2022-01-15", expiryDate: "2026-04-12", plan: "Yearly", address: "Kathmandu, Nepal", emergencyContact: "+977-9841000220", preferences: ["Dance Fitness"], openingBalance: 0, totalPaid: 80000, dueAmount: 0, membershipYears: 4, discount: 10, autoRenew: false },
];

export const bookings: Booking[] = [
  { id: "B001", memberId: "M001", memberName: "Aarav Sharma", service: "Gym", className: "Morning Power Yoga", date: "2026-03-26", startTime: "06:00", endTime: "07:00", status: "Confirmed", instructor: "Trainer Ravi" },
  { id: "B002", memberId: "M002", memberName: "Priya Thapa", service: "Spa", className: "Deep Tissue Massage", date: "2026-03-26", startTime: "10:00", endTime: "11:00", status: "Confirmed", instructor: "Therapist Maya" },
  { id: "B003", memberId: "M003", memberName: "Bikash Gurung", service: "Swimming", className: "Lap Swimming", date: "2026-03-26", startTime: "07:00", endTime: "08:00", status: "Pending", instructor: "Coach Anil" },
  { id: "B004", memberId: "M004", memberName: "Sita Rai", service: "Sauna", className: "Sauna Session", date: "2026-03-26", startTime: "14:00", endTime: "15:00", status: "Confirmed", instructor: "Staff Binita" },
  { id: "B005", memberId: "M006", memberName: "Anita Basnet", service: "Gym", className: "HIIT Blast", date: "2026-03-27", startTime: "08:00", endTime: "09:00", status: "Confirmed", instructor: "Trainer Ravi" },
  { id: "B006", memberId: "M010", memberName: "Manju Karki", service: "Spa", className: "Aromatherapy", date: "2026-03-27", startTime: "11:00", endTime: "12:00", status: "Pending", instructor: "Therapist Sunita" },
  { id: "B007", memberId: "M014", memberName: "Nisha Bhandari", service: "Swimming", className: "Aqua Fitness", date: "2026-03-27", startTime: "09:00", endTime: "10:00", status: "Confirmed", instructor: "Coach Anil" },
  { id: "B008", memberId: "M019", memberName: "Arjun Dahal", service: "Gym", className: "Strength Training", date: "2026-03-28", startTime: "06:00", endTime: "07:30", status: "Confirmed", instructor: "Trainer Prakash" },
  { id: "B009", memberId: "M020", memberName: "Puja Pandey", service: "Sauna", className: "Infrared Sauna", date: "2026-03-28", startTime: "15:00", endTime: "16:00", status: "Confirmed", instructor: "Staff Binita" },
  { id: "B010", memberId: "M008", memberName: "Kabita Shrestha", service: "Spa", className: "Hot Stone Therapy", date: "2026-03-29", startTime: "10:00", endTime: "11:30", status: "Pending", instructor: "Therapist Maya" },
  { id: "B011", memberId: "M011", memberName: "Raju Poudel", service: "Gym", className: "CrossFit WOD", date: "2026-03-29", startTime: "07:00", endTime: "08:00", status: "Confirmed", instructor: "Trainer Ravi" },
  { id: "B012", memberId: "M016", memberName: "Sarita Dangol", service: "Swimming", className: "Water Aerobics", date: "2026-03-30", startTime: "08:00", endTime: "09:00", status: "Confirmed", instructor: "Coach Anil" },
];

export const transactions: Transaction[] = [
  { id: "T001", memberId: "M001", memberName: "Aarav Sharma", amount: 40909, vat: 5318, total: 46227, method: "Card", type: "Renewal", date: "2026-01-15", description: "Platinum 15-Year Renewal", receiptNo: "VFC-2026-001" },
  { id: "T002", memberId: "M002", memberName: "Priya Thapa", amount: 21739, vat: 2826, total: 24565, method: "Esewa", type: "Payment", date: "2026-03-01", description: "Gold Yearly Payment", receiptNo: "VFC-2026-002" },
  { id: "T003", memberId: "M005", memberName: "Ramesh Adhikari", amount: 2609, vat: 339, total: 2948, method: "Cash", type: "Registration", date: "2026-01-01", description: "Basic Monthly Registration", receiptNo: "VFC-2026-003" },
  { id: "T004", memberId: "M009", memberName: "Sunil Tamang", amount: 2609, vat: 339, total: 2948, method: "Mobile Wallet", type: "Payment", date: "2026-03-01", description: "Basic Monthly Payment", receiptNo: "VFC-2026-004" },
  { id: "T005", memberId: "M003", memberName: "Bikash Gurung", amount: 10000, vat: 1300, total: 11300, method: "Bank Transfer", type: "Advance", date: "2026-02-15", description: "Advance Payment", receiptNo: "VFC-2026-005" },
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
  activeBookings: bookings.filter((b) => b.status === "Confirmed" || b.status === "Pending").length,
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
  { name: "Gym", value: 45, fill: "hsl(38, 92%, 50%)" },
  { name: "Spa", value: 25, fill: "hsl(280, 60%, 55%)" },
  { name: "Sauna", value: 15, fill: "hsl(15, 80%, 55%)" },
  { name: "Swimming", value: 15, fill: "hsl(200, 80%, 50%)" },
];

export const tierColors: Record<MemberTier, string> = {
  Basic: "bg-muted text-muted-foreground",
  Silver: "bg-secondary text-secondary-foreground",
  Gold: "bg-primary/20 text-primary border border-primary/30",
  Platinum: "bg-success/20 text-success border border-success/30",
};

export const serviceColors: Record<ServiceType, string> = {
  Gym: "bg-primary/20 text-primary",
  Spa: "bg-spa/20 text-spa",
  Sauna: "bg-sauna/20 text-sauna",
  Swimming: "bg-swimming/20 text-swimming",
};

export const statusColors: Record<MemberStatus, string> = {
  Active: "bg-success/20 text-success",
  Expired: "bg-destructive/20 text-destructive",
  Expiring: "bg-warning/20 text-warning",
  Inactive: "bg-muted text-muted-foreground",
};

export function formatNPR(amount: number): string {
  return `NPR ${amount.toLocaleString("en-NP")}`;
}
