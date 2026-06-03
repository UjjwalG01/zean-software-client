import { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatNPR, type Member } from "@/lib/mock-data";
import { useTransactions } from "@/hooks/use-firestore";
import { buildMemberLedger } from "@/lib/member-ledger";

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

  const { rows, summary } = useMemo(() => {
    if (!member) return { rows: [], summary: { totalCharged: 0, totalPaid: 0, advance: 0, netPayable: 0, dueBalance: 0, isSettled: true } };
    return buildMemberLedger(member.id, transactions, member.openingBalance || 0);
  }, [member, transactions]);

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

        {/* Summary */}
        <div className="ml-auto w-full sm:w-[360px] rounded-md border border-border/60 bg-muted/30 p-3 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total Billed:</span>
            <strong>{formatNPR(summary.totalCharged)}</strong>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total Paid:</span>
            <strong className="text-success">{formatNPR(summary.totalPaid)}</strong>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Advance Balance (deducted):</span>
            <strong className="text-primary">- {formatNPR(summary.advance)}</strong>
          </div>
          <div className="border-t border-border/60 mt-1 pt-1 flex justify-between text-base">
            <strong className="text-destructive">Net Payable Balance:</strong>
            <strong className="text-destructive">{formatNPR(summary.netPayable)}</strong>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
