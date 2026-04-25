import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuthContext } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ShieldAlert } from "lucide-react";

/**
 * Force-shown modal when the logged-in user has mustChangePassword=true.
 * They cannot dismiss it.
 */
export function ForcePasswordChangeModal() {
  const { mustChangePassword, changePassword, signOut } = useAuthContext();
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!oldPwd || !newPwd) { toast.error("Please fill all fields"); return; }
    if (newPwd.length < 8) { toast.error("New password must be at least 8 characters"); return; }
    if (newPwd === oldPwd) { toast.error("New password must differ from current"); return; }
    if (newPwd !== confirmPwd) { toast.error("Passwords do not match"); return; }

    setLoading(true);
    try {
      await changePassword(oldPwd, newPwd);
      toast.success("Password updated. Welcome!");
    } catch (e: any) {
      const msg = e?.code === "auth/wrong-password" || e?.code === "auth/invalid-credential"
        ? "Current password is incorrect"
        : e?.message || "Failed to update password";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={mustChangePassword} onOpenChange={() => { /* prevent close */ }}>
      <DialogContent className="sm:max-w-[420px]" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <div className="h-9 w-9 rounded-lg bg-primary/20 flex items-center justify-center">
              <ShieldAlert className="h-5 w-5 text-primary" />
            </div>
          </div>
          <DialogTitle className="font-display">Set a new password</DialogTitle>
          <DialogDescription>
            For your security, you must change the temporary password before continuing.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Temporary (current) Password</Label>
            <Input type="password" value={oldPwd} onChange={(e) => setOldPwd(e.target.value)} autoFocus />
          </div>
          <div className="space-y-2">
            <Label>New Password</Label>
            <Input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Confirm New Password</Label>
            <Input type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} />
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => signOut()} disabled={loading}>Sign out</Button>
            <Button onClick={handleSubmit} disabled={loading} className="flex-1 gradient-gold text-primary-foreground">
              {loading ? "Updating..." : "Update Password"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
