import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { format, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from "date-fns";
import { Calendar as CalendarIcon, Clock, Plus, Check, X, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { DashboardLanguage } from "@/lib/dashboardTranslations";
import { handleError } from "@/lib/errorHandler";

interface AdminShiftManagementProps {
  userId: string;
  language: DashboardLanguage;
}

const SHIFT_ROLES = ["accountant", "operations_manager", "reviews_admin", "hr_manager", "office_staff"];

const AdminShiftManagement = ({ userId, language }: AdminShiftManagementProps) => {
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [shifts, setShifts] = useState<any[]>([]);
  const [dayOffRequests, setDayOffRequests] = useState<any[]>([]);
  const [clockEntries, setClockEntries] = useState<any[]>([]);
  const [activeBreaks, setActiveBreaks] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<"day" | "week" | "month">("week");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  // New shift form
  const [newShiftEmployee, setNewShiftEmployee] = useState("");
  const [newShiftDate, setNewShiftDate] = useState<Date | undefined>();
  const [newShiftStart, setNewShiftStart] = useState("09:00");
  const [newShiftEnd, setNewShiftEnd] = useState("17:00");
  const [newShiftDateOpen, setNewShiftDateOpen] = useState(false);
  const [addingShift, setAddingShift] = useState(false);

  // Bulk shift
  const [bulkEmployee, setBulkEmployee] = useState("");
  const [bulkStartDate, setBulkStartDate] = useState<Date | undefined>();
  const [bulkEndDate, setBulkEndDate] = useState<Date | undefined>();
  const [bulkStartTime, setBulkStartTime] = useState("09:00");
  const [bulkEndTime, setBulkEndTime] = useState("17:00");
  const [bulkStartOpen, setBulkStartOpen] = useState(false);
  const [bulkEndOpen, setBulkEndOpen] = useState(false);
  const [addingBulk, setAddingBulk] = useState(false);

  // Day off decline
  const [declineReason, setDeclineReason] = useState("");

  useEffect(() => { fetchEmployees(); }, []);
  useEffect(() => { fetchShifts(); fetchClockEntries(); fetchDayOffRequests(); }, [selectedDate, viewMode]);

  const fetchEmployees = async () => {
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("role", SHIFT_ROLES as any);

    if (!roles || roles.length === 0) { setEmployees([]); return; }

    const userIds = [...new Set(roles.map(r => r.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, email")
      .in("id", userIds);

    const enriched = (profiles || []).map(p => ({
      ...p,
      roles: roles.filter(r => r.user_id === p.id).map(r => r.role),
    }));
    setEmployees(enriched);
  };

  const getDateRange = () => {
    if (viewMode === "day") return { start: selectedDate, end: selectedDate };
    if (viewMode === "week") return { start: startOfWeek(selectedDate, { weekStartsOn: 1 }), end: endOfWeek(selectedDate, { weekStartsOn: 1 }) };
    return { start: startOfMonth(selectedDate), end: endOfMonth(selectedDate) };
  };

  const fetchShifts = async () => {
    const { start, end } = getDateRange();
    const { data } = await supabase
      .from("shifts")
      .select("*")
      .gte("shift_date", format(start, "yyyy-MM-dd"))
      .lte("shift_date", format(end, "yyyy-MM-dd"))
      .order("shift_date")
      .order("start_time");
    setShifts(data || []);
  };

  const fetchClockEntries = async () => {
    const { start, end } = getDateRange();
    const { data } = await supabase
      .from("shift_clock_entries")
      .select("*")
      .gte("clock_in", start.toISOString())
      .lte("clock_in", addDays(end, 1).toISOString())
      .order("clock_in", { ascending: false });
    setClockEntries(data || []);

    // Fetch active breaks for currently clocked-in entries
    const activeIds = (data || []).filter(e => !e.clock_out).map(e => e.id);
    if (activeIds.length > 0) {
      const { data: breaks } = await supabase
        .from("shift_breaks")
        .select("clock_entry_id")
        .in("clock_entry_id", activeIds)
        .is("break_end", null);
      const breakMap: Record<string, boolean> = {};
      (breaks || []).forEach(b => { breakMap[b.clock_entry_id] = true; });
      setActiveBreaks(breakMap);
    } else {
      setActiveBreaks({});
    }
  };

  const fetchDayOffRequests = async () => {
    const { data } = await supabase
      .from("day_off_requests")
      .select("*")
      .eq("request_type", "staff")
      .order("created_at", { ascending: false });
    setDayOffRequests(data || []);
  };

  const handleAddShift = async () => {
    if (!newShiftEmployee || !newShiftDate) return;
    setAddingShift(true);
    try {
      const { error } = await supabase.from("shifts").insert({
        user_id: newShiftEmployee,
        shift_date: format(newShiftDate, "yyyy-MM-dd"),
        start_time: newShiftStart,
        end_time: newShiftEnd,
        created_by: userId,
      });
      if (error) throw error;

      // Send notification
      const emp = employees.find(e => e.id === newShiftEmployee);
      try {
        await supabase.functions.invoke("send-shift-notification", {
          body: {
            type: "shift_assigned",
            userEmail: emp?.email,
            userName: emp ? `${emp.first_name} ${emp.last_name}` : "",
            shiftDate: format(newShiftDate, "PPP"),
            shiftTime: `${newShiftStart} - ${newShiftEnd}`,
          },
        });
      } catch { /* non-critical */ }

      toast.success("Shift added");
      setNewShiftDate(undefined);
      fetchShifts();
    } catch (e: any) { toast.error(handleError(e)); }
    finally { setAddingShift(false); }
  };

  const handleAddBulkShifts = async () => {
    if (!bulkEmployee || !bulkStartDate || !bulkEndDate) return;
    setAddingBulk(true);
    try {
      const days = eachDayOfInterval({ start: bulkStartDate, end: bulkEndDate })
        .filter(d => d.getDay() !== 0 && d.getDay() !== 6); // Exclude weekends

      const shiftsToInsert = days.map(d => ({
        user_id: bulkEmployee,
        shift_date: format(d, "yyyy-MM-dd"),
        start_time: bulkStartTime,
        end_time: bulkEndTime,
        created_by: userId,
      }));

      const { error } = await supabase.from("shifts").insert(shiftsToInsert);
      if (error) throw error;

      // Send notification
      const emp = employees.find(e => e.id === bulkEmployee);
      try {
        await supabase.functions.invoke("send-shift-notification", {
          body: {
            type: "schedule_set",
            userEmail: emp?.email,
            userName: emp ? `${emp.first_name} ${emp.last_name}` : "",
            startDate: format(bulkStartDate, "PPP"),
            endDate: format(bulkEndDate, "PPP"),
            shiftTime: `${bulkStartTime} - ${bulkEndTime}`,
          },
        });
      } catch { /* non-critical */ }

      toast.success(`${shiftsToInsert.length} shifts added`);
      setBulkStartDate(undefined);
      setBulkEndDate(undefined);
      fetchShifts();
    } catch (e: any) { toast.error(handleError(e)); }
    finally { setAddingBulk(false); }
  };

  const handleApproveDayOff = async (requestId: string) => {
    try {
      const req = dayOffRequests.find(r => r.id === requestId);
      const { error } = await supabase
        .from("day_off_requests")
        .update({ status: "approved" as any, reviewed_by: userId, reviewed_at: new Date().toISOString() })
        .eq("id", requestId);
      if (error) throw error;

      // Send notification
      if (req) {
        const emp = employees.find(e => e.id === req.user_id);
        try {
          await supabase.functions.invoke("send-shift-notification", {
            body: {
              type: "day_off_approved",
              userEmail: emp?.email,
              userName: req.user_name,
              startDate: req.start_date,
              endDate: req.end_date,
            },
          });
        } catch { /* non-critical */ }
      }

      toast.success("Day off approved");
      fetchDayOffRequests();
    } catch (e: any) { toast.error(handleError(e)); }
  };

  const handleDeclineDayOff = async (requestId: string) => {
    try {
      const req = dayOffRequests.find(r => r.id === requestId);
      const { error } = await supabase
        .from("day_off_requests")
        .update({ status: "declined" as any, decline_reason: declineReason, reviewed_by: userId, reviewed_at: new Date().toISOString() })
        .eq("id", requestId);
      if (error) throw error;

      if (req) {
        const emp = employees.find(e => e.id === req.user_id);
        try {
          await supabase.functions.invoke("send-shift-notification", {
            body: {
              type: "day_off_declined",
              userEmail: emp?.email,
              userName: req.user_name,
              startDate: req.start_date,
              endDate: req.end_date,
              reason: declineReason,
            },
          });
        } catch { /* non-critical */ }
      }

      toast.success("Day off declined");
      setDeclineReason("");
      fetchDayOffRequests();
    } catch (e: any) { toast.error(handleError(e)); }
  };

  const getEmployeeName = (id: string) => {
    const emp = employees.find(e => e.id === id);
    return emp ? `${emp.first_name} ${emp.last_name}` : "Unknown";
  };

  const employeeOptions = employees.map(e => ({
    value: e.id,
    label: `${e.first_name} ${e.last_name}`,
  }));

  const { start: rangeStart, end: rangeEnd } = getDateRange();
  const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd });

  // Currently on shift
  const activeEntries = clockEntries.filter(e => !e.clock_out);

  const pendingDayOffs = dayOffRequests.filter(r => r.status === "pending");

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Shift Schedule Management</h2>

      <Tabs defaultValue="calendar" className="w-full">
        <TabsList className="flex gap-1 h-auto p-1 flex-wrap">
          <TabsTrigger value="calendar">Calendar View</TabsTrigger>
          <TabsTrigger value="active">Currently Active ({activeEntries.length})</TabsTrigger>
          <TabsTrigger value="add-shift">Add Shift</TabsTrigger>
          <TabsTrigger value="bulk">Bulk Schedule</TabsTrigger>
          <TabsTrigger value="dayoff">
            Day Off Requests
            {pendingDayOffs.length > 0 && (
              <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs">
                {pendingDayOffs.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Calendar View */}
        <TabsContent value="calendar" className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex gap-1">
              {(["day", "week", "month"] as const).map(mode => (
                <Button key={mode} size="sm" variant={viewMode === mode ? "default" : "outline"} onClick={() => setViewMode(mode)}>
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </Button>
              ))}
            </div>
            <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {format(selectedDate, "PPP")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={selectedDate} onSelect={(d) => { if (d) setSelectedDate(d); setDatePickerOpen(false); }} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[150px]">Employee</TableHead>
                  {days.map(day => (
                    <TableHead key={day.toISOString()} className="text-center min-w-[100px]">
                      <div>{format(day, "EEE")}</div>
                      <div className="text-xs">{format(day, "MMM d")}</div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map(emp => (
                  <TableRow key={emp.id}>
                    <TableCell className="font-medium">{emp.first_name} {emp.last_name}</TableCell>
                    {days.map(day => {
                      const dayShifts = shifts.filter(s => s.user_id === emp.id && s.shift_date === format(day, "yyyy-MM-dd"));
                      const dayEntries = clockEntries.filter(e => e.user_id === emp.id && isSameDay(new Date(e.clock_in), day));
                      return (
                        <TableCell key={day.toISOString()} className="text-center p-1">
                          {dayShifts.map(s => (
                            <div key={s.id} className={cn("text-[10px] rounded px-1 py-0.5 mb-0.5", s.status === "confirmed" ? "bg-green-100 dark:bg-green-900" : s.status === "pending" ? "bg-yellow-100 dark:bg-yellow-900" : "bg-muted")}>
                              {s.start_time?.slice(0,5)}-{s.end_time?.slice(0,5)}
                            </div>
                          ))}
                          {dayEntries.map(e => (
                            <div key={e.id} className="text-[10px] text-primary font-medium">
                              {e.clock_out ? "✓" : "🔴"} {format(new Date(e.clock_in), "HH:mm")}
                              {e.clock_out && `-${format(new Date(e.clock_out), "HH:mm")}`}
                            </div>
                          ))}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Currently Active */}
        <TabsContent value="active" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Currently On Shift</CardTitle></CardHeader>
            <CardContent>
              {activeEntries.length === 0 ? (
                <p className="text-muted-foreground">No employees currently clocked in</p>
              ) : (
                <div className="space-y-2">
                  {activeEntries.map(entry => {
                    const isOnBreak = activeBreaks[entry.id];
                    return (
                      <div key={entry.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{getEmployeeName(entry.user_id)}</p>
                          <p className="text-sm text-muted-foreground">Clocked in: {format(new Date(entry.clock_in), "h:mm a")}</p>
                        </div>
                        {isOnBreak ? (
                          <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300">On Break</Badge>
                        ) : (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">Active</Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Add Shift */}
        <TabsContent value="add-shift" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Add Individual Shift</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Employee</Label>
                <SearchableSelect value={newShiftEmployee} onValueChange={setNewShiftEmployee} options={employeeOptions} placeholder="Select employee" searchPlaceholder="Search..." emptyMessage="No employees" />
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Popover open={newShiftDateOpen} onOpenChange={setNewShiftDateOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start", !newShiftDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {newShiftDate ? format(newShiftDate, "PPP") : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={newShiftDate} onSelect={d => { setNewShiftDate(d); setNewShiftDateOpen(false); }} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Time</Label>
                  <Input type="time" value={newShiftStart} onChange={e => setNewShiftStart(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>End Time</Label>
                  <Input type="time" value={newShiftEnd} onChange={e => setNewShiftEnd(e.target.value)} />
                </div>
              </div>
              <Button onClick={handleAddShift} disabled={addingShift || !newShiftEmployee || !newShiftDate} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                {addingShift ? "Adding..." : "Add Shift"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bulk Schedule */}
        <TabsContent value="bulk" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Set Weekly/Monthly Schedule</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">This will create shifts for all weekdays in the selected date range.</p>
              <div className="space-y-2">
                <Label>Employee</Label>
                <SearchableSelect value={bulkEmployee} onValueChange={setBulkEmployee} options={employeeOptions} placeholder="Select employee" searchPlaceholder="Search..." emptyMessage="No employees" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Popover open={bulkStartOpen} onOpenChange={setBulkStartOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start", !bulkStartDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {bulkStartDate ? format(bulkStartDate, "PPP") : "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={bulkStartDate} onSelect={d => { setBulkStartDate(d); setBulkStartOpen(false); }} initialFocus className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Popover open={bulkEndOpen} onOpenChange={setBulkEndOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start", !bulkEndDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {bulkEndDate ? format(bulkEndDate, "PPP") : "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={bulkEndDate} onSelect={d => { setBulkEndDate(d); setBulkEndOpen(false); }} disabled={d => bulkStartDate ? d < bulkStartDate : false} initialFocus className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Time</Label>
                  <Input type="time" value={bulkStartTime} onChange={e => setBulkStartTime(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>End Time</Label>
                  <Input type="time" value={bulkEndTime} onChange={e => setBulkEndTime(e.target.value)} />
                </div>
              </div>
              <Button onClick={handleAddBulkShifts} disabled={addingBulk || !bulkEmployee || !bulkStartDate || !bulkEndDate} className="w-full">
                {addingBulk ? "Creating..." : "Create Schedule"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Day Off Requests */}
        <TabsContent value="dayoff" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Day Off Requests</CardTitle></CardHeader>
            <CardContent>
              {dayOffRequests.length === 0 ? (
                <p className="text-muted-foreground">No day off requests</p>
              ) : (
                <div className="space-y-3">
                  {dayOffRequests.map(req => (
                    <div key={req.id} className="p-4 border rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{req.user_name}</p>
                          <p className="text-sm">
                            {req.start_date}
                            {req.start_date !== req.end_date && ` → ${req.end_date}`}
                            {req.is_partial_day && ` (${req.partial_start_time?.slice(0,5)} - ${req.partial_end_time?.slice(0,5)})`}
                          </p>
                          {req.reason && <p className="text-sm text-muted-foreground">{req.reason}</p>}
                        </div>
                        <Badge className={cn(
                          req.status === "pending" ? "bg-yellow-100 text-yellow-800" :
                          req.status === "approved" ? "bg-green-100 text-green-800" :
                          "bg-red-100 text-red-800"
                        )}>
                          {req.status}
                        </Badge>
                      </div>
                      {req.status === "pending" && (
                        <div className="flex items-end gap-2">
                          <div className="flex-1">
                            <Input placeholder="Decline reason (optional)" value={declineReason} onChange={e => setDeclineReason(e.target.value)} />
                          </div>
                          <Button size="sm" onClick={() => handleApproveDayOff(req.id)}>
                            <Check className="h-4 w-4 mr-1" /> Approve
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleDeclineDayOff(req.id)}>
                            <X className="h-4 w-4 mr-1" /> Decline
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminShiftManagement;
