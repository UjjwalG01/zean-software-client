import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as fbServices from "@/lib/supabase-services";
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
import { INVOICE_PREFIX } from "@/lib/settings";
import { toIsoDayInTz } from "@/lib/tz";

const firebaseEnabled = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);

// ─── Members ────────────────────────────────────────────────────────
export function useMembers(filters?: { tier?: MemberTier; status?: MemberStatus; service?: ServiceType; outletId?: string }) {
  return useQuery({
    queryKey: ["members", filters],
    queryFn: async () => {
      const list = !firebaseEnabled ? mockMembers : await fbServices.getMembers(filters);
      if (filters?.outletId) {
        return list.filter((m) => !m.outletId || m.outletId === filters.outletId);
      }
      return list;
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["members"] });
    },
  });
}

export function useUpdateMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Record<string, any>> }) => {
      if (!firebaseEnabled) return;
      return fbServices.updateMember(id, data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["members"] });
    },
  });
}

export function useDeleteMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!firebaseEnabled) return;
      return fbServices.deleteMember(id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["members"] });
    },
  });
}

// ─── Bookings ───────────────────────────────────────────────────────
export function useBookings(filters?: { service?: ServiceType; outletId?: string }) {
  return useQuery({
    queryKey: ["bookings", filters],
    queryFn: async () => {
      const list = !firebaseEnabled ? mockBookings : await fbServices.getBookings(filters);
      if (filters?.outletId) {
        return list.filter((b: any) => !b.outletId || b.outletId === filters.outletId);
      }
      return list;
    },
  });
}

export function useAddBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Booking>) => {
      if (!firebaseEnabled) {
        const newBooking = {
          id: `B-${Date.now()}`,
          memberId: data.memberId || "",
          memberName: data.memberName || "",
          service: data.service || "Gym",
          className: data.className || "",
          date: data.date || "",
          startTime: data.startTime || "",
          endTime: data.endTime || "",
          status: data.status || "Pending",
          instructor: data.instructor || "",
        } as Booking;
        mockBookings.push(newBooking);
        toast.success("Booking created (mock mode)");
        return newBooking.id;
      }
      return fbServices.addBooking(data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookings"] });
    },
  });
}

export function useUpdateBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Record<string, any>> }) => {
      if (!firebaseEnabled) {
        const b = mockBookings.find((x) => x.id === id);
        if (b) {
          Object.assign(b, data);
        }
        return;
      }
      return fbServices.updateBooking(id, data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookings"] });
    },
  });
}

export function useDeleteBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!firebaseEnabled) {
        const idx = mockBookings.findIndex((x) => x.id === id);
        if (idx !== -1) mockBookings.splice(idx, 1);
        return;
      }
      return fbServices.deleteBooking(id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookings"] });
    },
  });
}

// ─── Transactions ───────────────────────────────────────────────────
export function useTransactions(filters?: { outletId?: string }) {
  return useQuery({
    queryKey: ["transactions", filters],
    queryFn: async () => {
      const list = !firebaseEnabled ? mockTransactions : await fbServices.getTransactions();
      if (filters?.outletId) {
        return list.filter((t: any) => !t.outletId || t.outletId === filters.outletId);
      }
      return list;
    },
  });
}

export function useAddTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Transaction>) => {
      if (!firebaseEnabled) {
        const newTx = {
          id: `T-${Date.now()}`,
          receiptNo: data.receiptNo || `${INVOICE_PREFIX}-${Date.now()}`,
          memberId: data.memberId || "",
          memberName: data.memberName || "",
          amount: data.amount || 0,
          vat: data.vat || Math.round((Number(data.amount || 0) - Number(data.amount || 0) / 1.13) * 100) / 100,
          total: data.total || data.amount || 0,
          method: data.method || "cash",
          type: data.type || "Charge",
          date: data.date || toIsoDayInTz(new Date()),
          description: data.description || "",
          status: data.status || "pending",
          bookingId: data.bookingId,
          chargeHead: data.chargeHead,
          chargeRowId: data.chargeRowId,
        } as Transaction;
        mockTransactions.push(newTx);
        toast.success("Payment recorded (mock mode)");
        return newTx.id;
      }
      return fbServices.addTransaction(data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}

export function useUpdateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Transaction> }) => {
      if (!firebaseEnabled) {
        const tx = mockTransactions.find((t) => t.id === id);
        if (tx) {
          Object.assign(tx, data);
          toast.success("Transaction updated (mock mode)");
        }
        return;
      }
      return fbServices.updateTransaction(id, data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
    },
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["checkIns"] });
      qc.invalidateQueries({ queryKey: ["dashboardStats"] });
    },
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
      if (!firebaseEnabled) {
        toast.success("Service created (mock mode)");
        return "mock-id";
      }
      return fbServices.addService(data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["services"] });
    },
  });
}

export function useUpdateService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Record<string, any>> }) => {
      if (!firebaseEnabled) return;
      return fbServices.updateService(id, data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["services"] });
    },
  });
}

export function useDeleteService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!firebaseEnabled) return;
      return fbServices.deleteService(id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["services"] });
    },
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
      if (!firebaseEnabled) {
        toast.success("Plan created (mock mode)");
        return "mock-id";
      }
      return fbServices.addMembershipPlan(data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["membershipPlans"] });
    },
  });
}

export function useUpdateMembershipPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Record<string, any>> }) => {
      if (!firebaseEnabled) return;
      return fbServices.updateMembershipPlan(id, data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["membershipPlans"] });
    },
  });
}

export function useDeleteMembershipPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!firebaseEnabled) return;
      return fbServices.deleteMembershipPlan(id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["membershipPlans"] });
    },
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
      if (!firebaseEnabled) {
        toast.success("Settings saved (mock mode)");
        return;
      }
      return fbServices.saveCompanySettings(settings);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["companySettings"] });
    },
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
          return {
            memberId: m.id,
            memberName: m.name,
            tier: m.tier,
            expiryDate: m.expiryDate,
            daysLeft,
            avatar: m.avatar,
          };
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
      if (!firebaseEnabled) {
        toast.success("Discount rules saved (mock mode)");
        return;
      }
      return fbServices.saveDiscountRules(rules);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["discountRules"] });
    },
  });
}

// Re-export mock data that doesn't come from Firebase
export { mockRevenueData as revenueData, mockServiceBreakdown as serviceBreakdown };
