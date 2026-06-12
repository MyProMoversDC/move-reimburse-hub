import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui/tabs";
import {
  Upload, RefreshCw, Trash2, FileText, Loader2, ThumbsUp, ThumbsDown,
  AlertCircle, CheckCircle2, BarChart3, Globe,
} from "lucide-react";
import { toast } from "sonner";
import { formatInTimeZone } from "date-fns-tz";

interface Doc {
  id: string;
  title: string;
  description: string | null;
  source_bucket: string;
  source_path: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  language: string | null;
  ai_enabled: boolean;
  ingest_status: "pending" | "processing" | "ready" | "failed";
  ingest_error: string | null;
  chunk_count: number;
  created_at: string;
}

const ACCEPTED = ".pdf,.docx,.txt,.md";

const AdminOfficeAIKnowledge = ({ userId }: { userId: string }) => {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [description, setDescription] = useState("");
  const [language, setLanguage] = useState("en");
  const [refreshKey, setRefreshKey] = useState(0);
  const [progress, setProgress] = useState<{ done: number; total: number; current: string } | null>(null);

  useEffect(() => {
    void fetchDocs();
    const channel = supabase
      .channel("office-ai-docs")
      .on("postgres_changes", { event: "*", schema: "public", table: "office_ai_documents" }, () => {
        void fetchDocs();
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [refreshKey]);

  const fetchDocs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("office_ai_documents")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setDocs((data ?? []) as Doc[]);
    setLoading(false);
  };

  const onUpload = async () => {
    if (!file) return toast.error("Please select a file");
    if (!title.trim()) return toast.error("Please enter a title");
    setUploading(true);
    try {
      const path = `${userId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error: upErr } = await supabase.storage
        .from("office-ai-kb")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;

      const { data: doc, error: insErr } = await supabase
        .from("office_ai_documents")
        .insert({
          title: title.trim(),
          description: description.trim() || null,
          source_bucket: "office-ai-kb",
          source_path: path,
          mime_type: file.type || "application/octet-stream",
          file_size_bytes: file.size,
          language,
          uploaded_by: userId,
        })
        .select()
        .single();
      if (insErr) throw insErr;

      // Trigger ingestion
      const { error: fnErr } = await supabase.functions.invoke(
        "ingest-office-ai-document",
        { body: { document_id: doc!.id } }
      );
      if (fnErr) throw fnErr;

      toast.success("Uploaded — ingestion started");
      setFile(null);
      setTitle("");
      setDescription("");
      setRefreshKey((k) => k + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const reindex = async (doc: Doc) => {
    const { error } = await supabase.functions.invoke("ingest-office-ai-document", {
      body: { document_id: doc.id },
    });
    if (error) toast.error(error.message);
    else toast.success("Re-ingestion started");
    setRefreshKey((k) => k + 1);
  };

  const remove = async (doc: Doc) => {
    if (!confirm(`Delete "${doc.title}" from the AI knowledge base?`)) return;
    await supabase.storage.from(doc.source_bucket).remove([doc.source_path]);
    const { error } = await supabase.from("office_ai_documents").delete().eq("id", doc.id);
    if (error) toast.error(error.message);
    else toast.success("Document deleted");
    setRefreshKey((k) => k + 1);
  };

  const toggleEnabled = async (doc: Doc) => {
    const { error } = await supabase.from("office_ai_documents")
      .update({ ai_enabled: !doc.ai_enabled }).eq("id", doc.id);
    if (error) toast.error(error.message);
    setRefreshKey((k) => k + 1);
  };

  const formatTime = (iso: string) => formatInTimeZone(new Date(iso), "America/New_York", "MMM d, yyyy h:mm a 'EST'");

  const statusBadge = (s: Doc["ingest_status"]) => {
    const map: Record<Doc["ingest_status"], { variant: "default" | "secondary" | "destructive" | "outline"; label: string; icon: any }> = {
      pending: { variant: "secondary", label: "Pending", icon: Loader2 },
      processing: { variant: "secondary", label: "Processing", icon: Loader2 },
      ready: { variant: "default", label: "Ready", icon: CheckCircle2 },
      failed: { variant: "destructive", label: "Failed", icon: AlertCircle },
    };
    const cfg = map[s];
    const Icon = cfg.icon;
    return (
      <Badge variant={cfg.variant} className="gap-1">
        <Icon className={`h-3 w-3 ${s === "processing" || s === "pending" ? "animate-spin" : ""}`} />
        {cfg.label}
      </Badge>
    );
  };

  return (
    <Tabs defaultValue="documents">
      <TabsList>
        <TabsTrigger value="documents"><FileText className="h-4 w-4 mr-2" />Documents</TabsTrigger>
        <TabsTrigger value="analytics"><BarChart3 className="h-4 w-4 mr-2" />Analytics</TabsTrigger>
      </TabsList>

      <TabsContent value="documents" className="space-y-6 mt-4">
        <Card className="p-5 border-2 border-primary/40 bg-primary/5 space-y-2">
          <h3 className="font-semibold text-lg">Office Staff AI Assistant — Knowledge Base</h3>
          <p className="text-sm text-foreground/90">
            Upload PDF, DOCX, TXT, or Markdown files. The assistant uses these to answer questions
            from Office Staff. After upload, the system extracts text, splits it into chunks, and
            embeds them for semantic search. Only <strong>Ready</strong> documents are searchable.
            Toggle <strong>Include in AI</strong> to remove a document from search without deleting it.
          </p>
        </Card>

        <Card className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input placeholder="Title (e.g. Refund Policy 2026)" value={title} onChange={(e) => setTitle(e.target.value)} />
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="h-10 rounded-md border bg-background px-3 text-sm"
            >
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="ru">Russian</option>
            </select>
          </div>
          <Textarea placeholder="Short description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />

          <div className="relative">
            <Button variant="outline" className="w-full justify-start pointer-events-none">
              <Upload className="h-4 w-4 mr-2" />
              {file ? `${file.name} (${Math.round(file.size / 1024)} KB)` : "Choose file (PDF, DOCX, TXT, MD)"}
            </Button>
            <input
              type="file"
              accept={ACCEPTED}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
          </div>
          {file && (
            <Button variant="ghost" size="sm" onClick={() => setFile(null)}>Remove file</Button>
          )}

          <Button onClick={onUpload} disabled={uploading || !file || !title.trim()}>
            {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            Upload & Ingest
          </Button>
        </Card>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : docs.length === 0 ? (
          <Card className="p-6 text-center text-muted-foreground">No documents yet.</Card>
        ) : (
          <div className="space-y-2">
            {docs.map((d) => (
              <Card key={d.id} className="p-4 flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="font-medium truncate">{d.title}</span>
                    {statusBadge(d.ingest_status)}
                    <Badge variant="outline" className="gap-1"><Globe className="h-3 w-3" />{d.language?.toUpperCase()}</Badge>
                    <Badge variant="outline">{d.chunk_count} chunks</Badge>
                  </div>
                  {d.description && <p className="text-xs text-muted-foreground mt-1">{d.description}</p>}
                  {d.ingest_error && <p className="text-xs text-destructive mt-1">Error: {d.ingest_error}</p>}
                  <p className="text-[11px] text-muted-foreground mt-1">Uploaded {formatTime(d.created_at)}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center gap-2 text-xs">
                    <span>Include in AI</span>
                    <Switch checked={d.ai_enabled} onCheckedChange={() => toggleEnabled(d)} />
                  </div>
                  <Button size="sm" variant="outline" onClick={() => reindex(d)} title="Re-ingest">
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(d)} title="Delete">
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="analytics" className="mt-4">
        <AdminOfficeAIAnalytics />
      </TabsContent>
    </Tabs>
  );
};

const AdminOfficeAIAnalytics = () => {
  const [queries, setQueries] = useState<any[]>([]);
  const [feedback, setFeedback] = useState<any[]>([]);
  const [range, setRange] = useState<7 | 30 | 90>(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void load();
  }, [range]);

  const load = async () => {
    setLoading(true);
    const since = new Date(Date.now() - range * 86400000).toISOString();
    const [q, f] = await Promise.all([
      supabase.from("office_ai_queries").select("*").gte("created_at", since).order("created_at", { ascending: false }).limit(500),
      supabase.from("office_ai_feedback").select("*").gte("created_at", since),
    ]);
    setQueries(q.data ?? []);
    setFeedback(f.data ?? []);
    setLoading(false);
  };

  const topQuestions = useMemo(() => {
    const counts: Record<string, number> = {};
    queries.forEach((q) => { counts[q.question] = (counts[q.question] ?? 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 20);
  }, [queries]);

  const unanswered = queries.filter((q) => !q.had_results);
  const avgMs = queries.length ? Math.round(queries.reduce((s, q) => s + (q.response_ms ?? 0), 0) / queries.length) : 0;
  const up = feedback.filter((f) => f.rating === "up").length;
  const down = feedback.filter((f) => f.rating === "down").length;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {([7, 30, 90] as const).map((d) => (
          <Button key={d} size="sm" variant={range === d ? "default" : "outline"} onClick={() => setRange(d)}>
            Last {d} days
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4"><p className="text-xs text-muted-foreground">Total questions</p><p className="text-2xl font-bold">{queries.length}</p></Card>
            <Card className="p-4"><p className="text-xs text-muted-foreground">Unanswered (no results)</p><p className="text-2xl font-bold text-destructive">{unanswered.length}</p></Card>
            <Card className="p-4"><p className="text-xs text-muted-foreground">Avg response time</p><p className="text-2xl font-bold">{avgMs} ms</p></Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">Feedback</p>
              <p className="text-2xl font-bold flex items-center gap-3">
                <span className="flex items-center gap-1 text-green-600"><ThumbsUp className="h-4 w-4" />{up}</span>
                <span className="flex items-center gap-1 text-destructive"><ThumbsDown className="h-4 w-4" />{down}</span>
              </p>
            </Card>
          </div>

          <Card className="p-4">
            <h4 className="font-semibold mb-3">Top questions</h4>
            {topQuestions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No questions in this window.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {topQuestions.map(([q, c]) => (
                  <li key={q} className="flex justify-between gap-3 border-b pb-1.5">
                    <span className="truncate">{q}</span>
                    <Badge variant="outline">{c}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-4">
            <h4 className="font-semibold mb-3">Unanswered questions ({unanswered.length})</h4>
            {unanswered.length === 0 ? (
              <p className="text-sm text-muted-foreground">All questions found relevant content. </p>
            ) : (
              <ul className="space-y-1.5 text-sm max-h-72 overflow-y-auto">
                {unanswered.slice(0, 50).map((q) => (
                  <li key={q.id} className="border-b pb-1.5">
                    <p>{q.question}</p>
                    <p className="text-[11px] text-muted-foreground">{formatInTimeZone(new Date(q.created_at), "America/New_York", "MMM d, h:mm a 'EST'")}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
};

export default AdminOfficeAIKnowledge;
