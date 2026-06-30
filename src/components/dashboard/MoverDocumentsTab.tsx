import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ExternalLink, Pencil, Search } from "lucide-react";

export const MOVER_ATTRIBUTE_OPTIONS = [
  { value: "foreman", label: "Foreman" },
  { value: "driver", label: "Driver" },
  { value: "helper", label: "Helper" },
  { value: "helper_k", label: "Helper (K)" },
  { value: "foreman_driver", label: "Foreman and Driver" },
] as const;

export const moverAttributeLabel = (v?: string | null) =>
  MOVER_ATTRIBUTE_OPTIONS.find((o) => o.value === v)?.label || "—";

interface Mover {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  avatar_url: string | null;
  mover_attribute: string | null;
}

interface RequiredDoc {
  id: string;
  key: string;
  name: string;
  url: string | null;
  is_active: boolean;
  sort_order: number;
}

interface Signature {
  user_id: string;
  document_id: string;
  signed_at: string;
  file_url: string | null;
}

interface MoverDocumentsTabProps {
  /** Set readOnly to hide editing controls (not used currently). */
  readOnly?: boolean;
}

const MoverDocumentsTab = ({ readOnly = false }: MoverDocumentsTabProps) => {
  const [movers, setMovers] = useState<Mover[]>([]);
  const [docs, setDocs] = useState<RequiredDoc[]>([]);
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [editDoc, setEditDoc] = useState<RequiredDoc | null>(null);
  const [editUrl, setEditUrl] = useState("");

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [{ data: roles }, { data: docsData }, { data: sigs }] = await Promise.all([
        supabase.from("user_roles").select("user_id, role").eq("role", "mover" as any),
        (supabase as any).from("mover_required_documents").select("*").eq("is_active", true).order("sort_order"),
        (supabase as any).from("mover_document_signatures").select("user_id, document_id, signed_at, file_url"),
      ]);
      const moverIds = (roles || []).map((r: any) => r.user_id);
      let profiles: any[] = [];
      if (moverIds.length) {
        const { data: pData } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, email, avatar_url, mover_attribute" as any)
          .in("id", moverIds)
          .order("first_name");
        profiles = pData || [];
      }
      setMovers(profiles as Mover[]);
      setDocs((docsData as RequiredDoc[]) || []);
      setSignatures((sigs as Signature[]) || []);
    } catch (e: any) {
      toast.error(e.message || "Failed to load mover documents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const sigMap = useMemo(() => {
    const m = new Map<string, Signature>();
    signatures.forEach((s) => m.set(`${s.user_id}:${s.document_id}`, s));
    return m;
  }, [signatures]);

  const updateAttribute = async (userId: string, value: string) => {
    const newVal = value === "__none__" ? null : value;
    const prev = movers;
    setMovers((arr) => arr.map((m) => (m.id === userId ? { ...m, mover_attribute: newVal } : m)));
    const { error } = await supabase
      .from("profiles")
      .update({ mover_attribute: newVal } as any)
      .eq("id", userId);
    if (error) {
      setMovers(prev);
      toast.error(error.message);
    } else {
      toast.success("Attribute updated");
    }
  };

  const toggleSignature = async (userId: string, docId: string, checked: boolean) => {
    if (checked) {
      const { data, error } = await (supabase as any)
        .from("mover_document_signatures")
        .insert({ user_id: userId, document_id: docId })
        .select()
        .single();
      if (error) return toast.error(error.message);
      setSignatures((arr) => [...arr, data]);
    } else {
      const { error } = await (supabase as any)
        .from("mover_document_signatures")
        .delete()
        .eq("user_id", userId)
        .eq("document_id", docId);
      if (error) return toast.error(error.message);
      setSignatures((arr) => arr.filter((s) => !(s.user_id === userId && s.document_id === docId)));
    }
  };

  const saveDocUrl = async () => {
    if (!editDoc) return;
    const { error } = await (supabase as any)
      .from("mover_required_documents")
      .update({ url: editUrl || null })
      .eq("id", editDoc.id);
    if (error) return toast.error(error.message);
    setDocs((arr) => arr.map((d) => (d.id === editDoc.id ? { ...d, url: editUrl || null } : d)));
    setEditDoc(null);
    toast.success("Document link saved");
  };

  const filtered = movers.filter((m) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      (m.first_name || "").toLowerCase().includes(q) ||
      (m.last_name || "").toLowerCase().includes(q) ||
      (m.email || "").toLowerCase().includes(q)
    );
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mover Documents</CardTitle>
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search movers..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-muted-foreground text-sm">Loading...</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Mover</TableHead>
                  <TableHead className="min-w-[180px]">Attribute</TableHead>
                  {docs.map((d) => (
                    <TableHead key={d.id} className="min-w-[180px]">
                      <div className="flex items-center gap-2">
                        <span>{d.name}</span>
                        {d.url ? (
                          <a
                            href={d.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary inline-flex items-center"
                            title="Open document"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        ) : null}
                        {!readOnly && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => {
                              setEditDoc(d);
                              setEditUrl(d.url || "");
                            }}
                            title="Edit document link"
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2 + docs.length} className="text-center text-muted-foreground">
                      No movers found
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={m.avatar_url || undefined} />
                            <AvatarFallback className="text-xs">
                              {m.first_name?.[0]}
                              {m.last_name?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">
                              {m.first_name} {m.last_name}
                            </div>
                            <div className="text-xs text-muted-foreground">{m.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={m.mover_attribute || "__none__"}
                          onValueChange={(v) => updateAttribute(m.id, v)}
                          disabled={readOnly}
                        >
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Not set" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Not set</SelectItem>
                            {MOVER_ATTRIBUTE_OPTIONS.map((o) => (
                              <SelectItem key={o.value} value={o.value}>
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      {docs.map((d) => {
                        const sig = sigMap.get(`${m.id}:${d.id}`);
                        return (
                          <TableCell key={d.id}>
                            <div className="flex items-center gap-2">
                              <Checkbox
                                checked={!!sig}
                                disabled={readOnly}
                                onCheckedChange={(c) => toggleSignature(m.id, d.id, !!c)}
                              />
                              <span className="text-xs text-muted-foreground">
                                {sig ? `Signed ${new Date(sig.signed_at).toLocaleDateString()}` : "Not signed"}
                              </span>
                            </div>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={!!editDoc} onOpenChange={(o) => !o && setEditDoc(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {editDoc?.name} link</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="doc-url">Document URL</Label>
            <Input
              id="doc-url"
              value={editUrl}
              onChange={(e) => setEditUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDoc(null)}>Cancel</Button>
            <Button onClick={saveDocUrl}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default MoverDocumentsTab;
