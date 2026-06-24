import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Plus, Map, Trash2 } from "lucide-react";
import { handleError } from "@/lib/errorHandler";

interface Route {
  id: string; route_date: string; name: string | null; status: string;
  truck_id: string | null; crew_id: string | null;
}
interface Stop { id: string; route_id: string; stop_order: number; address: string | null; scheduled_at: string | null; }

interface Props { userId: string; }

const PlanningBoard = ({ userId }: Props) => {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [stops, setStops] = useState<Record<string, Stop[]>>({});
  const [trucks, setTrucks] = useState<{ id: string; truck_number: string }[]>([]);
  const [crews, setCrews] = useState<{ id: string; name: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ route_date: new Date().toISOString().slice(0,10), name: "", truck_id: "", crew_id: "" });
  const [stopForm, setStopForm] = useState<Record<string, { address: string }>>({});

  const load = async () => {
    const [r, t, c] = await Promise.all([
      supabase.from("planning_routes").select("*").order("route_date", { ascending: false }).limit(60),
      supabase.from("trucks").select("id,truck_number").eq("is_active", true).order("truck_number"),
      supabase.from("crews").select("id,name").order("crew_date", { ascending: false }).limit(60),
    ]);
    if (r.error) toast.error(handleError(r.error)); else setRoutes((r.data || []) as Route[]);
    if (!t.error) setTrucks(t.data || []);
    if (!c.error) setCrews(c.data || []);
    if (r.data && r.data.length) {
      const ids = r.data.map((x: any) => x.id);
      const { data: s } = await supabase.from("planning_stops").select("*").in("route_id", ids).order("stop_order");
      const map: Record<string, Stop[]> = {};
      (s || []).forEach((row: any) => { (map[row.route_id] = map[row.route_id] || []).push(row); });
      setStops(map);
    } else setStops({});
  };
  useEffect(() => { load(); }, []);

  const createRoute = async () => {
    const { error } = await supabase.from("planning_routes").insert([{
      route_date: form.route_date, name: form.name || null,
      truck_id: form.truck_id || null, crew_id: form.crew_id || null,
      created_by: userId, status: "draft",
    }]);
    if (error) return toast.error(handleError(error));
    toast.success("Route created");
    setOpen(false);
    setForm({ ...form, name: "" });
    load();
  };

  const addStop = async (routeId: string) => {
    const f = stopForm[routeId];
    if (!f?.address) return;
    const order = (stops[routeId] || []).length;
    const { error } = await supabase.from("planning_stops").insert([{
      route_id: routeId, stop_order: order, address: f.address,
    }]);
    if (error) return toast.error(handleError(error));
    setStopForm({ ...stopForm, [routeId]: { address: "" } });
    load();
  };

  const removeStop = async (id: string) => { await supabase.from("planning_stops").delete().eq("id", id); load(); };
  const removeRoute = async (id: string) => {
    if (!confirm("Delete route?")) return;
    await supabase.from("planning_routes").delete().eq("id", id); load();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between bg-primary/5 p-4 rounded-t-lg">
        <CardTitle className="flex items-center gap-2"><Map className="h-5 w-5" /> Planning</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> New Route</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Route</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Date *</Label><Input type="date" value={form.route_date} onChange={e => setForm({ ...form, route_date: e.target.value })} /></div>
              <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Truck</Label>
                <SearchableSelect value={form.truck_id} onValueChange={v => setForm({ ...form, truck_id: v })}
                  options={trucks.map(t => ({ value: t.id, label: t.truck_number }))}
                  placeholder="Select" searchPlaceholder="Search..." emptyMessage="None" />
              </div>
              <div><Label>Crew</Label>
                <SearchableSelect value={form.crew_id} onValueChange={v => setForm({ ...form, crew_id: v })}
                  options={crews.map(c => ({ value: c.id, label: c.name }))}
                  placeholder="Select" searchPlaceholder="Search..." emptyMessage="None" />
              </div>
            </div>
            <DialogFooter><Button onClick={createRoute}>Create</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        <div className="bg-yellow-50 dark:bg-yellow-950/30 border-l-4 border-yellow-400 p-3 text-sm">
          Build daily routes — add ordered stops, assign a truck and crew.
        </div>
        {routes.length === 0 ? <p className="text-center text-muted-foreground py-6">No routes</p>
        : routes.map(r => (
          <Card key={r.id} className="p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="font-semibold">{r.name || "(unnamed)"} <span className="text-sm text-muted-foreground">· {r.route_date} · {r.status}</span></p>
              <Button variant="ghost" size="sm" onClick={() => removeRoute(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
            <ol className="list-decimal pl-5 space-y-1 mb-2">
              {(stops[r.id] || []).map(s => (
                <li key={s.id} className="flex items-center justify-between gap-2">
                  <span>{s.address}</span>
                  <Button variant="ghost" size="sm" onClick={() => removeStop(s.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                </li>
              ))}
            </ol>
            <div className="flex gap-2">
              <Input placeholder="Add stop address"
                value={stopForm[r.id]?.address || ""}
                onChange={e => setStopForm({ ...stopForm, [r.id]: { address: e.target.value } })} />
              <Button size="sm" onClick={() => addStop(r.id)}>Add</Button>
            </div>
          </Card>
        ))}
      </CardContent>
    </Card>
  );
};

export default PlanningBoard;
