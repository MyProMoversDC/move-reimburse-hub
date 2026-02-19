import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { pqt } from "@/lib/paymentQuestionTranslations";
import { Language } from "@/lib/translations";
import { format } from "date-fns";
import { Clock, CheckCircle, MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Languages, Loader2 } from "lucide-react";

interface Message {
  id: string;
  message: string;
  is_admin_message: boolean;
  created_at: string;
  sender_id: string;
}

interface PaymentQuestion {
  id: string;
  subject: string;
  other_subject: string | null;
  job_number: string;
  question_details: string;
  status: string;
  created_at: string;
  messages?: Message[];
}

interface PaymentQuestionHistoryProps {
  userId: string;
  language: Language;
  refreshKey?: number;
}

const PaymentQuestionHistory = ({ userId, language, refreshKey }: PaymentQuestionHistoryProps) => {
  const [questions, setQuestions] = useState<PaymentQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});
  const [sendingReply, setSendingReply] = useState<string | null>(null);
  const [translatedMessages, setTranslatedMessages] = useState<Map<string, string>>(new Map());
  const [translatingId, setTranslatingId] = useState<string | null>(null);

  useEffect(() => {
    fetchQuestions();
  }, [userId, refreshKey]);

  const fetchQuestions = async () => {
    setIsLoading(true);
    try {
      const { data: questionData, error } = await supabase
        .from("payment_questions")
        .select("*")
        .eq("mover_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const questionsWithMessages = await Promise.all(
        (questionData || []).map(async (q) => {
          const { data: messages } = await supabase
            .from("payment_question_messages")
            .select("*")
            .eq("question_id", q.id)
            .order("created_at", { ascending: true });
          return { ...q, messages: messages || [] };
        })
      );

      setQuestions(questionsWithMessages);
    } catch (error) {
      console.error("Error fetching payment questions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendReply = async (questionId: string) => {
    const text = replyTexts[questionId]?.trim();
    if (!text) return;

    setSendingReply(questionId);
    try {
      const { error } = await supabase.from("payment_question_messages").insert({
        question_id: questionId,
        sender_id: userId,
        message: text,
        is_admin_message: false,
      });

      if (error) throw error;

      toast.success(pqt("replySent", language));
      setReplyTexts((prev) => ({ ...prev, [questionId]: "" }));
      fetchQuestions();
    } catch (error) {
      console.error("Error sending reply:", error);
      toast.error(pqt("replyError", language));
    } finally {
      setSendingReply(null);
    }
  };

  const handleTranslateMessage = async (msgId: string, text: string) => {
    if (translatedMessages.has(msgId)) {
      const newMap = new Map(translatedMessages);
      newMap.delete(msgId);
      setTranslatedMessages(newMap);
      return;
    }
    setTranslatingId(msgId);
    try {
      const { data } = await supabase.functions.invoke("translate-text", {
        body: { texts: [text], targetLanguage: language },
      });
      if (data?.translations) {
        setTranslatedMessages(new Map(translatedMessages).set(msgId, data.translations[0]));
      }
    } catch (error) {
      console.error("Translation error:", error);
    } finally {
      setTranslatingId(null);
    }
  };

  const getSubjectDisplay = (q: PaymentQuestion) => {
    if (q.subject === "other" && q.other_subject) return q.other_subject;
    return pqt(q.subject as any, language);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return <Badge variant="secondary" className="flex items-center gap-1"><Clock className="h-3 w-3" />{pqt("open", language)}</Badge>;
      case "answered":
        return <Badge variant="outline" className="flex items-center gap-1 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"><CheckCircle className="h-3 w-3" />{pqt("answered", language)}</Badge>;
      case "closed":
        return <Badge variant="outline" className="flex items-center gap-1"><MessageCircle className="h-3 w-3" />{pqt("closed", language)}</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">{language === "ru" ? "Загрузка..." : language === "es" ? "Cargando..." : "Loading..."}</div>;

  if (questions.length === 0) {
    return <Card><CardContent className="py-8 text-center text-muted-foreground">{pqt("noQuestions", language)}</CardContent></Card>;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">{pqt("historyTitle", language)}</h3>
      <Accordion type="single" collapsible className="space-y-2">
        {questions.map((q) => (
          <AccordionItem key={q.id} value={q.id} className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-left w-full pr-4">
                <div className="flex-1">
                  <p className="font-medium">{getSubjectDisplay(q)} - {pqt("jobLabel", language)}: {q.job_number}</p>
                  <p className="text-sm text-muted-foreground">{pqt("submittedOn", language)}: {format(new Date(q.created_at), "MMM d, yyyy")}</p>
                </div>
                <div className="flex gap-2">{getStatusBadge(q.status)}</div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{pqt("questionLabel", language)}:</p>
                <p className="text-sm mt-1">{q.question_details}</p>
              </div>

              {/* Communication Thread */}
              {q.messages && q.messages.length > 0 && (
                <div className="pt-3 border-t space-y-2">
                  <p className="text-sm font-medium">{pqt("communicationHistory", language)}:</p>
                  {q.messages.map((msg) => (
                    <div key={msg.id} className={`p-3 rounded-md ${msg.is_admin_message ? "bg-blue-50 dark:bg-blue-950" : "bg-muted"}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium">{msg.is_admin_message ? pqt("admin", language) : pqt("you", language)}</span>
                        <span className="text-xs text-muted-foreground">{format(new Date(msg.created_at), "MMM d, yyyy h:mm a")}</span>
                      </div>
                      <p className="text-sm">{translatedMessages.get(msg.id) || msg.message}</p>
                      {msg.is_admin_message && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTranslateMessage(msg.id, msg.message)}
                          disabled={translatingId === msg.id}
                          className="mt-1 gap-1"
                        >
                          {translatingId === msg.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Languages className="h-3 w-3" />
                          )}
                          {translatedMessages.has(msg.id)
                            ? (language === "ru" ? "Показать оригинал" : language === "es" ? "Mostrar original" : "Show Original")
                            : (language === "ru" ? "Перевести" : language === "es" ? "Traducir" : "Translate")}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Reply Input */}
              <div className="flex gap-2 pt-2">
                <Textarea
                  placeholder={pqt("replyPlaceholder", language)}
                  value={replyTexts[q.id] || ""}
                  onChange={(e) => setReplyTexts((prev) => ({ ...prev, [q.id]: e.target.value }))}
                  className="min-h-[60px]"
                />
                <Button
                  size="sm"
                  onClick={() => handleSendReply(q.id)}
                  disabled={sendingReply === q.id || !replyTexts[q.id]?.trim()}
                  className="self-end"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
};

export default PaymentQuestionHistory;
