import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatNPR, type Member } from "@/lib/mock-data";
import {
  useMemberLedger,
  type MemberLedgerRow,
} from "@/hooks/use-member-ledger";
import { useMemberFinancials } from "@/hooks/use-member-financials";
import { getMemberPoolsSummary } from "@/lib/prepaid";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  member: Member | null;
}

type DerivedStatus = "Settled" | "Partial" | "Unpaid" | "Overpaid";

/**
 * Quick Balance — full transaction history + running balance for one member.
 *
 * Reads the server-side SSOT views (`vw_member_ledger` + `member_financial_summaries`)
 * via TanStack Query hooks. All balance math is server-computed; the UI just
 * projects rows and derives the display status from the signed net outstanding.
 */
export function QuickBalanceModal({ open, onOpenChange, member }: Props) {
  const { data: ledgerRows = [] } = useMemberLedger(member?.id);
  const { data: financials } = useMemberFinancials(member?.id);

  const { data: prepaid } = useQuery({
    queryKey: ["prepaidPools", member?.id],
    queryFn: () =>
      member ? getMemberPoolsSummary(member.id) : Promise.resolve(null),
    enabled: !!member && open,
  });

  // Ledger view returns rows DESC by occurred_at; QuickBalance shows oldest→newest for the running balance.
  const chronoRows = useMemo(
    () =>
      [...ledgerRows].sort((a, b) =>
        a.occurred_at.localeCompare(b.occurred_at),
      ),
    [ledgerRows],
  );

  const summary = useMemo(() => {
    // Booking vs manual charge split is a display-only derivation over the SSOT ledger rows.
    let bookingCharges = 0;
    let manualCharges = 0;
    let vatTotal = 0;
    for (const r of chronoRows) {
      if (r.voided || r.type !== "Charge") continue;
      const gross = Number(r.debit) || 0;
      vatTotal += Number(r.vat_amount) || 0;
      if (r.source === "booking") bookingCharges += gross;
      else manualCharges += gross;
    }

    const totalCharged = Number(financials?.total_invoiced ?? 0);
    const totalPaid = Number(financials?.total_paid ?? 0);
    const advance = Number(financials?.total_advances ?? 0);
    const discountTotal = Number(financials?.total_discounts ?? 0);
    const netPayable = Number(financials?.net_outstanding ?? 0);

    const status: DerivedStatus =
      netPayable < 0
        ? "Overpaid"
        : totalCharged === 0 || netPayable === 0
          ? "Settled"
          : totalPaid + advance + discountTotal > 0
            ? "Partial"
            : "Unpaid";

    return {
      totalCharged,
      bookingCharges,
      manualCharges,
      vatTotal,
      netCharges: Math.max(0, totalCharged - vatTotal),
      totalPaid,
      advance,
      discountTotal,
      netPayable,
      status,
    };
  }, [chronoRows, financials]);

  if (!member) return null;

  // Discount / Advance / voided rows surface in the summary cards below, not as individual lines.
  const visibleRows = chronoRows.filter(
    (r) =>
      !r.voided &&
      r.type !== "Advance" &&
      r.source !== "advance" &&
      r.source !== "discount",
  );

  const displayDate = (r: MemberLedgerRow) =>
    (r.occurred_on || r.occurred_at || "").slice(0, 10);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Quick Balance</DialogTitle>
        </DialogHeader>

        {/* Header strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 rounded-md overflow-hidden ">
          <div className="px-4 py-2 text-sm">
            <span className="opacity-80">Member No:</span>{" "}
            <strong>
              {(member as any).memberCode || (member as any).grcNo || member.id}
            </strong>
          </div>
          <div className="px-4 py-2 text-sm border-l border-primary-foreground/20">
            <span className="opacity-80">Name:</span>{" "}
            <strong>{member.name}</strong>
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
          {visibleRows.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">
              No transactions recorded yet
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[110px]">Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-[90px]">Kind</TableHead>
                  <TableHead className="text-right w-[110px]">Charge</TableHead>
                  <TableHead className="text-right w-[110px]">Paid</TableHead>
                  <TableHead className="text-right w-[120px]">
                    Balance
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">{displayDate(r)}</TableCell>
                    <TableCell className="text-sm">
                      {r.description}
                      {r.receipt_no && (
                        <span className="block text-[10px] text-muted-foreground font-mono">
                          {r.receipt_no}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {r.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {r.debit ? formatNPR(r.debit) : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm text-success">
                      {r.credit ? formatNPR(r.credit) : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm font-semibold">
                      {formatNPR(r.running_balance)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Detailed breakdown — booking charges, VAT, discounts, settlements → Net Payable */}
        <div className="ml-auto w-full sm:w-[420px] rounded-md border border-border/60 bg-muted/30 p-3 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              Booking Charges (gross)
            </span>
            <p>{formatNPR(summary.bookingCharges)}</p>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Manual / Misc Charges</span>
            <p>{formatNPR(summary.manualCharges)}</p>
          </div>
          {/* <div className="flex justify-between text-xs">
            <span className="text-muted-foreground pl-3">↳ Net (pre-VAT)</span>
            <span className="text-muted-foreground">{formatNPR(summary.netCharges)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground pl-3">↳ VAT (13%)</span>
            <span className="text-muted-foreground">{formatNPR(summary.vatTotal)}</span>
          </div> */}
          <div className="border-t border-border/50 my-1" />
          <div className="flex justify-between">
            <span className="text-muted-foreground">＋ Total Billed</span>
            <p>{formatNPR(summary.totalCharged)}</p>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">－ Total Paid</span>
            <p className="">{formatNPR(summary.totalPaid)}</p>
          </div>
          {summary.advance ? (
            <div className="flex justify-between">
              <span className="text-muted-foreground">－ Advance Balance</span>
              <p className="text-primary">{formatNPR(summary.advance)}</p>
            </div>
          ) : null}

          <div className="flex justify-between">
            <span className="text-muted-foreground">－ Discounts</span>
            <p className="">{formatNPR(summary.discountTotal)}</p>
          </div>
          <div className="border-t border-border/60 mt-1 pt-1 flex justify-between text-base">
            <strong
            // className={
            //   summary.status === "Settled"
            //     ? "text-success"
            //     : summary.status === "Partial"
            //       ? "text-warning"
            //       : summary.status === "Overpaid"
            //         ? "text-blue-500"
            //         : "text-destructive"
            // }
            >
              ＝ {summary.status === "Overpaid" ? "Refund Due" : "Net Payable"}{" "}
              {summary.netPayable > 0 ? summary.status : null}
            </strong>
            <strong
            // className={
            //   summary.status === "Settled"
            //     ? "text-success"
            //     : summary.status === "Partial"
            //       ? "text-warning"
            //       : summary.status === "Overpaid"
            //         ? "text-blue-500"
            //         : "text-destructive"
            // }
            >
              {summary.netPayable < 0
                ? `(${formatNPR(Math.abs(summary.netPayable))})`
                : formatNPR(summary.netPayable)}
            </strong>
          </div>
        </div>

        {/* Prepaid Membership Pool — only shown if any pool exists */}
        {prepaid && prepaid.pools.length > 0 && (
          <div className="ml-auto w-full sm:w-[420px] rounded-md border border-primary/30 bg-primary/5 p-3 text-sm space-y-1">
            <p className="text-xs uppercase tracking-wider text-primary font-semibold mb-1">
              Prepaid Membership
            </p>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Payment Done</span>
              <strong>{formatNPR(prepaid.totalPaid)}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Total Used (attendance)
              </span>
              <strong className="text-warning">
                −{formatNPR(prepaid.usedAmount)}
              </strong>
            </div>
            <div className="border-t border-primary/20 mt-1 pt-1 flex justify-between text-base">
              <strong className="text-primary">＝ Remaining Balance</strong>
              <strong className="text-primary">
                {formatNPR(prepaid.remaining)}
              </strong>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
