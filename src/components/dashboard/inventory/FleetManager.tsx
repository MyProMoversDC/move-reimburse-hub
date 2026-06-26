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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, Truck } from "lucide-react";
import { handleError } from "@/lib/errorHandler";

type ManualStatus = "active" | "under_maintenance" | "inactive" | "out_of_service";
type ComputedStatus = ManualStatus | "reserved" | "in_use";

interface TruckRow {
  id: string;
  truck_number: string;
  license_plate: string | null;
  capacity_notes: string | null;
  manual_status: ManualStatus;
  maintenance_start_date: string | null;
  maintenance_end_date: string | null;
  maintenance_notes: string | null;
  computed_status: ComputedStatus;
}

const MANUAL_STATUS_OPTIONS: { value: ManualStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "under_maintenance", label: "Under Maintenance" },
  { value: "inactive", label: "Inactive" },
  { value: "out_of_service", label: "Out of Service" },
];

export const STATUS_LABEL: Record<ComputedStatus, string> = {
  active: "Active",
  reserved: "Reserved",
  in_use: "In Use",
  under_maintenance: "Under Maintenance",
  inactive: "Inactive",
  out_of_service: "Out of Service",
};

export const StatusBadge = ({ status }: { status: ComputedStatus }) => {
  const cls: Record<ComputedStatus, string> = {
    active: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 border-green-300",
    reserved: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300 border-orange-300",
    in_use: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-300",
    under_maintenance: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300 border-yellow-300",
    inactive: "bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200 border-gray-300",
    out_of_service: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border-red-300",
  };
  return <Badge variant="outline" className={cls[status]}>{STATUS_LABEL[status]}</Badge>;
};

const FleetManager = () => {
  const [trucks, setTrucks] = useState<TruckRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TruckRow | null>(null);
  const [form, setForm] = useState({
    truck_number: "",
    license_plate: "",
    capacity_notes: "",
    manual_status: "active" as ManualStatus,
    maintenance_start_date: "",
    maintenance_end_date: "",
    maintenance_notes: "",
  });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("list_trucks_with_status", {
      _date: new Date().toISOString().slice(0, 10),
    });
    if (error) toast.error(handleError(error));
    else setTrucks((data || []) as TruckRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({
      truck_number: "", license_plate: "", capacity_notes: "",
      manual_status: "active", maintenance_start_date: "", maintenance_end_date: "", maintenance_notes: "",
    });
    setOpen(true);
  };
  const openEdit = (t: TruckRow) => {
    setEditing(t);
    setForm({
      truck_number: t.truck_number,
      license_plate: t.license_plate || "",
      capacity_notes: t.capacity_notes || "",
      manual_status: t.manual_status,
      maintenance_start_date: t.maintenance_start_date || "",
      maintenance_end_date: t.maintenance_end_date || "",
      maintenance_notes: t.maintenance_notes || "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.truck_number.trim()) return toast.error("Truck number required");
    if (form.manual_status === "under_maintenance") {
      if (!form.maintenance_start_date || !form.maintenance_end_date) {
        return toast.error("Maintenance start and end dates are required");
      }
      if (form.maintenance_end_date < form.maintenance_start_date) {
        return toast.error("Maintenance end date must be on or after start date");
      }
    }
    const payload: any = {
      truck_number: form.truck_number.trim(),
      license_plate: form.license_plate || null,
      capacity_notes: form.capacity_notes || null,
      manual_status: form.manual_status,
      maintenance_start_date: form.manual_status === "under_maintenance" ? form.maintenance_start_date : null,
      maintenance_end_date: form.manual_status === "under_maintenance" ? form.maintenance_end_date : null,
      maintenance_notes: form.manual_status === "under_maintenance" ? (form.maintenance_notes || null) : null,
    };
    const { error } = editing
      ? await supabase.from("trucks").update(payload).eq("id", editing.id)
      : await supabase.from("trucks").insert([payload]);
    if (error) return toast.error(handleError(error));
    toast.success(editing ? "Truck updated" : "Truck added");
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this truck? Linked truck inventory will also be removed.")) return;
    const { error } = await supabase.from("trucks").delete().eq("id", id);
    if (error) return toast.error(handleError(error));
    toast.success("Truck deleted");
    load();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between bg-primary/5 p-4 rounded-t-lg">
        <CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5" /> Fleet</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Add Truck</Button></DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{editing ? "Edit Truck" : "Add Truck"}</DialogTitle></DialogHeader>
            <div className="space-y-3 max-h-[70vh] overflow-y-auto">
              <div><Label>Truck Number *</Label><Input value={form.truck_number} onChange={e => setForm({ ...form, truck_number: e.target.value })} /></div>
              <div><Label>License Plate</Label><Input value={form.license_plate} onChange={e => setForm({ ...form, license_plate: e.target.value })} /></div>
              <div><Label>Capacity / Notes</Label><Input value={form.capacity_notes} onChange={e => setForm({ ...form, capacity_notes: e.target.value })} /></div>
              <div>
                <Label>Truck Status *</Label>
                <Select value={form.manual_status} onValueChange={(v) => setForm({ ...form, manual_status: v as ManualStatus })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MANUAL_STATUS_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Reserved and In Use are computed automatically from job orders.
                </p>
              </div>
              {form.manual_status === "under_maintenance" && (
                <div className="space-y-2 rounded-md border border-yellow-300 bg-yellow-50 dark:bg-yellow-950/30 p-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Maintenance Start *</Label>
                      <Input type="date" value={form.maintenance_start_date} onChange={e => setForm({ ...form, maintenance_start_date: e.target.value })} />
                    </div>
                    <div>
                      <Label>Maintenance End *</Label>
                      <Input type="date" value={form.maintenance_end_date} onChange={e => setForm({ ...form, maintenance_end_date: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <Label>Maintenance Notes</Label>
                    <Textarea value={form.maintenance_notes} onChange={e => setForm({ ...form, maintenance_notes: e.target.value })} placeholder="Optional notes about the maintenance" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Truck cannot be assigned to jobs that overlap this period.
                  </p>
                </div>
              )}
            </div>
            <DialogFooter><Button onClick={save}>{editing ? "Save" : "Add"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="p-0">
        <div className="bg-yellow-50 dark:bg-yellow-950/30 border-l-4 border-yellow-400 p-3 text-sm">
          Shared with Operations Manager and Warehouse Keeper. Status shown for today; Reserved/In Use are calculated automatically from scheduled and active jobs.
        </div>
        {loading ? <p className="p-4">Loading...</p> : trucks.length === 0 ? (
          <p className="text-center text-muted-foreground py-6">No trucks yet</p>
        ) : (
          <>
            {/* Desktop table — unchanged */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Truck</TableHead><TableHead>Plate</TableHead><TableHead>Notes</TableHead>
                    <TableHead>Status (today)</TableHead><TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trucks.map(t => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.truck_number}</TableCell>
                      <TableCell>{t.license_plate || "—"}</TableCell>
                      <TableCell>{t.capacity_notes || "—"}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <StatusBadge status={t.computed_status} />
                          {t.computed_status !== t.manual_status && (
                            <span className="text-[10px] text-muted-foreground">manual: {STATUS_LABEL[t.manual_status]}</span>
                          )}
                          {t.manual_status === "under_maintenance" && t.maintenance_start_date && (
                            <span className="text-[10px] text-muted-foreground">
                              {t.maintenance_start_date} → {t.maintenance_end_date}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => remove(t.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile cards — truck# headline + availability-first */}
            <div className="md:hidden divide-y">
              {trucks.map(t => (
                <div key={t.id} className="p-3 active:bg-muted/40">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="font-bold text-lg leading-none flex items-center gap-2">
                        <Truck className="h-4 w-4 text-muted-foreground" />
                        {t.truck_number}
                      </p>
                      {t.license_plate && (
                        <p className="text-xs text-muted-foreground mt-1">Plate: {t.license_plate}</p>
                      )}
                    </div>
                    <StatusBadge status={t.computed_status} />
                  </div>

                  {(t.computed_status !== t.manual_status || (t.manual_status === "under_maintenance" && t.maintenance_start_date)) && (
                    <div className="text-[11px] text-muted-foreground space-y-0.5 mb-2">
                      {t.computed_status !== t.manual_status && (
                        <div>Manual: {STATUS_LABEL[t.manual_status]}</div>
                      )}
                      {t.manual_status === "under_maintenance" && t.maintenance_start_date && (
                        <div>Maintenance: {t.maintenance_start_date} → {t.maintenance_end_date}</div>
                      )}
                    </div>
                  )}

                  {t.capacity_notes && (
                    <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{t.capacity_notes}</p>
                  )}

                  <div className="flex gap-2 pt-1">
                    <Button variant="outline" size="sm" className="flex-1 h-10" onClick={() => openEdit(t)}>
                      <Pencil className="h-4 w-4 mr-1" /> Edit
                    </Button>
                    <Button variant="ghost" size="sm" className="h-10" onClick={() => remove(t.id)} aria-label="Delete">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default FleetManager;
