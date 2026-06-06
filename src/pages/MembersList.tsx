import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Plus, Download, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TierBadge } from "@/components/TierBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { useMembers, useCompanySettings } from "@/hooks/use-firestore";
import { exportTableToCSV } from "@/lib/print-utils";
import type { ServiceType } from "@/lib/mock-data";
import { toast } from "sonner";
import { format } from "date-fns";

const MembersList = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("active-set");
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [photoPreview, setPhotoPreview] = useState<{ url: string; name: string } | null>(null);
  const perPage = 10;

  const { data: members = [], isLoading } = useMembers();
  const { data: settings = {} } = useCompanySettings();

  const filtered = useMemo(() => {
    return members.filter((m) => {
      const matchSearch =
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.email.toLowerCase().includes(search.toLowerCase()) ||
        m.phone.includes(search);
      const matchTier = tierFilter === "all" || m.tier === tierFilter;
      // Default ("active-set") excludes Inactive; "all" shows everything; explicit value matches exactly.
      const matchStatus =
        statusFilter === "active-set"
          ? m.status !== "Inactive"
          : statusFilter === "all"
            ? true
            : m.status === statusFilter;
      const matchService = serviceFilter === "all" || m.services.includes(serviceFilter as ServiceType);
      return matchSearch && matchTier && matchStatus && matchService;
    });
  }, [members, search, tierFilter, statusFilter, serviceFilter]);

  const paginated = filtered.slice((page - 1) * perPage, page * perPage);
  const totalPages = Math.ceil(filtered.length / perPage);

  const handleExport = () => {
    const headers = ["Name", "Email", "Phone", "Tier", "Status", "Services", "Plan", "Total Paid", "Due", "Expiry"];
    const rows = filtered.map((m) => [
      m.name,
      m.email,
      m.phone,
      m.tier,
      m.status,
      m.services.join("; "),
      m.plan,
      String(m.totalPaid),
      String(m.dueAmount),
      m.expiryDate,
    ]);
    exportTableToCSV(headers, rows, `members-${format(new Date(), "yyyyMMdd")}.csv`, {
      propertyName: settings.companyName || ".............",
      reportTitle: "Members Report",
      dateRange: format(new Date(), "PPP"),
      filters: {
        Search: search || "—",
        Tier: tierFilter === "all" ? "All" : tierFilter,
        Status: statusFilter === "all" ? "All" : statusFilter,
        Service: serviceFilter === "all" ? "All" : serviceFilter,
        "Total Records": String(filtered.length),
      },
    });
    toast.success(`Exported ${filtered.length} members to CSV`);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display">Members</h1>
          <p className="text-muted-foreground text-sm">{filtered.length} members found</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.open("/members/blank/grc", "_blank")}>
            <FileText className="h-4 w-4 mr-1" />
            Generate Blank GRC
          </Button>
          <Button size="sm" onClick={() => navigate("/members/new")}>
            <Plus className="h-4 w-4 mr-1" />
            Add Member
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, phone..."
            className="pl-9 bg-muted/50 border-0"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Select
          value={tierFilter}
          onValueChange={(v) => {
            setTierFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[140px] bg-muted/50 border-0">
            <SelectValue placeholder="Tier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tiers</SelectItem>
            <SelectItem value="Basic">Basic</SelectItem>
            <SelectItem value="Silver">Silver</SelectItem>
            <SelectItem value="Gold">Gold</SelectItem>
            <SelectItem value="Platinum">Platinum</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[170px] bg-muted/50 border-0">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active-set">Active + Expiring + Expired</SelectItem>
            <SelectItem value="all">All (incl. Inactive)</SelectItem>
            <SelectItem value="Active">Active only</SelectItem>
            <SelectItem value="Expired">Expired only</SelectItem>
            <SelectItem value="Expiring">Expiring only</SelectItem>
            <SelectItem value="Inactive">Inactive only</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={serviceFilter}
          onValueChange={(v) => {
            setServiceFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[140px] bg-muted/50 border-0">
            <SelectValue placeholder="Service" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Services</SelectItem>
            <SelectItem value="Gym">Gym</SelectItem>
            <SelectItem value="Spa">Spa</SelectItem>
            <SelectItem value="Sauna">Sauna</SelectItem>
            <SelectItem value="Swimming">Swimming</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="glass-card rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-lg" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Member</TableHead>
                <TableHead className="hidden md:table-cell">Phone</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead className="hidden lg:table-cell">Plan</TableHead>
                <TableHead className="hidden lg:table-cell">Services</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Joined</TableHead>
                <TableHead className="hidden md:table-cell">Expiry</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((m) => (
                <TableRow key={m.id} className="cursor-pointer" onClick={() => navigate(`/members/${m.id}`)}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar
                        className="h-8 w-8 cursor-zoom-in ring-1 ring-transparent hover:ring-primary/60"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (m.avatar) setPhotoPreview({ url: m.avatar, name: m.name });
                        }}
                      >
                        <AvatarImage src={m.avatar} alt={m.name} />
                        <AvatarFallback className="text-xs">
                          {m.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm">{m.name}</p>
                        <p className="text-xs text-muted-foreground">{m.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{m.phone}</TableCell>
                  <TableCell>
                    <TierBadge tier={m.tier} />
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">{m.plan}</TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <div className="flex gap-1 flex-wrap">
                      {m.services.map((s) => (
                        <span key={s} className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full">
                          {s}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={m.status} />
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{m.joinDate}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{m.expiryDate}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}

      <Dialog open={!!photoPreview} onOpenChange={(o) => !o && setPhotoPreview(null)}>
        <DialogContent className="max-w-md p-2">
          {photoPreview && (
            <div className="space-y-2">
              <img
                src={photoPreview.url}
                alt={photoPreview.name}
                className="w-full h-auto rounded-lg object-contain max-h-[70vh]"
              />
              <p className="text-center text-sm font-medium">{photoPreview.name}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MembersList;
