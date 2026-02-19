import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { Clock, CheckCircle, MessageCircle, Send, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { TranslateButton } from "./TranslateButton";
import { useTranslation } from "@/hooks/useTranslation";
import { Language } from "@/lib/translations";

interface Message {
  id: string;
  message: string;
  is_admin_message: boolean;
  created_at: string;
  sender_id: string;
}

interface Attachment {
  id: string;
  file_url: string;
  file_name: string;
  file_type: string | null;
}

interface PaymentQuestion {
  id: string;
  mover_id: string;
  mover_name: string;
  subject: string;
  other_subject: string | null;
  job_number: string;
  question_details: string;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  messages?: Message[];
  attachments?: Attachment[];
}

interface AdminPaymentQuestionListProps {
  language?: Language;
  userId: string;
}

const AdminPaymentQuestionList = ({ language = "en", userId }: AdminPaymentQuestionListProps) => {
  const [questions, setQuestions] = useState<PaymentQuestion[]>([]);
  const [filteredQuestions, setFilteredQuestions] = useState<PaymentQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "open" | "answered" | "closed">("all");
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});
  const [sendingReply, setSendingReply] = useState<string | null>(null);
  const [translatedCards, setTranslatedCards] = useState<Map<string, { question_details: string }>>(new Map());
  const [translatingCardId, setTranslatingCardId] = useState<string | null>(null);
  const [translatedMessages, setTranslatedMessages] = useState<Map<string, string>>(new Map());
  const [translatingMsgId, setTranslatingMsgId] = useState<string | null>(null);

  const { translateTexts, isTranslating } = useTranslation();

  useEffect(() => {
    fetchQuestions();
  }, []);

  useEffect(() => {
    if (filter === "all") setFilteredQuestions(questions);
    else setFilteredQuestions(questions.filter((q) => q.status === filter));
  }, [filter, questions]);

  const fetchQuestions = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("payment_questions")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const withDetails = await Promise.all(
        (data || []).map(async (q) => {
          const [messagesRes, attachmentsRes] = await Promise.all([
            supabase.from("payment_question_messages").select("*").eq("question_id", q.id).order("created_at", { ascending: true }),
            supabase.from("payment_question_attachments").select("*").eq("question_id", q.id),
          ]);
          return { ...q, messages: messagesRes.data || [], attachments: attachmentsRes.data || [] };
        })
      );

      setQuestions(withDetails);
    } catch (error) {
      console.error("Error fetching payment questions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendReply = async (question: PaymentQuestion) => {
    const text = replyTexts[question.id]?.trim();
    if (!text) return;

    setSendingReply(question.id);
    try {
      // Insert message
      const { error: msgError } = await supabase.from("payment_question_messages").insert({
        question_id: question.id,
        sender_id: userId,
        message: text,
        is_admin_message: true,
      });
      if (msgError) throw msgError;

      // Update status to answered
      await supabase
        .from("payment_questions")
        .update({ status: "answered", reviewed_at: new Date().toISOString() })
        .eq("id", question.id);

      toast.success("Response sent successfully");
      setReplyTexts((prev) => ({ ...prev, [question.id]: "" }));
      fetchQuestions();
    } catch (error) {
      console.error("Error sending reply:", error);
      toast.error("Failed to send response");
    } finally {
      setSendingReply(null);
    }
  };

  const handleTranslateQuestion = async (q: PaymentQuestion) => {
    if (translatedCards.has(q.id)) {
      const newMap = new Map(translatedCards);
      newMap.delete(q.id);
      setTranslatedCards(newMap);
      return;
    }
    setTranslatingCardId(q.id);
    const translations = await translateTexts([q.question_details]);
    setTranslatedCards(new Map(translatedCards).set(q.id, { question_details: translations[0] }));
    setTranslatingCardId(null);
  };

  const handleTranslateMessage = async (msgId: string, text: string) => {
    if (translatedMessages.has(msgId)) {
      const newMap = new Map(translatedMessages);
      newMap.delete(msgId);
      setTranslatedMessages(newMap);
      return;
    }
    setTranslatingMsgId(msgId);
    const translations = await translateTexts([text]);
    setTranslatedMessages(new Map(translatedMessages).set(msgId, translations[0]));
    setTranslatingMsgId(null);
  };

  const toggleExpanded = (id: string) => {
    setExpandedCards((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const getSubjectDisplay = (q: PaymentQuestion) => {
    if (q.subject === "other" && q.other_subject) return q.other_subject;
    return q.subject.charAt(0).toUpperCase() + q.subject.slice(1);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return <Badge variant="secondary" className="flex items-center gap-1"><Clock className="h-3 w-3" />Open</Badge>;
      case "answered":
        return <Badge variant="outline" className="flex items-center gap-1 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"><CheckCircle className="h-3 w-3" />Answered</Badge>;
      case "closed":
        return <Badge variant="outline" className="flex items-center gap-1"><MessageCircle className="h-3 w-3" />Closed</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const handleViewAttachment = async (attachment: Attachment) => {
    try {
      const { data } = await supabase.storage
        .from("payment-question-attachments")
        .createSignedUrl(attachment.file_url, 3600);
      if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    } catch (error) {
      console.error("Error viewing attachment:", error);
    }
  };

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
          <TabsList>
            <TabsTrigger value="all">All ({questions.length})</TabsTrigger>
            <TabsTrigger value="open">Open ({questions.filter((q) => q.status === "open").length})</TabsTrigger>
            <TabsTrigger value="answered">Answered ({questions.filter((q) => q.status === "answered").length})</TabsTrigger>
            <TabsTrigger value="closed">Closed ({questions.filter((q) => q.status === "closed").length})</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {filteredQuestions.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">No payment questions to review.</CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredQuestions.map((q) => (
            <Card key={q.id}>
              <CardHeader className="pb-2">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                  <div className="flex-1">
                    <CardTitle className="text-base font-medium">{q.mover_name}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(q.created_at), "MMM d, yyyy h:mm a")}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-wrap">{getStatusBadge(q.status)}</div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="font-medium text-muted-foreground">Subject:</span> {getSubjectDisplay(q)}</div>
                  <div><span className="font-medium text-muted-foreground">Job #:</span> {q.job_number}</div>
                </div>

                {expandedCards.has(q.id) && (
                  <>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Question:</p>
                      <p className="text-sm">{translatedCards.get(q.id)?.question_details || q.question_details}</p>
                    </div>

                    {/* Attachments */}
                    {q.attachments && q.attachments.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Attachments:</p>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {q.attachments.map((att) => (
                            <Button key={att.id} variant="outline" size="sm" onClick={() => handleViewAttachment(att)}>
                              {att.file_name}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Communication Thread */}
                    {q.messages && q.messages.length > 0 && (
                      <div className="pt-3 border-t space-y-2">
                        <p className="text-sm font-medium">Communication History:</p>
                        {q.messages.map((msg) => (
                          <div key={msg.id} className={`p-3 rounded-md ${msg.is_admin_message ? "bg-blue-50 dark:bg-blue-950" : "bg-muted"}`}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium">{msg.is_admin_message ? "Admin" : q.mover_name}</span>
                              <span className="text-xs text-muted-foreground">{format(new Date(msg.created_at), "MMM d, yyyy h:mm a")}</span>
                            </div>
                            <p className="text-sm">{translatedMessages.get(msg.id) || msg.message}</p>
                            {!msg.is_admin_message && (
                              <TranslateButton
                                onClick={() => handleTranslateMessage(msg.id, msg.message)}
                                isTranslating={isTranslating && translatingMsgId === msg.id}
                                isTranslated={translatedMessages.has(msg.id)}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Reply Input */}
                    <div className="flex gap-2 pt-2">
                      <Textarea
                        placeholder="Type your response..."
                        value={replyTexts[q.id] || ""}
                        onChange={(e) => setReplyTexts((prev) => ({ ...prev, [q.id]: e.target.value }))}
                        className="min-h-[60px]"
                      />
                      <Button
                        size="sm"
                        onClick={() => handleSendReply(q)}
                        disabled={sendingReply === q.id || !replyTexts[q.id]?.trim()}
                        className="self-end"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </>
                )}

                <div className="flex flex-wrap gap-2 pt-2">
                  <TranslateButton
                    onClick={() => handleTranslateQuestion(q)}
                    isTranslating={isTranslating && translatingCardId === q.id}
                    isTranslated={translatedCards.has(q.id)}
                  />
                  <Button variant="ghost" size="sm" onClick={() => toggleExpanded(q.id)}>
                    {expandedCards.has(q.id) ? (
                      <><ChevronUp className="h-4 w-4 mr-1" />Show Less</>
                    ) : (
                      <><ChevronDown className="h-4 w-4 mr-1" />Show More</>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminPaymentQuestionList;
