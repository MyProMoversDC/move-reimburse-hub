// Ingest an uploaded knowledge-base file: extract text, chunk, embed,
// store chunks. Triggered by admin from the UI after the file is uploaded
// to the office-ai-kb bucket.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { extractText, getDocumentProxy } from "npm:unpdf@0.12.1";
import mammoth from "npm:mammoth@1.8.0";
import { Buffer } from "node:buffer";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const EMBED_MODEL = "google/gemini-embedding-001";
const EMBED_DIMS = 1536;
const CHUNK_SIZE = 1200;   // ~chars
const CHUNK_OVERLAP = 200;

function chunkText(text: string): string[] {
  const clean = text.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
  const chunks: string[] = [];
  let i = 0;
  while (i < clean.length) {
    const end = Math.min(i + CHUNK_SIZE, clean.length);
    let slice = clean.slice(i, end);
    // try to end on paragraph or sentence
    if (end < clean.length) {
      const cut = Math.max(slice.lastIndexOf("\n\n"), slice.lastIndexOf(". "));
      if (cut > CHUNK_SIZE * 0.5) slice = slice.slice(0, cut + 1);
    }
    if (slice.trim().length > 0) chunks.push(slice.trim());
    i += Math.max(slice.length - CHUNK_OVERLAP, 1);
  }
  return chunks;
}

async function embedBatch(inputs: string[]): Promise<number[][]> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": LOVABLE_API_KEY,
    },
    body: JSON.stringify({
      model: EMBED_MODEL,
      input: inputs,
      dimensions: EMBED_DIMS,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Embedding failed ${res.status}: ${body}`);
  }
  const json = await res.json();
  return json.data.map((d: { embedding: number[] }) => d.embedding);
}

async function extractFromBuffer(buf: ArrayBuffer, mime: string): Promise<{ text: string; pages: number[] }> {
  if (mime.includes("pdf")) {
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const { text } = await extractText(pdf, { mergePages: false });
    const pagesArr = Array.isArray(text) ? text : [text as unknown as string];
    let combined = "";
    const pageBreaks: number[] = [];
    pagesArr.forEach((p, idx) => {
      pageBreaks.push(combined.length);
      combined += (idx > 0 ? "\n\n" : "") + (p || "");
    });
    return { text: combined, pages: pageBreaks };
  }
  if (mime.includes("word") || mime.includes("officedocument") || mime.endsWith("docx")) {
    const result = await mammoth.extractRawText({ buffer: Buffer.from(new Uint8Array(buf)) });
    return { text: result.value, pages: [] };
  }
  // plain text / markdown / html stripped
  const txt = new TextDecoder().decode(buf);
  return { text: txt.replace(/<[^>]+>/g, " "), pages: [] };
}

function pageForOffset(offset: number, pageBreaks: number[]): number | null {
  if (!pageBreaks.length) return null;
  for (let p = pageBreaks.length - 1; p >= 0; p--) {
    if (offset >= pageBreaks[p]) return p + 1;
  }
  return 1;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  let documentId: string | null = null;

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const user = await supabase.auth.getUser(auth.replace("Bearer ", ""));
    if (!user.data.user) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.data.user.id);
    if (!roles?.some((r) => r.role === "admin")) {
      return new Response("Forbidden", { status: 403, headers: corsHeaders });
    }

    const body = await req.json();
    documentId = body.document_id as string;
    if (!documentId) return new Response("document_id required", { status: 400, headers: corsHeaders });

    const { data: doc, error: docErr } = await supabase
      .from("office_ai_documents").select("*").eq("id", documentId).single();
    if (docErr || !doc) throw new Error("Document not found");

    await supabase.from("office_ai_documents")
      .update({ ingest_status: "processing", ingest_error: null }).eq("id", documentId);

    // Download file
    const { data: file, error: dlErr } = await supabase.storage
      .from(doc.source_bucket).download(doc.source_path);
    if (dlErr || !file) throw new Error(`Download failed: ${dlErr?.message}`);

    const buf = await file.arrayBuffer();
    const { text, pages } = await extractFromBuffer(buf, doc.mime_type ?? "");

    if (!text.trim()) throw new Error("No text extracted from document");

    // Purge existing chunks (reindex case)
    await supabase.from("office_ai_chunks").delete().eq("document_id", documentId);

    const chunks = chunkText(text);
    let inserted = 0;
    const BATCH = 50;
    let runningOffset = 0;
    for (let i = 0; i < chunks.length; i += BATCH) {
      const slice = chunks.slice(i, i + BATCH);
      const embeddings = await embedBatch(slice);
      const rows = slice.map((content, j) => {
        const idx = i + j;
        const pageNum = pageForOffset(runningOffset, pages);
        runningOffset += content.length;
        return {
          document_id: documentId!,
          chunk_index: idx,
          page_number: pageNum,
          content,
          token_count: Math.ceil(content.length / 4),
          embedding: JSON.stringify(embeddings[j]),
        };
      });
      const { error: insErr } = await supabase.from("office_ai_chunks").insert(rows);
      if (insErr) throw new Error(`Chunk insert failed: ${insErr.message}`);
      inserted += rows.length;
    }

    await supabase.from("office_ai_documents")
      .update({ ingest_status: "ready", chunk_count: inserted, ingest_error: null })
      .eq("id", documentId);

    return new Response(JSON.stringify({ ok: true, chunks: inserted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (documentId) {
      await supabase.from("office_ai_documents")
        .update({ ingest_status: "failed", ingest_error: msg }).eq("id", documentId);
    }
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
