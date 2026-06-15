import { useState } from "react";
import { LogOut, Key } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthContext } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { changePassword, signOut } from "@/lib/auth-service";

export function UserProfileMenu() {
  const { user } = useAuthContext();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [loading, setLoading] = useState(false);

  const displayName =
    user?.user_metadata?.display_name || user?.email?.split("@")[0] || "Client";

  const initials = displayName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleLogout = async () => {
    try {
      await signOut();
      navigate("/login");
    } catch (err: any) {
      toast.error(err.message || "Failed to sign out");
    }
  };

  const handleChangePassword = async () => {
    // 1. Basic configuration fallback for blank inputs
    if (!oldPwd || !newPwd || !confirmPwd) {
      toast.error("Please fill all password fields");
      return;
    }

    setLoading(true);
    try {
      // 2. Hand execution data off cleanly over all 3 critical structural metrics
      const result: any = await changePassword(oldPwd, newPwd, confirmPwd);

      if (result && result.status === "error") {
        toast.error(result.message || "Failed to change password");
        return;
      }

      toast.success("Password changed successfully!");
      setPwdOpen(false);
      setOldPwd("");
      setNewPwd("");
      setConfirmPwd("");
    } catch (err: any) {
      toast.error(
        err.message || "Verify your current credentials and try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>
          <button className="flex items-center gap-2 pl-2 border-l border-border cursor-pointer hover:opacity-80 transition-opacity">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary/20 text-primary text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="hidden lg:block text-left">
              <p className="text-sm font-medium leading-none">{displayName}</p>
              <p className="text-xs text-muted-foreground">
                {user?.email || "Super Admin"}
              </p>
            </div>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-1" align="end">
          <div className="p-3">
            <p className="text-sm font-medium">{displayName}</p>
            <p className="text-xs text-muted-foreground truncate">
              {user?.email}
            </p>
          </div>
          <Separator />
          <button
            className="w-full flex items-center gap-2 p-2 rounded-md text-sm hover:bg-muted/50 transition-colors text-left"
            onClick={() => {
              setMenuOpen(false);
              setPwdOpen(true);
            }}
          >
            <Key className="h-4 w-4 text-muted-foreground" />
            Change Password
          </button>
          <Separator />
          <button
            className="w-full flex items-center gap-2 p-2 rounded-md text-sm hover:bg-destructive/10 text-destructive transition-colors text-left"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </PopoverContent>
      </Popover>

      <Dialog open={pwdOpen} onOpenChange={setPwdOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="font-display">Change Password</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Current Password</Label>
              <Input
                type="password"
                value={oldPwd}
                onChange={(e) => setOldPwd(e.target.value)}
                placeholder="Enter current password"
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input
                type="password"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                placeholder="Enter new password"
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label>Confirm New Password</Label>
              <Input
                type="password"
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
                placeholder="Confirm new password"
                disabled={loading}
              />
            </div>
            <Button
              onClick={handleChangePassword}
              disabled={loading}
              className="w-full gradient-gold text-primary-foreground"
            >
              {loading ? "Changing..." : "Update Password"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
