import { useState } from "react";
import { Plus, Trash2, UserCog, Mail, Phone, Shield, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppUsers, useCreateAppUser, useUpdateAppUser, useDeleteAppUser } from "@/hooks/use-app-users";
import { toast } from "sonner";
import type { UserRole } from "@/lib/firebase-users";

const roleColors: Record<UserRole, string> = {
  admin: "bg-primary/20 text-primary",
  manager: "bg-blue-500/20 text-blue-400",
  staff: "bg-emerald-500/20 text-emerald-400",
  viewer: "bg-muted text-muted-foreground",
};

const UsersPage = () => {
  const { data: users = [], isLoading } = useAppUsers();
  const createMutation = useCreateAppUser();
  const updateMutation = useUpdateAppUser();
  const deleteMutation = useDeleteAppUser();

  const [open, setOpen] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [form, setForm] = useState({
    username: "", email: "", password: "", confirmPassword: "",
    fullName: "", phone: "", address: "", role: "staff" as UserRole,
  });

  const reset = () => setForm({
    username: "", email: "", password: "", confirmPassword: "",
    fullName: "", phone: "", address: "", role: "staff",
  });

  const validate = (): string | null => {
    if (!form.username.trim()) return "Username is required";
    if (!form.email.trim()) return "Email is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return "Invalid email format";
    if (!form.fullName.trim()) return "Full name is required";
    if (form.password.length < 8) return "Password must be at least 8 characters";
    if (form.password !== form.confirmPassword) return "Passwords do not match";
    return null;
  };

  const handleCreate = async () => {
    const err = validate();
    if (err) { toast.error(err); return; }
    try {
      await createMutation.mutateAsync({
        username: form.username,
        email: form.email,
        password: form.password,
        fullName: form.fullName,
        phone: form.phone,
        address: form.address,
        role: form.role,
      });
      toast.success(`User "${form.fullName}" created. They will be prompted to change password on first login.`);
      setOpen(false);
      reset();
    } catch (e: any) {
      const msg = e?.code === "auth/email-already-in-use"
        ? "A user with this email already exists"
        : e?.message || "Failed to create user";
      toast.error(msg);
    }
  };

  const toggleActive = async (id: string, current: boolean) => {
    try {
      await updateMutation.mutateAsync({ id, data: { isActive: !current } });
      toast.success(current ? "User deactivated" : "User activated");
    } catch { toast.error("Update failed"); }
  };

  const handleRoleChange = async (id: string, role: UserRole) => {
    try {
      await updateMutation.mutateAsync({ id, data: { role } });
      toast.success("Role updated");
    } catch { toast.error("Failed"); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Remove user "${name}"? This only removes their access record. The Firebase Auth account is not deleted.`)) return;
    try {
      await deleteMutation.mutateAsync(id);
      toast.success("User removed");
    } catch { toast.error("Failed"); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display">User Management</h1>
          <p className="text-muted-foreground text-sm">Create users, assign roles, and manage access</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" />Create User</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[520px]">
            <DialogHeader>
              <DialogTitle className="font-display">Create New User</DialogTitle>
              <DialogDescription>
                The new user will be required to change this temporary password on first login.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Username *</Label>
                  <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="rajesh.k" />
                </div>
                <div className="space-y-2">
                  <Label>Full Name *</Label>
                  <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Rajesh Karki" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="rajesh@vitafitclub.com" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+977-984XXXXXXX" />
                </div>
                <div className="space-y-2">
                  <Label>Role *</Label>
                  <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as UserRole })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin (full access)</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="staff">Staff (standard access)</SelectItem>
                      <SelectItem value="viewer">Viewer (read-only)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Kathmandu, Nepal" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Temporary Password *</Label>
                  <div className="relative">
                    <Input
                      type={showPwd ? "text" : "password"}
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      placeholder="Min 8 characters"
                      className="pr-10"
                    />
                    <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowPwd(!showPwd)}>
                      {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Confirm Password *</Label>
                  <Input type={showPwd ? "text" : "password"} value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} />
                </div>
              </div>
              <div className="rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground">
                <strong className="text-foreground">Security:</strong> The user will sign in with this temporary password and will be forced to change it before they can access the app.
              </div>
              <Button onClick={handleCreate} disabled={createMutation.isPending} className="w-full gradient-gold text-primary-foreground">
                {createMutation.isPending ? "Creating..." : "Create User"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center">
            <UserCog className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No users yet. Create your first user to grant access.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>User</TableHead>
                  <TableHead className="hidden md:table-cell">Email</TableHead>
                  <TableHead className="hidden lg:table-cell">Phone</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{u.fullName}</p>
                        <p className="text-xs text-muted-foreground">@{u.username}</p>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{u.email}</TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{u.phone || "—"}</TableCell>
                    <TableCell>
                      <Select value={u.role} onValueChange={(v) => handleRoleChange(u.id, v as UserRole)}>
                        <SelectTrigger className={`h-8 w-[110px] text-[11px] border-0 ${roleColors[u.role]}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="staff">Staff</SelectItem>
                          <SelectItem value="viewer">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {u.mustChangePassword
                        ? <Badge className="text-[10px] bg-warning/20 text-warning border-0">Pending password change</Badge>
                        : <Badge className="text-[10px] bg-success/20 text-success border-0">Active</Badge>}
                    </TableCell>
                    <TableCell>
                      <Switch checked={u.isActive} onCheckedChange={() => toggleActive(u.id, u.isActive)} />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => handleDelete(u.id, u.fullName)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
};

export default UsersPage;
