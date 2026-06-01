import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Mail, Phone, MapPin, Calendar, CreditCard, Activity, Edit, Power, Save, X, FileText, TrendingUp, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { TierBadge } from "@/components/TierBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { formatNPR } from "@/lib/mock-data";
import { useMember, useTransactions, useBookings, useUpdateMember, useCompanySettings } from "@/hooks/use-firestore";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MemberProgress } from "@/components/MemberProgress";
import { QuickBalanceModal } from "@/components/QuickBalanceModal";
import { toast } from "sonner";

const MemberProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: member, isLoading } = useMember(id);
  const { data: allTransactions = [] } = useTransactions();
  const { data: allBookings = [] } = useBookings();
  const { data: settings = {} } = useCompanySettings();
  const updateMember = useUpdateMember();

  const [editOpen, setEditOpen] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [quickBalanceOpen, setQuickBalanceOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "", email: "", phone: "", address: "", emergencyContact: "",
  });

  // Preferences tab state — wired to members.preferences (jsonb).
  const [prefsForm, setPrefsForm] = useState({
    favoriteActivities: "" as string,
    communicationChannel: "Email",
    language: "English",
    marketingOptIn: false,
    trainerPref: "",
    dietaryNotes: "",
  });

  useEffect(() => {
    if (member) {
      const p: any = (member as any).preferences;
      const list: string[] = Array.isArray(p) ? p : Array.isArray(p?.favoriteActivities) ? p.favoriteActivities : member.preferences || [];
      setPrefsForm({
        favoriteActivities: list.join(", "),
        communicationChannel: p?.communicationChannel || "Email",
        language: p?.language || "English",
        marketingOptIn: !!p?.marketingOptIn,
        trainerPref: p?.trainerPref || "",
        dietaryNotes: p?.dietaryNotes || "",
      });
    }
  }, [member]);

  const handleSavePreferences = async () => {
    if (!id) return;
    try {
      await updateMember.mutateAsync({
        id,
        data: {
          preferences: prefsForm.favoriteActivities.split(",").map((s) => s.trim()).filter(Boolean),
          // Extra fields kept under preferences jsonb via firebase-services pass-through.
          ...({
            preferencesMeta: {
              communicationChannel: prefsForm.communicationChannel,
              language: prefsForm.language,
              marketingOptIn: prefsForm.marketingOptIn,
              trainerPref: prefsForm.trainerPref,
              dietaryNotes: prefsForm.dietaryNotes,
            },
          } as any),
        } as any,
      });
      toast.success("Preferences saved");
    } catch {
      toast.error("Failed to save preferences");
    }
  };

  useEffect(() => {
    if (member) {
      setEditForm({
        name: member.name, email: member.email, phone: member.phone,
        address: member.address, emergencyContact: member.emergencyContact,
      });
    }
  }, [member]);

  const handleSaveEdit = async () => {
    if (!id) return;
    if (!editForm.name.trim() || !editForm.email.trim() || !editForm.phone.trim()) {
      toast.error("Name, email and phone are required");
      return;
    }
    const [firstName, ...rest] = editForm.name.trim().split(" ");
    try {
      await updateMember.mutateAsync({
        id,
        data: {
          firstName,
          lastName: rest.join(" "),
          email: editForm.email,
          phone: editForm.phone,
          address: editForm.address,
          emergencyContactNum: editForm.emergencyContact,
        },
      });
      toast.success("Member profile updated");
      setEditOpen(false);
    } catch { toast.error("Failed to update member"); }
  };

  const handleToggleActive = async () => {
    if (!id || !member) return;
    // Deactivation switches to Inactive (hidden by default in lists);
    // reactivation restores Active so member appears again.
    const next = member.status === "Inactive" ? "Active" : "Inactive";
    try {
      await updateMember.mutateAsync({ id, data: { status: next } });
      toast.success(next === "Active" ? "Member reactivated" : "Member deactivated");
      setDeactivateOpen(false);
    } catch { toast.error("Failed to update status"); }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-40 rounded-xl" />
        <div className="grid grid-cols-5 gap-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}</div>
      </div>
    );
  }

  if (!member) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-muted-foreground">Member not found</p>
        <Button variant="ghost" className="mt-4" onClick={() => navigate("/members")}>Back to Members</Button>
      </div>
    );
  }

  const memberTx = allTransactions.filter((t) => t.memberId === member.id);
  const memberBookings = allBookings.filter((b) => b.memberId === member.id);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate("/members")} className="text-muted-foreground">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Members
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(`/members/${id}/grc`)}>
            <FileText className="h-4 w-4 mr-1" /> Generate GRC
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate(`/members/new?edit=${id}`)}>
            <Edit className="h-4 w-4 mr-1" /> Edit
          </Button>
          <Button
            variant={member.status === "Active" ? "destructive" : "default"}
            size="sm"
            onClick={() => setDeactivateOpen(true)}
          >
            <Power className="h-4 w-4 mr-1" />
            {member.status === "Active" ? "Deactivate" : "Reactivate"}
          </Button>
        </div>
      </div>

      {/* Header Card */}
      <div className="glass-card rounded-xl p-6">
        <div className="flex flex-col sm:flex-row gap-6">
          <Avatar className="h-20 w-20 ring-2 ring-primary/30 ring-offset-2 ring-offset-background">
            <AvatarImage src={member.avatar} alt={member.name} />
            <AvatarFallback className="text-xl">{member.name.split(" ").map((n) => n[0]).join("")}</AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold font-display">{member.name}</h1>
              <TierBadge tier={member.tier} />
              <StatusBadge status={member.status} />
              {member.autoRenew && <Badge variant="outline" className="text-[10px] text-success border-success/30">Auto-Renew</Badge>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" />{member.email}</span>
              <span className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" />{member.phone}</span>
              <span className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" />{(() => { const a: any = (member as any).address; if (!a) return (member as any).permanentAddress || ""; if (typeof a === "string") return a; return a.permanent || a.temporary || ""; })()}</span>
              <span className="flex items-center gap-2"><Calendar className="h-3.5 w-3.5" />Joined {member.joinDate}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {member.services.map((s) => <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>)}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: "Plan", value: member.plan },
          { label: "Years", value: `${member.membershipYears} yrs` },
          { label: "Discount", value: `${member.discount}%` },
          { label: "Total Paid", value: formatNPR(member.totalPaid) },
          { label: "Due", value: formatNPR(member.dueAmount) },
        ].map((s) => (
          <div key={s.label} className="glass-card rounded-lg p-4 text-center">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-lg font-bold font-display mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="progress" className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="progress"><TrendingUp className="h-3.5 w-3.5 mr-1" />Progress</TabsTrigger>
          <TabsTrigger value="payments"><CreditCard className="h-3.5 w-3.5 mr-1" />Payments</TabsTrigger>
          <TabsTrigger value="bookings"><Calendar className="h-3.5 w-3.5 mr-1" />Bookings</TabsTrigger>
          <TabsTrigger value="preferences"><Activity className="h-3.5 w-3.5 mr-1" />Preferences</TabsTrigger>
        </TabsList>

        <TabsContent value="progress">
          <MemberProgress member={member} bookings={memberBookings} transactions={memberTx} propertyName={settings.companyName} />
        </TabsContent>


        <TabsContent value="payments">
          <div className="glass-card rounded-xl overflow-hidden">
            {memberTx.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No payment records</p>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead>Method</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                <TableBody>
                  {memberTx.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="text-sm">{t.date}</TableCell>
                      <TableCell className="text-sm">{t.description}</TableCell>
                      <TableCell><Badge variant="secondary" className="text-[10px]">{t.method}</Badge></TableCell>
                      <TableCell className="text-right font-medium text-sm">{formatNPR(t.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="bookings">
          <div className="glass-card rounded-xl overflow-hidden">
            {memberBookings.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No bookings</p>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Class</TableHead><TableHead>Service</TableHead><TableHead>Time</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {memberBookings.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="text-sm">{b.date}</TableCell>
                      <TableCell className="text-sm font-medium">{b.className}</TableCell>
                      <TableCell><Badge variant="secondary" className="text-[10px]">{b.service}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{b.startTime}–{b.endTime}</TableCell>
                      <TableCell><Badge variant={b.status === "Confirmed" ? "default" : "secondary"} className="text-[10px]">{b.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="preferences">
          <div className="glass-card rounded-xl p-6">
            <h3 className="font-semibold mb-3">Favorite Activities</h3>
            <div className="flex flex-wrap gap-2">
              {member.preferences.map((p) => <Badge key={p} variant="outline" className="text-sm">{p}</Badge>)}
            </div>
            <h3 className="font-semibold mt-6 mb-3">Emergency Contact</h3>
            <p className="text-sm text-muted-foreground">{member.emergencyContact}</p>
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Member Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Edit className="h-4 w-4 text-primary" /> Edit Member
            </DialogTitle>
            <DialogDescription>Update the member's contact details.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1.5">
              <Label>Full Name</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={editForm.email} onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={editForm.phone} onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Address</Label>
              <Input value={editForm.address} onChange={(e) => setEditForm((p) => ({ ...p, address: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Emergency Contact</Label>
              <Input value={editForm.emergencyContact} onChange={(e) => setEditForm((p) => ({ ...p, emergencyContact: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}><X className="h-4 w-4 mr-1" />Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={updateMember.isPending} className="gradient-gold text-primary-foreground">
              <Save className="h-4 w-4 mr-1" />
              {updateMember.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate Confirm Dialog */}
      <Dialog open={deactivateOpen} onOpenChange={setDeactivateOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Power className="h-4 w-4 text-destructive" />
              {member.status === "Active" ? "Deactivate Member?" : "Reactivate Member?"}
            </DialogTitle>
            <DialogDescription>
              {member.status === "Active"
                ? `${member.name} will lose access until reactivated. Bookings & payment history are preserved.`
                : `${member.name} will regain Active status.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivateOpen(false)}>Cancel</Button>
            <Button
              variant={member.status === "Active" ? "destructive" : "default"}
              onClick={handleToggleActive}
              disabled={updateMember.isPending}
            >
              {updateMember.isPending ? "Updating..." : member.status === "Active" ? "Deactivate" : "Reactivate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MemberProfile;
