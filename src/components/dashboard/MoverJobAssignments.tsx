import { useEffect, useState } from "react";
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
import { Loader2, CheckCircle2, XCircle, Clock, Truck, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDateEST } from "@/lib/dateUtils";

interface JobAssignment {
  id: string;
  job_number: string;
  client_name: string;
  service_date: string | null;
  move_size: string | null;
  scope_of_work: string | null;
  truck_number: string | null;
}

interface JobRow {
  id: string; // mover_job_assignments.id
  status: "pending" | "confirmed" | "declined";
  responded_at: string | null;
  assignment: JobAssignment;
}

interface Props { userId: string; }

function StatusBadge({ status }: { status: JobRow["status"] }) {
  if (status === "confirmed") {
    return <Badge className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Confirmed</Badge>;
  }
  if (status === "declined") {
    return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Declined</Badge>;
  }
  return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
}

export default function MoverJobAssignments({ userId }: Props) {
  const { toast } = useToast();
  const [rows, setRows] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<JobRow | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("mover_job_assignments")
      .select(
        "id, status, responded_at, assignment:job_assignments(id, job_number, client_name, service_date, move_size, scope_of_work, truck_number)"
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Failed to load jobs", description: error.message, variant: "destructive" });
    } else {
      setRows((data ?? []) as unknown as JobRow[]);
    }
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
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Keep selected row in sync with refreshed list (e.g. after realtime update)
  useEffect(() => {
    if (!selected) return;
    const updated = rows.find((r) => r.id === selected.id);
    if (updated && updated !== selected) setSelected(updated);
  }, [rows, selected]);

  async function respond(rowId: string, assignmentId: string, status: "confirmed" | "declined") {
    setBusyId(rowId);
    const { error } = await supabase.functions.invoke("confirm-job", {
      body: { assignment_id: assignmentId, status },
    });
    setBusyId(null);
    if (error) {
      toast({ title: "Could not submit", description: error.message, variant: "destructive" });
    } else {
      toast({ title: status === "confirmed" ? "Job confirmed" : "Job declined" });
      load();
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (rows.length === 0) {
    return <p className="text-center text-muted-foreground py-10">No jobs assigned to you yet.</p>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">My Jobs</h2>

      {rows.map((r) => {
        const a = r.assignment;
        return (
          <Card
            key={r.id}
            onClick={() => setSelected(r)}
            className="cursor-pointer hover:bg-accent/50 transition-colors"
          >
            <CardHeader className="flex flex-row items-start justify-between gap-2">
              <div>
                <CardTitle>Job #{a.job_number} — {a.client_name}</CardTitle>
                <CardDescription className="mt-1 flex flex-wrap items-center gap-2">
                  {a.service_date && (
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDateEST(a.service_date)}
                    </span>
                  )}
                  {a.truck_number && (
                    <span className="inline-flex items-center gap-1">
                      <Truck className="h-3 w-3" />
                      Truck {a.truck_number}
                    </span>
                  )}
                  {a.move_size && <Badge variant="outline">{a.move_size}</Badge>}
                </CardDescription>
              </div>
              <StatusBadge status={r.status} />
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Click to view full details</p>
            </CardContent>
          </Card>
        );
      })}

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>Job #{selected.assignment.job_number}</DialogTitle>
                <DialogDescription>{selected.assignment.client_name}</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Status</Label>
                  <StatusBadge status={selected.status} />
                </div>

                {selected.assignment.service_date && (
                  <div>
                    <Label>Service Date</Label>
                    <p className="text-sm mt-1">{formatDateEST(selected.assignment.service_date)}</p>
                  </div>
                )}

                {selected.assignment.move_size && (
                  <div>
                    <Label>Move Size</Label>
                    <p className="text-sm mt-1">{selected.assignment.move_size}</p>
                  </div>
                )}

                {selected.assignment.truck_number && (
                  <div>
                    <Label>Truck</Label>
                    <p className="text-sm mt-1">Truck {selected.assignment.truck_number}</p>
                  </div>
                )}

                {selected.assignment.scope_of_work && (
                  <div>
                    <Label>Scope of Work</Label>
                    <p className="text-sm mt-1 whitespace-pre-wrap">{selected.assignment.scope_of_work}</p>
                  </div>
                )}

                {selected.responded_at && selected.status !== "pending" && (
                  <p className="text-xs text-muted-foreground">
                    Responded {new Date(selected.responded_at).toLocaleString()}
                  </p>
                )}
              </div>

              {selected.status === "pending" && (
                <DialogFooter className="gap-2">
                  <Button
                    variant="outline"
                    onClick={() => respond(selected.id, selected.assignment.id, "declined")}
                    disabled={busyId === selected.id}
                  >
                    {busyId === selected.id ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <XCircle className="h-4 w-4 mr-2" />
                    )}
                    Decline
                  </Button>
                  <Button
                    onClick={() => respond(selected.id, selected.assignment.id, "confirmed")}
                    disabled={busyId === selected.id}
                  >
                    {busyId === selected.id ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                    )}
                    Confirm Job
                  </Button>
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
