// Drop into src/components/dashboard/ in the Reimbursement Hub project,
// then render it from MoverDashboard.tsx as a new tab (e.g. case "my-jobs":).
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, Clock, Truck, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface JobRow {
  id: string;                    // mover_job_assignments.id
  status: "pending" | "confirmed" | "declined";
  responded_at: string | null;
  assignment: {
    id: string;
    job_number: string;
    client_name: string;
    service_date: string | null;
    move_size: string | null;
    scope_of_work: string | null;
    truck_number: string | null;
  };
}

interface Props { userId: string; }

export default function MoverJobAssignments({ userId }: Props) {
  const { toast } = useToast();
  const [rows, setRows] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("mover_job_assignments")
      .select("id, status, responded_at, assignment:job_assignments(id, job_number, client_name, service_date, move_size, scope_of_work, truck_number)")
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
      .on("postgres_changes", { event: "*", schema: "public", table: "mover_job_assignments", filter: `user_id=eq.${userId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

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

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (rows.length === 0) return <p className="text-center text-muted-foreground py-10">No jobs assigned to you yet.</p>;

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">My Jobs</h2>
      {rows.map(r => {
        const a = r.assignment;
        const badge =
          r.status === "confirmed" ? <Badge className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Confirmed</Badge> :
          r.status === "declined"  ? <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Declined</Badge> :
                                      <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
        return (
          <Card key={r.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-2">
              <div>
                <CardTitle>Job #{a.job_number} — {a.client_name}</CardTitle>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  {a.service_date && <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{a.service_date}</span>}
                  {a.truck_number && <span className="inline-flex items-center gap-1"><Truck className="h-3 w-3" />Truck {a.truck_number}</span>}
                  {a.move_size && <Badge variant="outline">{a.move_size}</Badge>}
                </div>
              </div>
              {badge}
            </CardHeader>
            <CardContent className="space-y-3">
              {a.scope_of_work && (
                <div>
                  <div className="text-sm font-medium mb-1">Scope of work</div>
                  <p className="text-sm whitespace-pre-wrap">{a.scope_of_work}</p>
                </div>
              )}
              {r.status === "pending" && (
                <div className="flex gap-2">
                  <Button onClick={() => respond(r.id, a.id, "confirmed")} disabled={busyId === r.id}>
                    {busyId === r.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                    Confirm
                  </Button>
                  <Button variant="outline" onClick={() => respond(r.id, a.id, "declined")} disabled={busyId === r.id}>
                    <XCircle className="h-4 w-4 mr-2" />Decline
                  </Button>
                </div>
              )}
              {r.responded_at && r.status !== "pending" && (
                <p className="text-xs text-muted-foreground">Responded {new Date(r.responded_at).toLocaleString()}</p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
