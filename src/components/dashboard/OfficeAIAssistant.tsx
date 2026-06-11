import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Send, Loader2, Sparkles, FileText, Plus, MessageSquare, Trash2,
  ThumbsUp, ThumbsDown, BookOpen,
} from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { formatInTimeZone } from "date-fns-tz";
import logo from "@/assets/logo.png";

type Lang = "en" | "es" | "ru";

interface Citation {
  document_id: string;
  document_title: string;
  page_number: number | null;
  similarity: number;
}

interface Msg {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  created_at: string;
}

interface Conv {
  id: string;
  title: string | null;
  last_message_at: string;
}

const i18n = {
  en: {
    title: "AI Assistant",
    subtitle: "Ask questions about company policies, SOPs, and the knowledge base.",
    placeholder: "Ask anything about our internal documents…",
    newConv: "New conversation",
    history: "Recent conversations",
    empty: "Start a conversation. The assistant will answer using only the company knowledge base.",
    suggestions: ["What is the refund policy?", "How do I report a customer complaint?", "What are the procedures for handling damages?", "Where can I find the employee handbook?"],
    thinking: "Thinking…",
    sources: "Sources",
    helpful: "Was this helpful?",
    sent: "Thanks for your feedback",
    retention: "Conversations are kept for 90 days, then automatically cleared.",
  },
  es: {
    title: "Asistente IA",
    subtitle: "Haga preguntas sobre políticas, procedimientos y la base de conocimientos.",
    placeholder: "Pregunte cualquier cosa sobre nuestros documentos internos…",
    newConv: "Nueva conversación",
    history: "Conversaciones recientes",
    empty: "Inicie una conversación. El asistente responderá solo usando la base de conocimientos.",
    suggestions: ["¿Cuál es la política de reembolso?", "¿Cómo reporto una queja de cliente?", "¿Cuáles son los procedimientos para daños?", "¿Dónde encuentro el manual del empleado?"],
    thinking: "Pensando…",
    sources: "Fuentes",
    helpful: "¿Le fue útil?",
    sent: "Gracias por sus comentarios",
    retention: "Las conversaciones se conservan 90 días y luego se eliminan automáticamente.",
  },
  ru: {
    title: "AI Ассистент",
    subtitle: "Задавайте вопросы о политике компании, процедурах и базе знаний.",
    placeholder: "Спросите что угодно о наших внутренних документах…",
    newConv: "Новая беседа",
    history: "Недавние беседы",
    empty: "Начните беседу. Ассистент ответит, используя только базу знаний компании.",
    suggestions: ["Какова политика возврата?", "Как сообщить о жалобе клиента?", "Каковы процедуры при повреждениях?", "Где найти руководство сотрудника?"],
    thinking: "Думаю…",
    sources: "Источники",
    helpful: "Это было полезно?",
    sent: "Спасибо за отзыв",
    retention: "Беседы хранятся 90 дней, затем автоматически удаляются.",
  },
};

const OfficeAIAssistant = ({ userId, language }: { userId: string; language: Lang }) => {
  const t = i18n[language] ?? i18n.en;
  const [convs, setConvs] = useState<Conv[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [streaming, setStreaming] = useState("");
  const [streamCitations, setStreamCitations] = useState<Citation[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { void loadConvs(); }, []);
  useEffect(() => { if (activeId) void loadMessages(activeId); else setMessages([]); }, [activeId]);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);
  useEffect(() => { taRef.current?.focus(); }, [activeId]);

  const loadConvs = async () => {
    const { data } = await supabase
      .from("office_ai_conversations").select("id,title,last_message_at")
      .eq("user_id", userId).order("last_message_at", { ascending: false }).limit(50);
    setConvs((data ?? []) as Conv[]);
  };

  const loadMessages = async (id: string) => {
    const { data } = await supabase
      .from("office_ai_messages").select("*").eq("conversation_id", id)
      .order("created_at", { ascending: true });
    setMessages((data ?? []) as unknown as Msg[]);
  };

  const createConv = async (firstQuestion?: string) => {
    const title = firstQuestion ? firstQuestion.slice(0, 60) : "New conversation";
    const { data, error } = await supabase
      .from("office_ai_conversations").insert({
        user_id: userId, title, language,
      }).select().single();
    if (error) { toast.error(error.message); return null; }
    setConvs((c) => [data as Conv, ...c]);
    setActiveId(data!.id);
    return data!.id as string;
  };

  const deleteConv = async (id: string) => {
    if (!confirm("Delete this conversation?")) return;
    const { error } = await supabase.from("office_ai_conversations").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setConvs((c) => c.filter((x) => x.id !== id));
    if (activeId === id) setActiveId(null);
  };

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || sending) return;
    setSending(true);
    setStreaming("");
    setStreamCitations([]);

    try {
      let convId = activeId;
      if (!convId) convId = await createConv(q);
      if (!convId) return;

      // Optimistic user msg
      const { data: userMsg } = await supabase.from("office_ai_messages")
        .insert({ conversation_id: convId, role: "user", content: q })
        .select().single();
      if (userMsg) setMessages((m) => [...m, userMsg as unknown as Msg]);
      setInput("");

      const { data: { session } } = await supabase.auth.getSession();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/office-ai-chat`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ conversation_id: convId, question: q, language }),
      });

      if (!res.ok || !res.body) {
        const err = await res.text();
        throw new Error(err || `Request failed (${res.status})`);
      }

      // Citations from header
      const citHeader = res.headers.get("X-AI-Citations");
      const citations: Citation[] = citHeader ? JSON.parse(decodeURIComponent(citHeader)) : [];
      setStreamCitations(citations);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setStreaming(acc);
      }

      // Reload messages from DB (assistant message was persisted server-side)
      await loadMessages(convId);
      await loadConvs();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to get answer");
    } finally {
      setSending(false);
      setStreaming("");
      setStreamCitations([]);
      taRef.current?.focus();
    }
  };

  const giveFeedback = async (messageId: string, rating: "up" | "down") => {
    const { error } = await supabase.from("office_ai_feedback")
      .upsert({ message_id: messageId, user_id: userId, rating }, { onConflict: "message_id,user_id" });
    if (error) toast.error(error.message);
    else toast.success(t.sent);
  };

  const formatTime = (iso: string) => formatInTimeZone(new Date(iso), "America/New_York", "MMM d, h:mm a 'EST'");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4 h-[calc(100vh-200px)] min-h-[500px]">
      {/* Conversations sidebar */}
      <Card className="p-3 flex flex-col gap-2 overflow-hidden">
        <Button onClick={() => setActiveId(null)} size="sm" className="w-full">
          <Plus className="h-4 w-4 mr-2" /> {t.newConv}
        </Button>
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground mt-1">{t.history}</p>
        <ScrollArea className="flex-1">
          <div className="space-y-1 pr-2">
            {convs.map((c) => (
              <div key={c.id} className={`group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm cursor-pointer ${activeId === c.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                onClick={() => setActiveId(c.id)}>
                <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate flex-1">{c.title ?? "Untitled"}</span>
                <button onClick={(e) => { e.stopPropagation(); void deleteConv(c.id); }}
                  className="opacity-0 group-hover:opacity-100">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {convs.length === 0 && <p className="text-xs text-muted-foreground px-2 py-2">—</p>}
          </div>
        </ScrollArea>
        <p className="text-[10px] text-muted-foreground pt-2 border-t">{t.retention}</p>
      </Card>

      {/* Chat area */}
      <Card className="p-0 flex flex-col overflow-hidden">
        <div className="p-3 border-b flex items-center gap-3 bg-primary/5">
          <img src={logo} alt="MyProMovers" className="h-7" />
          <div className="flex-1">
            <h2 className="font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" />{t.title}</h2>
            <p className="text-xs text-muted-foreground">{t.subtitle}</p>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && !streaming ? (
            <div className="h-full flex flex-col items-center justify-center text-center gap-4 py-10">
              <div className="rounded-full bg-primary/10 p-4"><BookOpen className="h-8 w-8 text-primary" /></div>
              <p className="text-sm text-muted-foreground max-w-md">{t.empty}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-2xl">
                {t.suggestions.map((s) => (
                  <Button key={s} variant="outline" size="sm" className="justify-start h-auto py-2 text-left text-xs"
                    onClick={() => void send(s)}>
                    {s}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] space-y-1.5 ${m.role === "user" ? "" : "w-full"}`}>
                    {m.role === "user" ? (
                      <div className="bg-primary text-primary-foreground rounded-lg px-3 py-2 text-sm">{m.content}</div>
                    ) : (
                      <div className="space-y-2">
                        <div className="text-sm prose prose-sm max-w-none dark:prose-invert">
                          <ReactMarkdown>{m.content}</ReactMarkdown>
                        </div>
                        {Array.isArray(m.citations) && m.citations.length > 0 && (
                          <div className="flex items-center gap-2 flex-wrap pt-1 border-t">
                            <span className="text-[11px] text-muted-foreground">{t.sources}:</span>
                            {m.citations.slice(0, 5).map((c, i) => (
                              <CitationChip key={i} c={c} />
                            ))}
                          </div>
                        )}
                        <div className="flex items-center gap-2 pt-1">
                          <span className="text-[11px] text-muted-foreground">{t.helpful}</span>
                          <button onClick={() => void giveFeedback(m.id, "up")} className="text-muted-foreground hover:text-green-600"><ThumbsUp className="h-3.5 w-3.5" /></button>
                          <button onClick={() => void giveFeedback(m.id, "down")} className="text-muted-foreground hover:text-destructive"><ThumbsDown className="h-3.5 w-3.5" /></button>
                          <span className="text-[10px] text-muted-foreground ml-auto">{formatTime(m.created_at)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {streaming && (
                <div className="flex justify-start">
                  <div className="max-w-[85%] w-full space-y-2">
                    <div className="text-sm prose prose-sm max-w-none dark:prose-invert">
                      <ReactMarkdown>{streaming}</ReactMarkdown>
                    </div>
                    {streamCitations.length > 0 && (
                      <div className="flex items-center gap-2 flex-wrap pt-1 border-t">
                        <span className="text-[11px] text-muted-foreground">{t.sources}:</span>
                        {streamCitations.slice(0, 5).map((c, i) => <CitationChip key={i} c={c} />)}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {sending && !streaming && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> {t.thinking}
                </div>
              )}
            </>
          )}
        </div>

        <div className="border-t p-3">
          <div className="flex gap-2">
            <Textarea
              ref={taRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(input); }
              }}
              placeholder={t.placeholder}
              rows={2}
              disabled={sending}
              className="resize-none"
            />
            <Button onClick={() => void send(input)} disabled={sending || !input.trim()} size="icon" className="h-auto">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

const CitationChip = ({ c }: { c: Citation }) => {
  const open = async () => {
    const { data: doc } = await supabase
      .from("office_ai_documents").select("source_bucket,source_path,title")
      .eq("id", c.document_id).single();
    if (!doc) return toast.error("Source not available");
    const { data: signed } = await supabase.storage
      .from(doc.source_bucket).createSignedUrl(doc.source_path, 60 * 10);
    if (signed?.signedUrl) window.open(signed.signedUrl, "_blank");
    else toast.error("Could not load source");
  };
  return (
    <Badge variant="outline" className="cursor-pointer hover:bg-muted gap-1" onClick={open}>
      <FileText className="h-3 w-3" />
      <span className="max-w-[180px] truncate">{c.document_title}</span>
      {c.page_number && <span className="text-muted-foreground">p.{c.page_number}</span>}
    </Badge>
  );
};

export default OfficeAIAssistant;
