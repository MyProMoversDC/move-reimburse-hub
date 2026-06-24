import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Map, Trash2 } from "lucide-react";
import { handleError } from "@/lib/errorHandler";

interface Zone {
  id: string; name: string; zone_type: string | null; status: string;
  x_pct: number; y_pct: number; width_pct: number; height_pct: number; color: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  available: "bg-green-200 border-green-500",
  occupied: "bg-blue-200 border-blue-500",
  reserved: "bg-amber-200 border-amber-500",
  blocked: "bg-red-200 border-red-500",
};

const WarehouseLiveMap = () => {
  const [zones, setZones] = useState<Zone[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Zone | null>(null);
  const [form, setForm] = useState({ name: "", zone_type: "", status: "available", x_pct: 10, y_pct: 10, width_pct: 15, height_pct: 15 });

  const load = async () => {
    const { data, error } = await supabase.from("warehouse_zones").select("*").order("created_at");
    if (error) toast.error(handleError(error)); else setZones((data || []) as Zone[]);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name) return toast.error("Name required");
    const { error } = await supabase.from("warehouse_zones").insert([form]);
    if (error) return toast.error(handleError(error));
    setOpen(false);
    setForm({ name: "", zone_type: "", status: "available", x_pct: 10, y_pct: 10, width_pct: 15, height_pct: 15 });
    load();
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("warehouse_zones").update({ status }).eq("id", id);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete zone?")) return;
    await supabase.from("warehouse_zones").delete().eq("id", id);
    setSelected(null);
    load();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between bg-primary/5 p-4 rounded-t-lg">
        <CardTitle className="flex items-center gap-2"><Map className="h-5 w-5" /> Warehouse Live Map</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Add Zone</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Zone</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Type</Label><Input value={form.zone_type} onChange={e => setForm({ ...form, zone_type: e.target.value })} placeholder="e.g. Rack, Dock" /></div>
              <div className="grid grid-cols-4 gap-2">
                <div><Label>X%</Label><Input type="number" value={form.x_pct} onChange={e => setForm({ ...form, x_pct: Number(e.target.value) })} /></div>
                <div><Label>Y%</Label><Input type="number" value={form.y_pct} onChange={e => setForm({ ...form, y_pct: Number(e.target.value) })} /></div>
                <div><Label>W%</Label><Input type="number" value={form.width_pct} onChange={e => setForm({ ...form, width_pct: Number(e.target.value) })} /></div>
                <div><Label>H%</Label><Input type="number" value={form.height_pct} onChange={e => setForm({ ...form, height_pct: Number(e.target.value) })} /></div>
              </div>
            </div>
            <DialogFooter><Button onClick={save}>Add</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        <div className="bg-yellow-50 dark:bg-yellow-950/30 border-l-4 border-yellow-400 p-3 text-sm">
          Visual warehouse layout. Click a zone to change its status (Available, Occupied, Reserved, Blocked).
        </div>
        <div className="relative w-full aspect-[16/9] border-2 border-dashed bg-muted/30 rounded-lg overflow-hidden">
          {zones.map(z => (
            <button key={z.id} onClick={() => setSelected(z)}
              className={`absolute border-2 rounded text-xs font-medium flex items-center justify-center hover:opacity-90 ${STATUS_COLORS[z.status] || "bg-gray-200 border-gray-500"}`}
              style={{ left: `${z.x_pct}%`, top: `${z.y_pct}%`, width: `${z.width_pct}%`, height: `${z.height_pct}%` }}
              title={`${z.name} — ${z.status}`}>
              {z.name}
            </button>
          ))}
          {zones.length === 0 && <p className="absolute inset-0 flex items-center justify-center text-muted-foreground">No zones — add one to get started</p>}
        </div>
        <div className="flex gap-2 text-xs">
          {Object.entries(STATUS_COLORS).map(([k, c]) => (
            <span key={k} className="flex items-center gap-1"><span className={`inline-block w-3 h-3 ${c} border`} /> {k}</span>
          ))}
        </div>

        {selected && (
          <Card className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{selected.name}</p>
                <p className="text-xs text-muted-foreground">{selected.zone_type || "—"}</p>
              </div>
              <div className="flex gap-2 items-center">
                <Badge>{selected.status}</Badge>
                <select value={selected.status} onChange={e => updateStatus(selected.id, e.target.value)} className="border rounded px-2 py-1 text-sm bg-background">
                  {Object.keys(STATUS_COLORS).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <Button variant="ghost" size="sm" onClick={() => remove(selected.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>Close</Button>
              </div>
            </div>
          </Card>
        )}
      </CardContent>
    </Card>
  );
};

export default WarehouseLiveMap;
