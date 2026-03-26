import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Plus, Filter, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TierBadge } from "@/components/TierBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { members, type MemberTier, type MemberStatus, type ServiceType } from "@/lib/mock-data";
import { toast } from "sonner";

const MembersList = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const perPage = 10;

  const filtered = useMemo(() => {
    return members.filter((m) => {
      const matchSearch = m.name.toLowerCase().includes(search.toLowerCase()) || m.email.toLowerCase().includes(search.toLowerCase()) || m.phone.includes(search);
      const matchTier = tierFilter === "all" || m.tier === tierFilter;
      const matchStatus = statusFilter === "all" || m.status === statusFilter;
      const matchService = serviceFilter === "all" || m.services.includes(serviceFilter as ServiceType);
      return matchSearch && matchTier && matchStatus && matchService;
    });
  }, [search, tierFilter, statusFilter, serviceFilter]);

  const paginated = filtered.slice((page - 1) * perPage, page * perPage);
  const totalPages = Math.ceil(filtered.length / perPage);

  const handleExport = () => {
    toast.success("Member list exported as CSV");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display">Members</h1>
          <p className="text-muted-foreground text-sm">{filtered.length} members found</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}><Download className="h-4 w-4 mr-1" />Export</Button>
          <Button size="sm" onClick={() => navigate("/members/new")}><Plus className="h-4 w-4 mr-1" />Add Member</Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name, email, phone..." className="pl-9 bg-muted/50 border-0" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <Select value={tierFilter} onValueChange={(v) => { setTierFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[140px] bg-muted/50 border-0"><SelectValue placeholder="Tier" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tiers</SelectItem>
            <SelectItem value="Basic">Basic</SelectItem>
            <SelectItem value="Silver">Silver</SelectItem>
            <SelectItem value="Gold">Gold</SelectItem>
            <SelectItem value="Platinum">Platinum</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[140px] bg-muted/50 border-0"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Expired">Expired</SelectItem>
            <SelectItem value="Expiring">Expiring</SelectItem>
          </SelectContent>
        </Select>
        <Select value={serviceFilter} onValueChange={(v) => { setServiceFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[140px] bg-muted/50 border-0"><SelectValue placeholder="Service" /></SelectTrigger>
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
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Member</TableHead>
              <TableHead className="hidden md:table-cell">Phone</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead className="hidden lg:table-cell">Services</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Expiry</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.map((m) => (
              <TableRow key={m.id} className="cursor-pointer" onClick={() => navigate(`/members/${m.id}`)}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={m.avatar} alt={m.name} />
                      <AvatarFallback className="text-xs">{m.name.split(" ").map((n) => n[0]).join("")}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-sm">{m.name}</p>
                      <p className="text-xs text-muted-foreground">{m.email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{m.phone}</TableCell>
                <TableCell><TierBadge tier={m.tier} /></TableCell>
                <TableCell className="hidden lg:table-cell">
                  <div className="flex gap-1 flex-wrap">{m.services.map((s) => <span key={s} className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full">{s}</span>)}</div>
                </TableCell>
                <TableCell><StatusBadge status={m.status} /></TableCell>
                <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{m.expiryDate}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Page {page} of {totalPages}</p>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MembersList;
