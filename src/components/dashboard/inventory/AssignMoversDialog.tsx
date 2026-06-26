import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, UserCheck, MapPin } from "lucide-react";
import { handleError } from "@/lib/errorHandler";
import MoverAutocomplete from "./MoverAutocomplete";
import MoverLiveTrackDialog from "./MoverLiveTrackDialog";


interface Mover {
  id: string;
  first_name: string | null;
  last_name: string | null;
}

interface ExistingAssignment {
  assignment_id: string;
  mover_id: string;
  first_name: string | null;
  last_name: string | null;
  status: string;
  responded_at: string | null;
  decline_reason: string | null;
  started_at: string | null;
  ended_at: string | null;
  arrived_parking_at: string | null;
  moving_to_site_at: string | null;
  arrived_site_at: string | null;
  created_at: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobOrderId: string;
  jobNumber: string;
  clientName: string;
  onAssigned?: () => void;
}

const fmtEst = (iso: string | null) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-US", {
      timeZone: "America/New_York",
      month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    }) + " EST";
  } catch { return iso; }
};

const statusBadge = (s: string) => {
  const map: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
    confirmed: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
    declined: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
    in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
    completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  };
  return map[s] ?? "bg-muted text-muted-foreground";
};

const AssignMoversDialog = ({ open, onOpenChange, jobOrderId, jobNumber, clientName, onAssigned }: Props) => {
  const [movers, setMovers] = useState<Mover[]>([]);
  const [existing, setExisting] = useState<ExistingAssignment[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [trackTarget, setTrackTarget] = useState<ExistingAssignment | null>(null);


  const loadAll = async () => {
    setLoading(true);
    try {
      const { data: roleRows, error: rErr } = await supabase
        .from("user_roles").select("user_id").eq("role", "mover");
      if (rErr) throw rErr;
      const moverIds = (roleRows ?? []).map((r) => r.user_id);
      if (moverIds.length === 0) {
        setMovers([]);
      } else {
        const { data: profs, error: pErr } = await supabase
          .from("profiles").select("id, first_name, last_name").in("id", moverIds);
        if (pErr) throw pErr;
        const sorted = [...(profs ?? [])].sort((a, b) =>
          `${a.first_name ?? ""} ${a.last_name ?? ""}`.localeCompare(`${b.first_name ?? ""} ${b.last_name ?? ""}`));
        setMovers(sorted as Mover[]);
      }

      const { data: ex, error: eErr } = await supabase
        .rpc("list_inv_job_order_assignments", { _inv_job_id: jobOrderId });
      if (eErr) throw eErr;
      setExisting((ex ?? []) as ExistingAssignment[]);
      setSelected(new Set());
    } catch (e) {
      toast.error(handleError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (open) loadAll(); }, [open, jobOrderId]);

  const alreadyAssigned = new Set(existing.map((e) => e.mover_id));

  const submit = async () => {
    if (selected.size === 0) return toast.error("Select at least one mover");
    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc("assign_movers_to_inv_job_order", {
        _inv_job_id: jobOrderId,
        _user_ids: Array.from(selected),
      });
      if (error) throw error;
      const newly = (data as { newly_assigned?: number } | null)?.newly_assigned ?? selected.size;
      toast.success(`Assigned ${newly} mover${newly === 1 ? "" : "s"}`);
      onAssigned?.();
      loadAll();
    } catch (e) {
      toast.error(handleError(e));
    } finally {
      setSubmitting(false);
    }
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" /> Assign Movers — Job #{jobNumber}
          </DialogTitle>
          <DialogDescription>{clientName}</DialogDescription>
        </DialogHeader>

        <div className="bg-blue-50 dark:bg-blue-950/30 border-l-4 border-blue-400 p-3 text-sm rounded">
          Selected movers will receive an in-app and push notification and can Accept or Decline from My Jobs. Times shown in EST.
        </div>

        {loading ? (
          <div className="py-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <>
            {existing.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Crew assignments & history log</Label>
                <div className="border rounded-lg divide-y max-h-72 overflow-y-auto">
                  {existing.map((e) => {
                    const events: { at: string; label: string }[] = [];
                    if (e.created_at) events.push({ at: e.created_at, label: "Assigned by Ops Manager" });
                    if (e.responded_at) events.push({ at: e.responded_at, label: e.status === "declined" ? `Declined${e.decline_reason ? ` — ${e.decline_reason}` : ""}` : "Accepted job" });
                    if (e.arrived_parking_at) events.push({ at: e.arrived_parking_at, label: "Arrived at parking lot" });
                    if (e.moving_to_site_at) events.push({ at: e.moving_to_site_at, label: "Moving to customer site (GPS tracking on)" });
                    if (e.arrived_site_at) events.push({ at: e.arrived_site_at, label: "Arrived at customer site" });
                    if (e.ended_at) events.push({ at: e.ended_at, label: "Completed job (tracking stopped)" });
                    events.sort((a, b) => a.at.localeCompare(b.at));
                    return (
                      <div key={e.mover_id} className="p-3 text-sm">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="font-medium">{e.first_name ?? ""} {e.last_name ?? ""}</div>
                          <div className="flex items-center gap-2">
                            {e.moving_to_site_at && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2"
                                onClick={() => setTrackTarget(e)}
                                title="Track this mover's live location"
                              >
                                <MapPin className="h-3 w-3 mr-1" /> Track
                              </Button>
                            )}
                            <Badge className={statusBadge(e.status)}>{e.status.replace("_", " ")}</Badge>
                          </div>
                        </div>

                        {events.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No activity yet.</p>
                        ) : (
                          <ol className="space-y-1 border-l-2 border-muted pl-3">
                            {events.map((ev, i) => (
                              <li key={i} className="text-xs">
                                <span className="text-muted-foreground">{fmtEst(ev.at)} — </span>
                                <span>{ev.label}</span>
                              </li>
                            ))}
                          </ol>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Add movers</Label>
              <MoverAutocomplete
                movers={movers}
                selectedIds={Array.from(selected)}
                onChange={(ids) => setSelected(new Set(ids))}
                disabledIds={Array.from(alreadyAssigned)}
                placeholder="Type a mover's name…"
              />
            </div>

          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={submit} disabled={submitting || selected.size === 0}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Assign {selected.size > 0 ? `(${selected.size})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
      {trackTarget && (
        <MoverLiveTrackDialog
          open={!!trackTarget}
          onOpenChange={(o) => !o && setTrackTarget(null)}
          assignmentRowId={trackTarget.assignment_id}
          moverName={`${trackTarget.first_name ?? ""} ${trackTarget.last_name ?? ""}`.trim() || "Mover"}
          jobNumber={jobNumber}
        />
      )}
    </Dialog>

  );
};

export default AssignMoversDialog;
