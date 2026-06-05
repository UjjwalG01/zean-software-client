import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Plus, Download, Receipt, FileText, Printer, RotateCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { TransactionDetailModal } from "@/components/TransactionDetailModal";
import { RecordChargeModal } from "@/components/RecordChargeModal";
import { formatNPR, type PaymentMethod, type Transaction } from "@/lib/mock-data";
import {
  useTransactions,
  useAddTransaction,
  useUpdateTransaction,
  useMembers,
  useCompanySettings,
} from "@/hooks/use-firestore";
import { generateA5BillHTML, printHTML, exportTableToCSV } from "@/lib/print-utils";
import { applyAdvance, settleOldestCharges } from "@/lib/charges";
import { toast } from "sonner";
import { format } from "date-fns";

const methodColors: Record<PaymentMethod, string> = {
  Cash: "bg-success/20 text-success",
  Card: "bg-primary/20 text-primary",
  Esewa: "bg-emerald-500/20 text-emerald-400",
  "Bank Transfer": "bg-muted text-muted-foreground",
  "Mobile Wallet": "bg-purple-500/20 text-purple-400",
};

function parseSetup(settings: Record<string, string>, key: string, fallback: string[]): string[] {
  try {
    return settings[key] ? JSON.parse(settings[key]) : fallback;
  } catch {
    return fallback;
  }
}

/** Charges that have been paid count as "settled"; pending charges remain due. */
function statusLabel(t: Transaction): "Voided" | "Settled" | "Pending" {
  if ((t as any).voided || t.status === "voided") return "Voided";
  if (t.type === "Charge") return t.status === "paid" || t.status === "settled" ? "Settled" : "Pending";
  return t.status === "pending" ? "Pending" : "Settled";
}

const Transactions = () => {
  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [chargeOpen, setChargeOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [advMember, setAdvMember] = useState("");
  const [advAmount, setAdvAmount] = useState("");
  const [advMethod, setAdvMethod] = useState<PaymentMethod>("Cash");
  const [advNote, setAdvNote] = useState("");

  const [settleTxn, setSettleTxn] = useState<Transaction | null>(null);
  const [settleMethod, setSettleMethod] = useState<PaymentMethod>("Cash");
  const [settleNote, setSettleNote] = useState("");
  const [isSettlement, setIsSettlement] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const { data: transactions = [], isLoading } = useTransactions();
  const { data: members = [] } = useMembers();
  const { data: settings = {} } = useCompanySettings();
  const addTransactionMutation = useAddTransaction();
  const updateTransactionMutation = useUpdateTransaction();

  const paymentModes = parseSetup(settings, "setup_paymentModes", [
    "Cash",
    "Card",
    "Esewa",
    "Bank Transfer",
    "Mobile Wallet",
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
    return transactions.filter((t) => {
      const matchSearch =
        t.memberName.toLowerCase().includes(search.toLowerCase()) ||
        t.receiptNo.toLowerCase().includes(search.toLowerCase()) ||
        (t.description || "").toLowerCase().includes(search.toLowerCase());
      const matchMethod = methodFilter === "all" || t.method === methodFilter;
      const matchType = typeFilter === "all" || t.type === typeFilter;
      const matchStatus = statusFilter === "all" || statusLabel(t).toLowerCase() === statusFilter;
      return matchSearch && matchMethod && matchType && matchStatus;
    });
  }, [transactions, search, methodFilter, typeFilter, statusFilter]);

  const activeForTotals = filtered.filter((t) => statusLabel(t) !== "Voided");
  const totalAmount = activeForTotals.reduce((sum, t) => sum + t.total, 0);
  const totalVat = activeForTotals.reduce((sum, t) => sum + t.vat, 0);

  const printBill = (memberName: string, receiptNo: string, desc: string, gross: number, date: Date) => {
    const companyName = settings.companyName || "VitaFit Club";
    const net = Math.round((gross / 1.13) * 100) / 100;
    const vat = Math.round((gross - net) * 100) / 100;
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
      items: [{ description: desc || "Payment", quantity: 1, rate: gross, amount: gross }],
      subtotal: net,
      taxableAmount: net,
      vatAmount: vat,
      grandTotal: gross,
      attendant: "admin",
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
      await applyAdvance((d) => addTransactionMutation.mutateAsync(d) as Promise<string>, {
        memberId: advMember,
        memberName: memberObj?.name || "",
        amount,
        method: advMethod,
        note: advNote,
      });
      // Auto-settle oldest pending charges from the (just-paid) advance.
      const leftover = await settleOldestCharges(
        (a) => updateTransactionMutation.mutateAsync(a),
        transactions,
        advMember,
        amount,
      );
      toast.success(
        leftover > 0
          ? `Advance recorded — ${formatNPR(amount - leftover)} applied, ${formatNPR(leftover)} credit remaining`
          : `Advance of ${formatNPR(amount)} applied to pending charges`,
      );
      setAdvanceOpen(false);
      setAdvMember("");
      setAdvAmount("");
      setAdvNote("");
      setAdvMethod("Cash");
    } catch {
      toast.error("Failed to record advance");
    }
  };

  // ─── Settle / Resettle ────────────────────────────────────────────
  const openSettle = (t: Transaction, settlement = false) => {
    setSettleMethod("Cash");
    setSettleNote("");
    setIsSettlement(settlement);
    setSettleTxn(t);
  };

  // Auto-open the settlement dialog when redirected from a booking.
  // useEffect(() => {
  //   if (searchParams.get("newPayment") !== "true") return;
  //   // Wait until transactions have loaded before deciding.
  //   if (isLoading) return;
  //   const chargeId = searchParams.get("chargeId");
  //   const bookingId = searchParams.get("bookingId");
  //   const memberId = searchParams.get("memberId");
  //   let charge: Transaction | undefined;
  //   if (chargeId) {
  //     charge = transactions.find((t) => t.id === chargeId);
  //   }
  //   if (!charge && bookingId) {
  //     charge = transactions.find(
  //       (t) => t.bookingId === bookingId && t.type === "Charge" && t.status === "pending",
  //     );
  //   }
  //   if (!charge && memberId) {
  //     // Fallback: settle the oldest pending charge for the member.
  //     charge = transactions.find(
  //       (t) => t.memberId === memberId && t.type === "Charge" && t.status === "pending",
  //     );
  //   }
  //   if (charge) {
  //     openSettle(charge, true);
  //   } else {
  //     toast.error("No pending charge found to settle");
  //   }
  //   // Clear params so it doesn't re-trigger on refresh / state change.
  //   const next = new URLSearchParams(searchParams);
  //   ["newPayment", "memberName", "memberId", "service", "className", "bookingId", "chargeId", "amount", "locked"].forEach((k) => next.delete(k));
  //   setSearchParams(next, { replace: true });
  // }, [transactions, isLoading, searchParams, setSearchParams]);

  // Auto-open the settlement dialog when redirected from a booking.
  useEffect(() => {
    if (searchParams.get("newPayment") !== "true") return;
    // Wait until transactions have finished loading.
    if (isLoading) return;

    const chargeId = searchParams.get("chargeId");
    const bookingId = searchParams.get("bookingId");
    const memberId = searchParams.get("memberId");

    let charge: Transaction | undefined;

    // 1. Try to match by explicit chargeId
    if (chargeId) {
      charge = transactions.find((t) => t.id === chargeId);
    }

    // 2. Fallback to matching by bookingId
    if (!charge && bookingId) {
      charge = transactions.find((t) => t.bookingId === bookingId && t.type === "Charge" && t.status === "pending");
    }

    // 3. Fallback to the oldest pending charge for the member
    if (!charge && memberId) {
      charge = transactions.find((t) => t.memberId === memberId && t.type === "Charge" && t.status === "pending");
    }

    if (charge) {
      openSettle(charge, true);

      // Clear params ONLY after successfully finding and opening the charge
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
      ].forEach((k) => next.delete(k));
      setSearchParams(next, { replace: true });
    } else {
      // Optional: Only toast an error if transactions data is populated but still missing the target
      if (transactions.length > 0) {
        toast.error("No pending charge found to settle");

        // Clear params anyway so it doesn't infinite loop toast on state changes
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
        ].forEach((k) => next.delete(k));
        setSearchParams(next, { replace: true });
      }
    }
  }, [transactions, isLoading, searchParams, setSearchParams]);

  const handleSettle = async () => {
    if (!settleTxn) return;
    try {
      const paidAt = new Date();
      // 1. Flip the canonical row in the dedicated `charges` table.
      const chargeRowId = (settleTxn as any).chargeRowId as string | undefined;
      if (chargeRowId) {
        const { supabase } = await import("@/lib/supabase");
        const { error } = await supabase
          .from("charges")
          .update({ status: "paid", paid_at: paidAt.toISOString() })
          .eq("id", chargeRowId);
        if (error) throw error;
      }
      // 2. Mirror the status on the legacy transactions row so the list UI updates.
      await updateTransactionMutation.mutateAsync({
        id: settleTxn.id,
        data: {
          status: "paid",
          method: settleMethod,
          date: paidAt.toISOString().split("T")[0],
        },
      });
      toast.success(chargeRowId ? "Charge settled — marked paid" : "Payment settled");
      printBill(settleTxn.memberName, settleTxn.receiptNo, settleTxn.description, settleTxn.total, paidAt);
      setSettleTxn(null);
    } catch (e: any) {
      toast.error(e?.message || "Failed to settle payment");
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
            onClick={() => {
              const headers = ["Receipt #", "Date", "Member", "Method", "Type", "Status", "VAT", "Total"];
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
              exportTableToCSV(headers, rows, `transactions-${format(new Date(), "yyyyMMdd")}.csv`, {
                propertyName: settings.companyName || "VitaFit Club",
                reportTitle: "Transactions Report",
                dateRange: format(new Date(), "PPP"),
                filters: {
                  Search: search || "—",
                  Method: methodFilter === "all" ? "All" : methodFilter,
                  Type: typeFilter === "all" ? "All" : typeFilter,
                  Status: statusFilter === "all" ? "All" : statusFilter,
                  "Total Records": String(filtered.length),
                  "Total Amount (NPR)": String(totalAmount),
                  "Total VAT (NPR)": String(totalVat),
                },
              });
              toast.success(`Exported ${filtered.length} transactions to CSV`);
            }}
          >
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={() => setChargeOpen(true)}>
            <FileText className="h-4 w-4 mr-1" />
            Record Charge
          </Button>
          <Dialog open={advanceOpen} onOpenChange={setAdvanceOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Add Advance
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display">Add Advance</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Advances are deducted from the member's outstanding due balance. Any leftover is kept as credit.
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
                <div className="space-y-2">
                  <Label>Advance Amount (NPR) *</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={advAmount}
                    onChange={(e) => setAdvAmount(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <Select value={advMethod} onValueChange={(v) => setAdvMethod(v as PaymentMethod)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentModes.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
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
                    placeholder="Optional context"
                  />
                </div>
                <Button
                  onClick={handleAddAdvance}
                  disabled={addTransactionMutation.isPending}
                  className="w-full gradient-gold text-primary-foreground"
                >
                  <Receipt className="h-4 w-4 mr-1" />
                  {addTransactionMutation.isPending ? "Saving..." : "Record Advance"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <TransactionDetailModal transaction={selectedTransaction} open={detailOpen} onOpenChange={setDetailOpen} />
      <RecordChargeModal open={chargeOpen} onOpenChange={setChargeOpen} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Total Collections</p>
          <p className="text-xl font-bold font-display mt-1">{formatNPR(totalAmount)}</p>
        </div>
        <div className="glass-card rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Total VAT Collected</p>
          <p className="text-xl font-bold font-display mt-1">{formatNPR(totalVat)}</p>
        </div>
        <div className="glass-card rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Net Amount</p>
          <p className="text-xl font-bold font-display mt-1">{formatNPR(totalAmount - totalVat)}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by member, receipt, description..."
            className="pl-9 bg-muted/50 border-0"
            value={search}
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
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[130px] bg-muted/50 border-0">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {paymentTypes.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
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
              {filtered.map((t) => {
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
                    <TableCell className="font-mono text-xs text-muted-foreground">{t.receiptNo}</TableCell>
                    <TableCell className="text-sm">{t.date}</TableCell>
                    <TableCell className="text-sm font-medium">{t.memberName}</TableCell>
                    <TableCell>
                      <Badge
                        className={`text-[10px] border-0 ${methodColors[t.method] || "bg-muted text-muted-foreground"}`}
                      >
                        {t.method}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {t.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {sl === "Voided" ? (
                        <Badge className="text-[10px] border-0 bg-destructive/20 text-destructive">Voided</Badge>
                      ) : sl === "Pending" ? (
                        <Badge className="text-[10px] border-0 bg-amber-500/20 text-amber-400">Pending</Badge>
                      ) : (
                        <Badge className="text-[10px] border-0 bg-success/20 text-success">Settled</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium text-sm">{formatNPR(t.total)}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        {sl === "Pending" ? (
                          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openSettle(t)}>
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
                                printBill(t.memberName, t.receiptNo, t.description, t.total, new Date(t.date))
                              }
                            >
                              <Printer className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title="Resettle"
                              onClick={() => openSettle(t)}
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </Button>
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
                <Input value={settleTxn.memberName} readOnly className="bg-muted/40" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs">Type</Label>
                  <Input value={isSettlement ? "Settlement" : "Payment"} readOnly className="bg-muted/40" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Amount (NPR)</Label>
                  <Input value={settleTxn.total} readOnly className="bg-muted/40 font-semibold text-primary" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Description</Label>
                <Input value={settleTxn.description} readOnly className="bg-muted/40" />
              </div>
              <div className="space-y-2">
                <Label>Payment Method *</Label>
                <Select value={settleMethod} onValueChange={(v) => setSettleMethod(v as PaymentMethod)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentModes.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Note</Label>
                <Textarea
                  rows={2}
                  value={settleNote}
                  onChange={(e) => setSettleNote(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <Button
                onClick={handleSettle}
                disabled={updateTransactionMutation.isPending}
                className="w-full gradient-gold text-primary-foreground"
              >
                <Receipt className="h-4 w-4 mr-1" />
                {updateTransactionMutation.isPending ? "Saving..." : "Settle & Print Bill"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Transactions;
