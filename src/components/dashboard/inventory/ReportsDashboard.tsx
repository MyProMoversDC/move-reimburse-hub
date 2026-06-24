import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Download } from "lucide-react";

const ReportsDashboard = () => {
  const [range, setRange] = useState(() => {
    const d = new Date();
    const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0,10);
    const end = new Date(d.getFullYear(), d.getMonth()+1, 0).toISOString().slice(0,10);
    return { start, end };
  });
  const [purchases, setPurchases] = useState<any[]>([]);
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [jobCount, setJobCount] = useState(0);

  const load = async () => {
    const startIso = new Date(range.start + "T00:00:00").toISOString();
    const endIso = new Date(range.end + "T23:59:59").toISOString();
    const [p, items, jobs] = await Promise.all([
      supabase.from("purchases").select("*,inventory_items(name)").gte("purchased_at", startIso).lte("purchased_at", endIso),
      supabase.from("inventory_items").select("*"),
      supabase.from("inv_job_orders").select("id", { count: "exact", head: true }).gte("job_date", range.start).lte("job_date", range.end),
    ]);
    setPurchases(p.data || []);
    setLowStock((items.data || []).filter((i: any) => i.quantity <= i.min_stock_level));
    setJobCount(jobs.count || 0);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [range]);

  const totalSpend = purchases.reduce((s, p) => s + Number(p.unit_cost || 0) * Number(p.quantity || 0), 0);
  const totalUnits = purchases.reduce((s, p) => s + Number(p.quantity || 0), 0);

  const downloadCsv = () => {
    const lines = ["When,Item,Qty,UnitCost,Vendor,Notes"];
    purchases.forEach(p => {
      const when = new Date(p.purchased_at).toLocaleString("en-US", { timeZone: "America/New_York" });
      lines.push([when, p.inventory_items?.name || "", p.quantity, p.unit_cost || "", p.vendor || "", (p.notes || "").replace(/,/g, ";")].join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `purchases_${range.start}_${range.end}.csv`;
    a.click();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="bg-primary/5 p-4 rounded-t-lg">
          <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" /> Reports</CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <div className="bg-yellow-50 dark:bg-yellow-950/30 border-l-4 border-yellow-400 p-3 text-sm">
            Pick a date range to see purchase spend, job orders, and low-stock items.
          </div>
          <div className="flex flex-wrap gap-3 items-end">
            <div><Label>From</Label><Input type="date" value={range.start} onChange={e => setRange({ ...range, start: e.target.value })} /></div>
            <div><Label>To</Label><Input type="date" value={range.end} onChange={e => setRange({ ...range, end: e.target.value })} /></div>
            <Button variant="outline" onClick={downloadCsv}><Download className="h-4 w-4 mr-1" /> Export CSV</Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-3"><p className="text-xs text-muted-foreground">Purchase spend</p><p className="text-2xl font-bold">${totalSpend.toFixed(2)}</p></Card>
            <Card className="p-3"><p className="text-xs text-muted-foreground">Units purchased</p><p className="text-2xl font-bold">{totalUnits}</p></Card>
            <Card className="p-3"><p className="text-xs text-muted-foreground">Job orders</p><p className="text-2xl font-bold">{jobCount}</p></Card>
            <Card className="p-3"><p className="text-xs text-muted-foreground">Low-stock items</p><p className="text-2xl font-bold">{lowStock.length}</p></Card>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-4"><CardTitle>Low-stock items</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Qty</TableHead><TableHead>Min</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {lowStock.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">All items above minimum</TableCell></TableRow>
              : lowStock.map(it => (
                <TableRow key={it.id}>
                  <TableCell>{it.name}</TableCell><TableCell>{it.quantity}</TableCell><TableCell>{it.min_stock_level}</TableCell>
                  <TableCell><Badge variant="destructive">Low</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportsDashboard;
