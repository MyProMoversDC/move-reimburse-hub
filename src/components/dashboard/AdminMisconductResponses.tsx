import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { handleError } from "@/lib/errorHandler";
import { format } from "date-fns";
import { Loader2, MessageSquare, ChevronDown, ChevronUp, User } from "lucide-react";

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

interface MoverProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

const AdminMisconductResponses = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [profiles, setProfiles] = useState<{ [key: string]: MoverProfile }>({});
  const [loading, setLoading] = useState(true);
  const [expandedCase, setExpandedCase] = useState<string | null>(null);

  useEffect(() => {
    fetchMessages();
  }, []);

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("performance_misconduct_messages")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Get unique user IDs to fetch profiles
      const userIds = new Set<string>();
      (data || []).forEach(msg => {
        userIds.add(msg.sender_id);
        userIds.add(msg.recipient_id);
      });

      if (userIds.size > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, email")
          .in("id", Array.from(userIds));

        if (!profilesError && profilesData) {
          const profilesMap: { [key: string]: MoverProfile } = {};
          profilesData.forEach(p => {
            profilesMap[p.id] = p;
          });
          setProfiles(profilesMap);
        }
      }

      setMessages(data || []);
    } catch (error) {
      toast.error(handleError(error));
    } finally {
      setLoading(false);
    }
  };

  // Group messages by report_title and recipient (mover)
  const groupedMessages = messages.reduce((acc, msg) => {
    // Find the mover ID (the non-admin participant)
    const moverId = msg.is_admin_message ? msg.recipient_id : msg.sender_id;
    const key = `${msg.report_title}___${moverId}`;
    if (!acc[key]) {
      acc[key] = {
        reportTitle: msg.report_title,
        moverId,
        messages: [],
      };
    }
    acc[key].messages.push(msg);
    return acc;
  }, {} as { [key: string]: { reportTitle: string; moverId: string; messages: Message[] } });

  // Sort messages within each group by date (oldest first for conversation flow)
  Object.keys(groupedMessages).forEach(key => {
    groupedMessages[key].messages.sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  });

  const markAsRead = async (messageId: string) => {
    try {
      await supabase
        .from("performance_misconduct_messages")
        .update({ is_read: true })
        .eq("id", messageId);
    } catch (error) {
      console.error("Error marking as read:", error);
    }
  };

  const toggleCase = (key: string, msgs: Message[]) => {
    if (expandedCase === key) {
      setExpandedCase(null);
    } else {
      setExpandedCase(key);
      // Mark unread admin messages as read
      msgs.forEach(msg => {
        if (!msg.is_read && !msg.is_admin_message) {
          markAsRead(msg.id);
        }
      });
    }
  };

  const getMoverName = (moverId: string) => {
    const profile = profiles[moverId];
    return profile ? `${profile.first_name} ${profile.last_name}` : "Unknown Mover";
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
      <h2 className="text-2xl font-bold">Misconduct Case Responses</h2>

      {caseKeys.length === 0 ? (
        <Card className="p-6">
          <p className="text-muted-foreground text-center py-4">No messages sent yet</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {caseKeys.map(key => {
            const { reportTitle, moverId, messages: caseMessages } = groupedMessages[key];
            const latestMessage = caseMessages[caseMessages.length - 1];
            const hasUnreadReply = caseMessages.some(m => !m.is_read && !m.is_admin_message);
            const isExpanded = expandedCase === key;
            const moverName = getMoverName(moverId);

            return (
              <Card key={key} className="overflow-hidden">
                <div
                  className="p-4 cursor-pointer hover:bg-muted/50 transition-colors flex items-center justify-between"
                  onClick={() => toggleCase(key, caseMessages)}
                >
                  <div className="flex items-center gap-3">
                    <MessageSquare className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{reportTitle}</h3>
                        {hasUnreadReply && (
                          <Badge variant="destructive" className="text-xs">
                            New Reply
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="h-3 w-3" />
                        <span>{moverName}</span>
                        <span>•</span>
                        <span>{format(new Date(latestMessage.created_at), "MMM d, yyyy 'at' h:mm a")}</span>
                      </div>
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>

                {isExpanded && (
                  <div className="border-t p-4">
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
                                {msg.is_admin_message ? "Admin" : moverName}
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

export default AdminMisconductResponses;