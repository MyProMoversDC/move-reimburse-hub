import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Users, MessageSquare } from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import { chatTranslations, ChatLanguage } from "@/lib/chatTranslations";
import { toast } from "sonner";

interface Participant {
  user_id: string;
  last_read_at: string | null;
  profile?: {
    first_name: string;
    last_name: string;
    avatar_url?: string | null;
  };
}

interface Conversation {
  id: string;
  name: string | null;
  is_group: boolean;
  topic_type: string;
  topic_reference_label: string | null;
  updated_at: string;
  participants: Participant[];
  lastMessage?: {
    content: string | null;
    created_at: string;
    sender_id: string;
  };
  unreadCount: number;
}

interface ConversationListProps {
  userId: string;
  language: ChatLanguage;
  onSelectConversation: (conversation: Conversation) => void;
  onNewChat: () => void;
  onNewGroupChat?: () => void;
  isAdmin?: boolean;
  isUserOnline?: (userId: string) => boolean;
}

const ConversationList = ({ 
  userId, 
  language, 
  onSelectConversation, 
  onNewChat,
  onNewGroupChat,
  isAdmin = false,
  isUserOnline
}: ConversationListProps) => {
  const t = chatTranslations[language];
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const usersMapRef = useRef<Map<string, { first_name: string; last_name: string }>>(new Map());

  useEffect(() => {
    fetchConversations();

    // Subscribe to conversation updates with notification
    const channel = supabase
      .channel('conversation-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages'
        },
        async (payload) => {
          const newMessage = payload.new as { sender_id: string; content: string | null; conversation_id: string };
          
          // Only notify if the message is from someone else
          if (newMessage.sender_id !== userId) {
            // Get sender name from our cached map or fetch it
            let senderName = 'Someone';
            const cachedUser = usersMapRef.current.get(newMessage.sender_id);
            if (cachedUser) {
              senderName = `${cachedUser.first_name} ${cachedUser.last_name}`;
            } else {
              // Fetch the sender's profile
              const { data: profile } = await supabase
                .from('profiles')
                .select('first_name, last_name')
                .eq('id', newMessage.sender_id)
                .maybeSingle();
              
              if (profile) {
                senderName = `${profile.first_name} ${profile.last_name}`;
                usersMapRef.current.set(newMessage.sender_id, profile);
              }
            }

            // Show notification toast
            toast.message(t.newMessageFrom?.replace('{name}', senderName) || `New message from ${senderName}`, {
              description: newMessage.content?.substring(0, 50) || '📎 Attachment',
              duration: 4000,
            });
          }
          
          // Refresh conversations to update order and counts
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const fetchConversations = async () => {
    try {
      // Get conversations where user is a participant
      const { data: participantData, error: participantError } = await supabase
        .from('conversation_participants')
        .select('conversation_id, last_read_at')
        .eq('user_id', userId);

      if (participantError) throw participantError;

      if (!participantData || participantData.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      const conversationIds = participantData.map(p => p.conversation_id);
      const lastReadMap = new Map(participantData.map(p => [p.conversation_id, p.last_read_at]));

      // Fetch conversation details
      const { data: conversationsData, error: convError } = await supabase
        .from('conversations')
        .select('*')
        .in('id', conversationIds)
        .order('updated_at', { ascending: false });

      if (convError) throw convError;

      // Fetch all users with their names using RPC function
      const { data: allUsers } = await supabase.rpc('list_chat_users_for_picker');
      
      // Fetch avatar URLs from profiles
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, avatar_url');
      
      const avatarMap = new Map(
        (profilesData || []).map((p: { id: string; avatar_url: string | null }) => [p.id, p.avatar_url])
      );
      
      const usersMap = new Map(
        (allUsers || []).map((u: { id: string; first_name: string; last_name: string }) => [
          u.id, 
          { 
            first_name: u.first_name, 
            last_name: u.last_name,
            avatar_url: avatarMap.get(u.id) || null
          }
        ])
      );

      // Fetch participants and profiles for each conversation
      const conversationsWithDetails = await Promise.all(
        (conversationsData || []).map(async (conv) => {
          // Get participants
          const { data: participants } = await supabase
            .from('conversation_participants')
            .select('user_id, last_read_at')
            .eq('conversation_id', conv.id);

          const participantsWithProfiles = (participants || []).map(p => ({
            ...p,
            profile: usersMap.get(p.user_id) || { first_name: 'Unknown', last_name: 'User' }
          }));

          // Get last message
          const { data: lastMessages } = await supabase
            .from('chat_messages')
            .select('content, created_at, sender_id')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(1);

          // Count unread messages
          const lastRead = lastReadMap.get(conv.id);
          let unreadCount = 0;
          if (lastRead) {
            const { count } = await supabase
              .from('chat_messages')
              .select('*', { count: 'exact', head: true })
              .eq('conversation_id', conv.id)
              .gt('created_at', lastRead)
              .neq('sender_id', userId);
            unreadCount = count || 0;
          } else {
            const { count } = await supabase
              .from('chat_messages')
              .select('*', { count: 'exact', head: true })
              .eq('conversation_id', conv.id)
              .neq('sender_id', userId);
            unreadCount = count || 0;
          }

          return {
            ...conv,
            participants: participantsWithProfiles,
            lastMessage: lastMessages?.[0],
            unreadCount
          };
        })
      );

      // Sort conversations by last message time (most recent first)
      conversationsWithDetails.sort((a, b) => {
        const aTime = a.lastMessage?.created_at || a.updated_at;
        const bTime = b.lastMessage?.created_at || b.updated_at;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      });

      // Update users map ref for notifications
      usersMapRef.current = usersMap;

      setConversations(conversationsWithDetails);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const getConversationTitle = (conv: Conversation) => {
    if (conv.is_group) {
      return conv.name || 'Group Chat';
    }
    const otherParticipant = conv.participants.find(p => p.user_id !== userId);
    if (otherParticipant?.profile) {
      return `${otherParticipant.profile.first_name} ${otherParticipant.profile.last_name}`;
    }
    return 'Chat';
  };

  const getInitials = (conv: Conversation) => {
    if (conv.is_group) {
      return conv.name?.substring(0, 2).toUpperCase() || 'GC';
    }
    const otherParticipant = conv.participants.find(p => p.user_id !== userId);
    if (otherParticipant?.profile) {
      return `${otherParticipant.profile.first_name[0]}${otherParticipant.profile.last_name[0]}`;
    }
    return '??';
  };

  const getAvatarUrl = (conv: Conversation) => {
    if (conv.is_group) return null;
    const otherParticipant = conv.participants.find(p => p.user_id !== userId);
    return otherParticipant?.profile?.avatar_url || null;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return format(date, 'HH:mm');
    if (isYesterday(date)) return t.yesterday;
    return format(date, 'dd/MM');
  };

  const getTopicLabel = (topicType: string) => {
    const labels: Record<string, string> = {
      general: t.topicGeneral,
      reimbursement: t.topicReimbursement,
      review_bonus: t.topicReviewBonus,
      missing_payment: t.topicMissingPayment,
      violence_incident: t.topicViolenceIncident,
      performance_report: t.topicPerformanceReport,
      deductible: t.topicDeductible,
    };
    return labels[topicType] || topicType;
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[600px]">
      {/* Header */}
      <div className="p-4 border-b flex justify-between items-center">
        <h2 className="font-semibold text-lg">{t.conversations}</h2>
        <div className="flex gap-2">
          <Button size="sm" onClick={onNewChat}>
            <Plus className="h-4 w-4 mr-1" />
            {t.newChat}
          </Button>
          {isAdmin && onNewGroupChat && (
            <Button size="sm" variant="outline" onClick={onNewGroupChat}>
              <Users className="h-4 w-4 mr-1" />
              {t.newGroupChat}
            </Button>
          )}
        </div>
      </div>

      {/* Conversation list */}
      <ScrollArea className="flex-1">
        {conversations.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>{t.noConversations}</p>
            <p className="text-sm">{t.startNewChat}</p>
          </div>
        ) : (
          <div className="divide-y">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                className="w-full p-4 hover:bg-muted/50 flex items-start gap-3 text-left transition-colors"
                onClick={() => onSelectConversation(conv)}
              >
                <div className="relative">
                  <Avatar className="h-10 w-10">
                    {getAvatarUrl(conv) && (
                      <AvatarImage src={getAvatarUrl(conv)!} alt={getConversationTitle(conv)} />
                    )}
                    <AvatarFallback>
                      {conv.is_group ? <Users className="h-5 w-5" /> : getInitials(conv)}
                    </AvatarFallback>
                  </Avatar>
                  {!conv.is_group && isUserOnline && (() => {
                    const otherParticipant = conv.participants.find(p => p.user_id !== userId);
                    if (otherParticipant) {
                      const online = isUserOnline(otherParticipant.user_id);
                      return (
                        <span 
                          className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-background ${
                            online ? 'bg-green-500' : 'bg-muted-foreground/50'
                          }`}
                          title={online ? 'Online' : 'Offline'}
                        />
                      );
                    }
                    return null;
                  })()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <p className="font-medium truncate">{getConversationTitle(conv)}</p>
                    <div className="flex items-center gap-2">
                      {conv.unreadCount > 0 && (
                        <Badge className="h-5 min-w-[20px] flex items-center justify-center">
                          {conv.unreadCount}
                        </Badge>
                      )}
                      {conv.lastMessage && (
                        <span className="text-xs text-muted-foreground">
                          {formatDate(conv.lastMessage.created_at)}
                        </span>
                      )}
                    </div>
                  </div>
                  {conv.topic_type !== 'general' && (
                    <Badge variant="outline" className="mt-1 text-xs">
                      {getTopicLabel(conv.topic_type)}
                    </Badge>
                  )}
                  {conv.topic_reference_label && (
                    <p className="text-xs text-muted-foreground truncate mt-1">
                      {conv.topic_reference_label}
                    </p>
                  )}
                  {conv.lastMessage && (
                    <p className="text-sm text-muted-foreground truncate mt-1">
                      {conv.lastMessage.content || '📎 Attachment'}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

export default ConversationList;
