import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, X } from "lucide-react";
import { toast } from "sonner";
import { chatTranslations, ChatLanguage } from "@/lib/chatTranslations";

interface User {
  id: string;
  first_name: string;
  last_name: string;
  roles: string[];
}

interface NewChatDialogProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  userRole: string;
  language: ChatLanguage;
  isGroupChat?: boolean;
  onChatCreated: (conversationId: string) => void;
}

const NewChatDialog = ({ 
  open, 
  onClose, 
  userId, 
  userRole, 
  language, 
  isGroupChat = false,
  onChatCreated 
}: NewChatDialogProps) => {
  const t = chatTranslations[language];
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [groupName, setGroupName] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (open) {
      fetchUsers();
    }
  }, [open]);

  const fetchUsers = async () => {
    try {
      // Use the security definer function that bypasses RLS
      const { data, error } = await supabase
        .rpc('list_chat_users_for_picker', { exclude_user_id: userId });

      if (error) throw error;

      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUserSelect = (user: User) => {
    if (isGroupChat) {
      setSelectedUsers(prev => {
        const isSelected = prev.some(u => u.id === user.id);
        if (isSelected) {
          return prev.filter(u => u.id !== user.id);
        }
        return [...prev, user];
      });
    } else {
      setSelectedUsers([user]);
    }
  };

  const removeUser = (userId: string) => {
    setSelectedUsers(prev => prev.filter(u => u.id !== userId));
  };

  const handleCreate = async () => {
    if (selectedUsers.length === 0) {
      toast.error(t.recipientRequired);
      return;
    }

    if (isGroupChat && !groupName.trim()) {
      toast.error(t.groupNameRequired);
      return;
    }

    if (isGroupChat && selectedUsers.length < 2) {
      toast.error(t.selectAtLeast2);
      return;
    }

    setCreating(true);
    try {
      // For 1-on-1 chats, check if a conversation already exists with this user
      if (!isGroupChat && selectedUsers.length === 1) {
        const targetUserId = selectedUsers[0].id;
        
        // Find all conversations where current user is a participant
        const { data: userConversations } = await supabase
          .from('conversation_participants')
          .select('conversation_id')
          .eq('user_id', userId);
        
        if (userConversations && userConversations.length > 0) {
          const conversationIds = userConversations.map(c => c.conversation_id);
          
          // Find non-group conversations from these
          const { data: existingConversations } = await supabase
            .from('conversations')
            .select('id')
            .in('id', conversationIds)
            .eq('is_group', false);
          
          if (existingConversations && existingConversations.length > 0) {
            const existingConvIds = existingConversations.map(c => c.id);
            
            // Check if target user is in any of these conversations
            const { data: targetParticipation } = await supabase
              .from('conversation_participants')
              .select('conversation_id')
              .eq('user_id', targetUserId)
              .in('conversation_id', existingConvIds);
            
            if (targetParticipation && targetParticipation.length > 0) {
              // Existing conversation found - navigate to it
              const existingConversationId = targetParticipation[0].conversation_id;
              toast.info(language === 'en' 
                ? 'Opening existing conversation' 
                : language === 'es' 
                ? 'Abriendo conversación existente' 
                : 'Открываем существующий чат');
              onChatCreated(existingConversationId);
              handleClose();
              return;
            }
          }
        }
      }

      // No existing conversation found, create a new one
      const conversationId = crypto.randomUUID();

      const { error: convError } = await supabase
        .from('conversations')
        .insert({
          id: conversationId,
          name: isGroupChat ? groupName : null,
          is_group: isGroupChat,
          topic_type: 'general',
          topic_reference_id: null,
          topic_reference_label: null,
          created_by: userId,
        });

      if (convError) throw convError;

      // Add all participants
      const participantIds = [userId, ...selectedUsers.map(u => u.id)];
      const participants = participantIds.map(id => ({
        conversation_id: conversationId,
        user_id: id,
      }));

      const { error: partError } = await supabase
        .from('conversation_participants')
        .insert(participants);

      if (partError) throw partError;

      toast.success(isGroupChat ? t.groupCreated : t.chatCreated);
      onChatCreated(conversationId);
      handleClose();
    } catch (error) {
      console.error('Error creating chat:', error);
      toast.error(t.errorCreatingChat);
    } finally {
      setCreating(false);
    }
  };

  const handleClose = () => {
    setSelectedUsers([]);
    setGroupName("");
    setSearchQuery("");
    onClose();
  };

  const getRoleBadge = (roles: string[]) => {
    if (roles.includes('admin')) return t.admin;
    if (roles.includes('operations_manager')) return t.operationsManager;
    if (roles.includes('reviews_admin')) return t.reviewsAdmin;
    if (roles.includes('accountant')) return t.accountant;
    if (roles.includes('mover')) return t.mover;
    return '';
  };

  const filteredUsers = users.filter(user =>
    `${user.first_name} ${user.last_name}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isGroupChat ? t.newGroupChat : t.newChat}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Group name for group chats */}
          {isGroupChat && (
            <div className="space-y-2">
              <Label>{t.groupName}</Label>
              <Input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder={t.groupName}
              />
            </div>
          )}

          {/* User selection */}
          <div className="space-y-2">
            <Label>{isGroupChat ? t.selectRecipients : t.selectRecipient}</Label>
            
            {/* Selected users badges */}
            {selectedUsers.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {selectedUsers.map(user => (
                  <Badge key={user.id} variant="secondary" className="flex items-center gap-1">
                    {user.first_name} {user.last_name}
                    <button onClick={() => removeUser(user.id)}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.searchUsers}
                className="pl-8"
              />
            </div>

            <ScrollArea className="h-[200px] border rounded-md">
              {loading ? (
                <div className="flex justify-center p-4">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {filteredUsers.map(user => {
                    const isSelected = selectedUsers.some(u => u.id === user.id);
                    return (
                      <button
                        key={user.id}
                        className={`w-full flex items-center gap-3 p-2 rounded-md text-left transition-colors ${
                          isSelected ? 'bg-primary/10' : 'hover:bg-muted'
                        }`}
                        onClick={() => handleUserSelect(user)}
                      >
                        {isGroupChat && (
                          <Checkbox checked={isSelected} />
                        )}
                        <div className="flex-1">
                          <p className="font-medium">{user.first_name} {user.last_name}</p>
                          <p className="text-xs text-muted-foreground">{getRoleBadge(user.roles)}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={handleClose}>
              {t.cancel}
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isGroupChat ? t.createGroup : t.startChat}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NewChatDialog;
