import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Plus, Download, Receipt, FileText, Printer } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { TransactionDetailModal } from "@/components/TransactionDetailModal";
import { formatNPR, type PaymentMethod, type Transaction } from "@/lib/mock-data";
import { useTransactions, useAddTransaction, useUpdateTransaction, useMembers, useCompanySettings } from "@/hooks/use-firestore";
import { generateA5BillHTML, printHTML, exportTableToCSV } from "@/lib/print-utils";
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
  try { return settings[key] ? JSON.parse(settings[key]) : fallback; } catch { return fallback; }
}

const Transactions = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [payMember, setPayMember] = useState("");
  const [payType, setPayType] = useState("Payment");
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("Cash");
  const [payDesc, setPayDesc] = useState("");
  const [payLocked, setPayLocked] = useState(false);
  const [payBookingId, setPayBookingId] = useState<string>("");
  const [settleTxn, setSettleTxn] = useState<Transaction | null>(null);

  const { data: transactions = [], isLoading } = useTransactions();
  const { data: members = [] } = useMembers();
  const { data: settings = {} } = useCompanySettings();
  const addTransactionMutation = useAddTransaction();
  const updateTransactionMutation = useUpdateTransaction();

  const paymentModes = parseSetup(settings, "setup_paymentModes", ["Cash", "Card", "Esewa", "Bank Transfer", "Mobile Wallet"]);
  const paymentTypes = parseSetup(settings, "setup_paymentTypes", ["Payment", "Renewal", "Registration", "Advance", "Refund"]);

  // Auto-open payment dialog when coming from booking completion
  useEffect(() => {
    if (searchParams.get("newPayment") === "true" && members.length > 0) {
      const memberName = searchParams.get("memberName") || "";
      const memberId = searchParams.get("memberId") || "";
      const service = searchParams.get("service") || "";
      const className = searchParams.get("className") || "";
      const amount = searchParams.get("amount") || "";
      const locked = searchParams.get("locked") === "1";
      const bookingId = searchParams.get("bookingId") || "";

      const member = members.find((m) => m.id === memberId) || members.find((m) => m.name === memberName);
      if (member) setPayMember(member.id);
      setPayDesc(`${service} — ${className}`);
      setPayType("Payment");
      if (amount) setPayAmount(amount);
      setPayLocked(locked);
      setPayBookingId(bookingId);
      setDialogOpen(true);

      setSearchParams({}, { replace: true });
    }
  }, [searchParams, members, setSearchParams]);

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      const matchSearch = t.memberName.toLowerCase().includes(search.toLowerCase()) || t.receiptNo.toLowerCase().includes(search.toLowerCase()) || t.description.toLowerCase().includes(search.toLowerCase());
      const matchMethod = methodFilter === "all" || t.method === methodFilter;
      const matchType = typeFilter === "all" || t.type === typeFilter;
      return matchSearch && matchMethod && matchType;
    });
  }, [transactions, search, methodFilter, typeFilter]);

  const totalAmount = filtered.reduce((sum, t) => sum + t.total, 0);
  const totalVat = filtered.reduce((sum, t) => sum + t.vat, 0);

  const printBill = (memberName: string, receiptNo: string, desc: string, gross: number, date: Date) => {
    const companyName = settings.companyName || "VitaFit Club";
    // VAT-inclusive: the displayed/charged price already contains 13% VAT
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
      items: [{ description: desc || "Membership Payment", quantity: 1, rate: gross, amount: gross }],
      subtotal: net,
      taxableAmount: net,
      vatAmount: vat,
      grandTotal: gross,
      attendant: "admin",
    });
    printHTML(html);
  };

  const resetPayForm = () => {
    setPayMember(""); setPayAmount(""); setPayDesc("");
    setPayLocked(false); setPayBookingId("");
  };

  const handleRecordPayment = async (markPending = false) => {
    if (!payMember || !payAmount) {
      toast.error("Please select member and enter amount");
      return;
    }
    const memberObj = members.find((m) => m.id === payMember);
    const amount = Number(payAmount);
    const receiptNo = `VFC-${Date.now()}`;
    try {
      await addTransactionMutation.mutateAsync({
        memberId: payMember,
        memberName: memberObj?.name || "",
        amount,
        method: payMethod as PaymentMethod,
        type: payType as any,
        description: payDesc,
        date: new Date().toISOString().split("T")[0],
        receiptNo,
        status: markPending ? "pending" : "paid",
        bookingId: payBookingId || undefined,
      });
      setDialogOpen(false);
      if (markPending) {
        toast.success("Marked as pending — settle later from this list");
      } else {
        toast.success("Payment recorded! Generating invoice...");
        printBill(memberObj?.name || "", receiptNo, payDesc, amount, new Date());
      }
      resetPayForm();
    } catch {
      toast.error("Failed to record payment");
    }
  };

  const handleSettle = async () => {
    if (!settleTxn) return;
    try {
      await updateTransactionMutation.mutateAsync({
        id: settleTxn.id,
        data: {
          status: "paid",
          method: payMethod as PaymentMethod,
          date: new Date().toISOString().split("T")[0],
        },
      });
      toast.success("Payment settled! Generating invoice...");
      printBill(settleTxn.memberName, settleTxn.receiptNo, settleTxn.description, settleTxn.amount, new Date());
      setSettleTxn(null);
    } catch {
      toast.error("Failed to settle payment");
    }
  };

  const grossPreview = Number(payAmount || 0);
  const netPreview = grossPreview ? Math.round((grossPreview / 1.13) * 100) / 100 : 0;
  const vatPreview = grossPreview ? Math.round((grossPreview - netPreview) * 100) / 100 : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display">Transactions</h1>
          <p className="text-muted-foreground text-sm">{filtered.length} transactions • Total: {formatNPR(totalAmount)}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => {
            const headers = ["Receipt #", "Date", "Member", "Description", "Method", "Type", "VAT", "Total"];
            const rows = filtered.map((t) => [t.receiptNo, t.date, t.memberName, t.description, t.method, t.type, String(t.vat), String(t.total)]);
            exportTableToCSV(headers, rows, `transactions-${format(new Date(), "yyyyMMdd")}.csv`, {
              propertyName: settings.companyName || "VitaFit Club",
              reportTitle: "Transactions Report",
              dateRange: format(new Date(), "PPP"),
              filters: {
                Search: search || "—",
                Method: methodFilter === "all" ? "All" : methodFilter,
                Type: typeFilter === "all" ? "All" : typeFilter,
                "Total Records": String(filtered.length),
                "Total Amount (NPR)": String(totalAmount),
                "Total VAT (NPR)": String(totalVat),
              },
            });
            toast.success(`Exported ${filtered.length} transactions to CSV`);
          }}>
            <Download className="h-4 w-4 mr-1" />Export
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" />Record Payment</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle className="font-display">Record Payment</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Member</Label>
                  <Select value={payMember} onValueChange={setPayMember}>
                    <SelectTrigger><SelectValue placeholder="Select member" /></SelectTrigger>
                    <SelectContent>
                      {members.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Payment Type</Label>
                  <Select value={payType} onValueChange={setPayType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {paymentTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Amount (NPR, VAT incl.){payLocked && <span className="text-xs text-muted-foreground ml-1">(locked)</span>}</Label>
                    <Input type="number" placeholder="0" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} disabled={payLocked} />
                  </div>
                  <div className="space-y-2">
                    <Label>VAT included (13%)</Label>
                    <Input type="number" value={vatPreview} disabled />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <Select value={payMethod} onValueChange={setPayMethod}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {paymentModes.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Description</Label><Input placeholder="e.g. Gold Monthly Payment" value={payDesc} onChange={(e) => setPayDesc(e.target.value)} /></div>
                {payAmount && (
                  <div className="rounded-lg bg-muted/30 p-3 text-sm space-y-1">
                    <div className="flex justify-between"><span className="text-muted-foreground">Net (excl. VAT)</span><span>{formatNPR(netPreview)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">VAT (13% incl.)</span><span>{formatNPR(vatPreview)}</span></div>
                    <div className="flex justify-between font-bold"><span>Total Payable</span><span className="text-primary">{formatNPR(grossPreview)}</span></div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={() => handleRecordPayment(true)} disabled={addTransactionMutation.isPending}>
                    Pay Later (Pending)
                  </Button>
                  <Button onClick={() => handleRecordPayment(false)} disabled={addTransactionMutation.isPending} className="gradient-gold text-primary-foreground">
                    <Receipt className="h-4 w-4 mr-1" />{addTransactionMutation.isPending ? "Saving..." : "Pay & Print Bill"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <TransactionDetailModal transaction={selectedTransaction} open={detailOpen} onOpenChange={setDetailOpen} />

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

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by member, receipt, description..." className="pl-9 bg-muted/50 border-0" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={methodFilter} onValueChange={setMethodFilter}>
          <SelectTrigger className="w-[150px] bg-muted/50 border-0"><SelectValue placeholder="Method" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Methods</SelectItem>
            {paymentModes.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[140px] bg-muted/50 border-0"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {paymentTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Receipt #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Member</TableHead>
                <TableHead className="hidden md:table-cell">Description</TableHead>
                <TableHead>Method</TableHead>
                <TableHead className="hidden lg:table-cell">Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right hidden md:table-cell">VAT</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="w-28"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t) => (
                <TableRow key={t.id} className="cursor-pointer" onClick={() => { setSelectedTransaction(t); setDetailOpen(true); }}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{t.receiptNo}</TableCell>
                  <TableCell className="text-sm">{t.date}</TableCell>
                  <TableCell className="text-sm font-medium">{t.memberName}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{t.description}</TableCell>
                  <TableCell>
                    <Badge className={`text-[10px] border-0 ${methodColors[t.method] || "bg-muted text-muted-foreground"}`}>{t.method}</Badge>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <Badge variant="outline" className="text-[10px]">{t.type}</Badge>
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground hidden md:table-cell">{formatNPR(t.vat)}</TableCell>
                  <TableCell className="text-right font-medium text-sm">{formatNPR(t.total)}</TableCell>
                  <TableCell>
                    {t.status === "pending" ? (
                      <Badge className="text-[10px] border-0 bg-amber-500/20 text-amber-400">Pending</Badge>
                    ) : (
                      <Badge className="text-[10px] border-0 bg-success/20 text-success">Paid</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {t.status === "pending" ? (
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={(e) => {
                          e.stopPropagation();
                          setPayMethod("Cash");
                          setSettleTxn(t);
                        }}>Settle</Button>
                      ) : (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => {
                          e.stopPropagation();
                          printBill(t.memberName, t.receiptNo, t.description, t.amount, new Date(t.date));
                        }}>
                          <Printer className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={!!settleTxn} onOpenChange={(o) => !o && setSettleTxn(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Settle Pending Payment</DialogTitle></DialogHeader>
          {settleTxn && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/30 p-3 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Member</span><span className="font-medium">{settleTxn.memberName}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Description</span><span>{settleTxn.description}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Net (excl. VAT)</span><span>{formatNPR(settleTxn.amount)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">VAT (13% incl.)</span><span>{formatNPR(settleTxn.vat)}</span></div>
                <div className="flex justify-between font-bold"><span>Total Payable</span><span className="text-primary">{formatNPR(settleTxn.total)}</span></div>
              </div>
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select value={payMethod} onValueChange={setPayMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {paymentModes.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleSettle} disabled={updateTransactionMutation.isPending} className="w-full gradient-gold text-primary-foreground">
                <Receipt className="h-4 w-4 mr-1" />{updateTransactionMutation.isPending ? "Settling..." : "Settle & Print Bill"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Transactions;
