import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import ConversationList from "./ConversationList";
import ChatInterface from "./ChatInterface";
import NewChatDialog from "./NewChatDialog";
import { ChatLanguage } from "@/lib/chatTranslations";
import { usePresence } from "@/hooks/usePresence";

interface Participant {
  user_id: string;
  last_read_at?: string | null;
  profile?: {
    first_name: string;
    last_name: string;
  };
}

interface Conversation {
  id: string;
  name: string | null;
  is_group: boolean;
  topic_type: string;
  topic_reference_label: string | null;
  participants: Participant[];
}

interface ChatContainerProps {
  userId: string;
  userRole: string;
  language: ChatLanguage;
}

const ChatContainer = ({ userId, userRole, language }: ChatContainerProps) => {
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [showNewChatDialog, setShowNewChatDialog] = useState(false);
  const [showNewGroupDialog, setShowNewGroupDialog] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const { isUserOnline } = usePresence(userId);

  const isAdmin = userRole === 'admin';

  const handleChatCreated = async (conversationId: string) => {
    // Fetch the newly created conversation
    const { data: conv } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .single();

    if (conv) {
      // Fetch participants
      const { data: participants } = await supabase
        .from('conversation_participants')
        .select('user_id')
        .eq('conversation_id', conversationId);

      const participantUserIds = (participants || []).map(p => p.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .in('id', participantUserIds);

      const participantsWithProfiles = (participants || []).map(p => ({
        ...p,
        profile: profiles?.find(pr => pr.id === p.user_id)
      }));

      setSelectedConversation({
        ...conv,
        participants: participantsWithProfiles
      });
    }

    setRefreshKey(prev => prev + 1);
  };

  const handleBack = () => {
    setSelectedConversation(null);
    setRefreshKey(prev => prev + 1);
  };

  return (
    <Card className="h-[650px]">
      {selectedConversation ? (
        <ChatInterface
          conversation={selectedConversation}
          userId={userId}
          language={language}
          onBack={handleBack}
          isUserOnline={isUserOnline}
        />
      ) : (
        <ConversationList
          key={refreshKey}
          userId={userId}
          language={language}
          onSelectConversation={setSelectedConversation}
          onNewChat={() => setShowNewChatDialog(true)}
          onNewGroupChat={isAdmin ? () => setShowNewGroupDialog(true) : undefined}
          isAdmin={isAdmin}
          isUserOnline={isUserOnline}
        />
      )}

      <NewChatDialog
        open={showNewChatDialog}
        onClose={() => setShowNewChatDialog(false)}
        userId={userId}
        userRole={userRole}
        language={language}
        onChatCreated={handleChatCreated}
      />

      <NewChatDialog
        open={showNewGroupDialog}
        onClose={() => setShowNewGroupDialog(false)}
        userId={userId}
        userRole={userRole}
        language={language}
        isGroupChat={true}
        onChatCreated={handleChatCreated}
      />
    </Card>
  );
};

export default ChatContainer;
