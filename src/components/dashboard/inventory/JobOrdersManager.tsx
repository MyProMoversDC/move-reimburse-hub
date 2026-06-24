import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Plus, ClipboardList, Trash2, UserCheck } from "lucide-react";
import { handleError } from "@/lib/errorHandler";
import AssignMoversDialog from "./AssignMoversDialog";

interface Row {
  id: string;
  job_number: string;
  client_name: string;
  job_date: string;
  status: string;
  pickup_address: string | null;
  dropoff_address: string | null;
  job_type_id: string | null;
  truck_id: string | null;
}

interface Props { userId: string; }

const JobOrdersManager = ({ userId }: Props) => {
  const [rows, setRows] = useState<Row[]>([]);
  const [jobTypes, setJobTypes] = useState<{ id: string; name: string }[]>([]);
  const [trucks, setTrucks] = useState<{ id: string; truck_number: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState<Row | null>(null);
  const [assignedCounts, setAssignedCounts] = useState<Record<string, { total: number; pending: number; confirmed: number; declined: number }>>({});
  const [form, setForm] = useState({
    job_number: "", client_name: "", job_date: new Date().toISOString().slice(0,10),
    job_type_id: "", truck_id: "", pickup_address: "", dropoff_address: "", notes: "", status: "pending"
  });

  const load = async () => {
    const [j, t, tr] = await Promise.all([
      supabase.from("inv_job_orders").select("*").order("job_date", { ascending: false }).limit(200),
      supabase.from("job_types").select("id,name").order("name"),
      supabase.from("trucks").select("id,truck_number").eq("is_active", true).order("truck_number"),
    ]);
    if (j.error) toast.error(handleError(j.error)); else setRows((j.data || []) as Row[]);
    if (!t.error) setJobTypes(t.data || []);
    if (!tr.error) setTrucks(tr.data || []);
    await loadAssignedCounts((j.data || []).map((x: any) => x.id));
  };

  const loadAssignedCounts = async (jobIds: string[]) => {
    if (jobIds.length === 0) { setAssignedCounts({}); return; }
    const { data, error } = await supabase
      .from("job_assignments")
      .select("external_job_id, mover_job_assignments(status)")
      .in("external_job_id", jobIds);
    if (error) return;
    const counts: typeof assignedCounts = {};
    (data ?? []).forEach((row: any) => {
      const list = (row.mover_job_assignments ?? []) as { status: string }[];
      counts[row.external_job_id] = {
        total: list.length,
        pending: list.filter(m => m.status === "pending").length,
        confirmed: list.filter(m => m.status === "confirmed" || m.status === "in_progress" || m.status === "completed").length,
        declined: list.filter(m => m.status === "declined").length,
      };
    });
    setAssignedCounts(counts);
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.job_number || !form.client_name || !form.job_date) return toast.error("Job number, client, date required");
    const { error } = await supabase.from("inv_job_orders").insert([{
      job_number: form.job_number, client_name: form.client_name, job_date: form.job_date,
      job_type_id: form.job_type_id || null, truck_id: form.truck_id || null,
      pickup_address: form.pickup_address || null, dropoff_address: form.dropoff_address || null,
      notes: form.notes || null, status: form.status, created_by: userId,
    }]);
    if (error) return toast.error(handleError(error));
    toast.success("Job order created");
    setOpen(false);
    setForm({ ...form, job_number: "", client_name: "", pickup_address: "", dropoff_address: "", notes: "" });
    load();
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("inv_job_orders").update({ status }).eq("id", id);
    if (error) return toast.error(handleError(error));
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this job order?")) return;
    const { error } = await supabase.from("inv_job_orders").delete().eq("id", id);
    if (error) return toast.error(handleError(error));
    load();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between bg-primary/5 p-4 rounded-t-lg">
        <CardTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5" /> Job Orders</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> New Job Order</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Create Job Order</DialogTitle></DialogHeader>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Job # *</Label><Input value={form.job_number} onChange={e => setForm({ ...form, job_number: e.target.value })} /></div>
                <div><Label>Date *</Label><Input type="date" value={form.job_date} onChange={e => setForm({ ...form, job_date: e.target.value })} /></div>
              </div>
              <div><Label>Client *</Label><Input value={form.client_name} onChange={e => setForm({ ...form, client_name: e.target.value })} /></div>
              <div><Label>Job Type</Label>
                <SearchableSelect value={form.job_type_id} onValueChange={v => setForm({ ...form, job_type_id: v })}
                  options={jobTypes.map(j => ({ value: j.id, label: j.name }))} placeholder="Select type" searchPlaceholder="Search..." emptyMessage="None" />
              </div>
              <div><Label>Truck</Label>
                <SearchableSelect value={form.truck_id} onValueChange={v => setForm({ ...form, truck_id: v })}
                  options={trucks.map(t => ({ value: t.id, label: t.truck_number }))} placeholder="Select truck" searchPlaceholder="Search..." emptyMessage="None" />
              </div>
              <div><Label>Pickup Address</Label><Input value={form.pickup_address} onChange={e => setForm({ ...form, pickup_address: e.target.value })} /></div>
              <div><Label>Dropoff Address</Label><Input value={form.dropoff_address} onChange={e => setForm({ ...form, dropoff_address: e.target.value })} /></div>
              <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={create}>Create</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="p-0">
        <div className="bg-yellow-50 dark:bg-yellow-950/30 border-l-4 border-yellow-400 p-3 text-sm">
          Create job orders and assign trucks. Crews can be linked from the Crews tab.
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Job #</TableHead><TableHead>Client</TableHead><TableHead>Date</TableHead>
              <TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No job orders</TableCell></TableRow>
            : rows.map(r => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.job_number}</TableCell>
                <TableCell>{r.client_name}</TableCell>
                <TableCell>{r.job_date}</TableCell>
                <TableCell>
                  <select value={r.status} onChange={e => updateStatus(r.id, e.target.value)} className="border rounded px-2 py-1 text-sm bg-background">
                    <option value="pending">Pending</option><option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option><option value="cancelled">Cancelled</option>
                  </select>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default JobOrdersManager;
