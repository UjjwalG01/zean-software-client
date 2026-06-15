import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuthContext } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ShieldAlert } from "lucide-react";

import { changePassword, signOut } from "@/lib/auth-service";

/**
 * Force-shown modal when the logged-in user has must_change_password === true.
 * They cannot dismiss it without changing their password or signing out.
 */
export function ForcePasswordChangeModal() {
  const { user } = useAuthContext();
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [loading, setLoading] = useState(false);

  // Check the Supabase user metadata flag directly to open the modal
  const isPasswordChangeRequired =
    user?.user_metadata?.must_change_password === true;

  const handleSubmit = async () => {
    // 1. Basic empty field check before dispatching
    if (!oldPwd || !newPwd || !confirmPwd) {
      toast.error("Please fill all password fields");
      return;
    }

    setLoading(true);
    try {
      // 2. Dispatch all 3 parameters to the single source of truth validation layer
      const result = await changePassword(oldPwd, newPwd, confirmPwd);

      if (result.status === "error") {
        toast.error(result.message || "Failed to update password");
        return;
      }

      toast.success("Password updated successfully. Welcome!");
      setOldPwd("");
      setNewPwd("");
      setConfirmPwd("");
    } catch (e: any) {
      toast.error(e?.message || "An unexpected system error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await signOut();
      toast.success("Signed out successfully");
    } catch (e: any) {
      toast.error(e?.message || "Failed to sign out");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={isPasswordChangeRequired}
      onOpenChange={() => {
        /* prevent close */
      }}
    >
      <DialogContent
        className="sm:max-w-[420px]"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <div className="h-9 w-9 rounded-lg bg-primary/20 flex items-center justify-center">
              <ShieldAlert className="h-5 w-5 text-primary" />
            </div>
          </div>
          <DialogTitle className="font-display">Set a new password</DialogTitle>
          <DialogDescription>
            For your security, you must change the temporary password before
            continuing.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Temporary (current) Password</Label>
            <Input
              type="password"
              value={oldPwd}
              onChange={(e) => setOldPwd(e.target.value)}
              disabled={loading}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label>New Password</Label>
            <Input
              type="password"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label>Confirm New Password</Label>
            <Input
              type="password"
              value={confirmPwd}
              onChange={(e) => setConfirmPwd(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={handleSignOut}
              disabled={loading}
            >
              Sign out
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 gradient-gold text-primary-foreground"
            >
              {loading ? "Updating..." : "Update Password"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
