import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, Truck } from "lucide-react";
import { handleError } from "@/lib/errorHandler";

interface TruckRow {
  id: string;
  truck_number: string;
  license_plate: string | null;
  capacity_notes: string | null;
  is_active: boolean;
}

const FleetManager = () => {
  const [trucks, setTrucks] = useState<TruckRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TruckRow | null>(null);
  const [form, setForm] = useState({ truck_number: "", license_plate: "", capacity_notes: "", is_active: true });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("trucks").select("*").order("truck_number");
    if (error) toast.error(handleError(error));
    else setTrucks((data || []) as TruckRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ truck_number: "", license_plate: "", capacity_notes: "", is_active: true });
    setOpen(true);
  };
  const openEdit = (t: TruckRow) => {
    setEditing(t);
    setForm({
      truck_number: t.truck_number,
      license_plate: t.license_plate || "",
      capacity_notes: t.capacity_notes || "",
      is_active: t.is_active,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.truck_number.trim()) return toast.error("Truck number required");
    const payload = {
      truck_number: form.truck_number.trim(),
      license_plate: form.license_plate || null,
      capacity_notes: form.capacity_notes || null,
      is_active: form.is_active,
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
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Edit Truck" : "Add Truck"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Truck Number *</Label><Input value={form.truck_number} onChange={e => setForm({ ...form, truck_number: e.target.value })} /></div>
              <div><Label>License Plate</Label><Input value={form.license_plate} onChange={e => setForm({ ...form, license_plate: e.target.value })} /></div>
              <div><Label>Capacity / Notes</Label><Input value={form.capacity_notes} onChange={e => setForm({ ...form, capacity_notes: e.target.value })} /></div>
              <div className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} /><Label>Active</Label></div>
            </div>
            <DialogFooter><Button onClick={save}>{editing ? "Save" : "Add"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="p-0">
        <div className="bg-yellow-50 dark:bg-yellow-950/30 border-l-4 border-yellow-400 p-3 text-sm">
          Shared with Operations Manager and Warehouse Keeper. Both roles can add, edit, or remove trucks.
        </div>
        {loading ? <p className="p-4">Loading...</p> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Truck</TableHead><TableHead>Plate</TableHead><TableHead>Notes</TableHead>
                <TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trucks.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No trucks yet</TableCell></TableRow>
              : trucks.map(t => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.truck_number}</TableCell>
                  <TableCell>{t.license_plate || "—"}</TableCell>
                  <TableCell>{t.capacity_notes || "—"}</TableCell>
                  <TableCell><Badge variant={t.is_active ? "default" : "secondary"}>{t.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => remove(t.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default FleetManager;
