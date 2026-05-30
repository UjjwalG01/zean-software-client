import { useState } from "react";
import { Plus, Pencil, Trash2, Save, ShieldCheck, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCustomRoles, useSaveCustomRole, useDeleteCustomRole } from "@/hooks/use-permissions";
import type { CustomRole, RolePermissions, RoleRights } from "@/lib/firebase-roles";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const PAGE_GROUPS: { group: string; pages: { key: string; label: string }[] }[] = [
  {
    group: "MAIN",
    pages: [
      { key: "dashboard", label: "Dashboard" },
      { key: "members", label: "Members" },
      { key: "bookings", label: "Bookings" },
      { key: "attendance", label: "Attendance" },
      { key: "transactions", label: "Transactions" },
      { key: "inventory", label: "Inventory" },
      { key: "reports", label: "Reports" },
      { key: "forecast", label: "Forecast" },
    ],
  },
  {
    group: "SETUP",
    pages: [
      { key: "general", label: "General Setup" },
      { key: "outlets", label: "Outlets" },
      { key: "service-types", label: "Service Types" },
      { key: "plans", label: "Plans & Services" },
      { key: "stores", label: "Stores" },
      { key: "item-groups", label: "Item Groups" },
      { key: "charge-heads", label: "Charge Heads" },
      { key: "users", label: "Users & Roles" },
      { key: "email-templates", label: "Email Templates" },
      { key: "settings", label: "Settings" },
    ],
  },
];

const RIGHTS: (keyof RoleRights)[] = ["view", "add", "change", "trash"];
const RIGHT_LABELS: Record<keyof RoleRights, string> = { view: "VIEW", add: "ADD", change: "CHANGE", trash: "TRASH" };

function emptyPerms(): RolePermissions {
  const p: RolePermissions = {};
  PAGE_GROUPS.forEach((g) => g.pages.forEach((page) => { p[page.key] = { view: false, add: false, change: false, trash: false }; }));
  return p;
}

/** Back-compat shim so older imports keep working. */
export function useRoleDefinitions() {
  const { data: roles = [], isLoading } = useCustomRoles();
  return { roles, isLoaded: !isLoading };
}

export function RolesManager() {
  const { data: roles = [] } = useCustomRoles();
  const saveMutation = useSaveCustomRole();
  const deleteMutation = useDeleteCustomRole();
  const [editing, setEditing] = useState<CustomRole | null>(null);
  const [activeGroup, setActiveGroup] = useState(PAGE_GROUPS[0].group);

  const startNew = () => setEditing({
    id: undefined as any, name: "", description: "", isAdmin: false, active: true, permissions: emptyPerms(),
  } as any);
  const startEdit = (r: CustomRole) => setEditing({ ...r, permissions: { ...emptyPerms(), ...r.permissions } });

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.name.trim()) { toast.error("Role name is required"); return; }
    try { await saveMutation.mutateAsync(editing); toast.success("Role saved"); setEditing(null); }
    catch (e: any) { toast.error(e.message || "Failed to save role"); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this role? Users assigned to it will lose access.")) return;
    try { await deleteMutation.mutateAsync(id); toast.success("Role deleted"); }
    catch (e: any) { toast.error(e.message || "Failed to delete"); }
  };

  if (!editing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold font-display flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Custom Roles</h3>
            <p className="text-xs text-muted-foreground">Define what each role can see and do across the app. Saved to database.</p>
          </div>
          <Button size="sm" onClick={startNew}><Plus className="h-4 w-4 mr-1" />New Role</Button>
        </div>

        {roles.length === 0 ? (
          <div className="glass-card rounded-xl p-10 text-center text-sm text-muted-foreground">
            No custom roles yet. Click <span className="text-foreground font-medium">New Role</span> to create one.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {roles.map((r) => {
              const total = r.isAdmin ? "All" : Object.values(r.permissions || {}).reduce((s, p) => s + RIGHTS.filter((k) => p[k]).length, 0);
              return (
                <div key={r.id} className="glass-card rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold flex items-center gap-2">{r.name}{r.isAdmin && <Badge className="bg-primary/20 text-primary text-[10px]">Admin</Badge>}</p>
                    <Badge variant={r.active ? "default" : "secondary"} className="text-[10px]">{r.active ? "Active" : "Inactive"}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{total} permissions granted</p>
                  <div className="flex gap-1 pt-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => startEdit(r)}><Pencil className="h-3.5 w-3.5 mr-1" />Edit</Button>
                    <Button variant="outline" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleDelete(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const currentGroup = PAGE_GROUPS.find((g) => g.group === activeGroup) || PAGE_GROUPS[0];
  const allRightsForGroup = currentGroup.pages.every((p) => RIGHTS.every((k) => editing.permissions[p.key]?.[k]));

  const toggleAllForGroup = () => {
    const setVal = !allRightsForGroup;
    const next = { ...editing.permissions };
    currentGroup.pages.forEach((p) => { next[p.key] = { view: setVal, add: setVal, change: setVal, trash: setVal }; });
    setEditing({ ...editing, permissions: next });
  };

  const togglePageRight = (pageKey: string, right: keyof RoleRights) => {
    const next = { ...editing.permissions };
    next[pageKey] = { ...next[pageKey], [right]: !next[pageKey]?.[right] };
    setEditing({ ...editing, permissions: next });
  };

  const togglePageAll = (pageKey: string) => {
    const next = { ...editing.permissions };
    const all = RIGHTS.every((k) => next[pageKey]?.[k]);
    next[pageKey] = { view: !all, add: !all, change: !all, trash: !all };
    setEditing({ ...editing, permissions: next });
  };

  return (
    <div className="space-y-4">
      <div className="glass-card rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-sm">Role Details</h4>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing(null)}><X className="h-4 w-4" /></Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label>Role Name *</Label>
            <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Front Desk" />
          </div>
          <div className="space-y-2">
            <Label>Active</Label>
            <Select value={editing.active ? "yes" : "no"} onValueChange={(v) => setEditing({ ...editing, active: v === "yes" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">YES</SelectItem>
                <SelectItem value="no">NO</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Wildcard Admin</Label>
            <Select value={editing.isAdmin ? "yes" : "no"} onValueChange={(v) => setEditing({ ...editing, isAdmin: v === "yes" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="no">NO — use page checkboxes</SelectItem>
                <SelectItem value="yes">YES — full access</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        <div className="flex flex-col lg:flex-row">
          <div className="lg:w-48 border-b lg:border-b-0 lg:border-r border-border bg-muted/20">
            {PAGE_GROUPS.map((g) => (
              <button
                key={g.group}
                onClick={() => setActiveGroup(g.group)}
                className={cn(
                  "block w-full text-left px-4 py-3 text-sm transition-colors",
                  activeGroup === g.group ? "bg-primary/10 text-primary border-l-2 border-primary" : "hover:bg-muted/40 text-muted-foreground"
                )}
              >
                {g.group}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 border-b border-border">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-xs uppercase tracking-wider text-muted-foreground">Menu</th>
                  {RIGHTS.map((r) => (
                    <th key={r} className="px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">{RIGHT_LABELS[r]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border bg-muted/10">
                  <td className="px-4 py-2.5 font-medium flex items-center gap-2">
                    <Checkbox checked={allRightsForGroup} onCheckedChange={toggleAllForGroup} />
                    <span className="text-xs uppercase tracking-wider">Select All</span>
                  </td>
                  <td colSpan={4}></td>
                </tr>
                {currentGroup.pages.map((p) => {
                  const rights = editing.permissions[p.key] || { view: false, add: false, change: false, trash: false };
                  const allOn = RIGHTS.every((k) => rights[k]);
                  return (
                    <tr key={p.key} className="border-b border-border/50 hover:bg-muted/20">
                      <td className="px-4 py-2.5">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <Checkbox checked={allOn} onCheckedChange={() => togglePageAll(p.key)} />
                          <span>{p.label}</span>
                        </label>
                      </td>
                      {RIGHTS.map((r) => (
                        <td key={r} className="px-4 py-2.5 text-center">
                          <label className="inline-flex items-center gap-1.5 cursor-pointer">
                            <Checkbox checked={rights[r]} onCheckedChange={() => togglePageRight(p.key, r)} />
                            <span className="text-[10px] text-muted-foreground uppercase">{RIGHT_LABELS[r]}</span>
                          </label>
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
        <Button onClick={handleSave} disabled={saveMutation.isPending} className="gradient-gold text-primary-foreground">
          {saveMutation.isPending ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Saving...</> : <><Save className="h-4 w-4 mr-1" />Save Role</>}
        </Button>
      </div>
    </div>
  );
}
