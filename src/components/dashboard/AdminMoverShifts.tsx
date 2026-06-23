import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import QRCode from "qrcode";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { format, differenceInMinutes, startOfMonth } from "date-fns";
import { formatDateTimeEST } from "@/lib/dateUtils";
import { Download, Printer, RefreshCw, Calendar as CalendarIcon, QrCode, Users, FileSpreadsheet } from "lucide-react";
import { cn } from "@/lib/utils";


const buildUrl = (action: "in" | "out", token: string) =>
  `${window.location.origin}/mover/clock?action=${action}&token=${token}`;

const QrPanel = ({ action, label, color, onRotated }: { action: "in" | "out"; label: string; color: string; onRotated: () => void }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [token, setToken] = useState<string>("");
  const [url, setUrl] = useState<string>("");
  const [rotating, setRotating] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("mover_shift_qr_tokens" as any)
      .select("token")
      .eq("action", action)
      .eq("is_active", true)
      .maybeSingle();
    const t = (data as any)?.token;
    if (t) {
      setToken(t);
      const u = buildUrl(action, t);
      setUrl(u);
      if (canvasRef.current) {
        QRCode.toCanvas(canvasRef.current, u, { width: 256, margin: 2, errorCorrectionLevel: "H" });
      }
    }
  }, [action]);

  useEffect(() => { load(); }, [load]);

  const download = async () => {
    const dataUrl = await QRCode.toDataURL(url, { width: 1024, margin: 2, errorCorrectionLevel: "H" });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `mover-clock-${action}-qr.png`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const printQr = async () => {
    const dataUrl = await QRCode.toDataURL(url, { width: 1024, margin: 2, errorCorrectionLevel: "H" });
    const w = window.open("", "_blank", "width=600,height=800");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>${label}</title>
      <style>body{font-family:system-ui;text-align:center;padding:40px;}h1{margin-bottom:8px;}p{color:#555;}img{width:480px;max-width:90%;}</style>
      </head><body>
      <h1>${label}</h1>
      <p>MyProMovers — scan with the app to ${action === "in" ? "clock in" : "clock out"}</p>
      <img src="${dataUrl}" alt="${label}"/>
      <p style="margin-top:24px;font-size:11px;color:#999;word-break:break-all">${url}</p>
      <script>window.onload=()=>{window.print();}</script>
      </body></html>`);
    w.document.close();
  };

  const rotate = async () => {
    if (!confirm("This will invalidate the current QR. Anyone with the old printed code can no longer scan. Continue?")) return;
    setRotating(true);
    try {
      const { error } = await supabase.rpc("rotate_mover_shift_qr" as any, { _action: action });
      if (error) throw error;
      toast.success("New QR generated. Reprint and post it.");
      await load();
      onRotated();
    } catch (e: any) {
      toast.error(e.message);
    } finally { setRotating(false); }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className={cn("inline-block h-3 w-3 rounded-full", color)} /> {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-3">
        <canvas ref={canvasRef} className="border rounded-md bg-white p-2" />
        <div className="flex flex-wrap gap-2 justify-center">
          <Button size="sm" variant="outline" onClick={download}><Download className="h-3.5 w-3.5 mr-1" /> PNG</Button>
          <Button size="sm" variant="outline" onClick={printQr}><Printer className="h-3.5 w-3.5 mr-1" /> Print</Button>
          <Button size="sm" variant="destructive" onClick={rotate} disabled={rotating}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Regenerate
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground break-all max-w-full text-center">{url}</p>
      </CardContent>
    </Card>
  );
};

const AdminMoverShifts = () => {
  const [active, setActive] = useState<any[]>([]);
  const [entries, setEntries] = useState<any[]>([]);
  const [movers, setMovers] = useState<any[]>([]);
  const [moverFilter, setMoverFilter] = useState<string>("");
  const [startDate, setStartDate] = useState<Date | undefined>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchActive = async () => {
    const { data } = await supabase.rpc("admin_list_active_mover_shifts" as any);
    setActive((data as any) || []);
  };

  const fetchMovers = async () => {
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "mover" as any);
    const ids = [...new Set((roles || []).map((r: any) => r.user_id))];
    if (ids.length === 0) { setMovers([]); return; }
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", ids);
    setMovers(profs || []);
  };

  const fetchEntries = useCallback(async () => {
    if (!startDate || !endDate) return;
    const { data, error } = await supabase.rpc("admin_list_mover_shift_entries" as any, {
      _start: format(startDate, "yyyy-MM-dd"),
      _end: format(endDate, "yyyy-MM-dd"),
      _mover_id: moverFilter || null,
    });
    if (error) { toast.error(error.message); return; }
    setEntries((data as any) || []);
  }, [startDate, endDate, moverFilter]);

  useEffect(() => { fetchActive(); fetchMovers(); }, []);
  useEffect(() => { fetchEntries(); }, [fetchEntries, refreshKey]);

  useEffect(() => {
    const id = setInterval(fetchActive, 30000);
    return () => clearInterval(id);
  }, []);

  // Aggregate totals per mover
  type Totals = Record<string, { name: string; minutes: number }>;
  const totalsByMover: Totals = entries.reduce((acc: Totals, e: any) => {
    if (!e.net_minutes) return acc;
    const key = e.user_id;
    if (!acc[key]) acc[key] = { name: `${e.first_name} ${e.last_name}`, minutes: 0 };
    acc[key].minutes += e.net_minutes;
    return acc;
  }, {} as Totals);
  const totalsList = Object.values(totalsByMover);
  const grandTotalMins = totalsList.reduce((s, m) => s + m.minutes, 0);

  const exportCsv = () => {
    const header = ["Mover", "Clock In (EST)", "Clock Out (EST)", "Net Hours"];
    const rows = entries.map((e: any) => [
      `${e.first_name} ${e.last_name}`,
      formatDateTimeEST(e.clock_in),
      e.clock_out ? formatDateTimeEST(e.clock_out) : "",
      e.net_minutes ? (e.net_minutes / 60).toFixed(2) : "",
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `mover-shifts-${format(startDate || new Date(), "yyyyMMdd")}-${format(endDate || new Date(), "yyyyMMdd")}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const moverOptions = movers.map((m) => ({ value: m.id, label: `${m.first_name} ${m.last_name}` }));

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold flex items-center gap-2"><QrCode className="h-6 w-6" /> Mover Shifts (QR)</h2>

      <Tabs defaultValue="qr">
        <TabsList>
          <TabsTrigger value="qr">QR Codes</TabsTrigger>
          <TabsTrigger value="active">Active Now ({active.length})</TabsTrigger>
          <TabsTrigger value="history">History & Hours</TabsTrigger>
        </TabsList>

        <TabsContent value="qr" className="space-y-4">
          <Card>
            <CardContent className="py-3 text-sm bg-muted/50">
              Print both QR codes and post them at the office. Movers open them with the phone camera or via the in-app scanner.
              Regenerate only if a printed code is lost or compromised — old prints will stop working.
            </CardContent>
          </Card>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <QrPanel action="in" label="Clock-IN QR" color="bg-green-500" onRotated={() => setRefreshKey((k) => k + 1)} />
            <QrPanel action="out" label="Clock-OUT QR" color="bg-red-500" onRotated={() => setRefreshKey((k) => k + 1)} />
          </div>
        </TabsContent>

        <TabsContent value="active" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Movers Currently On Shift</CardTitle></CardHeader>
            <CardContent>
              {active.length === 0 ? (
                <p className="text-muted-foreground">No movers are currently clocked in.</p>
              ) : (
                <div className="space-y-2">
                  {active.map((a) => {
                    const mins = differenceInMinutes(new Date(), new Date(a.clock_in));
                    return (
                      <div key={a.entry_id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{a.first_name} {a.last_name}</p>
                          <p className="text-xs text-muted-foreground">Clocked in: {formatDateTimeEST(a.clock_in)}</p>
                        </div>
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          {Math.floor(mins / 60)}h {mins % 60}m
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardContent className="py-4 space-y-3">
              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Start date</label>
                  <Popover open={startOpen} onOpenChange={setStartOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm">
                        <CalendarIcon className="h-4 w-4 mr-2" />
                        {startDate ? format(startDate, "PPP") : "Select"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={startDate} onSelect={(d) => { if (d) setStartDate(d); setStartOpen(false); }} initialFocus className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">End date</label>
                  <Popover open={endOpen} onOpenChange={setEndOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm">
                        <CalendarIcon className="h-4 w-4 mr-2" />
                        {endDate ? format(endDate, "PPP") : "Select"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={endDate} onSelect={(d) => { if (d) setEndDate(d); setEndOpen(false); }} initialFocus className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1 min-w-[200px]">
                  <label className="text-xs text-muted-foreground">Mover (optional)</label>
                  <SearchableSelect
                    value={moverFilter}
                    onValueChange={setMoverFilter}
                    options={[{ value: "", label: "All movers" }, ...moverOptions]}
                    placeholder="All movers"
                    searchPlaceholder="Search…"
                    emptyMessage="No movers"
                  />
                </div>
                <Button size="sm" onClick={exportXls} disabled={entries.length === 0} className="ml-auto">
                  <FileSpreadsheet className="h-4 w-4 mr-1" /> Export
                </Button>
              </div>

              <div className="text-sm font-medium">
                Total: <span className="text-primary">{(grandTotalMins / 60).toFixed(2)} hours</span> across {Object.keys(totalsByMover).length} mover(s)
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mover</TableHead>
                      <TableHead>Clock In</TableHead>
                      <TableHead>Clock Out</TableHead>
                      <TableHead className="text-right">Hours</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No records in this range</TableCell></TableRow>
                    ) : entries.map((e: any) => (
                      <TableRow key={e.entry_id}>
                        <TableCell className="font-medium">{e.first_name} {e.last_name}</TableCell>
                        <TableCell>{formatDateTimeEST(e.clock_in)}</TableCell>
                        <TableCell>{e.clock_out ? formatDateTimeEST(e.clock_out) : <Badge variant="outline">Open</Badge>}</TableCell>
                        <TableCell className="text-right font-mono">{e.net_minutes ? (e.net_minutes / 60).toFixed(2) : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {Object.keys(totalsByMover).length > 0 && (
                <div className="border-t pt-3">
                  <p className="text-xs uppercase text-muted-foreground mb-2">Totals per mover</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {Object.values(totalsByMover).map((t) => (
                      <div key={t.name} className="flex justify-between text-sm border rounded-md px-3 py-1.5">
                        <span>{t.name}</span>
                        <span className="font-medium">{(t.minutes / 60).toFixed(2)}h</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminMoverShifts;
