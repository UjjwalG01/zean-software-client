import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatNPR, type PaymentMethod } from "@/lib/mock-data";

export interface PaymentSplit {
  method: PaymentMethod;
  amount: number;
  reference?: string;
}

interface Props {
  total: number;
  paymentModes: string[];
  value: PaymentSplit[];
  onChange: (splits: PaymentSplit[]) => void;
}

/**
 * Multi-mode payment editor.
 * Total of all splits must equal `total`. Returns one or more splits via onChange.
 */
export function SplitPaymentForm({ total, paymentModes, value, onChange }: Props) {
  const [splits, setSplits] = useState<PaymentSplit[]>(
    value.length ? value : [{ method: (paymentModes[0] || "Cash") as PaymentMethod, amount: total, reference: "" }]
  );

  useEffect(() => { onChange(splits); }, [splits]); // eslint-disable-line

  const sum = useMemo(() => splits.reduce((a, s) => a + Number(s.amount || 0), 0), [splits]);
  const remaining = total - sum;

  const update = (i: number, patch: Partial<PaymentSplit>) =>
    setSplits((cur) => cur.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  const add = () =>
    setSplits((cur) => [
      ...cur,
      { method: (paymentModes[0] || "Cash") as PaymentMethod, amount: Math.max(0, remaining), reference: "" },
    ]);

  const remove = (i: number) => setSplits((cur) => cur.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Payment Mode(s)</Label>
        <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={add}>
          <Plus className="h-3 w-3 mr-1" /> Add another mode
        </Button>
      </div>
      <div className="space-y-2">
        {splits.map((s, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 items-end">
            <div className="col-span-4">
              <Select value={s.method} onValueChange={(v) => update(i, { method: v as PaymentMethod })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {paymentModes.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-4">
              <Input type="number" min={0} value={s.amount}
                onChange={(e) => update(i, { amount: Number(e.target.value) })} placeholder="Amount" />
            </div>
            <div className="col-span-3">
              <Input value={s.reference || ""} onChange={(e) => update(i, { reference: e.target.value })}
                placeholder="Txn ref (opt.)" />
            </div>
            <div className="col-span-1">
              {splits.length > 1 && (
                <Button type="button" variant="ghost" size="icon" className="h-9 w-9"
                  onClick={() => remove(i)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between text-xs rounded-md bg-muted/30 px-3 py-2">
        <span className="text-muted-foreground">Total to collect</span>
        <span className="font-semibold">{formatNPR(total)}</span>
        <span className={remaining === 0 ? "text-success" : "text-destructive"}>
          {remaining === 0 ? "Balanced" : `Remaining ${formatNPR(remaining)}`}
        </span>
      </div>
    </div>
  );
}
