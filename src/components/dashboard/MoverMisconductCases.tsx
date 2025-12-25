import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { handleError } from "@/lib/errorHandler";
import { format } from "date-fns";
import { Send, Loader2, MessageSquare, ChevronDown, ChevronUp } from "lucide-react";
import { DashboardLanguage } from "@/lib/dashboardTranslations";

interface Message {
  id: string;
  report_id: string | null;
  report_title: string;
  sender_id: string;
  recipient_id: string;
  message: string;
  is_admin_message: boolean;
  is_read: boolean;
  created_at: string;
}

interface MoverMisconductCasesProps {
  userId: string;
  language?: DashboardLanguage;
}

const translations = {
  en: {
    title: "Performance/Misconduct Cases",
    noMessages: "No messages received",
    from: "From Management",
    yourReply: "Your Reply",
    reply: "Reply",
    sending: "Sending...",
    replyPlaceholder: "Type your reply here...",
    messageSent: "Reply sent successfully",
    viewConversation: "View Conversation",
    hideConversation: "Hide Conversation",
    unread: "New",
  },
  ru: {
    title: "Случаи поведения/нарушений",
    noMessages: "Нет полученных сообщений",
    from: "От руководства",
    yourReply: "Ваш ответ",
    reply: "Ответить",
    sending: "Отправка...",
    replyPlaceholder: "Введите ваш ответ здесь...",
    messageSent: "Ответ успешно отправлен",
    viewConversation: "Показать переписку",
    hideConversation: "Скрыть переписку",
    unread: "Новое",
  },
  es: {
    title: "Casos de Rendimiento/Conducta",
    noMessages: "No hay mensajes recibidos",
    from: "De la Gerencia",
    yourReply: "Tu Respuesta",
    reply: "Responder",
    sending: "Enviando...",
    replyPlaceholder: "Escribe tu respuesta aquí...",
    messageSent: "Respuesta enviada con éxito",
    viewConversation: "Ver Conversación",
    hideConversation: "Ocultar Conversación",
    unread: "Nuevo",
  },
};

const MoverMisconductCases = ({ userId, language = "en" }: MoverMisconductCasesProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCase, setExpandedCase] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<{ [key: string]: string }>({});
  const [sendingReply, setSendingReply] = useState<string | null>(null);

  const t = translations[language];

  useEffect(() => {
    fetchMessages();
  }, [userId]);

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("performance_misconduct_messages")
        .select("*")
        .or(`recipient_id.eq.${userId},sender_id.eq.${userId}`)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      toast.error(handleError(error));
    } finally {
      setLoading(false);
    }
  };

  // Group messages by report_title to show conversations
  const groupedMessages = messages.reduce((acc, msg) => {
    const key = msg.report_title;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(msg);
    return acc;
  }, {} as { [key: string]: Message[] });

  // Sort messages within each group by date (oldest first for conversation flow)
  Object.keys(groupedMessages).forEach(key => {
    groupedMessages[key].sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  });

  const handleReply = async (reportTitle: string, originalMessage: Message) => {
    const reply = replyText[reportTitle]?.trim();
    if (!reply) {
      toast.error("Please enter a reply message");
      return;
    }

    setSendingReply(reportTitle);
    try {
      // Call edge function to send reply email and save to database
      const { error } = await supabase.functions.invoke("send-misconduct-reply", {
        body: {
          reportTitle,
          message: reply,
          adminId: originalMessage.sender_id,
        },
      });

      if (error) throw error;

      toast.success(t.messageSent);
      setReplyText(prev => ({ ...prev, [reportTitle]: "" }));
      fetchMessages();
    } catch (error) {
      toast.error(handleError(error));
    } finally {
      setSendingReply(null);
    }
  };

  const markAsRead = async (messageId: string) => {
    try {
      await supabase
        .from("performance_misconduct_messages")
        .update({ is_read: true })
        .eq("id", messageId)
        .eq("recipient_id", userId);
    } catch (error) {
      console.error("Error marking as read:", error);
    }
  };

  const toggleCase = (reportTitle: string, messages: Message[]) => {
    if (expandedCase === reportTitle) {
      setExpandedCase(null);
    } else {
      setExpandedCase(reportTitle);
      // Mark unread messages as read
      messages.forEach(msg => {
        if (!msg.is_read && msg.recipient_id === userId) {
          markAsRead(msg.id);
        }
      });
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Card>
    );
  }

  const caseKeys = Object.keys(groupedMessages);

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">{t.title}</h2>

      {caseKeys.length === 0 ? (
        <Card className="p-6">
          <p className="text-muted-foreground text-center py-4">{t.noMessages}</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {caseKeys.map(reportTitle => {
            const caseMessages = groupedMessages[reportTitle];
            const latestMessage = caseMessages[caseMessages.length - 1];
            const hasUnread = caseMessages.some(m => !m.is_read && m.recipient_id === userId);
            const isExpanded = expandedCase === reportTitle;

            return (
              <Card key={reportTitle} className="overflow-hidden">
                <div
                  className="p-4 cursor-pointer hover:bg-muted/50 transition-colors flex items-center justify-between"
                  onClick={() => toggleCase(reportTitle, caseMessages)}
                >
                  <div className="flex items-center gap-3">
                    <MessageSquare className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{reportTitle}</h3>
                        {hasUnread && (
                          <Badge variant="destructive" className="text-xs">
                            {t.unread}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(latestMessage.created_at), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>

                {isExpanded && (
                  <div className="border-t p-4 space-y-4">
                    <ScrollArea className="max-h-80">
                      <div className="space-y-4 pr-4">
                        {caseMessages.map(msg => (
                          <div
                            key={msg.id}
                            className={`p-4 rounded-lg ${
                              msg.is_admin_message
                                ? "bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
                                : "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 ml-6"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className={`text-xs font-medium ${
                                msg.is_admin_message 
                                  ? "text-blue-700 dark:text-blue-300" 
                                  : "text-green-700 dark:text-green-300"
                              }`}>
                                {msg.is_admin_message ? t.from : t.yourReply}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(msg.created_at), "MMM d, yyyy 'at' h:mm a")}
                              </span>
                            </div>
                            <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>

                    {/* Reply Form */}
                    <div className="pt-4 border-t space-y-3">
                      <Textarea
                        placeholder={t.replyPlaceholder}
                        value={replyText[reportTitle] || ""}
                        onChange={(e) => setReplyText(prev => ({ ...prev, [reportTitle]: e.target.value }))}
                        className="min-h-[100px]"
                      />
                      <Button
                        onClick={() => handleReply(reportTitle, caseMessages.find(m => m.is_admin_message)!)}
                        disabled={sendingReply === reportTitle || !replyText[reportTitle]?.trim()}
                      >
                        {sendingReply === reportTitle ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            {t.sending}
                          </>
                        ) : (
                          <>
                            <Send className="h-4 w-4 mr-2" />
                            {t.reply}
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MoverMisconductCases;