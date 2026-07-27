import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Receipt, Download, Printer, Ban } from "lucide-react";
import { formatNPR, type Transaction } from "@/lib/mock-data";
import {
  generateStandardReceiptHTML,
  printHTML,
  downloadHTML,
} from "@/lib/print-utils";
import { formatInTz } from "@/lib/tz";

import {
  useCompanySettings,
  useUpdateTransaction,
} from "@/hooks/use-firestore";
import { toast } from "sonner";
import { methodColors } from "@/lib/utils";
import { nowIso } from "@/lib/tz";
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

interface TransactionDetailModalProps {
  transaction: Transaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TransactionDetailModal({
  transaction: t,
  open,
  onOpenChange,
}: TransactionDetailModalProps) {
  const { data: settings = {} } = useCompanySettings();
  const updateTxn = useUpdateTransaction();
  const [voiding, setVoiding] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [voidConfirmText, setVoidConfirmText] = useState("");
  if (!t) return null;

  const companyName = settings.companyName || ".............";

  // 🌟 FIX: Determine active VAT percentage dynamically from settings (supports 0 or any positive entry)
  const activeVatRate =
    settings.vatRate !== undefined && settings.vat_rate !== null
      ? Number(settings.vat_rate)
      : 13;

  // Calculate actual paid volume net of any applied discounts
  const discountAmount = Number((t as any).discount) || 0;
  const paidAmount = Math.max(0, t.total - discountAmount);

  const balanceAmount = 0;
  const isVoided = t.voided || t.status === "voided";

  const paperSize = (settings.bill_paperSize as "A4" | "A5" | "80mm") || "A5";
  const receiptKind: "payment" | "advance" =
    t.type === "Advance" ? "advance" : "payment";

  const buildReceiptHTML = () =>
    generateStandardReceiptHTML({
      companyName,
      companyTagline: (settings as any).companyTagline,
      companyAddress: (settings as any).companyAddress,
      companyPhone: (settings as any).companyPhone,
      companyEmail: (settings as any).companyEmail,
      companyLogoUrl: (settings as any).extras?.logoUrl || (settings as any).logo_url || (settings as any).companyLogoUrl,
      paymentMethod: t.method,
      remarks: t.description,
      guestName: t.memberName,
      billNo: t.receiptNo,
      billDate: t.date,
      billForMonth: formatInTz(t.date, { month: "long", year: "numeric" }),
      items: [
        {
          description: t.description || "Subscription / Services",
          quantity: 1,
          rate: t.amount,
          amount: t.amount,
        },
      ],
      subtotal: t.amount,
      taxableAmount: t.amount,
      vatAmount: t.vat,
      vatRate: activeVatRate,
      grandTotal: t.total,
      discount: discountAmount,
      paidAmount:
        t.status === "pending" || t.status === "voided" ? 0 : paidAmount,
      status: t.status,
      paperSize,
      kind: receiptKind,
    });

  const handlePrint = () => printHTML(buildReceiptHTML());
  const handleDownload = () =>
    downloadHTML(buildReceiptHTML(), `receipt-${t.receiptNo}.html`);


  const handleVoid = async () => {
    if (!voidReason.trim()) {
      toast.error("Please provide a reason for voiding");
      return;
    }
    if (voidConfirmText.trim().toUpperCase() !== "VOID") {
      toast.error("Type VOID to confirm");
      return;
    }
    setVoiding(true);
    try {
      await updateTxn.mutateAsync({
        id: t.id,
        data: {
          voided: true,
          voidReason,
          voidedAt: nowIso(),
          status: "voided" as any,
          amount: 0,
          vat: 0,
          total: 0,
        } as any,
      });
      const chargeRowId = (t as any).chargeRowId as string | undefined;
      if (chargeRowId) {
        try {
          const { supabase } = await import("@/lib/supabase");
          await supabase
            .from("charges")
            .update({
              total: 0,
              amount: 0,
              vat_amount: 0,
              meta: { voided: true, voidReason },
            })
            .eq("id", chargeRowId);
        } catch {
          /* swallow */
        }
      }
      toast.success("Transaction voided");
      setVoidOpen(false);
      onOpenChange(false);
    } catch {
      toast.error("Failed to void transaction");
    } finally {
      setVoiding(false);
    }
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
            <p className="font-mono text-lg font-bold text-primary">
              {t.receiptNo}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{t.date}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Member</p>
              <p className="font-medium text-sm">{t.memberName}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground mb-1">Type</p>
              <Badge variant="outline" className="text-xs">
                {t.type}
              </Badge>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <p className="font-semibold text-sm font-display">
              Amount Breakdown
            </p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Subtotal (before VAT)
                </span>
                <span>{formatNPR(t.amount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                {/* 🌟 FIX: Made the VAT label percentage reflect current configurations dynamically */}
                <span className="text-muted-foreground">
                  VAT ({activeVatRate}%)
                </span>
                <span>{formatNPR(t.vat)}</span>
              </div>

              <Separator />
              <div className="flex justify-between text-sm font-bold">
                <span>Total Gross Amount</span>
                <span className="text-primary">{formatNPR(t.total)}</span>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <p className="font-semibold text-sm font-display">
              Payment Details
            </p>
            <div className="space-y-2">
              {/* Discount Line-Item breakdown indicator */}
              {discountAmount > 0 && (
                <div className="flex justify-between text-sm text-destructive">
                  <span>Discount Applied</span>
                  <span className="font-medium">
                    -{formatNPR(discountAmount)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Paid Amount</span>
                <span className="text-success font-medium font-mono">
                  {t.status === "pending" || t.status === "voided"
                    ? 0
                    : formatNPR(paidAmount)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Payment Method</span>
                <Badge
                  className={`text-[10px] border-0 ${t.status === "pending" || t.status === "voided" ? "bg-muted text-muted-foreground" : methodColors[t.method] || ""}`}
                >
                  {t.status === "pending" || t.status === "voided"
                    ? "None"
                    : t.method}
                </Badge>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Status</span>
                {t.status === "pending" || t.status === "voided" ? (
                  <Badge className="text-[10px] bg-amber-500/20 text-amber-400 border-0 capitalize">
                    {t.status}
                  </Badge>
                ) : (
                  <Badge
                    variant="default"
                    className="text-[10px] bg-success/20 text-success border-0"
                  >
                    Paid
                  </Badge>
                )}
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Balance Due</span>
                {t.status === "pending" || t.status === "unpaid" ? (
                  formatNPR(t.total)
                ) : (
                  <span
                    className={
                      balanceAmount > 0
                        ? "text-destructive font-medium"
                        : "text-muted-foreground"
                    }
                  >
                    {formatNPR(balanceAmount)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {t.description && (
            <>
              <Separator />
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  Description
                </p>
                <p className="text-sm">{t.description}</p>
              </div>
            </>
          )}

          {isVoided && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive text-center font-medium">
              VOIDED{t.voidReason ? ` — ${t.voidReason}` : ""}
            </div>
          )}

          {t.status === "pending" ? (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-300 text-center">
              Bill cannot be printed until this transaction is settled. Settle
              it from the Transactions list first.
            </div>
          ) : isVoided ? null : (
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={handlePrint}
              >
                <Printer className="h-4 w-4 mr-1" />
                Print
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={handleDownload}
              >
                <Download className="h-4 w-4 mr-1" />
                Download PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setVoidReason("");
                  setVoidConfirmText("");
                  setVoidOpen(true);
                }}
                disabled={voiding}
                className="text-destructive border-destructive/40 hover:bg-destructive/10"
              >
                <Ban className="h-4 w-4 mr-1" />
                {voiding ? "Voiding…" : "Void"}
              </Button>
            </div>
          )}
        </div>

        <AlertDialog open={voidOpen} onOpenChange={setVoidOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Void this transaction?</AlertDialogTitle>
              <AlertDialogDescription>
                You are about to void receipt <b>{t.receiptNo}</b> (
                {formatNPR(t.total)}) for <b>{t.memberName}</b>. This zeroes its
                financial impact and cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Reason *</Label>
                <Input
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder="e.g. duplicate posting"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Type VOID to confirm</Label>
                <Input
                  value={voidConfirmText}
                  onChange={(e) => setVoidConfirmText(e.target.value)}
                  placeholder="VOID"
                />
              </div>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleVoid} disabled={voiding}>
                {voiding ? "Voiding…" : "Confirm Void"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
