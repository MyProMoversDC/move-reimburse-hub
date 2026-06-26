import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, RefreshCw, Map as MapIcon, Loader2, CheckCircle2, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { handleError } from "@/lib/errorHandler";
import AssignCrewDialog from "./AssignCrewDialog";
import AssignMoversDialog from "./AssignMoversDialog";

interface AssignedJobRef { id: string; job_number: string | null; client_name: string | null; }

interface PlanningJob {
  id: string;
  smartmoving_id: string;
  job_number: string | null;
  customer_name: string | null;
  status: string | null;
  job_type: string | null;
  service_date: string | null;
  start_time: string | null;
  end_time: string | null;
  address: string | null;
  move_size: string | null;
}

interface Props { userId: string; }

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function buildGrid(viewDate: Date): Date[] {
  const start = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const startWeekday = (start.getDay() + 6) % 7; // Mon-first
  const gridStart = new Date(start);
  gridStart.setDate(start.getDate() - startWeekday);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });
}

const PlanningCalendar = ({ userId }: Props) => {
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [jobs, setJobs] = useState<PlanningJob[]>([]);
  const [assignedMap, setAssignedMap] = useState<Map<string, AssignedJobRef>>(new Map());
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [assignJob, setAssignJob] = useState<PlanningJob | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [historyJob, setHistoryJob] = useState<AssignedJobRef | null>(null);

  const grid = useMemo(() => buildGrid(viewDate), [viewDate]);
  const fromDate = ymd(grid[0]);
  const toDateStr = ymd(grid[grid.length - 1]);

  const load = async () => {
    setLoading(true);
    try {
      const [jRes, oRes] = await Promise.all([
        supabase
          .from("planning_jobs")
          .select("*")
          .gte("service_date", fromDate)
          .lte("service_date", toDateStr)
          .order("service_date", { ascending: true }),
        supabase
          .from("inv_job_orders")
          .select("id, job_number, client_name, planned_from_smartmoving_id")
          .not("planned_from_smartmoving_id", "is", null),
      ]);
      if (jRes.error) throw jRes.error;
      setJobs((jRes.data ?? []) as PlanningJob[]);
      const m = new Map<string, AssignedJobRef>();
      for (const r of (oRes.data ?? []) as any[]) {
        if (r.planned_from_smartmoving_id) {
          m.set(r.planned_from_smartmoving_id, { id: r.id, job_number: r.job_number, client_name: r.client_name });
        }
      }
      setAssignedMap(m);
    } catch (e) {
      toast.error(handleError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [fromDate, toDateStr]);

  const refresh = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-smartmoving-jobs", {
        body: { fromDate, toDate: toDateStr },
      });
      if (error) throw error;
      const d = data as any;
      toast.success(`Synced ${d?.fetched ?? 0} jobs, saved ${d?.upserted ?? 0}.`);
      await load();
    } catch (e) {
      toast.error(handleError(e));
    } finally {
      setSyncing(false);
    }
  };

  const jobsByDate = useMemo(() => {
    const map = new Map<string, PlanningJob[]>();
    for (const j of jobs) {
      if (!j.service_date) continue;
      const k = j.service_date.slice(0, 10);
      (map.get(k) ?? map.set(k, []).get(k))!.push(j);
    }
    return map;
  }, [jobs]);

  const today = ymd(new Date());
  const monthLabel = `${MONTHS[viewDate.getMonth()]} ${viewDate.getFullYear()}`;
  const selectedJobs = selectedDate ? (jobsByDate.get(selectedDate) ?? []) : [];

  const prevMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  const nextMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  const goToday = () => {
    const d = new Date();
    setViewDate(new Date(d.getFullYear(), d.getMonth(), 1));
    setSelectedDate(ymd(d));
  };

  const openAssign = (j: PlanningJob) => {
    setAssignJob(j);
    setDialogOpen(true);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between bg-primary/5 p-4 rounded-t-lg gap-2 flex-wrap">
        <CardTitle className="flex items-center gap-2"><MapIcon className="h-5 w-5" /> Planning Calendar</CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={goToday}>Today</Button>
          <span className="font-semibold min-w-[140px] text-center">{monthLabel}</span>
          <Button variant="outline" size="sm" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
          <Button onClick={refresh} disabled={syncing}>
            {syncing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            Refresh from SmartMoving
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        <div className="bg-yellow-50 dark:bg-yellow-950/30 border-l-4 border-yellow-400 p-3 text-sm">
          Booked-stage opportunities pulled from SmartMoving. Click a day to see jobs, then assign a crew.
        </div>

        <div className="grid grid-cols-7 gap-px bg-border rounded overflow-hidden border">
          {WEEKDAYS.map(w => (
            <div key={w} className="bg-muted text-xs font-medium p-2 text-center text-muted-foreground">{w}</div>
          ))}
          {grid.map(d => {
            const k = ymd(d);
            const inMonth = d.getMonth() === viewDate.getMonth();
            const dayJobs = jobsByDate.get(k) ?? [];
            const assignedCount = dayJobs.filter(j => assignedIds.has(j.smartmoving_id)).length;
            const isToday = k === today;
            const isSelected = k === selectedDate;
            return (
              <button
                key={k}
                onClick={() => setSelectedDate(k)}
                className={cn(
                  "bg-background min-h-[80px] p-2 text-left transition-colors hover:bg-muted relative",
                  !inMonth && "opacity-40",
                  isSelected && "ring-2 ring-primary ring-inset",
                )}
              >
                <div className="flex items-start justify-between">
                  <span className={cn("text-sm", isToday && "font-bold text-primary")}>{d.getDate()}</span>
                  {dayJobs.length > 0 && (
                    <Badge variant="secondary" className="text-[10px] h-5">{dayJobs.length}</Badge>
                  )}
                </div>
                {dayJobs.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {dayJobs.slice(0, 2).map(j => (
                      <div key={j.id} className="text-[10px] truncate flex items-center gap-1">
                        {assignedIds.has(j.smartmoving_id) && <CheckCircle2 className="h-2.5 w-2.5 text-green-600 shrink-0" />}
                        <span className="truncate">{j.customer_name ?? j.job_number ?? "Job"}</span>
                      </div>
                    ))}
                    {dayJobs.length > 2 && <div className="text-[10px] text-muted-foreground">+{dayJobs.length - 2} more</div>}
                  </div>
                )}
                {assignedCount > 0 && (
                  <span className="absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full bg-green-500" />
                )}
              </button>
            );
          })}
        </div>

        {loading && <div className="text-center text-sm text-muted-foreground py-2"><Loader2 className="h-4 w-4 animate-spin inline mr-1" /> Loading...</div>}

        {selectedDate && (
          <Card className="mt-3">
            <CardHeader className="p-3">
              <CardTitle className="text-base">{selectedDate} — {selectedJobs.length} job{selectedJobs.length !== 1 ? "s" : ""}</CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-2">
              {selectedJobs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No Booked jobs on this day.</p>
              ) : selectedJobs.map(j => {
                const assigned = assignedIds.has(j.smartmoving_id);
                return (
                  <div key={j.id} className="flex items-start justify-between gap-3 p-3 border rounded-md">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold">#{j.job_number ?? "—"} · {j.customer_name ?? "Unknown"}</p>
                        {assigned && <Badge className="bg-green-600">Assigned</Badge>}
                        {j.job_type && <Badge variant="outline">{j.job_type}</Badge>}
                        {j.move_size && <Badge variant="outline">{j.move_size}</Badge>}
                      </div>
                      {j.address && <p className="text-xs text-muted-foreground mt-1">{j.address}</p>}
                      {(j.start_time || j.end_time) && (
                        <p className="text-xs text-muted-foreground">
                          {j.start_time ? new Date(j.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                          {j.end_time ? ` – ${new Date(j.end_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}
                        </p>
                      )}
                    </div>
                    <Button size="sm" onClick={() => openAssign(j)}>
                      {assigned ? "Edit crew" : "Assign crew"}
                    </Button>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </CardContent>

      <AssignCrewDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        job={assignJob}
        userId={userId}
        onSaved={load}
      />
    </Card>
  );
};

export default PlanningCalendar;
