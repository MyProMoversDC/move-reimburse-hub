import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Truck,
  Calendar,
  Play,
  Square,
  MapPin,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDateEST } from "@/lib/dateUtils";
import { Textarea } from "@/components/ui/textarea";

interface JobAssignment {
  id: string;
  job_number: string;
  client_name: string;
  service_date: string | null;
  move_size: string | null;
  scope_of_work: string | null;
  truck_number: string | null;
}

type JobStatus = "pending" | "confirmed" | "declined" | "in_progress" | "completed";

interface JobRow {
  id: string;
  status: JobStatus;
  responded_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  decline_reason: string | null;
  arrived_parking_at: string | null;
  arrived_site_at: string | null;
  assignment: JobAssignment;
}

interface Props { userId: string; }

const PING_INTERVAL_MS = 60_000;

function StatusBadge({ status }: { status: JobStatus }) {
  if (status === "confirmed") return <Badge className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Confirmed</Badge>;
  if (status === "in_progress") return <Badge className="bg-blue-600"><MapPin className="h-3 w-3 mr-1" />In Progress</Badge>;
  if (status === "completed") return <Badge className="bg-slate-600"><CheckCircle2 className="h-3 w-3 mr-1" />Completed</Badge>;
  if (status === "declined") return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Declined</Badge>;
  return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
}

export default function MoverJobAssignments({ userId }: Props) {
  const { toast } = useToast();
  const [rows, setRows] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<JobRow | null>(null);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [declineError, setDeclineError] = useState("");
  const trackingRef = useRef<{ rowId: string; timer: number } | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("mover_job_assignments")
      .select(
        "id, status, responded_at, started_at, ended_at, decline_reason, assignment:job_assignments(id, job_number, client_name, service_date, move_size, scope_of_work, truck_number)"
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) toast({ title: "Failed to load jobs", description: error.message, variant: "destructive" });
    else setRows((data ?? []) as unknown as JobRow[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const channel = supabase
      .channel("mover-jobs")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mover_job_assignments", filter: `user_id=eq.${userId}` },
        () => load()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    if (!selected) return;
    const updated = rows.find((r) => r.id === selected.id);
    if (updated && updated !== selected) setSelected(updated);
  }, [rows, selected]);

  // ---------- geolocation tracking ----------
  async function recordPing(rowId: string) {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await supabase.from("job_location_pings").insert({
          mover_assignment_id: rowId,
          user_id: userId,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      (err) => console.warn("geo error", err),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
  }

  function startTracking(rowId: string) {
    stopTracking();
    recordPing(rowId);
    const timer = window.setInterval(() => recordPing(rowId), PING_INTERVAL_MS);
    trackingRef.current = { rowId, timer };
  }
  function stopTracking() {
    if (trackingRef.current) {
      clearInterval(trackingRef.current.timer);
      trackingRef.current = null;
    }
  }

  // Resume tracking on load if any job is in_progress
  useEffect(() => {
    const live = rows.find((r) => r.status === "in_progress");
    if (live && trackingRef.current?.rowId !== live.id) startTracking(live.id);
    if (!live && trackingRef.current) stopTracking();
    return () => {};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  useEffect(() => () => stopTracking(), []);

  // ---------- actions ----------
  async function respond(rowId: string, assignmentId: string, status: "confirmed" | "declined", reason?: string) {
    setBusyId(rowId);
    const { error } = await supabase.functions.invoke("confirm-job", {
      body: { assignment_id: assignmentId, status, decline_reason: reason },
    });
    setBusyId(null);
    if (error) toast({ title: "Could not submit", description: error.message, variant: "destructive" });
    else { toast({ title: status === "confirmed" ? "Job confirmed" : "Job declined" }); load(); }
  }

  function openDecline() {
    setDeclineReason("");
    setDeclineError("");
    setDeclineOpen(true);
  }

  async function submitDecline() {
    if (!selected) return;
    const trimmed = declineReason.trim();
    if (!trimmed) { setDeclineError("A reason is required to decline."); return; }
    await respond(selected.id, selected.assignment.id, "declined", trimmed);
    setDeclineOpen(false);
  }

  function requestGeoPermission(): Promise<boolean> {
    return new Promise((resolve) => {
      if (!("geolocation" in navigator)) return resolve(false);
      navigator.geolocation.getCurrentPosition(() => resolve(true), () => resolve(false), { timeout: 15000 });
    });
  }

  async function startJob(row: JobRow) {
    setBusyId(row.id);
    const ok = await requestGeoPermission();
    if (!ok) {
      setBusyId(null);
      toast({
        title: "Location required",
        description: "Please allow location access to start the job.",
        variant: "destructive",
      });
      return;
    }
    const { error } = await supabase
      .from("mover_job_assignments")
      .update({ status: "in_progress", started_at: new Date().toISOString() })
      .eq("id", row.id);
    setBusyId(null);
    if (error) toast({ title: "Could not start", description: error.message, variant: "destructive" });
    else { toast({ title: "Job started", description: "Location tracking active." }); startTracking(row.id); load(); }
  }

  async function endJob(row: JobRow) {
    setBusyId(row.id);
    const { error } = await supabase
      .from("mover_job_assignments")
      .update({ status: "completed", ended_at: new Date().toISOString() })
      .eq("id", row.id);
    setBusyId(null);
    stopTracking();
    if (error) toast({ title: "Could not end", description: error.message, variant: "destructive" });
    else { toast({ title: "Job completed" }); load(); }
  }

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (rows.length === 0) return <p className="text-center text-muted-foreground py-10">No jobs assigned to you yet.</p>;

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">My Jobs</h2>

      {rows.map((r) => {
        const a = r.assignment;
        return (
          <Card key={r.id} onClick={() => setSelected(r)} className="cursor-pointer hover:bg-accent/50 transition-colors">
            <CardHeader className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
              <div className="min-w-0">
                <CardTitle className="break-words text-base sm:text-lg">Job #{a.job_number} — {a.client_name}</CardTitle>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  {a.service_date && (
                    <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDateEST(a.service_date)}</span>
                  )}
                  {a.truck_number && (
                    <span className="inline-flex items-center gap-1"><Truck className="h-3 w-3" />Truck {a.truck_number}</span>
                  )}
                  {a.move_size && <Badge variant="outline">{a.move_size}</Badge>}
                </div>
              </div>
              <StatusBadge status={r.status} />
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Tap to view full details</p>
            </CardContent>
          </Card>
        );
      })}

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto w-[95vw] sm:w-full">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="break-words">Job #{selected.assignment.job_number}</DialogTitle>
                <DialogDescription className="break-words">{selected.assignment.client_name}</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Status</Label>
                  <StatusBadge status={selected.status} />
                </div>

                {selected.assignment.service_date && (
                  <div><Label>Service Date</Label><p className="text-sm mt-1">{formatDateEST(selected.assignment.service_date)}</p></div>
                )}
                {selected.assignment.move_size && (
                  <div><Label>Move Size</Label><p className="text-sm mt-1">{selected.assignment.move_size}</p></div>
                )}
                {selected.assignment.truck_number && (
                  <div><Label>Truck</Label><p className="text-sm mt-1">Truck {selected.assignment.truck_number}</p></div>
                )}
                {selected.assignment.scope_of_work && (
                  <div><Label>Scope of Work</Label><p className="text-sm mt-1 whitespace-pre-wrap break-words">{selected.assignment.scope_of_work}</p></div>
                )}

                {selected.status === "in_progress" && (
                  <div className="rounded-md border border-blue-500/40 bg-blue-500/10 p-3 text-sm flex items-start gap-2">
                    <MapPin className="h-4 w-4 mt-0.5 text-blue-600 shrink-0" />
                    <span>Location tracking is active. Keep this tab open until you end the job.</span>
                  </div>
                )}

                {selected.started_at && (
                  <p className="text-xs text-muted-foreground">Started {new Date(selected.started_at).toLocaleString()}</p>
                )}
                {selected.ended_at && (
                  <p className="text-xs text-muted-foreground">Ended {new Date(selected.ended_at).toLocaleString()}</p>
                )}
                {selected.responded_at && selected.status === "declined" && (
                  <p className="text-xs text-muted-foreground">Responded {new Date(selected.responded_at).toLocaleString()}</p>
                )}
                {selected.status === "declined" && selected.decline_reason && (
                  <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
                    <Label className="text-destructive">Decline Reason</Label>
                    <p className="text-sm mt-1 whitespace-pre-wrap break-words">{selected.decline_reason}</p>
                  </div>
                )}
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2">
                {selected.status === "pending" && (
                  <>
                    <Button variant="outline" className="w-full sm:w-auto" onClick={openDecline} disabled={busyId === selected.id}>
                      {busyId === selected.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}Decline
                    </Button>
                    <Button className="w-full sm:w-auto" onClick={() => respond(selected.id, selected.assignment.id, "confirmed")} disabled={busyId === selected.id}>
                      {busyId === selected.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}Confirm Job
                    </Button>
                  </>
                )}
                {selected.status === "confirmed" && (
                  <Button className="w-full sm:w-auto bg-green-600 hover:bg-green-700" onClick={() => startJob(selected)} disabled={busyId === selected.id}>
                    {busyId === selected.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}Start Job
                  </Button>
                )}
                {selected.status === "in_progress" && (
                  <Button variant="destructive" className="w-full sm:w-auto" onClick={() => endJob(selected)} disabled={busyId === selected.id}>
                    {busyId === selected.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Square className="h-4 w-4 mr-2" />}End Job
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={declineOpen} onOpenChange={(o) => !o && setDeclineOpen(false)}>
        <DialogContent className="max-w-md w-[95vw] sm:w-full">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <XCircle className="h-5 w-5" /> Decline Job
            </DialogTitle>
            <DialogDescription>
              Please explain why you are declining this job. Your note will be sent to the Planning Manager.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="decline-note">Reason *</Label>
            <Textarea
              id="decline-note"
              rows={4}
              value={declineReason}
              onChange={(e) => { setDeclineReason(e.target.value); if (declineError) setDeclineError(""); }}
              placeholder="Enter the reason for declining..."
              className={declineError ? "border-destructive" : ""}
            />
            {declineError && <p className="text-sm text-destructive">{declineError}</p>}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeclineOpen(false)} disabled={busyId === selected?.id}>Cancel</Button>
            <Button variant="destructive" onClick={submitDecline} disabled={busyId === selected?.id}>
              {busyId === selected?.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
              Decline Job
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
