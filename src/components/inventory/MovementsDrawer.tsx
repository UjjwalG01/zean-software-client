import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useItemMovements, useInventoryItems } from "@/hooks/use-inventory";

interface Props { itemId: string | null; onClose: () => void; }

export function MovementsDrawer({ itemId, onClose }: Props) {
  const { data: items = [] } = useInventoryItems();
  const item = items.find((i) => i.id === itemId);
  const { data: movements = [] } = useItemMovements(itemId || "");

  // Recompute running balance forward
  let running = 0;
  const rows = movements.map((m) => {
    running += m.type === "issue" ? -m.quantity : m.quantity;
    return { ...m, balance: running };
  });

  return (
    <Sheet open={!!itemId} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{item ? `${item.code} — ${item.name}` : "Movements"}</SheetTitle>
        </SheetHeader>
        {item && (
          <div className="grid grid-cols-3 gap-3 my-4">
            <div className="rounded-lg border bg-card p-3"><p className="text-xs text-muted-foreground">Stock</p><p className="text-lg font-bold">{item.quantity} {item.unit}</p></div>
            <div className="rounded-lg border bg-card p-3"><p className="text-xs text-muted-foreground">Avg Rate</p><p className="text-lg font-bold">NPR {item.rate.toLocaleString()}</p></div>
            <div className="rounded-lg border bg-card p-3"><p className="text-xs text-muted-foreground">Valuation</p><p className="text-lg font-bold text-primary">NPR {(item.quantity * item.rate).toLocaleString()}</p></div>
          </div>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Rate</TableHead>
              <TableHead>Ref</TableHead>
              <TableHead className="text-right">Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">No movements yet</TableCell></TableRow>
            ) : rows.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="text-xs">{new Date(m.createdAt).toLocaleString()}</TableCell>
                <TableCell>
                  <Badge variant={m.type === "issue" ? "destructive" : m.type === "purchase" ? "default" : "secondary"} className="capitalize">{m.type}</Badge>
                </TableCell>
                <TableCell className="text-right font-medium">{m.type === "issue" ? "-" : "+"}{m.quantity}</TableCell>
                <TableCell className="text-right">NPR {m.rate.toLocaleString()}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{m.reference || m.note || "—"}</TableCell>
                <TableCell className="text-right font-semibold">{m.balance}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SheetContent>
    </Sheet>
  );
}
