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
  generateStandardReceiptHTML,
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
import { splitVatFromGross } from "@/lib/vat";

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

import {
  getSystemTodayStr,
  getSystemTimestamp,
  getSystemNowDate,
} from "@/lib/timeUtils";
import { useCurrentAppUser } from "@/hooks/use-app-users";

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

function statusLabel(t: Transaction): "Voided" | "Settled" | "Pending" {
  if ((t as any).voided || t.status === "voided") return "Voided";
  if (t.type === "Charge")
    return t.status === "paid" || t.status === "settled"
      ? "Settled"
      : "Pending";
  return t.status === "pending" ? "Pending" : "Settled";
}

const Transactions = () => {
  // 🌟 Optimization 1: Separate immediate text state from filtered state
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [methodFilter, setMethodFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [outletFilter, setOutletFilter] = useState<string>("all");

  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [chargeOpen, setChargeOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [settleTxn, setSettleTxn] = useState<Transaction | null>(null);
  const [isSettlement, setIsSettlement] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const todayStr = getSystemTodayStr();
  const [dateFrom, setDateFrom] = useState(todayStr);
  const [dateTo, setDateTo] = useState(todayStr);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;

  const { selected: activeOutlet, outlets: availableOutlets } = useOutlet();

  // Default outlet filter to the user's active outlet (local scope only —
  // never mutates the global OutletContext used by Bookings/Attendance).
  useEffect(() => {
    if (activeOutlet?.id && outletFilter === "all") {
      setOutletFilter(activeOutlet.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOutlet?.id]);

  const { data: transactions = [], isLoading } = useTransactions({
    outletId: outletFilter === "all" ? undefined : outletFilter,
  });
  const { data: members = [] } = useMembers({ outletId: activeOutlet?.id });
  const { data: settings = {} } = useCompanySettings();
  const addTransactionMutation = useAddTransaction();
  const updateTransactionMutation = useUpdateTransaction();
  const updateBookingMutation = useUpdateBooking();
  const { data: user } = useCurrentAppUser();
  const qc = useQueryClient();

  // Debounce global search input to prevent filtering lists on every keypress
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 250);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const paymentModes = parseSetup(settings, "setup_paymentModes", [
    "cash",
    "card",
    "esewa",
    "bank_transfer",
    "fonepay",
    "cheque",
    "credit",
    "other",
  ]);

  const filtered = useMemo(() => {
    console.log(transactions);
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
  const totalAmount = activeForTotals.reduce(
    (sum, t) =>
      sum + Math.max(0, (t.total || 0) - (Number((t as any).discount) || 0)),
    0,
  );

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
      paymentMethod?: string; // 🌟 Pass method down dynamically
    },
  ) => {
    const companyName = settings.companyName || ".............";
    const { net, vat } = splitVatFromGross(gross);

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

    const html = generateStandardReceiptHTML({
      companyName,
      companyAddress: settings.companyAddress || "",
      companyPhone: settings.companyPhone || "",
      companyEmail: settings.companyEmail || "",
      companyLogoUrl: (settings as any).extras?.logoUrl || (settings as any).logo_url || (settings as any).companyLogoUrl,
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
      paymentMethod: extras?.paymentMethod || "cash",
      paperSize: (settings.bill_paperSize as "A4" | "A5" | "80mm") || "A5",
      kind: "payment",
    });
    printHTML(html);
  };

  const openSettle = (t: Transaction, settlement = false) => {
    setIsSettlement(settlement);
    setSettleTxn(t);
  };

  // Auto-open logic on redirection
  useEffect(() => {
    if (searchParams.get("newPayment") !== "true" || isLoading) return;

    const chargeId = searchParams.get("chargeId");
    const bookingId = searchParams.get("bookingId");
    const memberId = searchParams.get("memberId");
    let charge = chargeId
      ? transactions.find((t) => t.id === chargeId)
      : undefined;

    if (!charge && bookingId) {
      charge = transactions.find(
        (t) =>
          t.bookingId === bookingId &&
          t.type === "Charge" &&
          t.status === "pending",
      );
    }
    if (!charge && memberId) {
      charge = transactions.find(
        (t) =>
          t.memberId === memberId &&
          t.type === "Charge" &&
          t.status === "pending",
      );
    }

    const isGuestFlow = searchParams.get("guest") === "1";
    if (!charge && (memberId || isGuestFlow)) {
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
          vat: splitVatFromGross(Number(amountStr)).vat,
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
          createdBy: user?.id,
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
            className="hidden md:flex"
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
                    "Total Records": String(filtered.length),
                    "Total Amount": String(totalAmount),
                  },
                },
              );
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

          <Dialog open={advanceOpen} onOpenChange={setAdvanceOpen}>
            <DialogTrigger asChild>
              <Button accessKey="a" size="sm">
                <Plus className="h-4 w-4 mr-1" />
                {underlineFirstChar("Add Receipt")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="font-display">
                  Account Settlement & Receipt
                </DialogTitle>
              </DialogHeader>
              {/* 🌟 Optimization 2: Isolated contents prevent parent lag */}
              <AdvanceModalBody
                members={members}
                transactions={transactions}
                paymentModes={paymentModes}
                addTransactionMutation={addTransactionMutation}
                updateTransactionMutation={updateTransactionMutation}
                activeOutlet={activeOutlet}
                settings={settings}
                onClose={() => setAdvanceOpen(false)}
              />
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
            placeholder="Search transactions here..."
            className="pl-9 justify-center bg-muted/50 border-0"
            value={searchInput}
            autoFocus
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        {/* Basic Filters */}
        <Select value={methodFilter} onValueChange={setMethodFilter}>
          <SelectTrigger className="w-[140px] bg-muted/50 border-0 hidden md:flex">
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
          <SelectTrigger className="w-[130px] bg-muted/50 border-0 hidden md:flex">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="settled">Settled</SelectItem>
            <SelectItem value="voided">Voided</SelectItem>
          </SelectContent>
        </Select>
        {availableOutlets.length > 1 && (
          <Select value={outletFilter} onValueChange={setOutletFilter}>
            <SelectTrigger className="w-[160px] bg-muted/50 border-0 hidden md:flex">
              <SelectValue placeholder="Outlet" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Outlets</SelectItem>
              {availableOutlets.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <DateRangeFilter
          from={dateFrom}
          to={dateTo}
          onChange={({ from, to }) => {
            setDateFrom(from);
            setDateTo(to);
          }}
        />
      </div>

      {/* Main Table View Container */}
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
                <TableHead className="hidden md:table-cell">Receipt</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Member</TableHead>
                <TableHead>Method</TableHead>
                <TableHead className="hidden md:table-cell">Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="w-32 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedFiltered.map((t) => {
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
                    <TableCell className="font-mono text-xs text-muted-foreground hidden md:table-cell">
                      {t.receiptNo}
                    </TableCell>
                    <TableCell className="text-sm">{t.date}</TableCell>
                    <TableCell className="text-sm font-medium">
                      {t.memberName ? (
                        t.memberName
                      ) : (
                        <span className="text-muted-foreground">FIT Guest</span>
                      )}
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
                    <TableCell className="hidden md:table-cell">
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
                      {t.status === "voided" ? 0 : formatNPR(t.total)}
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
                                    paymentMethod: t.method,
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
                                      : "Resettlement only allowed on same day"
                                  }
                                  disabled={!isSameDay}
                                  onClick={() => openSettle(t)}
                                >
                                  <RotateCcw className="h-3.5 w-3.5" />
                                </Button>
                              );
                            })()}
                          </>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs "
                            // disabled
                            onClick={() => {
                              toast.error(
                                "Can't revoke this transaction right now.",
                              );
                            }}
                          >
                            Revoke
                          </Button>
                        )}
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
            /* 🌟 Optimization 3: Moving inner state hooks to dedicated component scopes stops keystroke frame freeze */
            <SettleModalBody
              settleTxn={settleTxn}
              isSettlement={isSettlement}
              paymentModes={paymentModes}
              updateTransactionMutation={updateTransactionMutation}
              addTransactionMutation={addTransactionMutation}
              updateBookingMutation={updateBookingMutation}
              qc={qc}
              activeOutlet={activeOutlet}
              settings={settings}
              printBill={printBill}
              onClose={() => {
                setSettleTxn(null);
                setIsSettlement(false);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

/* ─── ISOLATED HIGH-FREQUENCY COMPONENT 1: ADVANCE PANEL ──────────────── */
function AdvanceModalBody({
  members,
  transactions,
  paymentModes,
  addTransactionMutation,
  updateTransactionMutation,
  activeOutlet,
  settings,
  onClose,
}: {
  members: any[];
  transactions: any[];
  paymentModes: string[];
  addTransactionMutation: any;
  updateTransactionMutation: any;
  activeOutlet: any;
  settings: any;
  onClose: () => void;
}) {
  const [advMember, setAdvMember] = useState("");
  const [advAmount, setAdvAmount] = useState("");
  const [advMethod, setAdvMethod] = useState<PaymentMethod>("cash");
  const [advNote, setAdvNote] = useState("");
  const [advDiscount, setAdvDiscount] = useState("");

  const memberFinancials = useMemo(() => {
    if (!advMember)
      return { grossCharges: 0, availableAdvance: 0, netPayable: 0 };
    const grossCharges = transactions
      .filter(
        (t) =>
          t.memberId === advMember &&
          t.type === "Charge" &&
          statusLabel(t) === "Pending",
      )
      .reduce((sum, t) => sum + (t.total || 0), 0);
    const availableAdvance = transactions
      .filter(
        (t) =>
          t.memberId === advMember &&
          t.type === "Advance" &&
          (t.status === "pending" || t.status === "unpaid" || !t.status),
      )
      .reduce((sum, t) => sum + (t.total || t.amount || 0), 0);
    return {
      grossCharges,
      availableAdvance,
      netPayable: Math.max(0, grossCharges - availableAdvance),
    };
  }, [advMember, transactions]);

  const finalBatchNetPayable = Math.max(
    0,
    memberFinancials.netPayable - (Number(advDiscount) || 0),
  );

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
      const leftover = await settleOldestCharges(
        (a) => updateTransactionMutation.mutateAsync(a),
        transactions,
        advMember,
        amount,
      );

      await logAudit({
        module: "transactions",
        entityType: "transaction",
        action: "advance_create",
        entityId: advMember,
        outletId: activeOutlet?.id || null,
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
          ? `Advance recorded — credit remaining`
          : `Advance applied successfully`,
      );
      onClose();
    } catch {
      toast.error("Failed to record advance");
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Apply a payment to clear profile dues indicators safely.
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

      {advMember && (
        <div className="p-3 rounded-lg border bg-muted/40 space-y-1.5 text-sm animate-fade-in">
          <div className="flex justify-between items-center text-xs text-muted-foreground">
            <span>Gross Outstanding Charges</span>
            <span className="font-mono">
              {formatNPR(memberFinancials.grossCharges)}
            </span>
          </div>
          <div className="flex justify-between items-center text-xs text-muted-foreground">
            <span>− Available Advance</span>
            <span className="font-mono text-primary">
              {formatNPR(memberFinancials.availableAdvance)}
            </span>
          </div>
          <div className="pt-2 border-t flex items-center justify-between gap-2">
            <span className="text-xs font-medium block text-muted-foreground">
              Total Net Payable
            </span>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-primary">
                {formatNPR(memberFinancials.netPayable)}
              </span>
              {memberFinancials.netPayable > 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-6 px-2 text-[10px]"
                  onClick={() =>
                    setAdvAmount(String(memberFinancials.netPayable))
                  }
                >
                  Use
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {advMember && memberFinancials.netPayable > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Apply Discount (NPR)</Label>
            <Input
              type="number"
              value={advDiscount}
              onChange={(e) => setAdvDiscount(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="space-y-2">
            <Label>Final Net Payable</Label>
            <Input
              value={formatNPR(finalBatchNetPayable)}
              readOnly
              className="bg-muted/40 font-semibold font-mono text-success"
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
          placeholder="Optional"
        />
      </div>

      <Button
        onClick={handleAddAdvance}
        disabled={addTransactionMutation.isPending}
        className="w-full gradient-gold text-primary-foreground"
      >
        <Receipt className="h-4 w-4 mr-1" />
        {addTransactionMutation.isPending ? "Processing..." : "Record Payment"}
      </Button>
    </div>
  );
}

/* ─── ISOLATED HIGH-FREQUENCY COMPONENT 2: SETTLEMENT PANEL ────────────── */
function SettleModalBody({
  settleTxn,
  isSettlement,
  paymentModes,
  updateTransactionMutation,
  addTransactionMutation,
  updateBookingMutation,
  qc,
  activeOutlet,
  settings,
  printBill,
  onClose,
}: {
  settleTxn: Transaction;
  isSettlement: boolean;
  paymentModes: string[];
  updateTransactionMutation: any;
  addTransactionMutation: any;
  updateBookingMutation: any;
  qc: any;
  activeOutlet: any;
  settings: any;
  printBill: any;
  onClose: () => void;
}) {
  const [settleMethod, setSettleMethod] = useState<PaymentMethod>("cash");
  const [settleNote, setSettleNote] = useState("");
  const [settleDiscount, setSettleDiscount] = useState<string>("");
  const [pendingSettle, setPendingSettle] = useState(false);

  useEffect(() => {
    if (settleTxn) {
      if (settleTxn?.method) {
        setSettleMethod(settleTxn.method as PaymentMethod);
      }

      // 🌟 Pull previous discount if available, otherwise default to empty string
      const previousDiscount = (settleTxn as any).discount;
      setSettleDiscount(
        previousDiscount !== undefined && previousDiscount !== null
          ? String(previousDiscount)
          : "",
      );
    }
  }, [settleTxn]);

  const isResettlement = settleTxn && statusLabel(settleTxn) === "Settled";
  const activeDiscount = isResettlement
    ? Number((settleTxn as any).discount) || 0
    : Number(settleDiscount) || 0;
  const netPayableValue = Math.max(0, (settleTxn.total || 0) - activeDiscount);

  const handleSettle = async () => {
    const discount = Math.max(0, Number(settleDiscount) || 0);
    const netDue = Math.max(0, (settleTxn.total || 0) - discount);

    // "Credit" / Pay Later — reserved for registered members only.
    const isCredit = settleMethod === ("credit" as PaymentMethod);
    const isGuestTxn = !settleTxn.memberId;
    if (isCredit && isGuestTxn) {
      toast.error(
        "Walk-in guests cannot pay on credit. Please select a registered member.",
      );
      return;
    }

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
          status: "completed",
          bookingId: settleTxn.bookingId,
          outletId: (settleTxn as any).outletId,
          isSettlement: true,
        } as any);
      } else {
        const chargeRowId = (settleTxn as any).chargeRowId;
        if (chargeRowId) {
          const { supabase } = await import("@/lib/supabase");
          const nowTs = getSystemTodayStr();
          await supabase
            .from("charges")
            .update({
              status: "paid",
              paid_at: nowTs,
              discount,
              method: settleMethod,
            })
            .eq("id", chargeRowId);
        }
        await updateTransactionMutation.mutateAsync({
          id: settleTxn.id,
          data: {
            status: "completed",
            method: settleMethod,
            date: getSystemTodayStr(),
            discount,
          } as any,
        });
      }

      if (settleTxn.bookingId) {
        await updateBookingMutation.mutateAsync({
          id: settleTxn.bookingId,
          data: {
            status: "completed",
            settledAt: getSystemTimestamp(),
            paymentMethod: settleMethod,
          } as any,
        });
      }

      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });

      await logAudit({
        module: "transactions",
        entityType: "transaction",
        action: "settle",
        entityId: settleTxn.id,
        outletId: activeOutlet?.id || null,
        newValue: {
          memberId: settleTxn.memberId,
          amountPaid: netDue,
          discountApplied: discount,
          paymentMethod: settleMethod,
        },
      });

      toast.success("Payment settled securely");

      // 🌟 FIX 2: Prevent automatic printing when resetting an already settled bill
      if (!isResettlement) {
        printBill(
          settleTxn.memberName,
          settleTxn.receiptNo,
          settleTxn.description,
          netDue,
          getSystemNowDate(),
          {
            memberId: settleTxn.memberId,
            discount,
            head: settleTxn.type,
            excludeTxnId: settleTxn.id,
            paymentMethod: settleMethod,
          },
        );
      }
      onClose();
    } catch {
      toast.error("Failed to process payment updates");
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-xs">Member</Label>
        <Input
          value={settleTxn.memberName}
          readOnly
          disabled
          className="bg-muted/40"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-xs">Type</Label>
          <Input
            value={isSettlement ? "Settlement" : "Payment"}
            readOnly
            disabled
            className="bg-muted/40"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Amount (NPR)</Label>
          <Input
            value={settleTxn.total}
            readOnly
            disabled
            className="bg-muted/40 font-semibold text-primary"
          />
        </div>
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
            maxLength={5}
            value={settleDiscount}
            onChange={(e) => setSettleDiscount(e.target.value)}
            className={
              isResettlement ? "bg-muted/50 cursor-auto text-primary" : ""
            }
          />
        </div>
        <div className="space-y-2">
          <Label>Net Payable</Label>
          <Input
            value={formatNPR(netPayableValue)}
            readOnly
            disabled={isResettlement}
            className="bg-muted/40 font-semibold font-mono text-success"
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
          : isResettlement
            ? "Confirm Resettlement"
            : "Settle & Print Bill"}
      </Button>

      <AlertDialog open={pendingSettle} onOpenChange={setPendingSettle}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm settlement</AlertDialogTitle>
            <AlertDialogDescription>
              Confirm settlement of <b>{formatNPR(netPayableValue)}</b> via{" "}
              <b>{settleMethod}</b>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSettle}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default Transactions;
