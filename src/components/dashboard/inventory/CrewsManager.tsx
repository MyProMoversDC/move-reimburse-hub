import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Plus, Users, Trash2, X } from "lucide-react";
import { handleError } from "@/lib/errorHandler";

interface Crew { id: string; name: string; crew_date: string; lead_user_id: string | null; truck_id: string | null; }
interface Mover { id: string; first_name: string; last_name: string; }

interface Props { userId: string; }

const CrewsManager = ({ userId }: Props) => {
  const [crews, setCrews] = useState<Crew[]>([]);
  const [movers, setMovers] = useState<Mover[]>([]);
  const [trucks, setTrucks] = useState<{ id: string; truck_number: string }[]>([]);
  const [members, setMembers] = useState<Record<string, { id: string; user_id: string; name: string }[]>>({});
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", crew_date: new Date().toISOString().slice(0,10), lead_user_id: "", truck_id: "" });
  const [extraMembers, setExtraMembers] = useState<string[]>([""]);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [memberPick, setMemberPick] = useState("");

  const load = async () => {
    const [c, m, t] = await Promise.all([
      supabase.from("crews").select("*").order("crew_date", { ascending: false }),
      supabase.rpc("list_chat_users_for_picker", { exclude_user_id: null }),
      supabase.from("trucks").select("id,truck_number").eq("is_active", true).order("truck_number"),
    ]);
    if (c.error) toast.error(handleError(c.error)); else setCrews((c.data || []) as Crew[]);
    if (!m.error) {
      const onlyMovers = (m.data || []).filter((u: any) => (u.roles || []).includes("mover"));
      setMovers(onlyMovers);
    }
    if (!t.error) setTrucks(t.data || []);

    // load members for all crews
    if (c.data && c.data.length) {
      const ids = c.data.map((x: any) => x.id);
      const { data: mems } = await supabase
        .from("crew_members").select("id,crew_id,user_id,profiles!crew_members_user_id_fkey(first_name,last_name)").in("crew_id", ids);
      const map: Record<string, { id: string; user_id: string; name: string }[]> = {};
      (mems || []).forEach((row: any) => {
        const arr = map[row.crew_id] || (map[row.crew_id] = []);
        arr.push({ id: row.id, user_id: row.user_id, name: `${row.profiles?.first_name || ""} ${row.profiles?.last_name || ""}`.trim() });
      });
      setMembers(map);
    } else setMembers({});
  };
  useEffect(() => { load(); }, []);

  const createCrew = async () => {
    if (!form.name || !form.crew_date) return toast.error("Name and date required");
    const { data: created, error } = await supabase.from("crews").insert([{
      name: form.name, crew_date: form.crew_date,
      lead_user_id: form.lead_user_id || null, truck_id: form.truck_id || null,
      created_by: userId,
    }]).select("id").single();
    if (error || !created) return toast.error(handleError(error));

    // Insert lead + extra members into crew_members (dedup, skip empties)
    const memberIds = Array.from(new Set(
      [form.lead_user_id, ...extraMembers].filter((x) => x && x.trim() !== "")
    ));
    if (memberIds.length > 0) {
      const { error: mErr } = await supabase
        .from("crew_members")
        .insert(memberIds.map((uid) => ({ crew_id: created.id, user_id: uid })));
      if (mErr) toast.error(handleError(mErr));
    }

    toast.success("Crew created");
    setOpen(false);
    setForm({ name: "", crew_date: new Date().toISOString().slice(0,10), lead_user_id: "", truck_id: "" });
    setExtraMembers([""]);
    load();
  };

  const updateExtraMember = (index: number, value: string) => {
    setExtraMembers((prev) => {
      const next = [...prev];
      next[index] = value;
      // Auto-append a new empty slot when the last slot just got filled
      if (value && index === next.length - 1) next.push("");
      return next;
    });
  };
  const removeExtraMember = (index: number) => {
    setExtraMembers((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length === 0 ? [""] : next;
    });
  };


  const addMember = async (crewId: string) => {
    if (!memberPick) return;
    const { error } = await supabase.from("crew_members").insert([{ crew_id: crewId, user_id: memberPick }]);
    if (error) return toast.error(handleError(error));
    setMemberPick("");
    setAddingTo(null);
    load();
  };
  const removeMember = async (id: string) => {
    await supabase.from("crew_members").delete().eq("id", id);
    load();
  };
  const removeCrew = async (id: string) => {
    if (!confirm("Delete crew?")) return;
    await supabase.from("crews").delete().eq("id", id);
    load();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between bg-primary/5 p-4 rounded-t-lg">
        <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Crews</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> New Crew</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Crew</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Date *</Label><Input type="date" value={form.crew_date} onChange={e => setForm({ ...form, crew_date: e.target.value })} /></div>
              <div><Label>Lead (mover)</Label>
                <SearchableSelect value={form.lead_user_id} onValueChange={v => setForm({ ...form, lead_user_id: v })}
                  options={movers.map(m => ({ value: m.id, label: `${m.first_name} ${m.last_name}` }))}
                  placeholder="Select lead" searchPlaceholder="Search movers..." emptyMessage="No movers" />
              </div>
              <div><Label>Truck</Label>
                <SearchableSelect value={form.truck_id} onValueChange={v => setForm({ ...form, truck_id: v })}
                  options={trucks.map(t => ({ value: t.id, label: t.truck_number }))}
                  placeholder="Select truck" searchPlaceholder="Search..." emptyMessage="None" />
              </div>
            </div>
            <DialogFooter><Button onClick={createCrew}>Create</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        <div className="bg-yellow-50 dark:bg-yellow-950/30 border-l-4 border-yellow-400 p-3 text-sm">
          Build crews from existing movers. Use Crew Tracking to see crews on the map in real time.
        </div>
        {crews.length === 0 ? <p className="text-center text-muted-foreground py-6">No crews yet</p>
        : crews.map(c => (
          <Card key={c.id} className="p-3">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="font-semibold">{c.name} <span className="text-sm text-muted-foreground">· {c.crew_date}</span></p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => removeCrew(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
            <div className="flex flex-wrap gap-2 mb-2">
              {(members[c.id] || []).map(m => (
                <Badge key={m.id} variant="secondary" className="gap-1">
                  {m.name}
                  <button onClick={() => removeMember(m.id)}><X className="h-3 w-3" /></button>
                </Badge>
              ))}
              {(!members[c.id] || members[c.id].length === 0) && <span className="text-xs text-muted-foreground">No members</span>}
            </div>
            {addingTo === c.id ? (
              <div className="flex gap-2">
                <SearchableSelect value={memberPick} onValueChange={setMemberPick}
                  options={movers.filter(m => !(members[c.id] || []).some(x => x.user_id === m.id))
                    .map(m => ({ value: m.id, label: `${m.first_name} ${m.last_name}` }))}
                  placeholder="Pick mover" searchPlaceholder="Search movers..." emptyMessage="No movers" triggerClassName="flex-1" />
                <Button size="sm" onClick={() => addMember(c.id)}>Add</Button>
                <Button size="sm" variant="ghost" onClick={() => { setAddingTo(null); setMemberPick(""); }}>Cancel</Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setAddingTo(c.id)}><Plus className="h-3 w-3 mr-1" /> Add member</Button>
            )}
          </Card>
        ))}
      </CardContent>
    </Card>
  );
};

export default CrewsManager;
