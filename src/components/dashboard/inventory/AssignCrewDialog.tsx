import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Loader2 } from "lucide-react";
import { handleError } from "@/lib/errorHandler";
import MoverAutocomplete from "./MoverAutocomplete";

interface PlanningJob {
  id: string;
  smartmoving_id: string;
  job_number: string | null;
  customer_name: string | null;
  service_date: string | null;
  address: string | null;
  move_size: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  job: PlanningJob | null;
  userId: string;
  onSaved?: () => void;
}

interface Mover { id: string; first_name: string; last_name: string; }
interface Crew { id: string; name: string; crew_date?: string | null; }
interface Truck { id: string; truck_number: string; }
interface ExistingAssignment {
  mover_id: string;
  first_name: string;
  last_name: string;
  status: string;
  decline_reason: string | null;
}

const AssignCrewDialog = ({ open, onOpenChange, job, userId, onSaved }: Props) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [movers, setMovers] = useState<Mover[]>([]);
  const [crews, setCrews] = useState<Crew[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [existingJobOrderId, setExistingJobOrderId] = useState<string | null>(null);
  const [existingAssignments, setExistingAssignments] = useState<ExistingAssignment[]>([]);

  const [form, setForm] = useState({
    truck_id: "",
    crew_id: "none",
    move_size: "",
    scope_of_work: "",
    parking_lot_time: "",
    job_site_time: "",
    notes: "",
  });
  const [selectedMoverIds, setSelectedMoverIds] = useState<string[]>([]);
  const [moverSearch, setMoverSearch] = useState("");

  useEffect(() => {
    if (!open || !job) return;
    (async () => {
      setLoading(true);
      try {
        const [roleRes, crewsRes, trucksRes, existingRes] = await Promise.all([
          supabase.from("user_roles").select("user_id").eq("role", "mover"),
          supabase.from("crews").select("id, name, crew_date").order("crew_date", { ascending: false }).limit(200),
          supabase.from("trucks").select("id, truck_number").eq("is_active", true).order("truck_number"),
          supabase
            .from("inv_job_orders")
            .select("id, truck_id, notes")
            .eq("planned_from_smartmoving_id", job.smartmoving_id)
            .maybeSingle(),
        ]);

        const moverIds = (roleRes.data ?? []).map((r: any) => r.user_id);
        let moversList: Mover[] = [];
        if (moverIds.length > 0) {
          const { data: profs } = await supabase
            .from("profiles")
            .select("id, first_name, last_name")
            .in("id", moverIds);
          moversList = [...(profs ?? [])].sort((a: any, b: any) =>
            `${a.first_name ?? ""} ${a.last_name ?? ""}`.localeCompare(`${b.first_name ?? ""} ${b.last_name ?? ""}`)
          ) as Mover[];
        }
        setMovers(moversList);
        setCrews(crewsRes.data ?? []);
        setTrucks(trucksRes.data ?? []);

        setForm(f => ({ ...f, move_size: job.move_size ?? "" }));

        if (existingRes.data) {
          setExistingJobOrderId(existingRes.data.id);
          setForm(f => ({
            ...f,
            truck_id: existingRes.data!.truck_id ?? "",
            scope_of_work: existingRes.data!.notes ?? "",
          }));
          const { data: assigns } = await supabase.rpc("list_inv_job_order_assignments", { _inv_job_id: existingRes.data.id });
          const list = (assigns as any[]) ?? [];
          setExistingAssignments(list);
          setSelectedMoverIds(list.map(a => a.mover_id));
        } else {
          setExistingJobOrderId(null);
          setExistingAssignments([]);
          setSelectedMoverIds([]);
        }
      } catch (e) {
        toast.error(handleError(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [open, job]);

  const applyCrewTemplate = async (crewId: string) => {
    setForm(f => ({ ...f, crew_id: crewId }));
    if (crewId === "none") return;
    const { data } = await supabase.from("crew_members").select("user_id").eq("crew_id", crewId);
    setSelectedMoverIds((data ?? []).map((r: any) => r.user_id));
  };

  const toggleMover = (id: string) => {
    setSelectedMoverIds(ids => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]);
  };

  const handleSave = async () => {
    if (!job?.service_date) { toast.error("Job has no service date"); return; }
    if (!form.truck_id) { toast.error("Select a truck"); return; }
    if (selectedMoverIds.length < 2) { toast.error("Select at least 2 movers"); return; }

    setSaving(true);
    try {
      const jobNumber = job.job_number || `SM-${job.smartmoving_id.slice(0, 8)}`;
      const customerName = job.customer_name || "SmartMoving customer";
      const composedNotes = [
        form.scope_of_work && `Scope: ${form.scope_of_work}`,
        form.parking_lot_time && `Parking lot: ${form.parking_lot_time}`,
        form.job_site_time && `Job site: ${form.job_site_time}`,
        form.move_size && `Move size: ${form.move_size}`,
        form.notes && `Notes: ${form.notes}`,
      ].filter(Boolean).join("\n");

      let invJobId = existingJobOrderId;

      // Defensive: an inv_job_order with this job_number (or smartmoving_id)
      // may already exist from a previous run / manual entry. Reuse it
      // instead of hitting the UNIQUE(job_number) constraint, which would
      // throw an error and block the mover notification from being sent.
      if (!invJobId) {
        const { data: byNumber } = await supabase
          .from("inv_job_orders")
          .select("id")
          .or(`job_number.eq.${jobNumber},smartmoving_id.eq.${job.smartmoving_id}`)
          .maybeSingle();
        if (byNumber?.id) invJobId = byNumber.id;
      }

      if (invJobId) {
        const { error } = await supabase
          .from("inv_job_orders")
          .update({
            truck_id: form.truck_id,
            notes: composedNotes || null,
            pickup_address: job.address ?? null,
            planned_from_smartmoving_id: job.smartmoving_id,
          })
          .eq("id", invJobId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("inv_job_orders")
          .insert({
            job_number: jobNumber,
            client_name: customerName,
            job_date: job.service_date,
            truck_id: form.truck_id,
            pickup_address: job.address ?? null,
            notes: composedNotes || null,
            status: "planned",
            smartmoving_id: job.smartmoving_id,
            planned_from_smartmoving_id: job.smartmoving_id,
            created_by: userId,
          })
          .select("id")
          .single();
        if (error) throw error;
        invJobId = data.id;
      }

      const { error: rpcErr } = await supabase.rpc("assign_movers_to_inv_job_order", {
        _inv_job_id: invJobId,
        _user_ids: selectedMoverIds,
      });
      if (rpcErr) throw rpcErr;

      toast.success("Crew assigned — movers notified");
      onOpenChange(false);
      onSaved?.();
    } catch (e) {
      toast.error(handleError(e));
    } finally {
      setSaving(false);
    }
  };

  const moverStatus = (id: string) => existingAssignments.find(a => a.mover_id === id);
  const filteredMovers = movers.filter(m =>
    !moverSearch ||
    `${m.first_name} ${m.last_name}`.toLowerCase().includes(moverSearch.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assign Crew</DialogTitle>
          <DialogDescription>
            {job?.customer_name} · Job #{job?.job_number ?? "—"} · {job?.service_date}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-950/30 border-l-4 border-blue-400 p-3 text-sm">
              Pick a truck, choose a crew template (or select movers manually), and save. Selected movers
              will receive an in-app and push notification and must Accept or Decline.
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Truck *</Label>
                <SearchableSelect
                  value={form.truck_id}
                  onValueChange={(v) => setForm({ ...form, truck_id: v })}
                  options={trucks.map(t => ({ value: t.id, label: t.truck_number }))}
                  placeholder="Select truck"
                  searchPlaceholder="Search trucks..."
                  emptyMessage="No trucks"
                />
              </div>
              <div>
                <Label>Crew template (optional)</Label>
                <SearchableSelect
                  value={form.crew_id}
                  onValueChange={applyCrewTemplate}
                  options={[{ value: "none", label: "— Ad-hoc —" }, ...crews.map(c => ({ value: c.id, label: c.crew_date ? `${c.name} · ${c.crew_date}` : c.name }))]}
                  placeholder="Select crew"
                  searchPlaceholder="Search crews..."
                  emptyMessage="No crews"
                />
              </div>
              <div>
                <Label>Move size</Label>
                <Input value={form.move_size} onChange={e => setForm({ ...form, move_size: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Parking-lot time</Label>
                  <Input type="time" value={form.parking_lot_time} onChange={e => setForm({ ...form, parking_lot_time: e.target.value })} />
                </div>
                <div>
                  <Label>Job-site time</Label>
                  <Input type="time" value={form.job_site_time} onChange={e => setForm({ ...form, job_site_time: e.target.value })} />
                </div>
              </div>
            </div>

            <div>
              <Label>Scope of work</Label>
              <Textarea rows={2} value={form.scope_of_work} onChange={e => setForm({ ...form, scope_of_work: e.target.value })} />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>

            <div>
              <Label>Movers ({selectedMoverIds.length} selected, minimum 2)</Label>
              <MoverAutocomplete
                movers={movers}
                selectedIds={selectedMoverIds}
                onChange={setSelectedMoverIds}
                placeholder="Type a mover's name…"
              />
              {existingAssignments.length > 0 && (
                <div className="mt-3 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Current responses</p>
                  <div className="flex flex-wrap gap-1.5">
                    {existingAssignments.map(a => (
                      <Badge key={a.mover_id} variant={
                        a.status === "confirmed" || a.status === "accepted" ? "default" :
                        a.status === "declined" ? "destructive" : "secondary"
                      }>
                        {a.first_name} {a.last_name}: {a.status}
                        {a.status === "declined" && a.decline_reason ? ` (${a.decline_reason})` : ""}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {existingJobOrderId ? "Update assignment" : "Assign crew"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AssignCrewDialog;
