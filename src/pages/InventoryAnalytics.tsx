import { BarChart3 } from "lucide-react";
import { InventoryTabsNav } from "@/components/inventory/InventoryTabsNav";
import { InventoryAnalytics } from "@/components/inventory/InventoryAnalytics";

/** `/inventory/analytics` — KPIs, charts and turnover derived from the ledger. */
export default function InventoryAnalyticsPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold font-display flex items-center gap-2">
          Inventory Analytics
        </h1>
      </div>

      <InventoryTabsNav />
      <InventoryAnalytics />
    </div>
  );
}
