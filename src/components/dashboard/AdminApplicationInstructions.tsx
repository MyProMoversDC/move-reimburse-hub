import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Upload, FileText, Video, Image as ImageIcon, File as FileIcon, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Material {
  id: string;
  title: string;
  description: string | null;
  file_url: string;
  file_name: string;
  file_type: string;
  file_size: number | null;
  sort_order: number;
  created_at: string;
}

const BUCKET = "application-instructions";

const AdminApplicationInstructions = ({ userId }: { userId: string }) => {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    fetchMaterials();
  }, []);

  const fetchMaterials = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("application_instruction_materials")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) toast.error("Failed to load materials");
    else setMaterials(data || []);
    setLoading(false);
  };

  const handleUpload = async () => {
    if (!title.trim() || !file) {
      toast.error("Title and file are required");
      return;
    }
    setUploading(true);
    try {
      const path = `${userId}/${Date.now()}_${file.name.replace(/[^\w.-]/g, "_")}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });
      if (upErr) throw upErr;

      const { error: insErr } = await supabase.from("application_instruction_materials").insert({
        title: title.trim(),
        description: description.trim() || null,
        file_url: path,
        file_name: file.name,
        file_type: file.type || "application/octet-stream",
        file_size: file.size,
        created_by: userId,
      });
      if (insErr) throw insErr;

      toast.success("Material uploaded");
      setTitle("");
      setDescription("");
      setFile(null);
      const input = document.getElementById("app-instr-file") as HTMLInputElement | null;
      if (input) input.value = "";
      fetchMaterials();
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const m = materials.find((x) => x.id === id);
    if (!m) return;
    const { error: sErr } = await supabase.storage.from(BUCKET).remove([m.file_url]);
    if (sErr) console.warn("storage delete:", sErr);
    const { error } = await supabase.from("application_instruction_materials").delete().eq("id", id);
    if (error) toast.error("Failed to delete");
    else {
      toast.success("Deleted");
      fetchMaterials();
    }
    setDeleteId(null);
  };

  const iconFor = (t: string) => {
    if (t.startsWith("video/")) return <Video className="h-5 w-5 text-primary" />;
    if (t.startsWith("image/")) return <ImageIcon className="h-5 w-5 text-primary" />;
    if (t.includes("pdf") || t.startsWith("text/")) return <FileText className="h-5 w-5 text-primary" />;
    return <FileIcon className="h-5 w-5 text-primary" />;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Application Instructions</h2>
        <p className="text-sm text-muted-foreground">
          Upload manuals and video tutorials for movers to study. Visible only to movers in their
          "Application Instructions" tab.
        </p>
      </div>

      <Card className="p-4 md:p-6 space-y-4">
        <h3 className="font-semibold">Upload New Material</h3>
        <div className="space-y-2">
          <Label htmlFor="app-instr-title">Title *</Label>
          <Input id="app-instr-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. How to submit a reimbursement" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="app-instr-desc">Description</Label>
          <Textarea id="app-instr-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description or instructions" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="app-instr-file">File (PDF, video, image, doc) *</Label>
          <Input
            id="app-instr-file"
            type="file"
            accept="application/pdf,video/*,image/*,.doc,.docx,.ppt,.pptx,.txt"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </div>
        <Button onClick={handleUpload} disabled={uploading || !title.trim() || !file}>
          {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
          Upload
        </Button>
      </Card>

      <div className="space-y-3">
        <h3 className="font-semibold">Uploaded Materials ({materials.length})</h3>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : materials.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            No materials uploaded yet.
          </Card>
        ) : (
          materials.map((m) => (
            <Card key={m.id} className="p-4 flex items-start gap-3">
              <div className="mt-1">{iconFor(m.file_type)}</div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{m.title}</p>
                {m.description && <p className="text-sm text-muted-foreground">{m.description}</p>}
                <p className="text-xs text-muted-foreground mt-1 truncate">{m.file_name}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setDeleteId(m.id)} title="Delete">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </Card>
          ))
        )}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this material?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the file for all movers. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && handleDelete(deleteId)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminApplicationInstructions;
