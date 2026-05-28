import { useState } from "react";
import { Plus, Trash2, UserCog, Eye, EyeOff, KeyRound, CheckCircle2, Copy, Mail, Pencil, ShieldCheck, Users as UsersIcon, ShieldAlert, ShieldQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppUsers, useCreateAppUser, useUpdateAppUser, useDeleteAppUser } from "@/hooks/use-app-users";
import { sendResetPasswordEmail } from "@/lib/firebase-auth";
import { toast } from "sonner";
import type { UserRole, AppUser } from "@/lib/firebase-users";
import { RolesManager, useRoleDefinitions } from "@/components/RolesManager";

const roleColors: Record<UserRole, string> = {
  admin: "bg-primary/20 text-primary",
  manager: "bg-blue-500/20 text-blue-400",
  staff: "bg-emerald-500/20 text-emerald-400",
  viewer: "bg-muted text-muted-foreground",
};

const DEFAULT_TEMP_PASSWORD = "12345678";

const UsersPage = () => {
  const { data: users = [], isLoading, refetch } = useAppUsers();
  const createMutation = useCreateAppUser();
  const updateMutation = useUpdateAppUser();
  const deleteMutation = useDeleteAppUser();
  const { roles: customRoles } = useRoleDefinitions();

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("users");
  const [showPwd, setShowPwd] = useState(false);
  const [successUser, setSuccessUser] = useState<{ email: string; password: string; fullName: string } | null>(null);
  const [resetTarget, setResetTarget] = useState<AppUser | null>(null);
  const [editTarget, setEditTarget] = useState<AppUser | null>(null);
  const [editForm, setEditForm] = useState<Partial<AppUser>>({});

  const initialForm = () => ({
    username: "", email: "", password: DEFAULT_TEMP_PASSWORD, confirmPassword: DEFAULT_TEMP_PASSWORD,
    fullName: "", phone: "", address: "", role: "staff" as UserRole,
  });
  const [form, setForm] = useState(initialForm());
  const reset = () => setForm(initialForm());

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
      const created = { email: form.email, password: form.password, fullName: form.fullName };
      setOpen(false);
      reset();
      await refetch();
      setSuccessUser(created);
      toast.success(`User "${created.fullName}" created successfully`);
    } catch (e: any) {
      const msg = e?.code === "auth/email-already-in-use"
        ? "A user with this email already exists in Firebase Auth"
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

  const handleRoleChange = async (id: string, customRoleId: string) => {
    try {
      // Custom role IDs are stored in extras; system DB role stays "staff" so RLS enums are valid.
      await updateMutation.mutateAsync({ id, data: { customRoleId, role: "staff" as UserRole } });
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

  const handleSendResetEmail = async (email: string) => {
    try {
      await sendResetPasswordEmail(email);
      toast.success(`Password reset email sent to ${email}`);
      setResetTarget(null);
    } catch (e: any) {
      toast.error(e?.message || "Failed to send reset email");
    }
  };

  const handleForceTempPassword = async (user: AppUser) => {
    try {
      await updateMutation.mutateAsync({ id: user.id, data: { mustChangePassword: true } });
      await sendResetPasswordEmail(user.email);
      toast.success(`Reset email sent. User will set a new password and be prompted again on next login.`);
      setResetTarget(null);
    } catch (e: any) {
      toast.error(e?.message || "Failed to reset");
    }
  };

  const copyCreds = (creds: { email: string; password: string }) => {
    navigator.clipboard.writeText(`Email: ${creds.email}\nPassword: ${creds.password}`);
    toast.success("Credentials copied to clipboard");
  };

  const openEdit = (u: AppUser) => {
    setEditTarget(u);
    setEditForm({ fullName: u.fullName, username: u.username, phone: u.phone, address: u.address, role: u.role });
  };

  const handleSaveEdit = async () => {
    if (!editTarget) return;
    try {
      await updateMutation.mutateAsync({ id: editTarget.id, data: editForm });
      toast.success("User updated");
      setEditTarget(null);
    } catch { toast.error("Update failed"); }
  };

  const counts = {
    total: users.length,
    admin: users.filter((u) => u.role === "admin").length,
    active: users.filter((u) => u.isActive).length,
    pending: users.filter((u) => u.mustChangePassword).length,
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
          <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display">Create New User</DialogTitle>
              <DialogDescription>
                Default password is <strong>{DEFAULT_TEMP_PASSWORD}</strong>. The user will be forced to change it on first login.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+977-984XXXXXXX" />
                </div>
                <div className="space-y-2">
                  <Label>Role *</Label>
                  <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as UserRole })}>
                    <SelectTrigger>
                      <SelectValue placeholder={customRoles.filter(r => r.active).length === 0 ? "No roles — create one first" : "Select role"} />
                    </SelectTrigger>
                    <SelectContent>
                      {customRoles.filter(r => r.active).length === 0 ? (
                        <div className="px-3 py-2 text-xs text-muted-foreground">Create roles in the Roles &amp; Permissions tab.</div>
                      ) : customRoles.filter(r => r.active).map(r => (
                        <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Kathmandu, Nepal" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                <strong className="text-foreground">Security:</strong> Username & password are pre-filled with the email and the default temp password ({DEFAULT_TEMP_PASSWORD}). The user must change their password on first login.
              </div>
              <Button onClick={handleCreate} disabled={createMutation.isPending} className="w-full gradient-gold text-primary-foreground">
                {createMutation.isPending ? "Creating..." : "Create User"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* STATS + ROLES LEGEND */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total users", value: counts.total, icon: UsersIcon, color: "text-primary" },
          { label: "Admins", value: counts.admin, icon: ShieldCheck, color: "text-amber-400" },
          { label: "Active", value: counts.active, icon: ShieldQuestion, color: "text-emerald-400" },
          { label: "Pending password", value: counts.pending, icon: ShieldAlert, color: "text-warning" },
        ].map((s) => (
          <div key={s.label} className="glass-card rounded-xl p-4 flex items-center gap-3">
            <div className={`h-10 w-10 rounded-lg bg-muted/40 flex items-center justify-center ${s.color}`}>
              <s.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold font-display leading-none">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {customRoles.length === 0 && (
        <div className="glass-card rounded-xl p-4 border border-warning/30 bg-warning/5">
          <p className="text-xs uppercase tracking-wider text-warning font-semibold mb-1">No roles defined</p>
          <p className="text-sm text-muted-foreground">
            Create roles with custom permissions in the <strong>Roles &amp; Permissions</strong> tab below, then assign them to each user.
          </p>
        </div>
      )}

      <Dialog open={!!successUser} onOpenChange={(o) => !o && setSuccessUser(null)}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-success/20 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-success" />
              </div>
              <div>
                <DialogTitle className="font-display">User Created!</DialogTitle>
                <DialogDescription>Share these credentials with the user.</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          {successUser && (
            <div className="space-y-3">
              <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Full name</span>
                  <span className="font-medium">{successUser.fullName}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Email / username</span>
                  <span className="font-medium font-mono text-xs">{successUser.email}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Temp password</span>
                  <span className="font-medium font-mono text-xs">{successUser.password}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                On first login, the user will be required to change this password.
              </p>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => successUser && copyCreds(successUser)}>
              <Copy className="h-4 w-4 mr-1" /> Copy
            </Button>
            <Button onClick={() => setSuccessUser(null)} className="gradient-gold text-primary-foreground">Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* RESET PASSWORD POPUP */}
      <Dialog open={!!resetTarget} onOpenChange={(o) => !o && setResetTarget(null)}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="font-display">Reset Password</DialogTitle>
            <DialogDescription>
              For security, Firebase requires the user to set their own password via a secure email link. Choose how to reset:
            </DialogDescription>
          </DialogHeader>
          {resetTarget && (
            <div className="space-y-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
                <p className="font-medium">{resetTarget.fullName}</p>
                <p className="text-xs text-muted-foreground font-mono">{resetTarget.email}</p>
              </div>
              <Button onClick={() => handleSendResetEmail(resetTarget.email)} className="w-full" variant="outline">
                <Mail className="h-4 w-4 mr-2" /> Send password reset email
              </Button>
              <Button onClick={() => handleForceTempPassword(resetTarget)} className="w-full gradient-gold text-primary-foreground">
                <KeyRound className="h-4 w-4 mr-2" /> Force change on next login
              </Button>
              <p className="text-[11px] text-muted-foreground text-center">
                Both options are secure: the user sets their own new password.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="roles">Roles & Permissions</TabsTrigger>
        </TabsList>
        <TabsContent value="users" className="space-y-4">
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
                      <TableHead className="w-24 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => {
                      const assignedId = u.customRoleId || u.role;
                      const custom = customRoles.find(r => r.id === assignedId);
                      const colorClass = custom ? "bg-accent/20 text-accent-foreground" : "bg-muted text-muted-foreground";
                      return (
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
                          <Select value={assignedId} onValueChange={(v) => handleRoleChange(u.id, v as UserRole)}>
                            <SelectTrigger className={`h-8 w-[160px] text-[11px] border-0 ${colorClass}`}>
                              <SelectValue placeholder="Unassigned" />
                            </SelectTrigger>
                            <SelectContent>
                              {customRoles.filter(r => r.active).length === 0 ? (
                                <div className="px-3 py-2 text-xs text-muted-foreground">Create a role first</div>
                              ) : customRoles.filter(r => r.active).map(r => (
                                <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                              ))}
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
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-muted" title="Edit user" onClick={() => openEdit(u)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-primary hover:bg-primary/10" title="Reset password" onClick={() => setResetTarget(u)}>
                              <KeyRound className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" title="Remove user" onClick={() => handleDelete(u.id, u.fullName)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </TabsContent>
        <TabsContent value="roles">
          <RolesManager />
        </TabsContent>
      </Tabs>

      {/* EDIT USER */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="font-display">Edit User</DialogTitle>
            <DialogDescription>Update profile details and role. Email cannot be changed.</DialogDescription>
          </DialogHeader>
          {editTarget && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Full name</Label>
                  <Input value={editForm.fullName || ""} onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Username</Label>
                  <Input value={editForm.username || ""} onChange={(e) => setEditForm({ ...editForm, username: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Email (read-only)</Label>
                <Input value={editTarget.email} disabled />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={editForm.phone || ""} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={editForm.role as string} onValueChange={(v) => setEditForm({ ...editForm, role: v as UserRole })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="staff">Staff</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                      {customRoles.filter(r => r.active).map(r => (
                        <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Input value={editForm.address || ""} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
                <Button onClick={handleSaveEdit} disabled={updateMutation.isPending} className="gradient-gold text-primary-foreground">
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UsersPage;
