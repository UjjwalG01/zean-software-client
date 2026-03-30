import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { isConfigured } from "@/lib/firebase";
import * as fbServices from "@/lib/firebase-services";
import {
  members as mockMembers,
  bookings as mockBookings,
  transactions as mockTransactions,
  dashboardStats as mockDashboardStats,
  expiryAlerts as mockExpiryAlerts,
  revenueData as mockRevenueData,
  serviceBreakdown as mockServiceBreakdown,
  type Member,
  type Booking,
  type Transaction,
  type MemberTier,
  type MemberStatus,
  type ServiceType,
} from "@/lib/mock-data";
import { toast } from "sonner";

const firebaseEnabled = isConfigured();

// ─── Members ────────────────────────────────────────────────────────
export function useMembers(filters?: { tier?: MemberTier; status?: MemberStatus; service?: ServiceType }) {
  return useQuery({
    queryKey: ["members", filters],
    queryFn: async () => {
      if (!firebaseEnabled) return mockMembers;
      return fbServices.getMembers(filters);
    },
  });
}

export function useMember(id: string | undefined) {
  return useQuery({
    queryKey: ["member", id],
    queryFn: async () => {
      if (!id) return null;
      if (!firebaseEnabled) return mockMembers.find((m) => m.id === id) || null;
      return fbServices.getMember(id);
    },
    enabled: !!id,
  });
}

export function useAddMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Member>) => {
      if (!firebaseEnabled) {
        toast.success(`Member "${data.name}" registered (mock mode)`);
        return "mock-id";
      }
      return fbServices.addMember(data);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["members"] }); },
  });
}

export function useUpdateMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Record<string, any>> }) => {
      if (!firebaseEnabled) return;
      return fbServices.updateMember(id, data);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["members"] }); },
  });
}

export function useDeleteMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!firebaseEnabled) return;
      return fbServices.deleteMember(id);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["members"] }); },
  });
}

// ─── Bookings ───────────────────────────────────────────────────────
export function useBookings(filters?: { service?: ServiceType }) {
  return useQuery({
    queryKey: ["bookings", filters],
    queryFn: async () => {
      if (!firebaseEnabled) return mockBookings;
      return fbServices.getBookings(filters);
    },
  });
}

export function useAddBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Booking>) => {
      if (!firebaseEnabled) {
        toast.success("Booking created (mock mode)");
        return "mock-id";
      }
      return fbServices.addBooking(data);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bookings"] }); },
  });
}

export function useUpdateBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Record<string, any>> }) => {
      if (!firebaseEnabled) return;
      return fbServices.updateBooking(id, data);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bookings"] }); },
  });
}

export function useDeleteBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!firebaseEnabled) return;
      return fbServices.deleteBooking(id);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bookings"] }); },
  });
}

// ─── Transactions ───────────────────────────────────────────────────
export function useTransactions() {
  return useQuery({
    queryKey: ["transactions"],
    queryFn: async () => {
      if (!firebaseEnabled) return mockTransactions;
      return fbServices.getTransactions();
    },
  });
}

export function useAddTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Transaction>) => {
      if (!firebaseEnabled) {
        toast.success("Payment recorded (mock mode)");
        return "mock-id";
      }
      return fbServices.addTransaction(data);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["transactions"] }); },
  });
}

// ─── Check-ins / Attendance ─────────────────────────────────────────
export interface CheckInRecord {
  id: string;
  memberId: string;
  memberName: string;
  date: string;
  checkInTime: string;
  checkOutTime?: string;
}

export function useCheckIns() {
  return useQuery({
    queryKey: ["checkIns"],
    queryFn: async () => {
      if (!firebaseEnabled) return [];
      return fbServices.getCheckIns();
    },
  });
}

export function useAddCheckIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { memberId: string; memberName: string; date: string }) => {
      if (!firebaseEnabled) {
        toast.success("Check-in recorded (mock mode)");
        return "mock-id";
      }
      return fbServices.addCheckInRecord(data);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["checkIns"] }); qc.invalidateQueries({ queryKey: ["dashboardStats"] }); },
  });
}

// ─── Services ───────────────────────────────────────────────────────
export function useServices() {
  return useQuery({
    queryKey: ["services"],
    queryFn: async () => {
      if (!firebaseEnabled) return [];
      return fbServices.getServices();
    },
  });
}

export function useAddService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<fbServices.FirestoreService>) => {
      if (!firebaseEnabled) { toast.success("Service created (mock mode)"); return "mock-id"; }
      return fbServices.addService(data);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["services"] }); },
  });
}

export function useUpdateService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Record<string, any>> }) => {
      if (!firebaseEnabled) return;
      return fbServices.updateService(id, data);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["services"] }); },
  });
}

export function useDeleteService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!firebaseEnabled) return;
      return fbServices.deleteService(id);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["services"] }); },
  });
}

// ─── Membership Plans ───────────────────────────────────────────────
export function useMembershipPlans() {
  return useQuery({
    queryKey: ["membershipPlans"],
    queryFn: async () => {
      if (!firebaseEnabled) return [];
      return fbServices.getMembershipPlans();
    },
  });
}

export function useAddMembershipPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<fbServices.FirestoreMembershipPlan>) => {
      if (!firebaseEnabled) { toast.success("Plan created (mock mode)"); return "mock-id"; }
      return fbServices.addMembershipPlan(data);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["membershipPlans"] }); },
  });
}

export function useUpdateMembershipPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Record<string, any>> }) => {
      if (!firebaseEnabled) return;
      return fbServices.updateMembershipPlan(id, data);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["membershipPlans"] }); },
  });
}

export function useDeleteMembershipPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!firebaseEnabled) return;
      return fbServices.deleteMembershipPlan(id);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["membershipPlans"] }); },
  });
}

// ─── Company Settings ───────────────────────────────────────────────
export function useCompanySettings() {
  return useQuery({
    queryKey: ["companySettings"],
    queryFn: async () => {
      if (!firebaseEnabled) return {};
      return fbServices.getCompanySettings();
    },
  });
}

export function useSaveCompanySettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (settings: Record<string, string>) => {
      if (!firebaseEnabled) { toast.success("Settings saved (mock mode)"); return; }
      return fbServices.saveCompanySettings(settings);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["companySettings"] }); },
  });
}

// ─── Dashboard ──────────────────────────────────────────────────────
export function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboardStats"],
    queryFn: async () => {
      if (!firebaseEnabled) return mockDashboardStats;
      return fbServices.getDashboardStats();
    },
  });
}

export function useExpiryAlerts() {
  return useQuery({
    queryKey: ["expiryAlerts"],
    queryFn: async () => {
      if (!firebaseEnabled) return mockExpiryAlerts;
      const members = await fbServices.getMembers({ status: "Expiring" as MemberStatus });
      const now = new Date();
      return members
        .map((m) => {
          const expiry = new Date(m.expiryDate);
          const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          return { memberId: m.id, memberName: m.name, tier: m.tier, expiryDate: m.expiryDate, daysLeft, avatar: m.avatar };
        })
        .sort((a, b) => a.daysLeft - b.daysLeft);
    },
  });
}

// ─── Discount Rules ─────────────────────────────────────────────────
export function useDiscountRules() {
  return useQuery({
    queryKey: ["discountRules"],
    queryFn: async () => {
      if (!firebaseEnabled) return [];
      return fbServices.getDiscountRules();
    },
  });
}

export function useSaveDiscountRules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rules: fbServices.DiscountRule[]) => {
      if (!firebaseEnabled) { toast.success("Discount rules saved (mock mode)"); return; }
      return fbServices.saveDiscountRules(rules);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["discountRules"] }); },
  });
}

// Re-export mock data that doesn't come from Firebase
export { mockRevenueData as revenueData, mockServiceBreakdown as serviceBreakdown };
