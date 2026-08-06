import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatNPR, type Transaction } from "@/lib/mock-data";
import { formatDate, formatDateTime } from "@/lib/tz";
import { cn } from "@/lib/utils";

export interface ReconciliationSelection {
  date: string;
  department: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selection: ReconciliationSelection | null;
  /** Pre-filtered transactions in the active date range. */
  transactions: Transaction[];
  /** Map of charge row id → charge_head, for resolving linked department. */
  chargeHeadById: Map<string, string>;
  loading?: boolean;
}

const methodLabel: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  qr: "QR",
  bank: "Bank",
  esewa: "eSewa",
  khalti: "Khalti",
  credit: "Ledger Adjustment",
};

function resolveDepartment(
  t: Transaction,
  chargeHeadById: Map<string, string>,
): string {
  const linked = t.chargeRowId ? chargeHeadById.get(t.chargeRowId) : undefined;
  return (
    t.chargeHead ||
    linked ||
    t.serviceType ||
    (t.type === "Charge" ? "Misc Charges" : "Membership")
  );
}

/**
 * Slide-out reconciliation drawer for the Daily Sales report.
 * Lists the individual transactions that roll up into the clicked
 * (date × department) cell, with full audit columns.
 */
export function ReconciliationDrawer({
  open,
  onOpenChange,
  selection,
  transactions,
  chargeHeadById,
  loading = false,
}: Props) {
  const rows = useMemo(() => {
    if (!selection) return [];
    return transactions.filter(
      (t) =>
        t.date === selection.date &&
        resolveDepartment(t, chargeHeadById) === selection.department,
    );
  }, [transactions, chargeHeadById, selection]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (a, r) => {
          const sign = r.voided ? -1 : 1;
          return {
            net: a.net + sign * (r.amount || 0),
            vat: a.vat + sign * (r.vat || 0),
            gross: a.gross + sign * (r.total || 0),
          };
        },
        { net: 0, vat: 0, gross: 0 },
      ),
    [rows],
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-3xl p-0 flex flex-col "
      >
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/60">
          <SheetTitle className="text-xl font-display">
            Reconciliation Breakdown
          </SheetTitle>
          <SheetDescription>
            {selection ? (
              <>
                <span className="font-medium text-foreground">
                  {selection.date}
                </span>
                <span className="mx-2 opacity-50">·</span>
                <span>{selection.department}</span>
              </>
            ) : (
              "Select a row to inspect"
            )}
          </SheetDescription>
        </SheetHeader>

        {/* Summary band */}
        {!loading && selection && rows.length > 0 && (
          <div className="grid grid-cols-3 gap-3 px-6 py-4 bg-muted/30 border-b border-border/60">
            <SummaryStat label="Net Sales" value={formatNPR(totals.net)} />
            <SummaryStat label="VAT" value={formatNPR(totals.vat)} />
            <SummaryStat
              label="Gross Total"
              value={formatNPR(totals.gross)}
              accent
            />
          </div>
        )}

        <ScrollArea className="flex-1">
          <div className="p-4">
            {loading ? (
              <SkeletonRows />
            ) : rows.length === 0 ? (
              <EmptyState />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Member</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead className="text-right">VAT</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const voided = r.voided === true;
                    return (
                      <TableRow
                        key={r.id}
                        className={cn(voided && "opacity-60 line-through")}
                      >
                        <TableCell className="whitespace-nowrap text-xs">
                          {formatDate(r.createdAt || r.date)}
                        </TableCell>
                        <TableCell>
                          <Link
                            to={`/members/${r.memberId}`}
                            className="text-primary hover:underline"
                            onClick={() => onOpenChange(false)}
                          >
                            <div className="font-medium leading-tight truncate">
                              {r.memberName}
                            </div>
                            {/* <div className="text-[10px] text-muted-foreground">
                              {r.memberId}
                            </div> */}
                          </Link>
                        </TableCell>
                        <TableCell className="max-w-[220px]">
                          <div
                            className="text-sm truncate"
                            title={r.description}
                          >
                            {r.description || r.chargeHead || r.type}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {r.receiptNo}
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNPR(r.amount || 0)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNPR(r.vat || 0)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {formatNPR(r.total || 0)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">
                            {methodLabel[r.method] || r.method}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <StatusBadge
                            status={voided ? "voided" : r.status || "—"}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function SummaryStat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "font-semibold tabular-nums",
          accent ? "text-primary text-lg" : "text-base",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "paid"
      ? "bg-success/15 text-success border-success/30"
      : status === "pending" || status === "unpaid"
        ? "bg-warning/15 text-warning border-warning/30"
        : status === "voided"
          ? "bg-destructive/15 text-destructive border-destructive/30"
          : "bg-muted text-muted-foreground";
  return (
    <Badge variant="outline" className={cn("text-[10px] capitalize", cls)}>
      {status}
    </Badge>
  );
}

function SkeletonRows() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="py-16 text-center text-sm text-muted-foreground">
      No contributing transactions found for this selection.
    </div>
  );
}
