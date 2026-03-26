import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Plus, Download, Receipt, FileText, CreditCard } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { transactions, formatNPR, type PaymentMethod } from "@/lib/mock-data";
import { toast } from "sonner";

const methodColors: Record<PaymentMethod, string> = {
  Cash: "bg-success/20 text-success",
  Card: "bg-primary/20 text-primary",
  Esewa: "bg-emerald-500/20 text-emerald-400",
  "Bank Transfer": "bg-muted text-muted-foreground",
  "Mobile Wallet": "bg-purple-500/20 text-purple-400",
};

const Transactions = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      const matchSearch = t.memberName.toLowerCase().includes(search.toLowerCase()) || t.receiptNo.toLowerCase().includes(search.toLowerCase()) || t.description.toLowerCase().includes(search.toLowerCase());
      const matchMethod = methodFilter === "all" || t.method === methodFilter;
      const matchType = typeFilter === "all" || t.type === typeFilter;
      return matchSearch && matchMethod && matchType;
    });
  }, [search, methodFilter, typeFilter]);

  const totalAmount = filtered.reduce((sum, t) => sum + t.total, 0);
  const totalVat = filtered.reduce((sum, t) => sum + t.vat, 0);

  const handleRecordPayment = () => {
    toast.success("Payment recorded successfully! Receipt generated.");
    setDialogOpen(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display">Transactions</h1>
          <p className="text-muted-foreground text-sm">{filtered.length} transactions • Total: {formatNPR(totalAmount)}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => toast.success("Transactions exported as CSV")}>
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
                  <Input placeholder="Search member..." />
                </div>
                <div className="space-y-2">
                  <Label>Payment Type</Label>
                  <Select>
                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
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
                    <Input type="number" placeholder="0" />
                  </div>
                  <div className="space-y-2">
                    <Label>VAT (13%)</Label>
                    <Input type="number" placeholder="Auto-calculated" disabled />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <Select>
                    <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="Card">Card (Stripe)</SelectItem>
                      <SelectItem value="Esewa">eSewa</SelectItem>
                      <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                      <SelectItem value="Mobile Wallet">Mobile Wallet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input placeholder="e.g. Gold Monthly Payment" />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleRecordPayment} className="flex-1 gradient-gold text-primary-foreground">
                    <Receipt className="h-4 w-4 mr-1" />Save & Generate Receipt
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground text-center">
                  💡 Connect to backend to enable Stripe, eSewa, and auto VAT calculation
                </p>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

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
              <TableRow key={t.id} className="cursor-pointer" onClick={() => navigate(`/members/${t.memberId}`)}>
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
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); toast.info("Receipt download ready (connect backend)"); }}>
                    <FileText className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default Transactions;
