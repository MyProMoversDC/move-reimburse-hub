// RAG chat endpoint for the Office Staff AI Assistant.
// Streams a Gemini answer grounded in the matched knowledge-base chunks
// and returns citations as a JSON header for the client to render.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders as baseCors } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const EMBED_MODEL = "google/gemini-embedding-001";
const EMBED_DIMS = 1536;
const CHAT_MODEL = "google/gemini-3-flash-preview";
const TOP_K = 16;

const corsHeaders = {
  ...baseCors,
  "Access-Control-Expose-Headers": "X-AI-Citations, X-AI-Query-Id",
};

const SYSTEM_PROMPT = `You are the MyProMovers Office Assistant. You help office staff find answers from the company knowledge base.

CORE PRINCIPLE — REASON OVER THE EXCERPTS:
Actively analyze and interpret the provided document excerpts. Do not require an exact keyword match between the user's question and the document text. Apply common-sense reasoning to map the user's wording to the concepts in the documents.

REASONING RULES:
- Treat the excerpts as the source of truth and INFER answers when the documents clearly cover the concept, even if the exact term differs.
- Map specific terms to their general categories and vice versa. Examples:
  • "Sunday" / "Saturday" → "weekend"; "Monday–Friday" → "weekday"
  • "January 1" / "Christmas" / "Thanksgiving" → "holiday" (if listed as one)
  • "tip" → "gratuity"; "pay/wage" → "rate / compensation"
  • "truck" → "vehicle"; "mover" → "crew / employee / staff"
  • City/state names → service area, region, branch
- If the document gives a rule for a category (e.g. "weekend rate is $X"), apply that rule to any member of the category the user asks about (e.g. Sunday).
- If multiple excerpts are relevant, combine them. If they conflict, point out the conflict and cite both sources.
- When the answer requires a small inference (synonym, category membership, simple arithmetic from rates × hours, etc.), make the inference and briefly explain it in one sentence, e.g. "Sunday is part of the weekend, so the weekend rate of $X applies."
- Only say you don't have the information when the documents truly do not cover the topic — not merely when the exact word is missing.

CITATION & FORMAT RULES:
- Always cite the source document by its title and (when available) page number, like [Doc Title, p. 3].
- Detect the user's language from their question and respond in the same language. Supported: English, Spanish, Russian.
- Be concise, clear, and professional. Use markdown for structure when helpful.
- Never invent facts, policies, prices, names, or numbers that cannot be derived from the excerpts.

FALLBACK:
- If after reasoning the excerpts genuinely do not answer the question, reply (in the user's language): "I don't have that information in the current knowledge base. Please contact an admin."`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    const userRes = await supabase.auth.getUser(auth.replace("Bearer ", ""));
    if (!userRes.data.user) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const userId = userRes.data.user.id;

    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const allowed = roles?.some((r) => r.role === "office_staff" || r.role === "admin");
    if (!allowed) return new Response("Forbidden", { status: 403, headers: corsHeaders });

    const body = await req.json();
    const conversationId: string | undefined = body.conversation_id;
    const question: string = (body.question ?? "").toString().trim();
    const language: string = body.language ?? "en";
    if (!question) return new Response("question required", { status: 400, headers: corsHeaders });

    const t0 = Date.now();

    // 1. Embed question
    const embedRes = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": LOVABLE_API_KEY },
      body: JSON.stringify({ model: EMBED_MODEL, input: question, dimensions: EMBED_DIMS }),
    });
    if (!embedRes.ok) {
      const errBody = await embedRes.text();
      return new Response(JSON.stringify({ error: `Embedding error: ${errBody}` }), {
        status: embedRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const embedJson = await embedRes.json();
    const queryEmbedding = embedJson.data[0].embedding as number[];

    // 2. Vector search
    const { data: matches, error: matchErr } = await supabase.rpc("match_office_ai_chunks", {
      query_embedding: JSON.stringify(queryEmbedding),
      match_count: TOP_K,
    });
    if (matchErr) {
      return new Response(JSON.stringify({ error: `Search error: ${matchErr.message}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const chunks = (matches ?? []) as Array<{
      id: string; document_id: string; document_title: string;
      page_number: number | null; content: string; similarity: number;
    }>;

    // 3. Build context
    const contextBlocks = chunks.map((c, i) =>
      `[${i + 1}] Document: "${c.document_title}"${c.page_number ? `, page ${c.page_number}` : ""}\n${c.content}`
    ).join("\n\n---\n\n");

    const userPrompt = chunks.length
      ? `User question: ${question}\n\nKnowledge base excerpts:\n\n${contextBlocks}`
      : `User question: ${question}\n\n(No relevant knowledge base excerpts found.)`;

    // 4. Call Gemini chat (non-stream for simplicity + reliable citation header)
    const chatRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": LOVABLE_API_KEY },
      body: JSON.stringify({
        model: CHAT_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        stream: true,
      }),
    });

    if (!chatRes.ok || !chatRes.body) {
      const errBody = await chatRes.text();
      return new Response(JSON.stringify({ error: `Chat error: ${errBody}` }), {
        status: chatRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Citations payload
    const citations = chunks.map((c) => ({
      document_id: c.document_id,
      document_title: c.document_title,
      page_number: c.page_number,
      similarity: Number(c.similarity?.toFixed(3) ?? 0),
    }));

    // Log query (fire & forget)
    let queryRowId: string | null = null;
    const { data: queryRow } = await supabase.from("office_ai_queries").insert({
      user_id: userId,
      conversation_id: conversationId ?? null,
      question,
      language,
      chunk_ids_used: chunks.map((c) => c.id),
      document_ids_used: Array.from(new Set(chunks.map((c) => c.document_id))),
      response_ms: Date.now() - t0,
      had_results: chunks.length > 0,
    }).select("id").single();
    queryRowId = queryRow?.id ?? null;

    // Stream SSE -> plain text + accumulate full answer to persist
    let fullAnswer = "";
    const stream = new ReadableStream({
      async start(controller) {
        const reader = chatRes.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const payload = line.slice(6).trim();
              if (payload === "[DONE]") continue;
              try {
                const json = JSON.parse(payload);
                const delta = json.choices?.[0]?.delta?.content;
                if (delta) {
                  fullAnswer += delta;
                  controller.enqueue(new TextEncoder().encode(delta));
                }
              } catch { /* ignore partial */ }
            }
          }
        } catch (e) {
          controller.error(e);
          return;
        }

        // Persist assistant message + update query preview
        if (conversationId) {
          await supabase.from("office_ai_messages").insert({
            conversation_id: conversationId,
            role: "assistant",
            content: fullAnswer,
            citations,
          });
          await supabase.from("office_ai_conversations")
            .update({ last_message_at: new Date().toISOString() })
            .eq("id", conversationId);
        }
        if (queryRowId) {
          await supabase.from("office_ai_queries")
            .update({ answer_preview: fullAnswer.slice(0, 500) })
            .eq("id", queryRowId);
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/plain; charset=utf-8",
        "X-AI-Citations": encodeURIComponent(JSON.stringify(citations)),
        "X-AI-Query-Id": queryRowId ?? "",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
