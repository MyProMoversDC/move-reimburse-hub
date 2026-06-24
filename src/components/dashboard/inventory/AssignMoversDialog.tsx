import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, UserCheck } from "lucide-react";
import { handleError } from "@/lib/errorHandler";
import MoverAutocomplete from "./MoverAutocomplete";

interface Mover {
  id: string;
  first_name: string | null;
  last_name: string | null;
}

interface ExistingAssignment {
  mover_id: string;
  first_name: string | null;
  last_name: string | null;
  status: string;
  responded_at: string | null;
  decline_reason: string | null;
  started_at: string | null;
  ended_at: string | null;
  arrived_parking_at: string | null;
  arrived_site_at: string | null;
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
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

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

  const filtered = movers.filter((m) => {
    const name = `${m.first_name ?? ""} ${m.last_name ?? ""}`.toLowerCase();
    return name.includes(search.toLowerCase());
  });

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
                <Label className="text-sm font-semibold">Current assignments</Label>
                <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                  {existing.map((e) => (
                    <div key={e.mover_id} className="p-2 text-sm flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">{e.first_name ?? ""} {e.last_name ?? ""}</div>
                        <div className="text-xs text-muted-foreground space-y-0.5 mt-1">
                          {e.responded_at && <div>Responded: {fmtEst(e.responded_at)}</div>}
                          {e.decline_reason && <div className="text-red-700 dark:text-red-300">Reason: {e.decline_reason}</div>}
                          {e.arrived_parking_at && <div>Arrived parking: {fmtEst(e.arrived_parking_at)}</div>}
                          {e.arrived_site_at && <div>Arrived site: {fmtEst(e.arrived_site_at)}</div>}
                          {e.started_at && <div>Started: {fmtEst(e.started_at)}</div>}
                          {e.ended_at && <div>Ended: {fmtEst(e.ended_at)}</div>}
                        </div>
                      </div>
                      <Badge className={statusBadge(e.status)}>{e.status.replace("_", " ")}</Badge>
                    </div>
                  ))}
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
    </Dialog>
  );
};

export default AssignMoversDialog;
