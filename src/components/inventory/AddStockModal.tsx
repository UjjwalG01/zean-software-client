import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useInventoryItems, useInventoryMutations } from "@/hooks/use-inventory";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: "purchase" | "issue";
  defaultItemId?: string;
}

export function AddStockModal({ open, onOpenChange, mode, defaultItemId }: Props) {
  const { data: items = [] } = useInventoryItems();
  const { purchase, issue } = useInventoryMutations();
  const [itemId, setItemId] = useState("");
  const [qty, setQty] = useState(0);
  const [rate, setRate] = useState(0);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");

  const current = useMemo(() => items.find((i) => i.id === itemId), [items, itemId]);

  useEffect(() => {
    if (open) {
      setItemId(defaultItemId || items[0]?.id || "");
      setQty(0); setReference(""); setNote("");
    }
  }, [open, defaultItemId, items]);

  useEffect(() => { if (current && mode === "purchase") setRate(current.rate); }, [current, mode]);

  const handleSave = async () => {
    if (!itemId || qty <= 0) { toast.error("Select item and enter quantity"); return; }
    if (mode === "purchase") {
      await purchase.mutateAsync({ itemId, qty, rate, reference, note });
      toast.success(`Added ${qty} ${current?.unit} to ${current?.name}`);
    } else {
      if (current && qty > current.quantity) { toast.error("Quantity exceeds available stock"); return; }
      await issue.mutateAsync({ itemId, qty, reference, note });
      toast.success(`Issued ${qty} ${current?.unit} of ${current?.name}`);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{mode === "purchase" ? "Add Stock (Purchase)" : "Issue Stock"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Item</Label>
            <Select value={itemId} onValueChange={setItemId}>
              <SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger>
              <SelectContent>
                {items.filter((i) => i.active).map((i) => (
                  <SelectItem key={i.id} value={i.id}>{i.code} — {i.name} (stock: {i.quantity})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Quantity ({current?.unit || ""})</Label>
              <Input type="number" min={0} value={qty} onChange={(e) => setQty(Number(e.target.value))} />
            </div>
            {mode === "purchase" && (
              <div className="space-y-1.5"><Label>Rate (NPR, VAT incl.)</Label>
                <Input type="number" min={0} value={rate} onChange={(e) => setRate(Number(e.target.value))} />
              </div>
            )}
          </div>
          <div className="space-y-1.5"><Label>Reference {mode === "purchase" ? "(Invoice no.)" : "(Issue no.)"}</Label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
          <div className="space-y-1.5"><Label>Note</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          {mode === "purchase" && current && qty > 0 && (
            <p className="text-xs text-muted-foreground">
              New stock: <b>{current.quantity + qty}</b> {current.unit} · New avg rate: <b>NPR {Math.round((((current.quantity * current.rate) + (qty * rate)) / (current.quantity + qty)) || 0).toLocaleString()}</b>
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} className="gradient-gold text-primary-foreground">
            {mode === "purchase" ? "Add to Stock" : "Issue Stock"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
