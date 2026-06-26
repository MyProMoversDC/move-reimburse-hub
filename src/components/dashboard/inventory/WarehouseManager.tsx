import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Plus, Package, Trash2, Pencil } from "lucide-react";
import { handleError } from "@/lib/errorHandler";

const UOMS = ["piece","roll","box","pack","set","ft","lb"] as const;

interface Item { id: string; name: string; description: string | null; category_id: string | null; uom: string; quantity: number; min_stock_level: number; }

interface Props { userId: string; }

const WarehouseManager = ({ userId }: Props) => {
  const [items, setItems] = useState<Item[]>([]);
  const [cats, setCats] = useState<{ id: string; name: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [form, setForm] = useState({ name: "", description: "", category_id: "", uom: "piece", quantity: 0, min_stock_level: 0 });
  const [catOpen, setCatOpen] = useState(false);
  const [newCat, setNewCat] = useState("");

  const load = async () => {
    const [i, c] = await Promise.all([
      supabase.from("inventory_items").select("*").order("name"),
      supabase.from("inventory_categories").select("id,name").order("name"),
    ]);
    if (i.error) toast.error(handleError(i.error)); else setItems((i.data || []) as Item[]);
    if (!c.error) setCats(c.data || []);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name.trim()) return toast.error("Name required");
    const payload: any = {
      name: form.name.trim(), description: form.description || null,
      category_id: form.category_id || null, uom: form.uom,
      quantity: form.quantity, min_stock_level: form.min_stock_level,
    };
    const { error } = editing
      ? await supabase.from("inventory_items").update(payload).eq("id", editing.id)
      : await supabase.from("inventory_items").insert([payload]);
    if (error) return toast.error(handleError(error));
    toast.success(editing ? "Item updated" : "Item added");
    setOpen(false);
    setForm({ name: "", description: "", category_id: "", uom: "piece", quantity: 0, min_stock_level: 0 });
    setEditing(null);
    load();
  };

  const openEdit = (it: Item) => {
    setEditing(it);
    setForm({
      name: it.name, description: it.description || "", category_id: it.category_id || "",
      uom: it.uom, quantity: it.quantity, min_stock_level: it.min_stock_level,
    });
    setOpen(true);
  };

  const remove = async (id: string) => {
    if (!confirm("Delete item?")) return;
    const { error } = await supabase.from("inventory_items").delete().eq("id", id);
    if (error) return toast.error(handleError(error));
    load();
  };

  const addCategory = async () => {
    if (!newCat.trim()) return;
    const { error } = await supabase.from("inventory_categories").insert([{ name: newCat.trim() }]);
    if (error) return toast.error(handleError(error));
    setNewCat("");
    setCatOpen(false);
    load();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between bg-primary/5 p-4 rounded-t-lg">
        <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" /> Warehouse Inventory</CardTitle>
        <div className="flex gap-2">
          <Dialog open={catOpen} onOpenChange={setCatOpen}>
            <DialogTrigger asChild><Button variant="outline" size="sm">+ Category</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Category</DialogTitle></DialogHeader>
              <Input value={newCat} onChange={e => setNewCat(e.target.value)} placeholder="Category name" />
              <DialogFooter><Button onClick={addCategory}>Add</Button></DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Item</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editing ? "Edit Item" : "New Item"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                <div><Label>Description</Label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
                <div><Label>Category</Label>
                  <SearchableSelect value={form.category_id} onValueChange={v => setForm({ ...form, category_id: v })}
                    options={cats.map(c => ({ value: c.id, label: c.name }))}
                    placeholder="Select" searchPlaceholder="Search..." emptyMessage="None" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div><Label>UOM</Label>
                    <SearchableSelect value={form.uom} onValueChange={v => setForm({ ...form, uom: v })}
                      options={UOMS.map(u => ({ value: u, label: u }))}
                      placeholder="UOM" searchPlaceholder="" emptyMessage="" />
                  </div>
                  <div><Label>Qty</Label><Input type="number" value={form.quantity} onChange={e => setForm({ ...form, quantity: Number(e.target.value) })} /></div>
                  <div><Label>Min Stock</Label><Input type="number" value={form.min_stock_level} onChange={e => setForm({ ...form, min_stock_level: Number(e.target.value) })} /></div>
                </div>
              </div>
              <DialogFooter><Button onClick={save}>{editing ? "Save" : "Add"}</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="bg-yellow-50 dark:bg-yellow-950/30 border-l-4 border-yellow-400 p-3 text-sm">
          Manage warehouse stock. Items with quantity at or below minimum stock level show a low-stock warning.
        </div>
        {/* Desktop table */}
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead><TableHead>UOM</TableHead><TableHead>Qty</TableHead>
                <TableHead>Min</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">No items</TableCell></TableRow>
              : items.map(it => {
                const low = it.quantity <= it.min_stock_level;
                return (
                  <TableRow key={it.id}>
                    <TableCell className="font-medium">{it.name}</TableCell>
                    <TableCell>{it.uom}</TableCell>
                    <TableCell>{it.quantity}</TableCell>
                    <TableCell>{it.min_stock_level}</TableCell>
                    <TableCell><Badge variant={low ? "destructive" : "default"}>{low ? "Low" : "OK"}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(it)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => remove(it.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        {/* Mobile cards */}
        <div className="md:hidden divide-y">
          {items.length === 0 ? (
            <p className="text-center text-muted-foreground py-6 text-sm">No items</p>
          ) : items.map(it => {
            const low = it.quantity <= it.min_stock_level;
            return (
              <div key={it.id} className="p-3 flex items-start justify-between gap-3 active:bg-muted/40">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm truncate">{it.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {it.quantity} {it.uom} · min {it.min_stock_level}
                  </p>
                  <Badge variant={low ? "destructive" : "default"} className="mt-1 text-[10px]">
                    {low ? "Low" : "OK"}
                  </Badge>
                </div>
                <div className="flex shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(it)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => remove(it.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default WarehouseManager;
