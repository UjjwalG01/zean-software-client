import { useState } from "react";
import { ArrowLeftRight, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InventoryTabsNav } from "@/components/inventory/InventoryTabsNav";
import { StockMovementsLedger } from "@/components/inventory/StockMovementsLedger";
import { AddStockModal } from "@/components/inventory/AddStockModal";

/** `/inventory/movements` — full stock movement ledger with logging action. */
export default function InventoryMovementsPage() {
  const [logOpen, setLogOpen] = useState(false);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-display flex items-center gap-2">
            <ArrowLeftRight className="h-6 w-6 text-primary" /> Stock Movements
          </h1>
          <p className="text-sm text-muted-foreground">
            Every received, issued, adjusted and transferred unit — the audit
            source for all inventory reports.
          </p>
        </div>
        <Button
          className="gradient-gold text-primary-foreground"
          onClick={() => setLogOpen(true)}
        >
          <ClipboardList className="h-4 w-4 mr-1.5" /> Log Movement
        </Button>
      </div>

      <InventoryTabsNav />
      <StockMovementsLedger />

      <AddStockModal open={logOpen} onOpenChange={setLogOpen} />
    </div>
  );
}
