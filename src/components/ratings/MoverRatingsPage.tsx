import { useMemo, useState } from "react";
import { useAllMoverRatings, useAllRatingEvents, useMoverRatingEvents } from "@/hooks/useRatings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RatingStatusBadge, StarRating, getRatingStatus, EVENT_LABELS, EVENT_OPTIONS } from "./ratingUtils";
import { Search, Download, Plus, TrendingUp, TrendingDown, AlertTriangle, Users, Activity } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend, CartesianGrid } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface Props { readOnly?: boolean }

const COLORS = ["#16a34a", "#2563eb", "#ea580c", "#dc2626", "#a855f7", "#0ea5e9", "#f59e0b", "#10b981"];

export default function MoverRatingsPage({ readOnly = false }: Props) {
  const { data: movers = [], isLoading, refetch } = useAllMoverRatings();
  const { data: allEvents = [], refetch: refetchEvents } = useAllRatingEvents();
  const [search, setSearch] = useState("");
  const [eventFilter, setEventFilter] = useState<string>("all");
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [selectedMover, setSelectedMover] = useState<any | null>(null);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustMover, setAdjustMover] = useState<string>("");
  const [adjustEvent, setAdjustEvent] = useState<string>("positive_feedback");
  const [adjustReason, setAdjustReason] = useState("");
  const [submittingAdjust, setSubmittingAdjust] = useState(false);

  // KPI metrics
  const kpis = useMemo(() => {
    const scored = movers.filter((m: any) => m.rating);
    const scores = scored.map((m: any) => m.rating.score);
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 40;
    const sorted = [...scored].sort((a: any, b: any) => b.rating.score - a.rating.score);
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const monthEvents = allEvents.filter((e) => new Date(e.created_at) >= monthStart);
    return {
      avg,
      highest: sorted.slice(0, 5),
      lowest: [...sorted].reverse().slice(0, 5),
      critical: scored.filter((m: any) => m.rating.score <= 20),
      monthChange: monthEvents.length,
    };
  }, [movers, allEvents]);

  // Distribution
  const distribution = useMemo(() => {
    const buckets = [
      { range: "10-15", min: 10, max: 15, count: 0 },
      { range: "16-20", min: 16, max: 20, count: 0 },
      { range: "21-25", min: 21, max: 25, count: 0 },
      { range: "26-30", min: 26, max: 30, count: 0 },
      { range: "31-35", min: 31, max: 35, count: 0 },
      { range: "36-40", min: 36, max: 40, count: 0 },
      { range: "41-45", min: 41, max: 45, count: 0 },
      { range: "46-50", min: 46, max: 50, count: 0 },
    ];
    for (const m of movers) {
      const s = m.rating?.score ?? 40;
      const b = buckets.find((x) => s >= x.min && s <= x.max);
      if (b) b.count++;
    }
    return buckets;
  }, [movers]);

  // Trend: avg score per month from events (running)
  const trend = useMemo(() => {
    const monthly: Record<string, { sum: number; count: number }> = {};
    const sortedEvents = [...allEvents].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const running: Record<string, number> = {};
    for (const m of movers) running[m.id] = m.rating?.score ?? 40;
    for (const ev of sortedEvents) {
      const key = format(new Date(ev.created_at), "yyyy-MM");
      monthly[key] = monthly[key] ?? { sum: 0, count: 0 };
      const avgNow = Object.values(running).reduce((a, b) => a + b, 0) / Math.max(1, Object.values(running).length);
      monthly[key].sum += avgNow; monthly[key].count++;
    }
    return Object.entries(monthly).map(([month, v]) => ({ month, avg: +(v.sum / v.count).toFixed(2) }));
  }, [allEvents, movers]);

  // Event breakdown donut
  const breakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const ev of allEvents) counts[ev.event_type] = (counts[ev.event_type] ?? 0) + 1;
    return Object.entries(counts).map(([k, v]) => ({ name: EVENT_LABELS[k] ?? k, value: v }));
  }, [allEvents]);

  const filteredMovers = useMemo(() => {
    const q = search.toLowerCase();
    let list = movers.filter((m: any) =>
      `${m.first_name} ${m.last_name} ${m.email ?? ""}`.toLowerCase().includes(q)
    );
    if (criticalOnly) list = list.filter((m: any) => (m.rating?.score ?? 40) <= 20);
    list.sort((a: any, b: any) => (a.rating?.score ?? 40) - (b.rating?.score ?? 40));
    return list;
  }, [movers, search, criticalOnly]);

  const filteredEvents = useMemo(() => {
    return allEvents.filter((e) => eventFilter === "all" || e.event_type === eventFilter);
  }, [allEvents, eventFilter]);

  const exportCsv = () => {
    const rows = [["Mover", "Event", "Delta", "Reason", "Created By", "Date"]];
    const moverMap = new Map(movers.map((m: any) => [m.id, `${m.first_name} ${m.last_name}`]));
    for (const e of filteredEvents) {
      rows.push([
        moverMap.get(e.mover_id) ?? e.mover_id,
        EVENT_LABELS[e.event_type] ?? e.event_type,
        String(e.delta),
        (e.reason ?? "").replace(/"/g, '""'),
        e.created_by ?? "",
        format(new Date(e.created_at), "yyyy-MM-dd HH:mm 'EST'"),
      ]);
    }
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `rating-events-${format(new Date(), "yyyy-MM-dd")}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const submitAdjustment = async () => {
    if (!adjustMover || !adjustReason.trim()) { toast.error("Mover and reason required"); return; }
    setSubmittingAdjust(true);
    try {
      const { data, error } = await supabase.functions.invoke("record-rating-event", {
        body: { mover_id: adjustMover, event_type: adjustEvent, reason: adjustReason, manual: true },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error ?? error?.message);
      toast.success("Adjustment recorded");
      setAdjustOpen(false); setAdjustReason(""); setAdjustMover("");
      refetch(); refetchEvents();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to record adjustment");
    } finally {
      setSubmittingAdjust(false);
    }
  };

  if (isLoading) return <div>Loading performance dashboard...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Mover Performance Ratings</h2>
          <p className="text-sm text-muted-foreground">Track, reward, and review mover performance across the company.</p>
        </div>
        {!readOnly && (
          <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Manual Adjustment</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Manual Rating Adjustment</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm">
                  Manual adjustments are audited. Maximum one positive adjustment per mover every 30 days.
                </div>
                <div>
                  <Label>Mover</Label>
                  <Select value={adjustMover} onValueChange={setAdjustMover}>
                    <SelectTrigger><SelectValue placeholder="Select mover" /></SelectTrigger>
                    <SelectContent>
                      {movers.map((m: any) => (
                        <SelectItem key={m.id} value={m.id}>{m.first_name} {m.last_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Event Type</Label>
                  <Select value={adjustEvent} onValueChange={setAdjustEvent}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {EVENT_OPTIONS.map((k) => <SelectItem key={k} value={k}>{EVENT_LABELS[k]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Reason (required)</Label>
                  <Textarea value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} placeholder="Justification for this adjustment..." />
                </div>
                <Button onClick={submitAdjustment} disabled={submittingAdjust} className="w-full">
                  {submittingAdjust ? "Submitting..." : "Record Adjustment"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <KpiCard icon={Activity} label="Avg Company Score" value={kpis.avg.toFixed(1)} hint="/50" />
        <KpiCard icon={TrendingUp} label="Highest" value={String(kpis.highest[0]?.rating.score ?? "-")} hint={kpis.highest[0] ? `${kpis.highest[0].first_name} ${kpis.highest[0].last_name}` : ""} tone="positive" />
        <KpiCard icon={TrendingDown} label="Lowest" value={String(kpis.lowest[0]?.rating.score ?? "-")} hint={kpis.lowest[0] ? `${kpis.lowest[0].first_name} ${kpis.lowest[0].last_name}` : ""} tone="negative" />
        <KpiCard icon={AlertTriangle} label="Critical Movers" value={String(kpis.critical.length)} hint="≤ 20 pts" tone="negative" />
        <KpiCard icon={Users} label="Changes This Month" value={String(kpis.monthChange)} hint="rating events" />
      </div>

      {/* Critical alert */}
      {kpis.critical.length > 0 && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Critical Movers Requiring Review
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {kpis.critical.map((m: any) => (
              <button key={m.id} onClick={() => setSelectedMover(m)} className="flex items-center gap-2 rounded-full border border-destructive/40 bg-background px-3 py-1 text-sm hover:bg-destructive/10">
                <span>{m.first_name} {m.last_name}</span>
                <span className="font-bold text-destructive">{m.rating.score}</span>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="movers">
        <TabsList>
          <TabsTrigger value="movers">Movers</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="history">Event History</TabsTrigger>
        </TabsList>

        <TabsContent value="movers" className="space-y-3 mt-4">
          <div className="flex flex-col md:flex-row gap-2 items-stretch md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search movers..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Button variant={criticalOnly ? "default" : "outline"} onClick={() => setCriticalOnly((v) => !v)}>
              Critical Only
            </Button>
          </div>
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mover</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Stars</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Last Update</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMovers.map((m: any) => {
                  const score = m.rating?.score ?? 40;
                  const s = getRatingStatus(score);
                  return (
                    <TableRow key={m.id} className={`cursor-pointer ${s.rowClass}`} onClick={() => setSelectedMover(m)}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8"><AvatarImage src={m.avatar_url || undefined} /><AvatarFallback>{m.first_name?.[0]}{m.last_name?.[0]}</AvatarFallback></Avatar>
                          <div>
                            <div className="font-medium">{m.first_name} {m.last_name}</div>
                            <div className="text-xs text-muted-foreground">{m.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-bold text-lg tabular-nums">{score}<span className="text-xs text-muted-foreground"> /50</span></TableCell>
                      <TableCell><StarRating score={score} /></TableCell>
                      <TableCell><RatingStatusBadge score={score} /></TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {m.rating?.updated_at ? format(new Date(m.rating.updated_at), "MMM d, yyyy") : "-"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle>Rating Distribution</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={distribution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="range" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#2563eb" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Rating Trend</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={trend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis domain={[10, 50]} />
                    <Tooltip />
                    <Line type="monotone" dataKey="avg" stroke="#16a34a" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle>Event Breakdown</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={breakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100} label>
                      {breakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-3 mt-4">
          <div className="flex flex-col md:flex-row gap-2">
            <Select value={eventFilter} onValueChange={setEventFilter}>
              <SelectTrigger className="w-[240px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Event Types</SelectItem>
                {EVENT_OPTIONS.map((k) => <SelectItem key={k} value={k}>{EVENT_LABELS[k]}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex-1" />
            <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-2" />Export CSV</Button>
          </div>
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Mover</TableHead><TableHead>Event</TableHead><TableHead>Δ</TableHead><TableHead>Reason</TableHead><TableHead>Date</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filteredEvents.slice(0, 200).map((e) => {
                  const m = movers.find((x: any) => x.id === e.mover_id);
                  return (
                    <TableRow key={e.id}>
                      <TableCell>{m ? `${m.first_name} ${m.last_name}` : "—"}</TableCell>
                      <TableCell>{EVENT_LABELS[e.event_type] ?? e.event_type}</TableCell>
                      <TableCell className={`font-bold ${e.delta >= 0 ? "text-green-600" : "text-red-600"}`}>{e.delta > 0 ? "+" : ""}{e.delta}</TableCell>
                      <TableCell className="max-w-[300px] truncate">{e.reason}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{format(new Date(e.created_at), "MMM d, yyyy HH:mm")} EST</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <RatingDetailsDialog mover={selectedMover} onClose={() => setSelectedMover(null)} />
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, hint, tone }: any) {
  const toneClass = tone === "positive" ? "text-green-600" : tone === "negative" ? "text-red-600" : "text-foreground";
  return (
    <Card><CardContent className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
        <Icon className={`h-4 w-4 ${toneClass}`} />
      </div>
      <div className={`text-2xl font-bold mt-1 ${toneClass}`}>{value}</div>
      <div className="text-xs text-muted-foreground truncate">{hint}</div>
    </CardContent></Card>
  );
}

function RatingDetailsDialog({ mover, onClose }: { mover: any | null; onClose: () => void }) {
  const { data: events = [] } = useMoverRatingEvents(mover?.id);
  if (!mover) return null;
  const score = mover.rating?.score ?? 40;
  let running = 40;
  const timeline = events.map((e) => { running = Math.min(50, Math.max(10, running + e.delta)); return { ...e, running }; });
  return (
    <Dialog open={!!mover} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Avatar><AvatarImage src={mover.avatar_url || undefined} /><AvatarFallback>{mover.first_name?.[0]}{mover.last_name?.[0]}</AvatarFallback></Avatar>
            <div>
              <div>{mover.first_name} {mover.last_name}</div>
              <div className="text-xs text-muted-foreground font-normal">Performance Score Details</div>
            </div>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/30">
            <div>
              <div className="text-4xl font-bold">{score}<span className="text-base text-muted-foreground"> /50</span></div>
              <StarRating score={score} />
            </div>
            <RatingStatusBadge score={score} />
          </div>
          <div>
            <h4 className="font-semibold mb-2">Score Calculation Timeline</h4>
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm py-1 border-b"><span className="text-muted-foreground">Starting Score</span><span className="font-bold">40</span></div>
              {timeline.map((e: any) => (
                <div key={e.id} className="flex items-start justify-between text-sm py-1.5 border-b">
                  <div className="flex-1 pr-3">
                    <div className="flex items-center gap-2">
                      <span className={`font-bold tabular-nums ${e.delta >= 0 ? "text-green-600" : "text-red-600"}`}>{e.delta > 0 ? "+" : ""}{e.delta}</span>
                      <span className="font-medium">{EVENT_LABELS[e.event_type] ?? e.event_type}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{e.reason}</div>
                    <div className="text-[10px] text-muted-foreground">{format(new Date(e.created_at), "MMM d, yyyy HH:mm")} EST</div>
                  </div>
                  <span className="text-sm font-bold tabular-nums">{e.running}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm py-2 mt-1 bg-primary/5 px-2 rounded">
                <span className="font-bold">Current Score</span><span className="font-bold text-lg">{score}</span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
