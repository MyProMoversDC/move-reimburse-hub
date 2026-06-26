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
  const [trucks, setTrucks] = useState<{ id: string; truck_number: string; computed_status: string; is_available: boolean }[]>([]);
  const [open, setOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState<Row | null>(null);
  const [assignedCounts, setAssignedCounts] = useState<Record<string, { total: number; pending: number; confirmed: number; declined: number }>>({});
  const [search, setSearch] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;
  const [form, setForm] = useState({
    job_number: "", client_name: "", job_date: new Date().toISOString().slice(0,10),
    job_type_id: "", truck_id: "", pickup_address: "", dropoff_address: "", notes: "", status: "pending"
  });

  const loadTrucksForDate = async (dateStr: string) => {
    const { data, error } = await supabase.rpc("list_trucks_with_status", { _date: dateStr });
    if (!error) setTrucks((data || []) as any);
  };

  const load = async () => {
    const [j, t] = await Promise.all([
      supabase.from("inv_job_orders").select("*").order("job_date", { ascending: true }).limit(2000),
      supabase.from("job_types").select("id,name").order("name"),
    ]);
    if (j.error) toast.error(handleError(j.error)); else setRows((j.data || []) as Row[]);
    if (!t.error) setJobTypes(t.data || []);
    await loadAssignedCounts((j.data || []).map((x: any) => x.id));
    await loadTrucksForDate(form.job_date);
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
  useEffect(() => { setPage(1); }, [search, filterDate]);

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
        <div className="flex flex-col sm:flex-row gap-2 p-3 border-b bg-muted/30">
          <Input
            placeholder="Search by job # or client name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sm:max-w-xs"
          />
          <Input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="sm:w-44"
          />
          {(search || filterDate) && (
            <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setFilterDate(""); }}>
              Clear
            </Button>
          )}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Job #</TableHead><TableHead>Client</TableHead><TableHead>Date</TableHead>
              <TableHead>Status</TableHead><TableHead>Movers</TableHead><TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(() => {
              const q = search.trim().toLowerCase();
              const filteredRows = rows.filter(r => {
                if (filterDate && r.job_date !== filterDate) return false;
                if (q && !`${r.job_number} ${r.client_name}`.toLowerCase().includes(q)) return false;
                return true;
              });
              if (filteredRows.length === 0) {
                return <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">No job orders</TableCell></TableRow>;
              }
              const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
              const safePage = Math.min(page, totalPages);
              const start = (safePage - 1) * PAGE_SIZE;
              const pageRows = filteredRows.slice(start, start + PAGE_SIZE);
              return pageRows.map(r => {
              const c = assignedCounts[r.id];
              return (
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
                <TableCell className="text-xs">
                  {!c || c.total === 0 ? <span className="text-muted-foreground">None</span> : (
                    <div className="flex flex-wrap gap-1">
                      {c.pending > 0 && <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300">{c.pending} pending</Badge>}
                      {c.confirmed > 0 && <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">{c.confirmed} accepted</Badge>}
                      {c.declined > 0 && <Badge variant="secondary" className="bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">{c.declined} declined</Badge>}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => setAssignTarget(r)} title="Assign / view movers">
                    <UserCheck className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            );});
            })()}
          </TableBody>
        </Table>
        {(() => {
          const q = search.trim().toLowerCase();
          const total = rows.filter(r => {
            if (filterDate && r.job_date !== filterDate) return false;
            if (q && !`${r.job_number} ${r.client_name}`.toLowerCase().includes(q)) return false;
            return true;
          }).length;
          const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
          const safePage = Math.min(page, totalPages);
          if (total === 0) return null;
          const first = (safePage - 1) * PAGE_SIZE + 1;
          const last = Math.min(safePage * PAGE_SIZE, total);
          return (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 p-3 border-t bg-muted/30 text-sm">
              <div className="text-muted-foreground">Showing {first}–{last} of {total}</div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" disabled={safePage <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Previous</Button>
                <span>Page {safePage} of {totalPages}</span>
                <Button size="sm" variant="outline" disabled={safePage >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Next</Button>
              </div>
            </div>
          );
        })()}
      </CardContent>


      {assignTarget && (
        <AssignMoversDialog
          open={!!assignTarget}
          onOpenChange={(o) => !o && setAssignTarget(null)}
          jobOrderId={assignTarget.id}
          jobNumber={assignTarget.job_number}
          clientName={assignTarget.client_name}
          onAssigned={load}
        />
      )}
    </Card>
  );
};

export default JobOrdersManager;
