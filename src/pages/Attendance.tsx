import { useState, useMemo } from "react";
import {
  UserCheck,
  UserX,
  Search,
  Filter,
  Download,
  Calendar,
  QrCode,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useMembers,
  useCheckIns,
  useAddCheckIn,
  useCompanySettings,
} from "@/hooks/use-firestore";
import { toast } from "sonner";
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
} from "date-fns";
import { exportTableToCSV } from "@/lib/print-utils";
import { QRCheckInScanner } from "@/components/QRCheckInScanner";
import { consumeForAttendance } from "@/lib/prepaid";
import { formatNPR } from "@/lib/mock-data";
import { logAudit } from "@/lib/audit-log";
import { toIsoDayInTz, formatInTz, getAppTimezone } from "@/lib/tz";

const Attendance = () => {
  const { data: members = [], isLoading: membersLoading } = useMembers();
  const { data: checkIns = [], isLoading: checkInsLoading } = useCheckIns();
  const { data: settings = {} } = useCompanySettings();
  const addCheckInMutation = useAddCheckIn();

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<
    "all" | "present" | "absent"
  >("all");
  const [filterMonth, setFilterMonth] = useState(format(new Date(), "yyyy-MM"));
  const [filterMember, setFilterMember] = useState("all");
  const [scanOpen, setScanOpen] = useState(false);

  const isLoading = membersLoading || checkInsLoading;

  // Anchor "today" to the configured app timezone so the check-in row maps to
  // the correct calendar day regardless of the operator's browser timezone.
  const todayStr = toIsoDayInTz(new Date());

  // Who checked in today
  const todayCheckIns = useMemo(() => {
    return checkIns.filter((c) => c.date === todayStr);
  }, [checkIns, todayStr]);

  const todayCheckedInIds = useMemo(
    () => new Set(todayCheckIns.map((c) => c.memberId)),
    [todayCheckIns],
  );

  // Active members only
  const activeMembers = useMemo(
    () =>
      members.filter((m) => m.status === "Active" || m.status === "Expiring"),
    [members],
  );

  // Filtered for mark attendance view
  const filteredMembers = useMemo(() => {
    let list = activeMembers;
    if (search)
      list = list.filter((m) =>
        m.name.toLowerCase().includes(search.toLowerCase()),
      );
    if (filterStatus === "present")
      list = list.filter((m) => todayCheckedInIds.has(m.id));
    if (filterStatus === "absent")
      list = list.filter((m) => !todayCheckedInIds.has(m.id));
    return list;
  }, [activeMembers, search, filterStatus, todayCheckedInIds]);

  const handleCheckIn = async (memberId: string, memberName: string) => {
    if (todayCheckedInIds.has(memberId)) {
      toast.info(`${memberName} is already checked in today`);
      return;
    }
    try {
      const attendanceId = await addCheckInMutation.mutateAsync({
        memberId,
        memberName,
        date: todayStr,
      });
      // ⚡ AUDIT LOG INSERTION
      await logAudit({
        module: "attendance",
        entityType: "attendance",
        action: "marke",
        entityId: String(attendanceId || memberId),
        outletId: "No Outlet", // Attendance maps globally or inherits from active database sessions
        newValue: {
          memberId,
          memberName,
          date: todayStr,
        },
      });
      toast.success(`${memberName} checked in!`);
      // Prepaid membership: deduct the daily rate if an active pool exists.
      try {
        const used = await consumeForAttendance({
          memberId,
          memberName,
          attendanceId: String(attendanceId || ""),
          day: todayStr,
        });
        if (used) {
          toast.success(
            `Deducted ${formatNPR(used.consumed)} from prepaid balance · Remaining ${formatNPR(used.remaining)}`,
          );
        }
      } catch {
        /* prepaid is best-effort; never block attendance */
      }
    } catch {
      toast.error("Failed to record check-in");
    }
  };

  // Resolve a scanned QR payload to a member. Accepts a member id or admission code.
  const handleScanned = (code: string) => {
    const member = members.find(
      (m) =>
        m.id === code ||
        (m as any).admissionNo === code ||
        (m as any).code === code,
    );
    if (!member) {
      toast.error(`No member matched QR: ${code}`);
      return;
    }
    handleCheckIn(member.id, member.name);
  };

  // Report data
  const reportMonth = useMemo(() => {
    const [y, m] = filterMonth.split("-").map(Number);
    const start = startOfMonth(new Date(y, m - 1));
    const end = endOfMonth(start);
    return { start, end, days: eachDayOfInterval({ start, end }) };
  }, [filterMonth]);

  const reportData = useMemo(() => {
    const membersToShow =
      filterMember === "all"
        ? activeMembers
        : activeMembers.filter((m) => m.id === filterMember);
    return membersToShow.map((m) => {
      const memberCheckIns = checkIns.filter(
        (c) =>
          c.memberId === m.id &&
          c.date >= format(reportMonth.start, "yyyy-MM-dd") &&
          c.date <= format(reportMonth.end, "yyyy-MM-dd"),
      );
      const presentDays = memberCheckIns.length;
      const totalDays = reportMonth.days.length;
      const absentDays = totalDays - presentDays;
      const rate =
        totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;
      return {
        member: m,
        presentDays,
        absentDays,
        totalDays,
        rate,
        checkInDates: new Set(memberCheckIns.map((c) => c.date)),
      };
    });
  }, [activeMembers, checkIns, filterMember, reportMonth]);

  const handleExportReport = () => {
    const headers = [
      "Member",
      "Present Days",
      "Absent Days",
      "Total Days",
      "Attendance %",
    ];
    const rows = reportData.map((r) => [
      r.member.name,
      String(r.presentDays),
      String(r.absentDays),
      String(r.totalDays),
      `${r.rate}%`,
    ]);
    const memberFilterLabel =
      filterMember === "all"
        ? "All Members"
        : activeMembers.find((m) => m.id === filterMember)?.name ||
          filterMember;
    exportTableToCSV(headers, rows, `attendance-${filterMonth}.csv`, {
      propertyName: settings.companyName || ".............",
      reportTitle: "Attendance Report",
      dateRange: format(reportMonth.start, "MMMM yyyy"),
      filters: {
        Month: filterMonth,
        Member: memberFilterLabel,
        "Total Records": String(reportData.length),
      },
    });
    toast.success("Attendance report exported!");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display">Attendance</h1>
          <p className="text-muted-foreground text-sm">
            {todayCheckIns.length} present today •{" "}
            {activeMembers.length - todayCheckIns.length} absent
          </p>
        </div>
        <Button
          onClick={() => setScanOpen(true)}
          className="gradient-gold text-primary-foreground"
        >
          <QrCode className="h-4 w-4 mr-2" /> Scan QR Check-in
        </Button>
      </div>

      <QRCheckInScanner
        open={scanOpen}
        onOpenChange={setScanOpen}
        onDetected={handleScanned}
      />

      <Tabs defaultValue="checkin" className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="checkin">
            <UserCheck className="h-3.5 w-3.5 mr-1" />
            Mark Attendance
          </TabsTrigger>
          <TabsTrigger value="report">
            <Calendar className="h-3.5 w-3.5 mr-1" />
            Attendance Report
          </TabsTrigger>
        </TabsList>

        <TabsContent value="checkin">
          {/* Filter bar — styled like the reference image */}
          <div className="glass-card rounded-xl p-4 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search members..."
                className="pl-9 bg-muted/50 border-0"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select
              value={filterStatus}
              onValueChange={(v) => setFilterStatus(v as any)}
            >
              <SelectTrigger className="w-[140px] bg-muted/50 border-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Members</SelectItem>
                <SelectItem value="present">Present</SelectItem>
                <SelectItem value="absent">Absent</SelectItem>
              </SelectContent>
            </Select>
            <Badge variant="outline" className="text-xs py-1.5 px-3">
              Today: {format(new Date(), "dd MMM yyyy")}
            </Badge>
          </div>

          {/* Summary cards */}
          {/* <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
            <div className="glass-card rounded-xl p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-success/20 flex items-center justify-center">
                <UserCheck className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Present</p>
                <p className="text-xl font-bold font-display">{todayCheckIns.length}</p>
              </div>
            </div>
            <div className="glass-card rounded-xl p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-destructive/20 flex items-center justify-center">
                <UserX className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Absent</p>
                <p className="text-xl font-bold font-display">{activeMembers.length - todayCheckIns.length}</p>
              </div>
            </div>
            <div className="glass-card rounded-xl p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <Filter className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Attendance Rate</p>
                <p className="text-xl font-bold font-display">
                  {activeMembers.length > 0 ? Math.round((todayCheckIns.length / activeMembers.length) * 100) : 0}%
                </p>
              </div>
            </div>
          </div> */}

          {/* Members table */}
          <div className="glass-card rounded-xl overflow-hidden mt-4">
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
                    <TableHead className="hidden md:table-cell">
                      Phone
                    </TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead className="hidden lg:table-cell">
                      Time Slot
                    </TableHead>
                    <TableHead className="hidden md:table-cell">
                      Last Check-in
                    </TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMembers.map((m) => {
                    const todayCi = todayCheckIns.find((c) => c.memberId === m.id);
                    const isPresent = !!todayCi;
                    const lastCi = [...checkIns]
                      .filter((c) => c.memberId === m.id)
                      .sort((a, b) => (a.date < b.date ? 1 : -1))[0];
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium text-sm">
                          {m.name}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                          {m.phone}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[10px]">
                            {m.tier}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                          {m.timeSlot}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                          {lastCi?.date ? `${lastCi.date}${lastCi.checkInTime ? " · " + lastCi.checkInTime : ""}` : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={`text-[10px] border-0 ${isPresent ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"}`}
                          >
                            {isPresent
                              ? todayCi?.checkInTime
                                ? `Present · ${todayCi.checkInTime}`
                                : "Present"
                              : "Absent"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant={isPresent ? "secondary" : "default"}
                            disabled={isPresent || addCheckInMutation.isPending}
                            onClick={() => handleCheckIn(m.id, m.name)}
                            className={
                              isPresent
                                ? ""
                                : "gradient-gold text-primary-foreground"
                            }
                          >
                            {isPresent ? "Checked In ✓" : "Check In"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="report">
          {/* Report filter bar */}
          <div className="glass-card rounded-xl p-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-muted-foreground">
                Month:
              </label>
              <Input
                type="month"
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                className="w-[180px] bg-muted/50 border-0"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-muted-foreground">
                Member:
              </label>
              <Select value={filterMember} onValueChange={setFilterMember}>
                <SelectTrigger className="w-[200px] bg-muted/50 border-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Members</SelectItem>
                  {activeMembers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="ml-auto"
              onClick={handleExportReport}
            >
              <Download className="h-4 w-4 mr-1" />
              Export Report
            </Button>
          </div>

          {/* Report table */}
          <div className="glass-card rounded-xl overflow-hidden mt-4">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Member</TableHead>
                  <TableHead className="text-center">Present</TableHead>
                  <TableHead className="text-center">Absent</TableHead>
                  <TableHead className="text-center">Total Days</TableHead>
                  <TableHead className="text-center">Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportData.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-muted-foreground py-8"
                    >
                      No data
                    </TableCell>
                  </TableRow>
                ) : (
                  reportData.map((r) => (
                    <TableRow key={r.member.id}>
                      <TableCell className="font-medium text-sm">
                        {r.member.name}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-success/20 text-white border-0 text-[10px]">
                          {r.presentDays}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-destructive/20 text-white border-0 text-[10px]">
                          {r.absentDays}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        {r.totalDays}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${r.rate >= 75 ? "text-white border-success/30" : r.rate >= 50 ? "text-white border-warning/30" : "text-white border-destructive/30"}`}
                        >
                          {r.rate}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Attendance;
