import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useMembers } from "@/hooks/use-firestore";
import { chargeHeadsStore, type ChargeHead } from "@/lib/charge-heads-store";
import { formatNPR } from "@/lib/mock-data";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

/**
 * Record an unpaid miscellaneous charge against a member.
 * Writes a transaction with type="Charge", status="unpaid" — the member
 * ledger picks it up as payable until settled from Transactions.
 */
export function RecordChargeModal({ open, onOpenChange }: Props) {
  const { data: members = [] } = useMembers();
  const addTransaction = useAddTransaction();
  const [heads, setHeads] = useState<ChargeHead[]>([]);
  const [memberId, setMemberId] = useState("");
  const [headId, setHeadId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) {
      setHeads(chargeHeadsStore.active());
      setMemberId("");
      setHeadId("");
      setAmount("");
      setNote("");
    }
  }, [open]);

  const selectedHead = useMemo(() => heads.find((h) => h.id === headId), [heads, headId]);

  useEffect(() => {
    if (selectedHead?.defaultAmount && !amount) {
      setAmount(String(selectedHead.defaultAmount));
    }
  }, [selectedHead]); // eslint-disable-line react-hooks/exhaustive-deps

  const gross = Number(amount || 0);
  const net = gross ? Math.round((gross / 1.13) * 100) / 100 : 0;
  const vat = gross ? Math.round((gross - net) * 100) / 100 : 0;

  const submit = async () => {
    if (!memberId) {
      toast.error("Select a member");
      return;
    }
    if (!selectedHead) {
      toast.error("Select a charge head");
      return;
    }
    if (!gross || gross <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    const member = members.find((m) => m.id === memberId);
    try {
      await addTransaction.mutateAsync({
        memberId,
        memberName: member?.name || "",
        amount: net,
        vat,
        total: gross,
        // method: "Cash",
        type: "Charge" as any,
        date: new Date().toISOString().split("T")[0],
        description: `${selectedHead.name}${note ? ` — ${note}` : ""}`,
        receiptNo: `CHG-${Date.now()}`,
        status: "unpaid",
        chargeHead: selectedHead.name,
      });
      toast.success(`Charge of ${formatNPR(gross)} posted to ${member?.name}`);
      onOpenChange(false);
    } catch {
      toast.error("Failed to record charge");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">Record Charge</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Member *</Label>
            <Select value={memberId} onValueChange={setMemberId}>
              <SelectTrigger>
                <SelectValue placeholder="Select member" />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Charge Head *</Label>
            <Select value={headId} onValueChange={setHeadId}>
              <SelectTrigger>
                <SelectValue placeholder="Select head" />
              </SelectTrigger>
              <SelectContent>
                {heads.length === 0 ? (
                  <div className="px-2 py-4 text-xs text-muted-foreground">
                    No active heads. Add them in Setup → Charge Heads.
                  </div>
                ) : (
                  heads.map((h) => (
                    <SelectItem key={h.id} value={h.id}>
                      {h.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Amount (NPR, VAT incl.) *</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
          </div>

          <div className="space-y-2">
            <Label>Note</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Optional context (locker #, equipment, etc.)"
            />
          </div>

          {gross > 0 && (
            <div className="rounded-lg bg-muted/30 p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Net</span>
                <span>{formatNPR(net)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">VAT (13% incl.)</span>
                <span>{formatNPR(vat)}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Total Payable</span>
                <span className="text-primary">{formatNPR(gross)}</span>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={addTransaction.isPending}>
            {addTransaction.isPending ? "Posting…" : "Post Charge"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
