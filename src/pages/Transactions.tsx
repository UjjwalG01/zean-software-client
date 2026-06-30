import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Search,
  Plus,
  Download,
  Receipt,
  FileText,
  Printer,
  RotateCcw,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { TransactionDetailModal } from "@/components/TransactionDetailModal";
import { RecordChargeModal } from "@/components/RecordChargeModal";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  formatNPR,
  type PaymentMethod,
  type Transaction,
} from "@/lib/mock-data";
import {
  useTransactions,
  useAddTransaction,
  useUpdateTransaction,
  useUpdateBooking,
  useMembers,
  useCompanySettings,
} from "@/hooks/use-firestore";
import { useQueryClient } from "@tanstack/react-query";
import {
  generateA5BillHTML,
  printHTML,
  exportTableToCSV,
} from "@/lib/print-utils";
import { applyAdvance, settleOldestCharges } from "@/lib/charges";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  capitalizeFirstLetter,
  underlineFirstChar,
  underlineSpecificChars,
} from "@/lib/string-case-change";
import { methodColors } from "@/lib/utils";

import { INVOICE_PREFIX } from "@/lib/settings";
import { logAudit } from "@/lib/audit-log";

import { useOutlet } from "@/contexts/OutletContext";
import { toIsoDayInTz } from "@/lib/tz";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { formatInTimeZone } from "date-fns-tz";
import {
  getSystemTodayStr,
  getSystemTimestamp,
  getSystemNowDate,
} from "@/lib/timeUtils";

const SYSTEM_TZ = "Asia/Katmandu";

function parseSetup(
  settings: Record<string, string>,
  key: string,
  fallback: string[],
): string[] {
  try {
    return settings[key] ? JSON.parse(settings[key]) : fallback;
  } catch {
    return fallback;
  }
}

/** Charges that have been paid count as "settled"; pending charges remain due. */
function statusLabel(t: Transaction): "Voided" | "Settled" | "Pending" {
  if ((t as any).voided || t.status === "voided") return "Voided";
  if (t.type === "Charge")
    return t.status === "paid" || t.status === "settled"
      ? "Settled"
      : "Pending";
  return t.status === "pending" ? "Pending" : "Settled";
}

const Transactions = () => {
  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [chargeOpen, setChargeOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [advMember, setAdvMember] = useState("");
  const [advAmount, setAdvAmount] = useState("");
  const [advMethod, setAdvMethod] = useState<PaymentMethod>("cash");
  const [advNote, setAdvNote] = useState("");
  const [advDiscount, setAdvDiscount] = useState("");

  const [settleTxn, setSettleTxn] = useState<Transaction | null>(null);
  const [settleMethod, setSettleMethod] = useState<PaymentMethod>("cash");
  const [settleNote, setSettleNote] = useState("");
  const [settleDiscount, setSettleDiscount] = useState<string>("");
  const [isSettlement, setIsSettlement] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const todayStr = getSystemTodayStr();
  const [dateFrom, setDateFrom] = useState(todayStr);
  const [dateTo, setDateTo] = useState(todayStr);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;

  const { selected: activeOutlet } = useOutlet();
  const { data: transactions = [], isLoading } = useTransactions({
    outletId: activeOutlet?.id,
  });
  const { data: members = [] } = useMembers({ outletId: activeOutlet?.id });
  const { data: settings = {} } = useCompanySettings();
  const addTransactionMutation = useAddTransaction();
  const updateTransactionMutation = useUpdateTransaction();
  const updateBookingMutation = useUpdateBooking();
  const qc = useQueryClient();

  // Confirmation state
  const [pendingSettle, setPendingSettle] = useState(false);

  const paymentModes = parseSetup(settings, "setup_paymentModes", [
    "cash",
    "card",
    "esewa",
    "bank_transfer",
    "mobile_wallet",
    "cheque",
    "other",
  ]);
  const paymentTypes = parseSetup(settings, "setup_paymentTypes", [
    "Payment",
    "Charge",
    "Advance",
    "Renewal",
    "Registration",
    "Refund",
  ]);

  const filtered = useMemo(() => {
    const list = transactions.filter((t) => {
      const matchSearch =
        t.memberName.toLowerCase().includes(search.toLowerCase()) ||
        t.receiptNo.toLowerCase().includes(search.toLowerCase()) ||
        (t.description || "").toLowerCase().includes(search.toLowerCase());
      const matchMethod = methodFilter === "all" || t.method === methodFilter;
      const matchType = typeFilter === "all" || t.type === typeFilter;
      const matchStatus =
        statusFilter === "all" || statusLabel(t).toLowerCase() === statusFilter;
      const d = t.date || "";
      const matchFrom = !dateFrom || d >= dateFrom;
      const matchTo = !dateTo || d <= dateTo;
      return (
        matchSearch &&
        matchMethod &&
        matchType &&
        matchStatus &&
        matchFrom &&
        matchTo
      );
    });
    return [...list].sort((a: any, b: any) => {
      const av = a.createdAt || a.created_at || a.date || "";
      const bv = b.createdAt || b.created_at || b.date || "";
      return String(bv).localeCompare(String(av));
    });
  }, [
    transactions,
    search,
    methodFilter,
    typeFilter,
    statusFilter,
    dateFrom,
    dateTo,
  ]);

  const activeForTotals = filtered.filter((t) => statusLabel(t) !== "Voided");
  // Net amount actually received from guest = total − discount applied.
  const totalAmount = activeForTotals.reduce(
    (sum, t) =>
      sum + Math.max(0, (t.total || 0) - (Number((t as any).discount) || 0)),
    0,
  );
  const totalVat = activeForTotals.reduce((sum, t) => sum + t.vat, 0);

  const memberFinancials = useMemo(() => {
    if (!advMember)
      return { grossCharges: 0, availableAdvance: 0, netPayable: 0 };

    // 1. Sum up all unpaid charges
    const grossCharges = transactions
      .filter(
        (t) =>
          t.memberId === advMember &&
          t.type === "Charge" &&
          statusLabel(t) === "Pending",
      )
      .reduce((sum, t) => sum + (t.total || 0), 0);

    // 2. Sum up any unutilized advance deposits or credits
    const availableAdvance = transactions
      .filter(
        (t) =>
          t.memberId === advMember &&
          t.type === "Advance" &&
          (t.status === "pending" || t.status === "unpaid" || !t.status),
      )
      .reduce((sum, t) => sum + (t.total || t.amount || 0), 0);

    // 3. Compute net amount the member actually owes right now
    const netPayable = Math.max(0, grossCharges - availableAdvance);

    return { grossCharges, availableAdvance, netPayable };
  }, [advMember, transactions]);

  // Calculate the final checkout figure after entering an optional discount
  const finalBatchNetPayable = Math.max(
    0,
    memberFinancials.netPayable - (Number(advDiscount) || 0),
  );

  // Local pagination
  useEffect(() => {
    setPage(1);
  }, [search, methodFilter, typeFilter, statusFilter, dateFrom, dateTo]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pagedFiltered = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const printBill = (
    memberName: string,
    receiptNo: string,
    desc: string,
    gross: number,
    date: Date,
    extras?: {
      memberId?: string;
      discount?: number;
      head?: string;
      excludeTxnId?: string;
    },
  ) => {
    const companyName = settings.companyName || ".............";
    const net = Math.round((gross / 1.13) * 100) / 100;
    const vat = Math.round((gross - net) * 100) / 100;
    // Sum of prior pending charges for the member (excluding the one being settled).
    const previousBalance = extras?.memberId
      ? transactions
          .filter(
            (t) =>
              t.memberId === extras.memberId &&
              t.type === "Charge" &&
              t.status === "pending" &&
              t.id !== extras.excludeTxnId,
          )
          .reduce((s, t) => s + (t.total || 0), 0)
      : 0;
    const html = generateA5BillHTML({
      companyName,
      companyAddress: settings.companyAddress || "",
      companyPhone: settings.companyPhone || "",
      companyEmail: settings.companyEmail || "",
      vatNo: settings.vatNo || settings.panNumber || "",
      guestName: memberName,
      billNo: receiptNo,
      billDate: format(date, "dd/MM/yyyy"),
      billForMonth: format(date, "MMMM yyyy"),
      items: [
        {
          description: desc || "Payment",
          quantity: 1,
          rate: gross,
          amount: gross,
          head: extras?.head || "Services",
        },
      ],
      subtotal: net,
      taxableAmount: net,
      vatAmount: vat,
      grandTotal: gross,
      previousBalance,
      discount: extras?.discount || 0,
      paidAmount: gross,
      attendant: "user",
      paymentMethod: settleMethod,
      paperSize: (settings.bill_paperSize as "A4" | "A5" | "80mm") || "A5",
      kind: "payment",
    });
    printHTML(html);
  };

  // ─── Add Advance ──────────────────────────────────────────────────
  const handleAddAdvance = async () => {
    if (!advMember || !advAmount) {
      toast.error("Please select member and enter amount");
      return;
    }
    const memberObj = members.find((m) => m.id === advMember);
    const amount = Number(advAmount);
    if (amount <= 0) {
      toast.error("Amount must be greater than zero");
      return;
    }
    try {
      await applyAdvance(
        (d) => addTransactionMutation.mutateAsync(d) as Promise<string>,
        {
          memberId: advMember,
          memberName: memberObj?.name || "",
          amount,
          method: advMethod,
          note: advNote,
          outletId: activeOutlet?.id,
        },
      );
      // Auto-settle oldest pending charges from the (just-paid) advance.
      const leftover = await settleOldestCharges(
        (a) => updateTransactionMutation.mutateAsync(a),
        transactions,
        advMember,
        amount,
      );
      // ⚡ AUDIT LOG INSERTION
      await logAudit({
        module: "transactions",
        entityType: "transaction",
        action: "advance_create",
        entityId: advMember, // Groups under the target member's profile
        outletId: activeOutlet?.id || null, // Captures active branch context
        newValue: {
          memberId: advMember,
          memberName: memberObj?.name || "",
          advanceAmount: amount,
          paymentMethod: advMethod,
          note: advNote || null,
          remainingCredit: leftover,
        },
      });
      toast.success(
        leftover > 0
          ? `Advance recorded — ${formatNPR(amount - leftover)} applied, ${formatNPR(leftover)} credit remaining`
          : `Advance of ${formatNPR(amount)} applied to pending charges`,
      );
      // Print Advance Receipt
      try {
        const companyName = settings.companyName || ".............";
        const advHtml = generateA5BillHTML({
          companyName,
          companyAddress: settings.companyAddress || "",
          companyPhone: settings.companyPhone || "",
          companyEmail: settings.companyEmail || "",
          guestName: memberObj?.name || "",
          billNo: `ADV-${Date.now().toString().slice(-8)}`,
          billDate: format(getSystemNowDate(), "dd/MM/yyyy"),
          billForMonth: format(getSystemNowDate(), "MMMM yyyy"),
          items: [],
          subtotal: amount,
          taxableAmount: amount,
          vatAmount: 0,
          grandTotal: amount,
          paidAmount: amount,
          paymentMethod: advMethod,
          paperSize: (settings.bill_paperSize as "A4" | "A5" | "80mm") || "A5",
          kind: "advance",
        });
        printHTML(advHtml);
      } catch {
        /* non-blocking */
      }
      setAdvanceOpen(false);
      setAdvDiscount("");
      setAdvMember("");
      setAdvAmount("");
      setAdvNote("");
      setAdvMethod("cash");
    } catch {
      toast.error("Failed to record advance");
    }
  };

  // ─── Settle / Resettle ────────────────────────────────────────────
  const openSettle = (t: Transaction, settlement = false) => {
    setSettleMethod("cash");
    setSettleNote("");
    setSettleDiscount("");
    setIsSettlement(settlement);
    setSettleTxn(t);
  };

  // Auto-open the settlement dialog when redirected from a booking.
  useEffect(() => {
    if (searchParams.get("newPayment") !== "true") return;
    // Wait until transactions have loaded before deciding.
    if (isLoading) return;

    // const { outlets } = useOutlet();
    // console.log(outlets);
    const chargeId = searchParams.get("chargeId");
    const bookingId = searchParams.get("bookingId");
    const memberId = searchParams.get("memberId");
    let charge: Transaction | undefined;
    if (chargeId) {
      charge = transactions.find((t) => t.id === chargeId);
    }
    if (!charge && bookingId) {
      charge = transactions.find(
        (t) =>
          t.bookingId === bookingId &&
          t.type === "Charge" &&
          t.status === "pending",
      );
    }
    if (!charge && memberId) {
      // Fallback: settle the oldest pending charge for the member.
      charge = transactions.find(
        (t) =>
          t.memberId === memberId &&
          t.type === "Charge" &&
          t.status === "pending",
      );
    }
    const isGuestFlow = searchParams.get("guest") === "1";
    if (!charge && (memberId || isGuestFlow)) {
      // Dynamic fallback: construct a temporary charge transaction so the modal can open.
      // Guest bookings (FIT walk-ins) have no memberId — we still want the settlement
      // modal to open with the guest name + amount + default Cash/0 discount prefilled.
      const amountStr = searchParams.get("amount");
      const serviceStr = searchParams.get("service") || "Service";
      const classNameStr = searchParams.get("className") || "";
      const memberNameStr = searchParams.get("memberName") || "";
      if (amountStr) {
        charge = {
          id: `TEMP-${Date.now()}`,
          memberId: memberId || "",
          memberName: memberNameStr,
          amount: Number(amountStr),
          vat:
            Math.round((Number(amountStr) - Number(amountStr) / 1.13) * 100) /
            100,
          total: Number(amountStr),
          method: "cash",
          type: "Charge",
          date: getSystemTodayStr(),
          description: `${serviceStr} — ${classNameStr}`,
          receiptNo: `${INVOICE_PREFIX}-${Date.now()}`,
          status: "pending",
          bookingId: bookingId || undefined,
          outletId: searchParams.get("outletId") || undefined,
          isGuest: isGuestFlow || undefined,
          guestName: isGuestFlow
            ? memberNameStr.replace(/^Guest\s*·\s*/i, "")
            : undefined,
        } as any;
      }
    }
    if (charge) {
      openSettle(charge, true);
    } else {
      toast.error("No pending charge found to settle");
    }
    // Clear params so it doesn't re-trigger on refresh / state change.
    const next = new URLSearchParams(searchParams);
    [
      "newPayment",
      "memberName",
      "memberId",
      "service",
      "className",
      "bookingId",
      "chargeId",
      "amount",
      "locked",
      "outletId",
      "guest",
    ].forEach((k) => next.delete(k));
    setSearchParams(next, { replace: true });
  }, [transactions, isLoading, searchParams, setSearchParams]);

  const handleSettle = async () => {
    if (!settleTxn) return;
    const discount = Math.max(0, Number(settleDiscount) || 0);
    const netDue = Math.max(0, (settleTxn.total || 0) - discount);

    try {
      if (settleTxn.id.startsWith("TEMP-")) {
        await addTransactionMutation.mutateAsync({
          memberId: settleTxn.memberId,
          memberName: settleTxn.memberName,
          amount: netDue,
          vat: settleTxn.vat,
          total: netDue,
          discount,
          method: settleMethod,
          type: settleTxn.serviceType || "Charge",
          date: getSystemTodayStr(),
          description: settleTxn.description,
          receiptNo: settleTxn.receiptNo,
          status: "paid",
          bookingId: settleTxn.bookingId,
          outletId: (settleTxn as any).outletId,
          isSettlement: true,
          isGuest: (settleTxn as any).isGuest || undefined,
          guestName: (settleTxn as any).guestName || undefined,
        } as any);
      } else {
        // 1) Flip canonical charges row to paid (source of truth for ledger)
        const chargeRowId = (settleTxn as any).chargeRowId as
          | string
          | undefined;
        if (chargeRowId) {
          try {
            const { supabase } = await import("@/lib/supabase");
            const nowTs = getSystemTodayStr();
            await supabase
              .from("charges")
              .update({
                status: "paid",
                paid_at: nowTs,
                updated_at: nowTs,
                discount,
                method: settleMethod,
                outlet_id: settleTxn.outletId || null,
              })
              .eq("id", chargeRowId);
          } catch (err) {
            console.warn(
              "[transactions] failed to mark canonical charge paid",
              err,
            );
          }
        }
        // 2) Mirror onto the legacy transaction row
        await updateTransactionMutation.mutateAsync({
          id: settleTxn.id,
          data: {
            status: "paid",
            method: settleMethod,
            date: getSystemTodayStr(),
            discount,
          } as any,
        });
      }

      // 3) If linked to a booking, mark it Completed
      if (settleTxn.bookingId) {
        try {
          await updateBookingMutation.mutateAsync({
            id: settleTxn.bookingId,
            data: {
              status: "Completed",
              settledAt: getSystemTimestamp(),
              paymentMethod: settleMethod,
            } as any,
          });
        } catch (err) {
          console.warn("[transactions] failed to update booking status", err);
        }
      }

      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["charges"] });
      qc.invalidateQueries({ queryKey: ["member-ledger"] });

      // ⚡ AUDIT LOG INSERTION
      await logAudit({
        module: "transactions",
        entityType: "transaction",
        action: settleTxn.id.startsWith("TEMP-")
          ? "settlement_create"
          : "settle",
        entityId: settleTxn.id,
        outletId: activeOutlet?.id || settleTxn.outletId || null,
        newValue: {
          memberId: settleTxn.memberId,
          memberName: settleTxn.memberName,
          amountPaid: netDue,
          discountApplied: discount,
          paymentMethod: settleMethod,
          note: settleNote || null,
          bookingId: settleTxn.bookingId || null,
        },
      });

      toast.success(
        discount > 0
          ? `Settled with ${formatNPR(discount)} discount`
          : settleTxn.bookingId
            ? "Payment settled — booking marked completed"
            : "Payment settled",
      );
      printBill(
        settleTxn.memberName,
        settleTxn.receiptNo,
        settleTxn.description,
        netDue,
        getSystemNowDate(),
        {
          memberId: settleTxn.memberId,
          discount,
          head: (settleTxn as any).serviceType || settleTxn.type || "Services",
          excludeTxnId: settleTxn.id,
        },
      );

      setSettleTxn(null);
      setSettleMethod("cash");
      setSettleNote("");
      setSettleDiscount("");
      setIsSettlement(false);
    } catch (e) {
      toast.error("Failed to settle payment");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display">Transactions</h1>
          <p className="text-muted-foreground text-sm">
            {filtered.length} transactions • Total: {formatNPR(totalAmount)}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            accessKey="x"
            onClick={() => {
              const headers = [
                "Receipt #",
                "Date",
                "Member",
                "Method",
                "Type",
                "Status",
                "VAT",
                "Total",
              ];
              const rows = filtered.map((t) => [
                t.receiptNo,
                t.date,
                t.memberName,
                t.method,
                t.type,
                statusLabel(t),
                String(t.vat),
                String(t.total),
              ]);
              exportTableToCSV(
                headers,
                rows,
                `transactions-${format(getSystemNowDate(), "yyyyMMdd")}.csv`,
                {
                  propertyName: settings.companyName || ".............",
                  reportTitle: "Transactions Report",
                  dateRange: format(getSystemNowDate(), "PPP"),
                  filters: {
                    Search: search || "—",
                    Method: methodFilter === "all" ? "All" : methodFilter,
                    Type: typeFilter === "all" ? "All" : typeFilter,
                    Status: statusFilter === "all" ? "All" : statusFilter,
                    "Total Records": String(filtered.length),
                    "Total Amount (NPR)": String(totalAmount),
                    "Total VAT (NPR)": String(totalVat),
                  },
                },
              );
              toast.success(`Exported ${filtered.length} transactions to CSV`);
            }}
          >
            <Download className="h-4 w-4 mr-1" />
            {underlineSpecificChars("Export", [1])}
          </Button>
          <Button
            variant="outline"
            size="sm"
            accessKey="r"
            onClick={() => setChargeOpen(true)}
          >
            <FileText className="h-4 w-4 mr-1" />
            {underlineFirstChar("Record Charge")}
          </Button>

          <Dialog
            open={advanceOpen}
            onOpenChange={(o) => {
              setAdvanceOpen(o);
              if (!o) {
                setAdvDiscount(""); // Reset discount when closed
              }
            }}
          >
            <DialogTrigger asChild>
              <Button accessKey="a" size="sm">
                <Plus className="h-4 w-4 mr-1" />
                {underlineFirstChar("Add Advance / Checkout")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="font-display">
                  Account Settlement & Advance
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Apply a payment to clear a member's accumulated balance. Any
                  leftover amount is safely saved as a profile credit indicator.
                </p>

                <div className="space-y-2">
                  <Label>Member *</Label>
                  <Select value={advMember} onValueChange={setAdvMember}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select member" />
                    </SelectTrigger>
                    <SelectContent>
                      {members.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 📊 ACCUMULATED LEDGER BREAKDOWN CARD */}
                {advMember && (
                  <div className="p-3 rounded-lg border border-border bg-muted/40 space-y-2 text-sm animate-fade-in">
                    <div className="flex justify-between items-center text-xs text-muted-foreground">
                      <span>Gross Outstanding Tab:</span>
                      <span className="font-mono font-medium">
                        {formatNPR(memberFinancials.grossCharges)}
                      </span>
                    </div>
                    {memberFinancials.availableAdvance > 0 && (
                      <div className="flex justify-between items-center text-xs text-success">
                        <span>Available Profile Credit:</span>
                        <span className="font-mono font-medium">
                          -{formatNPR(memberFinancials.availableAdvance)}
                        </span>
                      </div>
                    )}
                    <div className="pt-2 border-t border-border/60 flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="text-xs font-medium text-muted-foreground block">
                          Net Outstanding Balance:
                        </span>
                        <span className="font-mono font-bold text-base text-primary">
                          {formatNPR(memberFinancials.netPayable)}
                        </span>
                      </div>
                      {memberFinancials.netPayable > 0 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs bg-background hover:bg-primary hover:text-primary-foreground transition-all"
                          onClick={() =>
                            setAdvAmount(String(finalBatchNetPayable))
                          }
                        >
                          Use Net Total
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* 🏷️ BATCH DISCOUNT INPUT FIELD */}
                {advMember && memberFinancials.netPayable > 0 && (
                  <div className="grid grid-cols-2 gap-3 animate-fade-in">
                    <div className="space-y-2">
                      <Label>Apply Discount (NPR)</Label>
                      <Input
                        type="number"
                        min={0}
                        max={memberFinancials.netPayable}
                        placeholder="0"
                        value={advDiscount}
                        onChange={(e) => setAdvDiscount(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Final Net Payable</Label>
                      <Input
                        value={formatNPR(finalBatchNetPayable)}
                        readOnly
                        className="bg-muted/40 font-semibold text-success font-mono"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Payment Amount (NPR) *</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={advAmount}
                    onChange={(e) => setAdvAmount(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <Select
                    value={advMethod}
                    onValueChange={(v) => setAdvMethod(v as PaymentMethod)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentModes.map((m) => (
                        <SelectItem key={m} value={m}>
                          {capitalizeFirstLetter(m.replace(/_/g, " "))}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Note</Label>
                  <Textarea
                    rows={2}
                    value={advNote}
                    onChange={(e) => setAdvNote(e.target.value)}
                    placeholder="Optional checkout context"
                  />
                </div>

                <Button
                  onClick={handleAddAdvance}
                  disabled={addTransactionMutation.isPending}
                  className="w-full gradient-gold text-primary-foreground"
                >
                  <Receipt className="h-4 w-4 mr-1" />
                  {addTransactionMutation.isPending
                    ? "Processing Settlement..."
                    : Number(advAmount) === finalBatchNetPayable &&
                        finalBatchNetPayable > 0
                      ? "Clear Total Account & Checkout"
                      : "Record Payment"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <TransactionDetailModal
        transaction={selectedTransaction}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
      <RecordChargeModal open={chargeOpen} onOpenChange={setChargeOpen} />

      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 justify-center min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            accessKey="/"
            placeholder="Click Alt + / to search..."
            className="pl-9 justify-center bg-muted/50 border-0"
            value={search}
            autoFocus
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={methodFilter} onValueChange={setMethodFilter}>
          <SelectTrigger className="w-[140px] bg-muted/50 border-0">
            <SelectValue placeholder="Method" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Methods</SelectItem>
            {paymentModes.map((m) => (
              <SelectItem key={m} value={m}>
                {capitalizeFirstLetter(m)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[130px] bg-muted/50 border-0">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="settled">Settled</SelectItem>
            <SelectItem value="voided">Voided</SelectItem>
          </SelectContent>
        </Select>
        <DateRangeFilter
          from={dateFrom}
          to={dateTo}
          onChange={({ from, to }) => {
            setDateFrom(from);
            setDateTo(to);
          }}
        />
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-lg" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Receipt</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Member</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="w-32 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedFiltered.map((t) => {
                console.log(t);
                const sl = statusLabel(t);
                return (
                  <TableRow
                    key={t.id}
                    className="cursor-pointer"
                    onClick={() => {
                      setSelectedTransaction(t);
                      setDetailOpen(true);
                    }}
                  >
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {t.receiptNo}
                    </TableCell>
                    <TableCell className="text-sm">{t.date}</TableCell>
                    <TableCell className="text-sm font-medium">
                      {t.memberName}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={`text-[10px] border-0 ${t.status === "pending" || t.status === "voided" ? "bg-muted text-muted-foreground" : methodColors[t.method] || "bg-muted text-muted-foreground"}`}
                      >
                        {t.status === "pending" || t.status === "voided"
                          ? "None"
                          : t.method}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {t.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {sl === "Voided" ? (
                        <Badge className="text-[10px] border-0 bg-destructive/20 text-destructive">
                          Voided
                        </Badge>
                      ) : sl === "Pending" ? (
                        <Badge className="text-[10px] border-0 bg-amber-500/20 text-amber-400">
                          Pending
                        </Badge>
                      ) : (
                        <Badge className="text-[10px] border-0 bg-success/20 text-success">
                          Settled
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium text-sm">
                      {formatNPR(t.total)}
                    </TableCell>
                    <TableCell>
                      <div
                        className="flex items-center justify-end gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {sl === "Pending" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => openSettle(t)}
                          >
                            Settle
                          </Button>
                        ) : sl === "Settled" ? (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title="Print"
                              onClick={() =>
                                printBill(
                                  t.memberName,
                                  t.receiptNo,
                                  t.description,
                                  t.total,
                                  new Date(t.date),
                                  {
                                    memberId: t.memberId,
                                    discount: Number((t as any).discount) || 0,
                                    head:
                                      (t as any).serviceType ||
                                      t.type ||
                                      "Services",
                                    excludeTxnId: t.id,
                                  },
                                )
                              }
                            >
                              <Printer className="h-3.5 w-3.5" />
                            </Button>
                            {(() => {
                              const isSameDay =
                                toIsoDayInTz(t.date) === getSystemTodayStr();
                              return (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  title={
                                    isSameDay
                                      ? "Resettle"
                                      : "Resettlement only allowed on the same day"
                                  }
                                  disabled={!isSameDay}
                                  onClick={() => openSettle(t)}
                                >
                                  <RotateCcw className="h-3.5 w-3.5" />
                                </Button>
                              );
                            })()}
                          </>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setPage((p) => Math.max(1, p - 1));
                }}
              />
            </PaginationItem>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(
                (p) => Math.abs(p - page) < 3 || p === 1 || p === totalPages,
              )
              .map((p) => (
                <PaginationItem key={p}>
                  <PaginationLink
                    href="#"
                    isActive={p === page}
                    onClick={(e) => {
                      e.preventDefault();
                      setPage(p);
                    }}
                  >
                    {p}
                  </PaginationLink>
                </PaginationItem>
              ))}
            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setPage((p) => Math.min(totalPages, p + 1));
                }}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      {/* Settle / Resettle dialog */}
      <Dialog
        open={!!settleTxn}
        onOpenChange={(o) => {
          if (!o) {
            setSettleTxn(null);
            setIsSettlement(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">
              {isSettlement
                ? "Record Payment — Settlement"
                : settleTxn && statusLabel(settleTxn) === "Settled"
                  ? "Resettle Payment"
                  : "Settle Pending Payment"}
            </DialogTitle>
          </DialogHeader>
          {settleTxn && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs">Member</Label>
                <Input
                  value={settleTxn.memberName}
                  readOnly
                  className="bg-muted/40"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs">Type</Label>
                  <Input
                    value={isSettlement ? "Settlement" : "Payment"}
                    readOnly
                    className="bg-muted/40"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Amount (NPR)</Label>
                  <Input
                    value={settleTxn.total}
                    readOnly
                    className="bg-muted/40 font-semibold text-primary"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Description</Label>
                <Input
                  value={settleTxn.description}
                  readOnly
                  className="bg-muted/40"
                />
              </div>
              <div className="space-y-2">
                <Label>Payment Method *</Label>
                <Select
                  value={settleMethod}
                  onValueChange={(v) => setSettleMethod(v as PaymentMethod)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentModes.map((m) => (
                      <SelectItem key={m} value={m}>
                        {capitalizeFirstLetter(m.replace(/_/g, " "))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Discount (NPR)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={settleTxn.total}
                    value={settleDiscount}
                    onChange={(e) => setSettleDiscount(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Net Payable</Label>
                  <Input
                    value={formatNPR(
                      Math.max(
                        0,
                        (settleTxn.total || 0) - (Number(settleDiscount) || 0),
                      ),
                    )}
                    readOnly
                    className="bg-muted/40 font-semibold text-success"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  rows={2}
                  value={settleNote}
                  onChange={(e) => setSettleNote(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <Button
                onClick={() => setPendingSettle(true)}
                disabled={updateTransactionMutation.isPending}
                className="w-full gradient-gold text-primary-foreground"
              >
                <Receipt className="h-4 w-4 mr-1" />
                {updateTransactionMutation.isPending
                  ? "Saving..."
                  : "Settle & Print Bill"}
              </Button>
              <AlertDialog open={pendingSettle} onOpenChange={setPendingSettle}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirm settlement</AlertDialogTitle>
                    <AlertDialogDescription>
                      Settle{" "}
                      {formatNPR(
                        Math.max(
                          0,
                          (settleTxn.total || 0) -
                            (Number(settleDiscount) || 0),
                        ),
                      )}{" "}
                      for <b>{settleTxn.memberName}</b> via{" "}
                      <b>{settleMethod}</b>? This action will mark the charge as
                      paid and print a bill.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={async () => {
                        setPendingSettle(false);
                        await handleSettle();
                      }}
                    >
                      Confirm
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Transactions;
