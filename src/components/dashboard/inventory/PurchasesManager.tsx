import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Plus, ShoppingCart } from "lucide-react";
import { handleError } from "@/lib/errorHandler";

interface Row { id: string; item_id: string; quantity: number; unit_cost: number | null; vendor: string | null; notes: string | null; purchased_at: string; }

interface Props { userId: string; }

const PurchasesManager = ({ userId }: Props) => {
  const [rows, setRows] = useState<Row[]>([]);
  const [items, setItems] = useState<{ id: string; name: string; quantity: number }[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ item_id: "", quantity: 1, unit_cost: "", vendor: "", notes: "" });

  const load = async () => {
    const [p, i] = await Promise.all([
      supabase.from("purchases").select("*").order("purchased_at", { ascending: false }).limit(100),
      supabase.from("inventory_items").select("id,name,quantity").order("name"),
    ]);
    if (p.error) toast.error(handleError(p.error)); else setRows((p.data || []) as Row[]);
    if (!i.error) setItems(i.data || []);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.item_id || form.quantity <= 0) return toast.error("Item and positive quantity required");
    const { error } = await supabase.from("purchases").insert([{
      item_id: form.item_id, quantity: form.quantity,
      unit_cost: form.unit_cost ? Number(form.unit_cost) : null,
      vendor: form.vendor || null, notes: form.notes || null,
      purchased_by: userId,
    }]);
    if (error) return toast.error(handleError(error));
    // Bump inventory
    const item = items.find(x => x.id === form.item_id);
    if (item) {
      await supabase.from("inventory_items").update({ quantity: item.quantity + form.quantity }).eq("id", form.item_id);
    }
    toast.success("Purchase recorded — inventory updated");
    setOpen(false);
    setForm({ item_id: "", quantity: 1, unit_cost: "", vendor: "", notes: "" });
    load();
  };

  const nameOf = (id: string) => items.find(i => i.id === id)?.name || id.slice(0, 8);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between bg-primary/5 p-4 rounded-t-lg">
        <CardTitle className="flex items-center gap-2"><ShoppingCart className="h-5 w-5" /> Purchases</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> New Purchase</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Record Purchase</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Item *</Label>
                <SearchableSelect value={form.item_id} onValueChange={v => setForm({ ...form, item_id: v })}
                  options={items.map(i => ({ value: i.id, label: i.name }))}
                  placeholder="Pick item" searchPlaceholder="Search..." emptyMessage="No items" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Quantity *</Label><Input type="number" value={form.quantity} onChange={e => setForm({ ...form, quantity: Number(e.target.value) })} /></div>
                <div><Label>Unit Cost</Label><Input type="number" step="0.01" value={form.unit_cost} onChange={e => setForm({ ...form, unit_cost: e.target.value })} /></div>
              </div>
              <div><Label>Vendor</Label><Input value={form.vendor} onChange={e => setForm({ ...form, vendor: e.target.value })} /></div>
              <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={create}>Record</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="p-0">
        <div className="bg-yellow-50 dark:bg-yellow-950/30 border-l-4 border-yellow-400 p-3 text-sm">
          Recording a purchase automatically increases the warehouse inventory quantity for that item.
        </div>
        <Table>
          <TableHeader><TableRow>
            <TableHead>When</TableHead><TableHead>Item</TableHead><TableHead>Qty</TableHead>
            <TableHead>Unit Cost</TableHead><TableHead>Vendor</TableHead><TableHead>Notes</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">No purchases yet</TableCell></TableRow>
            : rows.map(r => (
              <TableRow key={r.id}>
                <TableCell>{new Date(r.purchased_at).toLocaleString("en-US", { timeZone: "America/New_York" })}</TableCell>
                <TableCell className="font-medium">{nameOf(r.item_id)}</TableCell>
                <TableCell>{r.quantity}</TableCell>
                <TableCell>{r.unit_cost != null ? `$${r.unit_cost}` : "—"}</TableCell>
                <TableCell>{r.vendor || "—"}</TableCell>
                <TableCell className="max-w-xs truncate">{r.notes || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default PurchasesManager;
