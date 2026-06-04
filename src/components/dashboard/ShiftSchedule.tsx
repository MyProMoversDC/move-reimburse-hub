import { useState, useEffect, useCallback } from "react";
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
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { format, differenceInMinutes, startOfDay, endOfDay, parseISO, addDays, startOfMonth } from "date-fns";
import { formatDateEST, formatInEST } from "@/lib/dateUtils";
import { Clock, Play, Pause, Square, Calendar as CalendarIcon, DollarSign, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { shiftTranslations } from "@/lib/shiftTranslations";
import { DashboardLanguage } from "@/lib/dashboardTranslations";
import { handleError } from "@/lib/errorHandler";

interface ShiftScheduleProps {
  userId: string;
  language: DashboardLanguage;
}

const ShiftSchedule = ({ userId, language }: ShiftScheduleProps) => {
  const t = shiftTranslations[language];

  // Clock state
  const [activeClockEntry, setActiveClockEntry] = useState<any>(null);
  const [activeBreak, setActiveBreak] = useState<any>(null);
  const [todayBreakMinutes, setTodayBreakMinutes] = useState(0);
  const [todayShifts, setTodayShifts] = useState<any[]>([]);
  const [clockEntries, setClockEntries] = useState<any[]>([]);
  const [elapsedTime, setElapsedTime] = useState("");

  // Schedule state
  const [upcomingShifts, setUpcomingShifts] = useState<any[]>([]);

  // Day off state
  const [dayOffStartDate, setDayOffStartDate] = useState<Date | undefined>();
  const [dayOffEndDate, setDayOffEndDate] = useState<Date | undefined>();
  const [isPartialDay, setIsPartialDay] = useState(false);
  const [partialStartTime, setPartialStartTime] = useState("09:00");
  const [partialEndTime, setPartialEndTime] = useState("13:00");
  const [dayOffReason, setDayOffReason] = useState("");
  const [dayOffRequests, setDayOffRequests] = useState<any[]>([]);
  const [submittingDayOff, setSubmittingDayOff] = useState(false);
  const [dayOffStartOpen, setDayOffStartOpen] = useState(false);
  const [dayOffEndOpen, setDayOffEndOpen] = useState(false);

  // Earnings state
  const [hourlyRate, setHourlyRate] = useState(0);
  const [savingRate, setSavingRate] = useState(false);
  const [earningsStartDate, setEarningsStartDate] = useState<Date | undefined>();
  const [earningsEndDate, setEarningsEndDate] = useState<Date | undefined>();
  const [totalHours, setTotalHours] = useState(0);
  const [earningsStartOpen, setEarningsStartOpen] = useState(false);
  const [earningsEndOpen, setEarningsEndOpen] = useState(false);

  // Timer - freezes during breaks, resumes after
  useEffect(() => {
    if (!activeClockEntry) return;
    if (activeBreak) {
      // Freeze: show worked time up to break start
      const minsBeforeBreak = Math.max(0, differenceInMinutes(new Date(activeBreak.break_start), new Date(activeClockEntry.clock_in)) - todayBreakMinutes);
      const hours = Math.floor(minsBeforeBreak / 60);
      const remainingMins = minsBeforeBreak % 60;
      setElapsedTime(`${hours}h ${remainingMins}m`);
      return;
    }
    const interval = setInterval(() => {
      const workedMins = Math.max(0, differenceInMinutes(new Date(), new Date(activeClockEntry.clock_in)) - todayBreakMinutes);
      const hours = Math.floor(workedMins / 60);
      const remainingMins = workedMins % 60;
      setElapsedTime(`${hours}h ${remainingMins}m`);
    }, 1000);
    return () => clearInterval(interval);
  }, [activeClockEntry, activeBreak, todayBreakMinutes]);

  const fetchData = useCallback(async () => {
    await Promise.all([
      fetchTodayShifts(),
      fetchActiveClockEntry(),
      fetchUpcomingShifts(),
      fetchDayOffRequests(),
      fetchHourlyRate(),
    ]);
  }, [userId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fetchTodayShifts = async () => {
    const today = format(new Date(), "yyyy-MM-dd");
    const { data } = await supabase
      .from("shifts")
      .select("*")
      .eq("user_id", userId)
      .eq("shift_date", today)
      .order("start_time");
    setTodayShifts(data || []);
  };

  const fetchActiveClockEntry = async () => {
    const { data } = await supabase
      .from("shift_clock_entries")
      .select("*")
      .eq("user_id", userId)
      .is("clock_out", null)
      .order("clock_in", { ascending: false })
      .limit(1)
      .maybeSingle();
    setActiveClockEntry(data);

    if (data) {
      // Check active break
      const { data: breakData } = await supabase
        .from("shift_breaks")
        .select("*")
        .eq("clock_entry_id", data.id)
        .is("break_end", null)
        .maybeSingle();
      setActiveBreak(breakData);

      // Calculate total break minutes
      const { data: breaks } = await supabase
        .from("shift_breaks")
        .select("*")
        .eq("clock_entry_id", data.id)
        .not("break_end", "is", null);
      const totalMins = (breaks || []).reduce((sum, b) => sum + (b.duration_minutes || 0), 0);
      setTodayBreakMinutes(totalMins);
    }
  };

  const fetchUpcomingShifts = async () => {
    const today = format(new Date(), "yyyy-MM-dd");
    const { data } = await supabase
      .from("shifts")
      .select("*")
      .eq("user_id", userId)
      .gte("shift_date", today)
      .order("shift_date")
      .order("start_time")
      .limit(14);
    setUpcomingShifts(data || []);
  };

  const fetchDayOffRequests = async () => {
    const { data } = await supabase
      .from("day_off_requests")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    setDayOffRequests(data || []);
  };

  const fetchHourlyRate = async () => {
    const { data } = await supabase
      .from("shift_hourly_rates")
      .select("hourly_rate")
      .eq("user_id", userId)
      .maybeSingle();
    if (data) setHourlyRate(data.hourly_rate);
  };

  const handleClockIn = async () => {
    // Check if there's a confirmed shift today
    const todayConfirmed = todayShifts.find(s => s.status === "confirmed");
    if (!todayConfirmed && todayShifts.length > 0) {
      toast.error(t.noConfirmedShift);
      return;
    }

    try {
      const { error } = await supabase
        .from("shift_clock_entries")
        .insert({ user_id: userId, shift_id: todayConfirmed?.id || null });
      if (error) throw error;
      toast.success(t.clockInSuccess);
      fetchActiveClockEntry();
    } catch (e: any) { toast.error(handleError(e)); }
  };

  const handleClockOut = async () => {
    if (!activeClockEntry) return;
    // End active break first
    if (activeBreak) {
      await handleEndBreak();
    }
    try {
      const { error } = await supabase
        .from("shift_clock_entries")
        .update({ clock_out: new Date().toISOString() })
        .eq("id", activeClockEntry.id);
      if (error) throw error;
      toast.success(t.clockOutSuccess);
      setActiveClockEntry(null);
      setElapsedTime("");
    } catch (e: any) { toast.error(handleError(e)); }
  };

  const handleStartBreak = async (minutes: number) => {
    if (!activeClockEntry) return;
    if (todayBreakMinutes + minutes > 60) {
      toast.error(t.maxBreakReached);
      return;
    }
    try {
      const { error } = await supabase
        .from("shift_breaks")
        .insert({
          clock_entry_id: activeClockEntry.id,
          duration_minutes: minutes,
        });
      if (error) throw error;
      toast.success(t.breakStarted);
      fetchActiveClockEntry();
    } catch (e: any) { toast.error(handleError(e)); }
  };

  const handleEndBreak = async () => {
    if (!activeBreak) return;
    try {
      const { error } = await supabase
        .from("shift_breaks")
        .update({ break_end: new Date().toISOString() })
        .eq("id", activeBreak.id);
      if (error) throw error;
      toast.success(t.breakEnded);
      setActiveBreak(null);
      fetchActiveClockEntry();
    } catch (e: any) { toast.error(handleError(e)); }
  };

  const handleConfirmShift = async (shiftId: string) => {
    try {
      const { error } = await supabase
        .from("shifts")
        .update({ status: "confirmed" as any })
        .eq("id", shiftId);
      if (error) throw error;
      toast.success(t.shiftConfirmed);
      fetchTodayShifts();
      fetchUpcomingShifts();
    } catch (e: any) { toast.error(handleError(e)); }
  };

  const handleSubmitDayOff = async () => {
    if (!dayOffStartDate) return;
    const endDate = dayOffEndDate || dayOffStartDate;

    setSubmittingDayOff(true);
    try {
      // Get user name
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", userId)
        .single();

      const userName = profile ? `${profile.first_name} ${profile.last_name}` : "Unknown";

      const { error } = await supabase
        .from("day_off_requests")
        .insert({
          user_id: userId,
          user_name: userName,
          start_date: format(dayOffStartDate, "yyyy-MM-dd"),
          end_date: format(endDate, "yyyy-MM-dd"),
          is_partial_day: isPartialDay,
          partial_start_time: isPartialDay ? partialStartTime : null,
          partial_end_time: isPartialDay ? partialEndTime : null,
          reason: dayOffReason || null,
        });
      if (error) throw error;

      // Send notification email
      try {
        await supabase.functions.invoke("send-shift-notification", {
          body: {
            type: "day_off_request",
            userName,
            startDate: format(dayOffStartDate, "PPP"),
            endDate: format(endDate, "PPP"),
            isPartial: isPartialDay,
            partialTimes: isPartialDay ? `${partialStartTime} - ${partialEndTime}` : null,
            reason: dayOffReason || "Not specified",
          },
        });
      } catch { /* non-critical */ }

      toast.success(t.requestSubmitted);
      setDayOffStartDate(undefined);
      setDayOffEndDate(undefined);
      setDayOffReason("");
      setIsPartialDay(false);
      fetchDayOffRequests();
    } catch (e: any) { toast.error(handleError(e)); }
    finally { setSubmittingDayOff(false); }
  };

  const handleSaveRate = async () => {
    setSavingRate(true);
    try {
      const { data: existing } = await supabase
        .from("shift_hourly_rates")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("shift_hourly_rates")
          .update({ hourly_rate: hourlyRate, updated_at: new Date().toISOString() })
          .eq("user_id", userId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("shift_hourly_rates")
          .insert({ user_id: userId, hourly_rate: hourlyRate });
        if (error) throw error;
      }
      toast.success(t.rateSaved);
    } catch (e: any) { toast.error(handleError(e)); }
    finally { setSavingRate(false); }
  };

  const calculateEarnings = useCallback(async () => {
    if (!earningsStartDate || !earningsEndDate || !hourlyRate) {
      setTotalHours(0);
      return;
    }

    const { data: entries } = await supabase
      .from("shift_clock_entries")
      .select("*, shift_breaks(*)")
      .eq("user_id", userId)
      .not("clock_out", "is", null)
      .gte("clock_in", startOfDay(earningsStartDate).toISOString())
      .lte("clock_in", endOfDay(earningsEndDate).toISOString());

    let totalMins = 0;
    (entries || []).forEach(entry => {
      const worked = differenceInMinutes(new Date(entry.clock_out), new Date(entry.clock_in));
      const breakMins = (entry.shift_breaks || []).reduce((s: number, b: any) => s + (b.duration_minutes || 0), 0);
      totalMins += worked - breakMins;
    });
    setTotalHours(totalMins / 60);
  }, [earningsStartDate, earningsEndDate, hourlyRate, userId]);

  useEffect(() => { calculateEarnings(); }, [calculateEarnings]);

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
      confirmed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
      approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
      declined: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
      cancelled: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
    };
    const labels: Record<string, string> = {
      pending: t.pending,
      confirmed: t.shiftConfirmed.replace("!", ""),
      approved: t.approved,
      declined: t.declined,
    };
    return <Badge className={colors[status] || ""}>{labels[status] || status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">{t.shiftSchedule}</h2>

      <Tabs defaultValue="clock" className="w-full">
        <div className="overflow-x-auto -mx-3 px-3 md:mx-0 md:px-0">
          <TabsList className="inline-flex min-w-max md:flex gap-1 h-auto p-1">
            <TabsTrigger value="clock" className="text-xs md:text-sm px-2 md:px-3 py-1.5">
              <Clock className="h-3 w-3 md:h-4 md:w-4 mr-1" />
              {t.currentShift}
            </TabsTrigger>
            <TabsTrigger value="schedule" className="text-xs md:text-sm px-2 md:px-3 py-1.5">
              <CalendarIcon className="h-3 w-3 md:h-4 md:w-4 mr-1" />
              {t.mySchedule}
            </TabsTrigger>
            <TabsTrigger value="dayoff" className="text-xs md:text-sm px-2 md:px-3 py-1.5">
              <CalendarIcon className="h-3 w-3 md:h-4 md:w-4 mr-1" />
              {t.dayOffRequest}
            </TabsTrigger>
            <TabsTrigger value="earnings" className="text-xs md:text-sm px-2 md:px-3 py-1.5">
              <DollarSign className="h-3 w-3 md:h-4 md:w-4 mr-1" />
              {t.earnings}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Clock In/Out Tab */}
        <TabsContent value="clock" className="space-y-4">
          {/* Today's Schedule */}
          <Card>
            <CardHeader><CardTitle className="text-lg">{t.todaySchedule}</CardTitle></CardHeader>
            <CardContent>
              {todayShifts.length === 0 ? (
                <p className="text-muted-foreground">{t.noShiftToday}</p>
              ) : (
                <div className="space-y-2">
                  {todayShifts.map(shift => (
                    <div key={shift.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <span className="font-medium">{shift.start_time?.slice(0,5)} - {shift.end_time?.slice(0,5)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(shift.status)}
                        {shift.status === "pending" && (
                          <Button size="sm" onClick={() => handleConfirmShift(shift.id)}>
                            {t.confirmShift}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Clock Controls */}
          <Card>
            <CardHeader><CardTitle className="text-lg">{t.currentShift}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {activeClockEntry ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{t.clockedIn}</p>
                      <p className="text-lg font-mono">{format(new Date(activeClockEntry.clock_in), "h:mm a")}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">{t.hoursWorked}</p>
                      <p className="text-2xl font-bold font-mono">{elapsedTime || "0h 0m"}</p>
                    </div>
                  </div>

                  {todayBreakMinutes > 0 && (
                    <p className="text-sm text-muted-foreground">{t.totalBreakToday}: {todayBreakMinutes} {t.breakMinutes}</p>
                  )}

                  {activeBreak ? (
                    <Button onClick={handleEndBreak} variant="outline" className="w-full">
                      <Pause className="h-4 w-4 mr-2" />
                      {t.endBreak}
                    </Button>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">{t.startBreak}:</p>
                      <div className="flex gap-2 flex-wrap">
                        {[15, 30, 45, 60].filter(m => m + todayBreakMinutes <= 60).map(mins => (
                          <Button key={mins} size="sm" variant="outline" onClick={() => handleStartBreak(mins)}>
                            <Play className="h-3 w-3 mr-1" />
                            {mins} {t.breakMinutes}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  <Button onClick={handleClockOut} variant="destructive" className="w-full">
                    <Square className="h-4 w-4 mr-2" />
                    {t.clockOut}
                  </Button>
                </div>
              ) : (
                <div className="text-center space-y-4">
                  <p className="text-muted-foreground">{t.noActiveShift}</p>
                  <Button onClick={handleClockIn} size="lg" className="w-full">
                    <Play className="h-5 w-5 mr-2" />
                    {t.clockIn}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Schedule Tab */}
        <TabsContent value="schedule" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>{t.mySchedule}</CardTitle></CardHeader>
            <CardContent>
              {upcomingShifts.length === 0 ? (
                <p className="text-muted-foreground">{t.noShiftToday}</p>
              ) : (
                <div className="space-y-2">
                  {upcomingShifts.map(shift => (
                    <div key={shift.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{format(new Date(shift.shift_date + "T00:00:00"), "EEE, MMM d")}</p>
                        <p className="text-sm text-muted-foreground">{shift.start_time?.slice(0,5)} - {shift.end_time?.slice(0,5)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(shift.status)}
                        {shift.status === "pending" && (
                          <Button size="sm" onClick={() => handleConfirmShift(shift.id)}>
                            {t.confirmShift}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Day Off Request Tab */}
        <TabsContent value="dayoff" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>{t.dayOffRequest}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Switch checked={isPartialDay} onCheckedChange={setIsPartialDay} />
                <Label>{isPartialDay ? t.isPartialDay : t.fullDay}</Label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t.startDate}</Label>
                  <Popover open={dayOffStartOpen} onOpenChange={setDayOffStartOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dayOffStartDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dayOffStartDate ? format(dayOffStartDate, "PPP") : t.selectDate}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={dayOffStartDate} onSelect={(d) => { setDayOffStartDate(d); setDayOffStartOpen(false); }} disabled={(d) => d < new Date()} initialFocus className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>

                {!isPartialDay && (
                  <div className="space-y-2">
                    <Label>{t.endDate}</Label>
                    <Popover open={dayOffEndOpen} onOpenChange={setDayOffEndOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dayOffEndDate && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dayOffEndDate ? format(dayOffEndDate, "PPP") : t.selectDate}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={dayOffEndDate} onSelect={(d) => { setDayOffEndDate(d); setDayOffEndOpen(false); }} disabled={(d) => d < (dayOffStartDate || new Date())} initialFocus className="p-3 pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                  </div>
                )}
              </div>

              {isPartialDay && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t.partialStartTime}</Label>
                    <Input type="time" value={partialStartTime} onChange={e => setPartialStartTime(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t.partialEndTime}</Label>
                    <Input type="time" value={partialEndTime} onChange={e => setPartialEndTime(e.target.value)} />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>{t.reason}</Label>
                <Textarea value={dayOffReason} onChange={e => setDayOffReason(e.target.value)} />
              </div>

              <Button onClick={handleSubmitDayOff} disabled={submittingDayOff || !dayOffStartDate} className="w-full">
                {submittingDayOff ? t.submitting : t.submitRequest}
              </Button>
            </CardContent>
          </Card>

          {/* Day Off History */}
          <Card>
            <CardHeader><CardTitle>{t.dayOffHistory}</CardTitle></CardHeader>
            <CardContent>
              {dayOffRequests.length === 0 ? (
                <p className="text-muted-foreground">{t.noDayOffRequests}</p>
              ) : (
                <div className="space-y-2">
                  {dayOffRequests.map(req => (
                    <div key={req.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">
                          {format(new Date(req.start_date + "T00:00:00"), "MMM d, yyyy")}
                          {req.start_date !== req.end_date && ` - ${format(new Date(req.end_date + "T00:00:00"), "MMM d, yyyy")}`}
                        </p>
                        {req.is_partial_day && (
                          <p className="text-sm text-muted-foreground">{req.partial_start_time?.slice(0,5)} - {req.partial_end_time?.slice(0,5)}</p>
                        )}
                        {req.reason && <p className="text-sm text-muted-foreground">{req.reason}</p>}
                        {req.decline_reason && <p className="text-sm text-destructive">{t.declineReason}: {req.decline_reason}</p>}
                      </div>
                      {getStatusBadge(req.status)}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Earnings Tab */}
        <TabsContent value="earnings" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>{t.hourlyRate}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-2">
                  <Label>{t.hourlyRate}</Label>
                  <Input type="number" min="0" step="0.01" value={hourlyRate} onChange={e => setHourlyRate(parseFloat(e.target.value) || 0)} />
                </div>
                <Button onClick={handleSaveRate} disabled={savingRate}>
                  <Save className="h-4 w-4 mr-2" />
                  {t.saveRate}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">{t.hourlyRateDescription}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>{t.earnings}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t.startDate}</Label>
                  <Popover open={earningsStartOpen} onOpenChange={setEarningsStartOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !earningsStartDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {earningsStartDate ? format(earningsStartDate, "PPP") : t.selectDate}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={earningsStartDate} onSelect={(d) => { setEarningsStartDate(d); setEarningsStartOpen(false); }} initialFocus className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>{t.endDate}</Label>
                  <Popover open={earningsEndOpen} onOpenChange={setEarningsEndOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !earningsEndDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {earningsEndDate ? format(earningsEndDate, "PPP") : t.selectDate}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={earningsEndDate} onSelect={(d) => { setEarningsEndDate(d); setEarningsEndOpen(false); }} initialFocus className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {hourlyRate > 0 && earningsStartDate && earningsEndDate && (
                <div className="grid grid-cols-2 gap-4">
                  <Card className="bg-primary/5 border-primary/20">
                    <CardContent className="pt-4 text-center">
                      <p className="text-sm text-muted-foreground">{t.totalHours}</p>
                      <p className="text-2xl font-bold">{totalHours.toFixed(1)}h</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
                    <CardContent className="pt-4 text-center">
                      <p className="text-sm text-muted-foreground">{t.totalEarnings}</p>
                      <p className="text-2xl font-bold text-green-600">${(totalHours * hourlyRate).toFixed(2)}</p>
                    </CardContent>
                  </Card>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ShiftSchedule;
