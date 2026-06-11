import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatNPR, type Member } from "@/lib/mock-data";
import { useTransactions } from "@/hooks/use-firestore";
import { useCharges } from "@/hooks/use-charges";
import { buildMemberLedger } from "@/lib/member-ledger";
import { getMemberPoolsSummary } from "@/lib/prepaid";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  member: Member | null;
}

/**
 * Quick Balance — full transaction history + running balance for one member.
 * Modeled on the screenshot: dark header strip, ledger table, summary card.
 */
export function QuickBalanceModal({ open, onOpenChange, member }: Props) {
  const { data: transactions = [] } = useTransactions();
  const { data: charges = [] } = useCharges();

  const { rows, summary } = useMemo(() => {
    if (!member) {
      return {
        rows: [],
        summary: {
          totalCharged: 0,
          bookingCharges: 0,
          manualCharges: 0,
          vatTotal: 0,
          netCharges: 0,
          totalPaid: 0,
          advance: 0,
          discountTotal: 0,
          netPayable: 0,
          dueBalance: 0,
          isSettled: true,
          status: "Settled" as const,
        },
      };
    }
    return buildMemberLedger(member.id, transactions, member.openingBalance || 0, charges);
  }, [member, transactions, charges]);

  const { data: prepaid } = useQuery({
    queryKey: ["prepaidPools", member?.id],
    queryFn: () => (member ? getMemberPoolsSummary(member.id) : Promise.resolve(null)),
    enabled: !!member && open,
  });

  if (!member) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Quick Balance</DialogTitle>
        </DialogHeader>

        {/* Header strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 rounded-md overflow-hidden bg-primary text-primary-foreground">
          <div className="px-4 py-2 text-sm">
            <span className="opacity-80">Member No:</span> <strong>{(member as any).memberCode || (member as any).grcNo || member.id}</strong>
          </div>
          <div className="px-4 py-2 text-sm border-l border-primary-foreground/20">
            <span className="opacity-80">Name:</span> <strong>{member.name}</strong>
          </div>
          <div className="px-4 py-2 text-sm border-l border-primary-foreground/20">
            <span className="opacity-80">Plan:</span>{" "}
            <strong>
              {member.tier} · {member.plan}
            </strong>
          </div>
        </div>

        {/* Ledger */}
        <div className="rounded-md border border-border/50 overflow-hidden">
          {rows.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">No transactions recorded yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[110px]">Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-[90px]">Kind</TableHead>
                  <TableHead className="text-right w-[110px]">Charge</TableHead>
                  <TableHead className="text-right w-[110px]">Paid</TableHead>
                  <TableHead className="text-right w-[120px]">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={i} className={r.voided ? "opacity-50 line-through" : ""}>
                    <TableCell className="text-xs">{r.date}</TableCell>
                    <TableCell className="text-sm">
                      {r.description}
                      {r.receiptNo && (
                        <span className="block text-[10px] text-muted-foreground font-mono">{r.receiptNo}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {r.kind}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm">{r.debit ? formatNPR(r.debit) : "—"}</TableCell>
                    <TableCell className="text-right text-sm text-success">
                      {r.credit ? formatNPR(r.credit) : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm font-semibold">{formatNPR(r.balance)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Detailed breakdown — booking charges, VAT, discounts, settlements → Net Payable */}
        <div className="ml-auto w-full sm:w-[420px] rounded-md border border-border/60 bg-muted/30 p-3 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Booking Charges (gross)</span>
            <strong>{formatNPR(summary.bookingCharges)}</strong>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Manual / Misc Charges</span>
            <strong>{formatNPR(summary.manualCharges)}</strong>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground pl-3">↳ Net (pre-VAT)</span>
            <span className="text-muted-foreground">{formatNPR(summary.netCharges)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground pl-3">↳ VAT (13%)</span>
            <span className="text-muted-foreground">{formatNPR(summary.vatTotal)}</span>
          </div>
          <div className="border-t border-border/50 my-1" />
          <div className="flex justify-between">
            <span className="text-muted-foreground">＋ Total Billed</span>
            <strong>{formatNPR(summary.totalCharged)}</strong>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">－ Total Paid (Settlements)</span>
            <strong className="text-success">{formatNPR(summary.totalPaid)}</strong>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">－ Advance Balance</span>
            <strong className="text-primary">{formatNPR(summary.advance)}</strong>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">－ Discounts</span>
            <strong className="text-warning">{formatNPR(summary.discountTotal)}</strong>
          </div>
          <div className="border-t border-border/60 mt-1 pt-1 flex justify-between text-base">
            <strong className={summary.status === "Settled" ? "text-success" : summary.status === "Partial" ? "text-warning" : "text-destructive"}>
              ＝ Net Payable ({summary.status})
            </strong>
            <strong className={summary.status === "Settled" ? "text-success" : summary.status === "Partial" ? "text-warning" : "text-destructive"}>
              {formatNPR(summary.netPayable)}
            </strong>
          </div>
        </div>

        {/* Prepaid Membership Pool — only shown if any pool exists */}
        {prepaid && prepaid.pools.length > 0 && (
          <div className="ml-auto w-full sm:w-[420px] rounded-md border border-primary/30 bg-primary/5 p-3 text-sm space-y-1">
            <p className="text-xs uppercase tracking-wider text-primary font-semibold mb-1">Prepaid Membership</p>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Payment Done</span>
              <strong>{formatNPR(prepaid.totalPaid)}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Used (attendance)</span>
              <strong className="text-warning">−{formatNPR(prepaid.usedAmount)}</strong>
            </div>
            <div className="border-t border-primary/20 mt-1 pt-1 flex justify-between text-base">
              <strong className="text-primary">＝ Remaining Balance</strong>
              <strong className="text-primary">{formatNPR(prepaid.remaining)}</strong>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
