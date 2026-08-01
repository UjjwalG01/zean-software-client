import { useState, useEffect, useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useInventoryItems,
  useInventoryStores,
  useInventorySuppliers,
  useInventoryMutations,
} from "@/hooks/use-inventory";
import { toast } from "sonner";

/** Movement kinds that can be logged manually from the UI. */
export type LogMovementMode = "purchase" | "issue" | "adjustment" | "transfer";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Preselected movement type. Defaults to `purchase` (Received). */
  mode?: LogMovementMode;
  defaultItemId?: string;
}

const MODE_OPTIONS: { value: LogMovementMode; label: string }[] = [
  { value: "purchase", label: "Received" },
  { value: "issue", label: "Issued" },
  { value: "adjustment", label: "Adjusted" },
  { value: "transfer", label: "Transferred" },
];

/**
 * Unified "Log Movement" sheet — records received / issued / adjusted /
 * transferred stock. Every save writes an `inv_movements` row (and an audit
 * entry) through the inventory data layer.
 */
export function AddStockModal({
  open,
  onOpenChange,
  mode = "purchase",
  defaultItemId,
}: Props) {
  const { data: items = [] } = useInventoryItems();
  const { data: stores = [] } = useInventoryStores();
  const { data: suppliers = [] } = useInventorySuppliers();
  const { purchase, issue, adjust, transfer } = useInventoryMutations();

  const [type, setType] = useState<LogMovementMode>(mode);
  const [itemId, setItemId] = useState("");
  const [qty, setQty] = useState(0);
  const [rate, setRate] = useState(0);
  const [supplierId, setSupplierId] = useState<string>("none");
  const [toStoreId, setToStoreId] = useState<string>("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const current = useMemo(
    () => items.find((i) => i.id === itemId),
    [items, itemId],
  );

  useEffect(() => {
    if (!open) return;
    setType(mode);
    setItemId(defaultItemId || items[0]?.id || "");
    setQty(0);
    setReference("");
    setNote("");
    setSupplierId("none");
    setToStoreId("");
  }, [open, mode, defaultItemId, items]);

  useEffect(() => {
    if (current && type === "purchase") setRate(current.rate);
  }, [current, type]);

  const handleSave = async () => {
    if (!itemId) {
      toast.error("Select an item");
      return;
    }
    if (type !== "adjustment" && qty <= 0) {
      toast.error("Enter a quantity greater than zero");
      return;
    }
    if (type === "adjustment" && qty === 0) {
      toast.error("Enter a non-zero adjustment (use −n to reduce stock)");
      return;
    }
    if (type === "transfer" && !toStoreId) {
      toast.error("Select a destination store");
      return;
    }
    if (
      (type === "issue" || type === "transfer") &&
      current &&
      qty > current.quantity
    ) {
      toast.error("Quantity exceeds available stock");
      return;
    }

    setSaving(true);
    try {
      if (type === "purchase") {
        await purchase.mutateAsync({
          itemId,
          qty,
          rate,
          reference,
          note,
          supplierId: supplierId === "none" ? undefined : supplierId,
        });
      } else if (type === "issue") {
        await issue.mutateAsync({ itemId, qty, reference, note });
      } else if (type === "adjustment") {
        await adjust.mutateAsync({ itemId, delta: qty, reason: note, reference });
      } else {
        await transfer.mutateAsync({ itemId, toStoreId, qty, reference, note });
      }
      toast.success(`Movement logged for ${current?.name ?? "item"}`);
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not log the movement",
      );
    } finally {
      setSaving(false);
    }
  };

  const section = (title: string, children: React.ReactNode) => (
    <div className="space-y-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      {children}
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Log Movement</SheetTitle>
          <SheetDescription>
            Record a stock movement. All entries appear in the ledger and audit
            history.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-5">
          {section(
            "Movement",
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Item</Label>
                <Select value={itemId} onValueChange={setItemId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select item" />
                  </SelectTrigger>
                  <SelectContent>
                    {items
                      .filter((i) => i.active)
                      .map((i) => (
                        <SelectItem key={i.id} value={i.id}>
                          {i.code} — {i.name} (stock: {i.quantity})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Movement Type</Label>
                <Select
                  value={type}
                  onValueChange={(v) => setType(v as LogMovementMode)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>,
          )}

          {section(
            "Quantity & Pricing",
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>
                  Quantity {current?.unit ? `(${current.unit})` : ""}
                  {type === "adjustment" && (
                    <span className="ml-1 text-[10px] text-muted-foreground">
                      (± delta)
                    </span>
                  )}
                </Label>
                <Input
                  type="number"
                  value={qty}
                  onChange={(e) => setQty(Number(e.target.value))}
                />
              </div>
              {type === "purchase" && (
                <div className="space-y-1.5">
                  <Label>Rate (NPR, VAT incl.)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={rate}
                    onChange={(e) => setRate(Number(e.target.value))}
                  />
                </div>
              )}
            </div>,
          )}

          {type === "purchase" &&
            section(
              "Supplier",
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger>
                  <SelectValue placeholder="No supplier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No supplier</SelectItem>
                  {suppliers
                    .filter((s) => s.active)
                    .map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>,
            )}

          {type === "transfer" &&
            section(
              "Locations",
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>From</Label>
                  <Input
                    value={
                      stores.find((s) => s.id === current?.storeId)?.name || "—"
                    }
                    readOnly
                    disabled
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>To</Label>
                  <Select value={toStoreId} onValueChange={setToStoreId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Destination" />
                    </SelectTrigger>
                    <SelectContent>
                      {stores
                        .filter((s) => s.active && s.id !== current?.storeId)
                        .map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>,
            )}

          {section(
            "Reference",
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Reference No.</Label>
                <Input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Invoice / issue / transfer no."
                />
              </div>
              <div className="space-y-1.5">
                <Label>Reference Note</Label>
                <Textarea
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Why is this movement being recorded?"
                />
              </div>
            </div>,
          )}

          {type === "purchase" && current && qty > 0 && (
            <p className="text-xs text-muted-foreground">
              New stock: <b>{current.quantity + qty}</b> {current.unit} · New
              avg rate:{" "}
              <b>
                NPR{" "}
                {Math.round(
                  (current.quantity * current.rate + qty * rate) /
                    (current.quantity + qty) || 0,
                ).toLocaleString()}
              </b>
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="gradient-gold text-primary-foreground"
          >
            Save Movement
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
