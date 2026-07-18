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

import { isSameDay } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { getSystemNowDate } from "@/lib/timeUtils";
import { splitVatFromGross, shouldBreakdownVat } from "@/lib/vat";


const SYSTEM_TZ = "Asia/Kathmandu";

const isSupabaseEnabled = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);

// Local in-memory store for tracking check-ins while in mock mode
const localMockCheckIns: CheckInRecord[] = [];

/** Safely converts either UI format (DD-MM-YYYY) or DB format (YYYY-MM-DD) to a standard JS Date object */
function parseUiDate(dateStr: unknown): Date | null {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return dateStr;
  if (typeof dateStr === "string" && /^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
    const [d, m, y] = dateStr.split("-");
    return new Date(`${y}-${m}-${d}T00:00:00`);
  }
  if (typeof dateStr === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return new Date(`${dateStr}T00:00:00`);
  }
  const parsed = new Date(dateStr as string);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/** Generates current date in UI format string (DD-MM-YYYY) */
function getTodayUiString(): string {
  const now = getSystemNowDate();
  const d = String(now.getDate()).padStart(2, "0");
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const y = now.getFullYear();
  return `${d}-${m}-${y}`;
}

// ─── Members ────────────────────────────────────────────────────────
export function useMembers(filters?: {
  tier?: MemberTier;
  status?: MemberStatus;
  service?: ServiceType;
  outletId?: string;
}) {
  return useQuery({
    queryKey: ["members", filters],
    queryFn: async () => {
      const list = !isSupabaseEnabled ? mockMembers : await fbServices.getMembers(filters);
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
      if (!isSupabaseEnabled) return mockMembers.find((m) => m.id === id) || null;
      return fbServices.getMember(id);
    },
    enabled: !!id,
  });
}

// ─── Shared Mock Helper for Booking Normalization ───────────────────
function normalizeBookingFields(existing: any, incoming: any) {
  const systemNow = getSystemNowDate();
  const targetDateStr = incoming.date || incoming.booking_date || existing.date || existing.booking_date;
  const bookingDate = parseUiDate(targetDateStr) || systemNow;
  const isToday = isSameDay(bookingDate, systemNow);
  const targetStatus = isToday ? "Pending" : incoming.status || existing.status || "Confirmed";

  return {
    ...existing,
    ...incoming,
    date: targetDateStr,
    bookingDate: targetDateStr,
    booking_date: targetDateStr,
    startTime: incoming.startTime || incoming.start_time || existing.startTime,
    start_time: incoming.start_time || incoming.startTime || existing.start_time,
    endTime: incoming.endTime || incoming.end_time || existing.endTime,
    end_time: incoming.end_time || incoming.endTime || existing.end_time,
    status: targetStatus,
    bookingStatus: targetStatus,
  };
}

// ─── Fixed Member Mutations ─────────────────────────────────────────
export function useAddMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Member>) => {
      if (!isSupabaseEnabled) {
        const newMember = {
          id: `M-$${Date.now()}`,
          name: data.name || "Unnamed Member",
          status: data.status || "Active",
          tier: data.tier || "Standard",
          ...data,
        } as Member;
        mockMembers.push(newMember);
        toast.success(`Member "${newMember.name}" registered (mock mode)`);
        return newMember.id;
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
      if (!isSupabaseEnabled) {
        const m = mockMembers.find((x) => x.id === id);
        if (m) {
          Object.assign(m, data);
          toast.success("Member details updated (mock mode)");
        }
        return;
      }
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
      if (!isSupabaseEnabled) {
        const idx = mockMembers.findIndex((x) => x.id === id);
        if (idx !== -1) {
          mockMembers.splice(idx, 1);
          toast.success("Member removed (mock mode)");
        }
        return;
      }
      return fbServices.deleteMember(id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["members"] });
    },
  });
}

// ─── Bookings ───────────────────────────────────────────────────────
export function useBookings(filters?: { service?: ServiceType; outletId?: string; date?: string }) {
  return useQuery({
    queryKey: ["bookings", filters],
    queryFn: async () => {
      // Fetch the initial listing from mock data or database services
      const list = !isSupabaseEnabled ? mockBookings : await fbServices.getBookings(filters);
      let filteredList = list;

      // 1. Filter by outletId if provided
      if (filters?.outletId) {
        filteredList = filteredList.filter(
          (b: any) => !b.outletId || b.outletId === filters.outletId
        );
      }

      // 2. Filter by date if provided to guarantee identical day evaluation
      if (filters?.date) {
        filteredList = filteredList.filter(
          (b: any) => String(b.date).trim() === String(filters.date).trim()
        );
      }

      return filteredList;
    },
  });
}

export function useAddBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Booking>) => {
      if (!isSupabaseEnabled) {
        const newBooking = {
          id: `B-${Date.now()}`,
          memberId: data.memberId || "",
          memberName: data.memberName || "",
          service: data.service || "Membership",
          className: data.className || "",
          date: data.date || getTodayUiString(),
          startTime: data.startTime || "",
          endTime: data.endTime || "",
          status: data.status || "Pending",
          instructor: data.instructor || "",
          bookingStatus: data.bookingStatus || "Confirmed",
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

// ─── Fixed Booking Mutation (Maintains Field Parity) ──────────────────
export function useUpdateBooking() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Record<string, any>> }) => {
      if (!isSupabaseEnabled) {
        const idx = mockBookings.findIndex((x) => x.id === id);
        if (idx !== -1) {
          // Normalize and commit updates directly onto mock array
          mockBookings[idx] = normalizeBookingFields(mockBookings[idx], data);
        }
        return;
      }
      return fbServices.updateBooking(id, data);
    },
    onMutate: async ({ id, data }) => {
      await qc.cancelQueries({ queryKey: ["bookings"] });
      const previous = qc.getQueryData<any[]>(["bookings"]);

      if (previous) {
        qc.setQueryData<any[]>(
          ["bookings"],
          previous.map((b) => (b.id === id ? normalizeBookingFields(b, data) : b)),
        );
      }
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) {
        qc.setQueryData(["bookings"], ctx.previous);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["bookings"] });
    },
  });
}

export function useDeleteBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!isSupabaseEnabled) {
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
      const list = !isSupabaseEnabled ? mockTransactions : await fbServices.getTransactions();
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
      if (!isSupabaseEnabled) {
        const newTx = {
          id: `T-${Date.now()}`,
          receiptNo: data.receiptNo || `${INVOICE_PREFIX}-${Date.now()}`,
          memberId: data.memberId || "",
          memberName: data.memberName || "",
          amount: data.amount || 0,
          vat: data.vat ?? (shouldBreakdownVat(data.type as any) ? splitVatFromGross(Number(data.amount || 0)).vat : 0),
          total: data.total || data.amount || 0,
          method: data.method || "cash",
          type: data.type || "Charge",
          date: data.date || getTodayUiString(),
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
      qc.invalidateQueries({ queryKey: ["charges"] });
      qc.invalidateQueries({ queryKey: ["member-ledger"] });
      qc.invalidateQueries({ queryKey: ["member-financials"] });
    },
  });
}

export function useUpdateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Transaction> }) => {
      if (!isSupabaseEnabled) {
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
      qc.invalidateQueries({ queryKey: ["charges"] });
      qc.invalidateQueries({ queryKey: ["member-ledger"] });
      qc.invalidateQueries({ queryKey: ["member-financials"] });
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
      if (!isSupabaseEnabled) return localMockCheckIns; // Return local store instead of []
      return fbServices.getCheckIns();
    },
  });
}

export function useAddCheckIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { memberId: string; memberName: string; date: string }) => {
      if (!isSupabaseEnabled) {
        const now = getSystemNowDate();
        const newRecord: CheckInRecord = {
          id: `mock-ci-${now.getTime()}`,
          memberId: data.memberId,
          memberName: data.memberName,
          date: data.date,
          checkInTime: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
        };
        localMockCheckIns.unshift(newRecord); // Persist to local array
        toast.success("Check-in recorded (mock mode)");
        return newRecord.id;
      }
      return fbServices.addCheckInRecord(data);
    },
    onMutate: async (data) => {
      await qc.cancelQueries({ queryKey: ["checkIns"] });
      const previous = qc.getQueryData<CheckInRecord[]>(["checkIns"]) || [];
      const now = getSystemNowDate();
      const optimistic: CheckInRecord = {
        id: `optimistic-${now.getTime()}`,
        memberId: data.memberId,
        memberName: data.memberName,
        date: data.date,
        checkInTime: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
      };
      qc.setQueryData<CheckInRecord[]>(["checkIns"], [optimistic, ...previous]);
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(["checkIns"], ctx.previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["checkIns"] });
      qc.invalidateQueries({ queryKey: ["dashboardStats"] });
    },
  });
}

// ─── Fixed Service Types Hook ───────────────────────────────────────
export function useServiceTypes() {
  return useQuery({
    queryKey: ["serviceTypes"],
    queryFn: async () => {
      // Prevent dynamic bundle-loading or network failure crashes in mock mode
      if (!isSupabaseEnabled) return [];

      const { getServiceTypes } = await import("@/lib/supabase-outlets");
      return getServiceTypes();
    },
  });
}

// ─── Services ───────────────────────────────────────────────────────
export function useServices() {
  return useQuery({
    queryKey: ["services"],
    queryFn: async () => {
      if (!isSupabaseEnabled) return [];
      return fbServices.getServices();
    },
  });
}

export function useAddService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<fbServices.FirestoreService>) => {
      if (!isSupabaseEnabled) {
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
      if (!isSupabaseEnabled) {
        toast.success("Service changes saved (mock mode)");
        return;
      }
      return fbServices.updateService(id, data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["services"] }),
  });
}

export function useDeleteService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!isSupabaseEnabled) {
        toast.success("Service deleted (mock mode)");
        return;
      }
      return fbServices.deleteService(id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["services"] }),
  });
}

// ─── Membership Plans ───────────────────────────────────────────────
export function useMembershipPlans() {
  return useQuery({
    queryKey: ["membershipPlans"],
    queryFn: async () => {
      if (!isSupabaseEnabled) return [];
      return fbServices.getMembershipPlans();
    },
  });
}

export function useAddMembershipPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<fbServices.FirestoreMembershipPlan>) => {
      if (!isSupabaseEnabled) {
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
      if (!isSupabaseEnabled) return;
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
      if (!isSupabaseEnabled) return;
      return fbServices.deleteMembershipPlan(id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["membershipPlans"] });
    },
  });
}

// ─── Plan Durations ─────────────────────────────────────────────────
export function usePlanDurations() {
  return useQuery({
    queryKey: ["planDurations"],
    queryFn: async () => {
      if (!isSupabaseEnabled) return [];
      return fbServices.getPlanDurations();
    },
  });
}

export function useAddPlanDuration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<fbServices.PlanDuration>) => {
      if (!isSupabaseEnabled) return "mock";
      return fbServices.addPlanDuration(data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["planDurations"] }),
  });
}

export function useUpdatePlanDuration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<fbServices.PlanDuration> }) => {
      if (!isSupabaseEnabled) return;
      return fbServices.updatePlanDuration(id, data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["planDurations"] }),
  });
}

export function useDeletePlanDuration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!isSupabaseEnabled) return;
      return fbServices.deletePlanDuration(id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["planDurations"] }),
  });
}

// ─── Company Settings ───────────────────────────────────────────────
export function useCompanySettings() {
  return useQuery({
    queryKey: ["companySettings"],
    queryFn: async () => {
      if (!isSupabaseEnabled) return {};
      return fbServices.getCompanySettings();
    },
  });
}

export function useSaveCompanySettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (settings: Record<string, any>) => {
      if (!isSupabaseEnabled) {
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
      if (!isSupabaseEnabled) return mockDashboardStats;
      return fbServices.getDashboardStats();
    },
  });
}

export function useExpiryAlerts() {
  return useQuery({
    queryKey: ["expiryAlerts"],
    queryFn: async () => {
      if (!isSupabaseEnabled) return mockExpiryAlerts;
      const members = await fbServices.getMembers({ status: "Expiring" as MemberStatus });
      const now = getSystemNowDate();
      return members
        .map((m) => {
          const parsed = parseUiDate(m.expiryDate) || now;
          const expiry = new Date(parsed);
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
      if (!isSupabaseEnabled) return [];
      return fbServices.getDiscountRules();
    },
  });
}

export function useSaveDiscountRules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rules: fbServices.DiscountRule[]) => {
      if (!isSupabaseEnabled) {
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
