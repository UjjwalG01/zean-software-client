import { useState, useMemo } from "react";
import { Search, Plus, Download, Receipt, FileText } from "lucide-react";
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
import { useTransactions, useAddTransaction, useMembers } from "@/hooks/use-firestore";
import { toast } from "sonner";

const methodColors: Record<PaymentMethod, string> = {
  Cash: "bg-success/20 text-success",
  Card: "bg-primary/20 text-primary",
  Esewa: "bg-emerald-500/20 text-emerald-400",
  "Bank Transfer": "bg-muted text-muted-foreground",
  "Mobile Wallet": "bg-purple-500/20 text-purple-400",
};

const Transactions = () => {
  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // New payment form
  const [payMember, setPayMember] = useState("");
  const [payType, setPayType] = useState("Payment");
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("Cash");
  const [payDesc, setPayDesc] = useState("");

  const { data: transactions = [], isLoading } = useTransactions();
  const { data: members = [] } = useMembers();
  const addTransactionMutation = useAddTransaction();

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

  const handleRecordPayment = async () => {
    if (!payMember || !payAmount) {
      toast.error("Please select member and enter amount");
      return;
    }
    const memberObj = members.find((m) => m.id === payMember);
    const amount = Number(payAmount);
    try {
      await addTransactionMutation.mutateAsync({
        memberId: payMember,
        memberName: memberObj?.name || "",
        amount,
        method: payMethod as PaymentMethod,
        type: payType as any,
        description: payDesc,
        date: new Date().toISOString().split("T")[0],
        receiptNo: `VFC-${Date.now()}`,
      });
      toast.success("Payment recorded successfully! Receipt generated.");
      setDialogOpen(false);
      setPayMember("");
      setPayAmount("");
      setPayDesc("");
    } catch {
      toast.error("Failed to record payment");
    }
  };

  const vatPreview = payAmount ? Math.round(Number(payAmount) * 0.13) : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display">Transactions</h1>
          <p className="text-muted-foreground text-sm">{filtered.length} transactions • Total: {formatNPR(totalAmount)}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => {
            import("@/lib/print-utils").then(({ exportTableToCSV }) => {
              const headers = ["Receipt #", "Date", "Member", "Description", "Method", "Type", "VAT", "Total"];
              const rows = filtered.map((t) => [t.receiptNo, t.date, t.memberName, t.description, t.method, t.type, String(t.vat), String(t.total)]);
              exportTableToCSV(headers, rows, "transactions-export.csv");
              toast.success("Transactions exported as CSV!");
            });
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
                      <SelectItem value="Payment">Payment</SelectItem>
                      <SelectItem value="Renewal">Renewal</SelectItem>
                      <SelectItem value="Registration">Registration</SelectItem>
                      <SelectItem value="Advance">Advance Payment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Amount (NPR)</Label>
                    <Input type="number" placeholder="0" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>VAT (13%)</Label>
                    <Input type="number" value={vatPreview} disabled />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <Select value={payMethod} onValueChange={setPayMethod}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="Card">Card</SelectItem>
                      <SelectItem value="Esewa">eSewa</SelectItem>
                      <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                      <SelectItem value="Mobile Wallet">Mobile Wallet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Description</Label><Input placeholder="e.g. Gold Monthly Payment" value={payDesc} onChange={(e) => setPayDesc(e.target.value)} /></div>
                {payAmount && (
                  <div className="rounded-lg bg-muted/30 p-3 text-sm space-y-1">
                    <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatNPR(Number(payAmount))}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">VAT</span><span>{formatNPR(vatPreview)}</span></div>
                    <div className="flex justify-between font-bold"><span>Total</span><span className="text-primary">{formatNPR(Number(payAmount) + vatPreview)}</span></div>
                  </div>
                )}
                <Button onClick={handleRecordPayment} disabled={addTransactionMutation.isPending} className="w-full gradient-gold text-primary-foreground">
                  <Receipt className="h-4 w-4 mr-1" />{addTransactionMutation.isPending ? "Saving..." : "Save & Generate Receipt"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Transaction Detail Modal */}
      <TransactionDetailModal transaction={selectedTransaction} open={detailOpen} onOpenChange={setDetailOpen} />

      {/* Summary Cards */}
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

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by member, receipt, description..." className="pl-9 bg-muted/50 border-0" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={methodFilter} onValueChange={setMethodFilter}>
          <SelectTrigger className="w-[150px] bg-muted/50 border-0"><SelectValue placeholder="Method" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Methods</SelectItem>
            <SelectItem value="Cash">Cash</SelectItem>
            <SelectItem value="Card">Card</SelectItem>
            <SelectItem value="Esewa">eSewa</SelectItem>
            <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
            <SelectItem value="Mobile Wallet">Mobile Wallet</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[140px] bg-muted/50 border-0"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="Payment">Payment</SelectItem>
            <SelectItem value="Renewal">Renewal</SelectItem>
            <SelectItem value="Registration">Registration</SelectItem>
            <SelectItem value="Advance">Advance</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
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
                <TableHead className="text-right hidden md:table-cell">VAT</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="w-10"></TableHead>
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
                    <Badge className={`text-[10px] border-0 ${methodColors[t.method]}`}>{t.method}</Badge>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <Badge variant="outline" className="text-[10px]">{t.type}</Badge>
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground hidden md:table-cell">{formatNPR(t.vat)}</TableCell>
                  <TableCell className="text-right font-medium text-sm">{formatNPR(t.total)}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); toast.info("Receipt download ready"); }}>
                      <FileText className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
};

export default Transactions;
