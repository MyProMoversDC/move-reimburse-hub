import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { formatEasternDateTime } from "@/lib/dateUtils";
import { Loader2, Send, Trash2, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface Mover { id: string; first_name: string | null; last_name: string | null; email: string | null; }
interface Batch { id: string; run_date: string; status: string; total_count: number; matched_count: number; sent_count: number; failed_count: number; created_at: string; error: string | null; }
interface Stub {
  id: string; batch_id: string; file_name: string; extracted_name: string | null;
  smartmoving_employee_id: string | null; mover_id: string | null;
  pay_period_start: string | null; pay_period_end: string | null; net_total: number | null;
  status: string; error: string | null; sent_at: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  ready: "bg-blue-500", unmatched: "bg-amber-500", sent: "bg-green-600",
  send_failed: "bg-red-600", error: "bg-red-600", processing: "bg-slate-400",
  discarded: "bg-slate-500",
};

export default function PayStubsDashboard() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>("");
  const [stubs, setStubs] = useState<Stub[]>([]);
  const [movers, setMovers] = useState<Mover[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [assignFor, setAssignFor] = useState<Stub | null>(null);
  const [assignMoverId, setAssignMoverId] = useState<string>("");

  const loadBatches = async () => {
    const { data } = await supabase.from("pay_stub_batches").select("*").order("created_at", { ascending: false }).limit(50);
    setBatches((data as any) ?? []);
    if (data && data[0] && !selectedBatchId) setSelectedBatchId(data[0].id);
  };
  const loadStubs = async (batchId: string) => {
    setLoading(true);
    const { data, error } = await supabase.from("pay_stubs").select("*").eq("batch_id", batchId).order("created_at", { ascending: true });
    if (error) toast.error(error.message);
    setStubs((data as any) ?? []);
    setLoading(false);
  };
  const loadMovers = async () => {
    const { data } = await supabase
      .from("user_roles").select("user_id").eq("role", "mover");
    const ids = (data ?? []).map((r: any) => r.user_id);
    if (!ids.length) return;
    const { data: profiles } = await supabase.from("profiles")
      .select("id, first_name, last_name, email").in("id", ids);
    setMovers(((profiles as any) ?? []).sort((a: Mover, b: Mover) =>
      `${a.first_name ?? ""} ${a.last_name ?? ""}`.localeCompare(`${b.first_name ?? ""} ${b.last_name ?? ""}`)));
  };

  useEffect(() => { loadBatches(); loadMovers(); }, []);
  useEffect(() => { if (selectedBatchId) loadStubs(selectedBatchId); }, [selectedBatchId]);

  const counts = useMemo(() => {
    const c = { total: stubs.length, matched: 0, unmatched: 0, sent: 0, failed: 0 };
    for (const s of stubs) {
      if (s.status === "sent") c.sent++;
      else if (s.status === "send_failed" || s.status === "error") c.failed++;
      else if (s.status === "unmatched") c.unmatched++;
      else if (s.mover_id) c.matched++;
    }
    return c;
  }, [stubs]);

  const runNow = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-smartmoving-paystubs", { body: {} });
      if (error) throw error;
      toast.success(`Sync started (${(data as any)?.count ?? 0} pay stubs, ${(data as any)?.matched ?? 0} matched)`);
      await loadBatches();
      if ((data as any)?.batch_id) setSelectedBatchId((data as any).batch_id);
    } catch (e: any) {
      toast.error(e.message ?? "Sync failed");
    } finally { setRunning(false); }
  };

  const openAssign = (stub: Stub) => {
    setAssignFor(stub);
    setAssignMoverId(stub.mover_id ?? "");
  };

  const saveAssignment = async () => {
    if (!assignFor || !assignMoverId) return;
    const { error } = await supabase.from("pay_stubs")
      .update({ mover_id: assignMoverId, status: "ready", error: null })
      .eq("id", assignFor.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Assigned");
    setAssignFor(null);
    await loadStubs(selectedBatchId);
  };

  const sendOne = async (stub: Stub) => {
    if (!stub.mover_id) { toast.error("Assign a mover first"); return; }
    const { data, error } = await supabase.functions.invoke("send-paystub-batch", { body: { pay_stub_id: stub.id } });
    if (error) { toast.error(error.message); return; }
    if ((data as any)?.ok) toast.success("Sent");
    else toast.error((data as any)?.error ?? "Send failed");
    await loadStubs(selectedBatchId);
  };

  const discard = async (stub: Stub) => {
    const { error } = await supabase.from("pay_stubs")
      .update({ status: "discarded", discarded_at: new Date().toISOString() })
      .eq("id", stub.id);
    if (error) toast.error(error.message);
    else { toast.success("Discarded"); await loadStubs(selectedBatchId); }
  };

  const moverName = (id: string | null) => {
    const m = movers.find((x) => x.id === id);
    return m ? `${m.first_name ?? ""} ${m.last_name ?? ""}`.trim() || m.email : "—";
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold">Pay Stubs</h2>
        <div className="flex items-center gap-2">
          <Select value={selectedBatchId} onValueChange={setSelectedBatchId}>
            <SelectTrigger className="w-[280px]"><SelectValue placeholder="Select a batch" /></SelectTrigger>
            <SelectContent>
              {batches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.run_date} · {b.status} · {b.matched_count}/{b.total_count} matched
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={runNow} disabled={running} size="sm">
            {running ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Sync SmartMoving now
          </Button>
        </div>
      </div>

      <div className="bg-muted/40 border rounded-md p-3 text-sm">
        <strong>How this works:</strong> Every Thursday at 10:00 AM EST the system pulls pay stubs from SmartMoving.
        Rows automatically matched to a mover are emailed immediately with the PDF attached. Unmatched rows appear below —
        assign the correct mover, then <em>Send</em>. Emails contain no links; the pay stub is attached as a PDF.
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {[
          { l: "Total", v: counts.total },
          { l: "Matched", v: counts.matched },
          { l: "Unmatched", v: counts.unmatched },
          { l: "Sent", v: counts.sent },
          { l: "Failed", v: counts.failed },
        ].map((s) => (
          <Card key={s.l}><CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">{s.l}</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{s.v}</CardContent></Card>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : stubs.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">No pay stubs in this batch yet.</div>
      ) : (
        <div className="border rounded-md overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-3 py-2">Mover / Name on Stub</th>
                <th className="px-3 py-2">Pay Period</th>
                <th className="px-3 py-2 text-right">Net</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Sent</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {stubs.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="px-3 py-2">
                    <div className="font-medium">{s.mover_id ? moverName(s.mover_id) : <span className="text-amber-600">Unassigned</span>}</div>
                    <div className="text-xs text-muted-foreground">{s.extracted_name ?? "—"} {s.smartmoving_employee_id ? `· SM #${s.smartmoving_employee_id}` : ""}</div>
                  </td>
                  <td className="px-3 py-2">{s.pay_period_start} → {s.pay_period_end}</td>
                  <td className="px-3 py-2 text-right">{s.net_total != null ? `$${Number(s.net_total).toFixed(2)}` : "—"}</td>
                  <td className="px-3 py-2">
                    <Badge className={`${STATUS_COLORS[s.status] ?? "bg-slate-400"} text-white`}>{s.status}</Badge>
                    {s.error && <div className="text-xs text-red-600 mt-1 max-w-[240px] truncate" title={s.error}>{s.error}</div>}
                  </td>
                  <td className="px-3 py-2 text-xs">{s.sent_at ? formatEasternDateTime(s.sent_at) : "—"}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {s.status !== "sent" && s.status !== "discarded" && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => openAssign(s)}>Assign</Button>
                        <Button size="sm" className="ml-2" onClick={() => sendOne(s)} disabled={!s.mover_id}>
                          <Send className="h-3 w-3 mr-1" />Send
                        </Button>
                        <Button size="sm" variant="ghost" className="ml-2" onClick={() => discard(s)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!assignFor} onOpenChange={(o) => !o && setAssignFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign mover</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Name on stub: <strong>{assignFor?.extracted_name ?? "—"}</strong>
              {assignFor?.smartmoving_employee_id ? <> · SmartMoving ID <strong>{assignFor.smartmoving_employee_id}</strong></> : null}
            </div>
            <Select value={assignMoverId} onValueChange={setAssignMoverId}>
              <SelectTrigger><SelectValue placeholder="Select a mover" /></SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {movers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {`${m.first_name ?? ""} ${m.last_name ?? ""}`.trim() || m.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAssignFor(null)}>Cancel</Button>
            <Button onClick={saveAssignment} disabled={!assignMoverId}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
