import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Receipt, Download, Printer } from "lucide-react";
import { formatNPR, type Transaction } from "@/lib/mock-data";
import { generateReceiptHTML, printHTML, downloadHTML } from "@/lib/print-utils";
import { useCompanySettings } from "@/hooks/use-firestore";

interface TransactionDetailModalProps {
  transaction: Transaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const methodColors: Record<string, string> = {
  Cash: "bg-success/20 text-success",
  Card: "bg-primary/20 text-primary",
  Esewa: "bg-emerald-500/20 text-emerald-400",
  "Bank Transfer": "bg-muted text-muted-foreground",
  "Mobile Wallet": "bg-purple-500/20 text-purple-400",
};

export function TransactionDetailModal({ transaction: t, open, onOpenChange }: TransactionDetailModalProps) {
  const { data: settings = {} } = useCompanySettings();
  if (!t) return null;

  const companyName = settings.companyName || "VitaFit Club";
  const paidAmount = t.total;
  const balanceAmount = 0;

  const handlePrint = () => {
    const html = generateReceiptHTML(t, companyName);
    printHTML(html);
  };

  const handleDownload = () => {
    const html = generateReceiptHTML(t, companyName);
    downloadHTML(html, `receipt-${t.receiptNo}.html`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            Transaction Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="rounded-lg border border-border/50 bg-muted/30 p-4 text-center">
            <p className="text-xs text-muted-foreground">Receipt No.</p>
            <p className="font-mono text-lg font-bold text-primary">{t.receiptNo}</p>
            <p className="text-xs text-muted-foreground mt-1">{t.date}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Member</p>
              <p className="font-medium text-sm">{t.memberName}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground mb-1">Type</p>
              <Badge variant="outline" className="text-xs">{t.type}</Badge>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <p className="font-semibold text-sm font-display">Amount Breakdown</p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal (before VAT)</span>
                <span>{formatNPR(t.amount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">VAT (13%)</span>
                <span>{formatNPR(t.vat)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-sm font-bold">
                <span>Total Amount</span>
                <span className="text-primary">{formatNPR(t.total)}</span>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <p className="font-semibold text-sm font-display">Payment Details</p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Payment Method</span>
                <Badge className={`text-[10px] border-0 ${methodColors[t.method] || ""}`}>{t.method}</Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Paid Amount</span>
                <span className="text-success font-medium">{formatNPR(paidAmount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Balance Due</span>
                <span className={balanceAmount > 0 ? "text-destructive font-medium" : "text-muted-foreground"}>
                  {formatNPR(balanceAmount)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Status</span>
                {t.status === "pending" ? (
                  <Badge className="text-[10px] bg-amber-500/20 text-amber-400 border-0">Pending</Badge>
                ) : (
                  <Badge variant="default" className="text-[10px] bg-success/20 text-success border-0">Paid</Badge>
                )}
              </div>
            </div>
          </div>

          {t.description && (
            <>
              <Separator />
              <div>
                <p className="text-xs text-muted-foreground mb-1">Description</p>
                <p className="text-sm">{t.description}</p>
              </div>
            </>
          )}

          {t.status === "pending" ? (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-300 text-center">
              Bill cannot be printed until this transaction is settled. Settle it from the Transactions list first.
            </div>
          ) : (
            <div className="flex gap-2 pt-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-1" />Print
              </Button>
              <Button variant="outline" size="sm" className="flex-1" onClick={handleDownload}>
                <Download className="h-4 w-4 mr-1" />Download PDF
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
