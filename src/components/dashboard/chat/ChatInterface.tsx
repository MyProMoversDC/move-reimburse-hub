import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, Paperclip, ArrowLeft, Image, FileText, Film, X, Download, Music } from "lucide-react";
import { toast } from "sonner";
import { format, isToday, isYesterday } from "date-fns";
import { chatTranslations, ChatLanguage } from "@/lib/chatTranslations";
import { getSignedUrlsForAttachments } from "@/lib/storageUtils";

interface Message {
  id: string;
  content: string | null;
  sender_id: string;
  created_at: string;
  attachments?: {
    id: string;
    file_url: string;
    file_name: string;
    file_type: string;
  }[];
}

interface Participant {
  user_id: string;
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

interface ChatInterfaceProps {
  conversation: Conversation;
  userId: string;
  language: ChatLanguage;
  onBack: () => void;
  isUserOnline?: (userId: string) => boolean;
}

const ChatInterface = ({ conversation, userId, language, onBack, isUserOnline }: ChatInterfaceProps) => {
  const t = chatTranslations[language];
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [usersMap, setUsersMap] = useState<Map<string, { first_name: string; last_name: string; avatar_url?: string }>>(new Map());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch all users for name and avatar display
  useEffect(() => {
    const fetchUsers = async () => {
      // Get users from the RPC function
      const { data: allUsers } = await supabase.rpc('list_chat_users_for_picker');
      
      // Also fetch avatar URLs from profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar_url');
      
      if (profiles) {
        const map = new Map(
          profiles.map((p: { id: string; first_name: string; last_name: string; avatar_url?: string }) => [
            p.id,
            { first_name: p.first_name, last_name: p.last_name, avatar_url: p.avatar_url || undefined }
          ])
        );
        setUsersMap(map);
      } else if (allUsers) {
        // Fallback to RPC data without avatars
        const map = new Map(
          allUsers.map((u: { id: string; first_name: string; last_name: string }) => [
            u.id,
            { first_name: u.first_name, last_name: u.last_name }
          ])
        );
        setUsersMap(map);
      }
    };
    fetchUsers();
  }, []);

  useEffect(() => {
    fetchMessages();
    markAsRead();

    // Subscribe to new messages
    const channel = supabase
      .channel(`messages-${conversation.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${conversation.id}`
        },
        async (payload) => {
          const newMsg = payload.new as Message;
          // Fetch attachments for the new message
          const { data: attachments } = await supabase
            .from('chat_message_attachments')
            .select('*')
            .eq('message_id', newMsg.id);
          
          setMessages(prev => [...prev, { ...newMsg, attachments: attachments || [] }]);
          if (newMsg.sender_id !== userId) {
            markAsRead();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversation.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchMessages = async () => {
    try {
      const { data: messagesData, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch attachments for all messages with signed URLs
      const messagesWithAttachments = await Promise.all(
        (messagesData || []).map(async (msg) => {
          const { data: attachments } = await supabase
            .from('chat_message_attachments')
            .select('*')
            .eq('message_id', msg.id);
          
          if (attachments && attachments.length > 0) {
            const attachmentsWithSignedUrls = await getSignedUrlsForAttachments(
              attachments,
              "chat-attachments"
            );
            return { 
              ...msg, 
              attachments: attachmentsWithSignedUrls.map(a => ({
                ...a,
                file_url: a.signed_url
              }))
            };
          }
          return { ...msg, attachments: [] };
        })
      );

      setMessages(messagesWithAttachments);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async () => {
    await supabase
      .from('conversation_participants')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', conversation.id)
      .eq('user_id', userId);
  };

  const uploadFiles = async (messageId: string) => {
    const uploadedFiles = [];
    
    for (const file of selectedFiles) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${userId}/${conversation.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('chat-attachments')
        .upload(filePath, file);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        continue;
      }

      // Store the file path, not the public URL (bucket is private)
      uploadedFiles.push({
        message_id: messageId,
        file_url: filePath,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
      });
    }

    if (uploadedFiles.length > 0) {
      await supabase.from('chat_message_attachments').insert(uploadedFiles);
    }

    return uploadedFiles;
  };

  const handleSend = async () => {
    if (!newMessage.trim() && selectedFiles.length === 0) return;

    setSending(true);
    try {
      const { data: message, error } = await supabase
        .from('chat_messages')
        .insert({
          conversation_id: conversation.id,
          sender_id: userId,
          content: newMessage.trim() || null,
        })
        .select()
        .single();

      if (error) throw error;

      if (selectedFiles.length > 0) {
        setUploading(true);
        await uploadFiles(message.id);
        setUploading(false);
      }

      setNewMessage("");
      setSelectedFiles([]);
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error(t.errorSendingMessage);
    } finally {
      setSending(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const total = selectedFiles.length + files.length;
    if (total > 10) {
      toast.error("Maximum 10 files allowed");
      const allowed = files.slice(0, 10 - selectedFiles.length);
      setSelectedFiles(prev => [...prev, ...allowed]);
    } else {
      setSelectedFiles(prev => [...prev, ...files]);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const getSenderName = (senderId: string) => {
    if (senderId === userId) return t.you;
    // First try from conversation participants
    const participant = conversation.participants.find(p => p.user_id === senderId);
    if (participant?.profile) {
      return `${participant.profile.first_name} ${participant.profile.last_name}`;
    }
    // Fallback to usersMap
    const user = usersMap.get(senderId);
    if (user) {
      return `${user.first_name} ${user.last_name}`;
    }
    return 'Unknown';
  };

  const getSenderAvatar = (senderId: string) => {
    const user = usersMap.get(senderId);
    return user?.avatar_url || null;
  };

  const getSenderInitials = (senderId: string) => {
    const user = usersMap.get(senderId);
    if (user) {
      const first = user.first_name?.[0] || '';
      const last = user.last_name?.[0] || '';
      return (first + last).toUpperCase() || '?';
    }
    return '?';
  };

  const getConversationTitle = () => {
    if (conversation.is_group) {
      return conversation.name || 'Group Chat';
    }
    const otherParticipant = conversation.participants.find(p => p.user_id !== userId);
    if (otherParticipant?.profile) {
      return `${otherParticipant.profile.first_name} ${otherParticipant.profile.last_name}`;
    }
    // Fallback to usersMap
    if (otherParticipant) {
      const user = usersMap.get(otherParticipant.user_id);
      if (user) {
        return `${user.first_name} ${user.last_name}`;
      }
    }
    return 'Chat';
  };

  const getOtherParticipantOnlineStatus = () => {
    if (conversation.is_group || !isUserOnline) return null;
    const otherParticipant = conversation.participants.find(p => p.user_id !== userId);
    if (otherParticipant) {
      return isUserOnline(otherParticipant.user_id);
    }
    return null;
  };

  const formatMessageDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) {
      return format(date, 'HH:mm');
    }
    if (isYesterday(date)) {
      return `${t.yesterday} ${format(date, 'HH:mm')}`;
    }
    return format(date, 'dd/MM/yyyy HH:mm');
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return <Image className="h-4 w-4" />;
    if (fileType.startsWith('video/')) return <Film className="h-4 w-4" />;
    if (fileType.startsWith('audio/')) return <Music className="h-4 w-4" />;
    return <FileText className="h-4 w-4" />;
  };

  const renderAttachment = (attachment: { file_url: string; file_name: string; file_type: string }) => {
    if (attachment.file_type.startsWith('image/')) {
      return (
        <a href={attachment.file_url} target="_blank" rel="noopener noreferrer">
          <img 
            src={attachment.file_url} 
            alt={attachment.file_name}
            className="max-w-[200px] max-h-[200px] rounded-lg object-cover"
          />
        </a>
      );
    }
    
    if (attachment.file_type.startsWith('video/')) {
      return (
        <video 
          src={attachment.file_url} 
          controls 
          className="max-w-[300px] rounded-lg"
        />
      );
    }

    return (
      <a 
        href={attachment.file_url} 
        target="_blank" 
        rel="noopener noreferrer"
        className="flex items-center gap-2 p-2 bg-muted rounded-lg hover:bg-muted/80"
      >
        {getFileIcon(attachment.file_type)}
        <span className="text-sm truncate max-w-[150px]">{attachment.file_name}</span>
        <Download className="h-4 w-4" />
      </a>
    );
  };

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] md:h-[600px]">
      {/* Header */}
      <div className="flex items-center gap-2 md:gap-3 p-3 md:p-4 border-b">
        <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8 md:h-10 md:w-10">
          <ArrowLeft className="h-4 w-4 md:h-5 md:w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm md:text-base truncate">{getConversationTitle()}</h3>
            {getOtherParticipantOnlineStatus() !== null && (
              <span 
                className={`w-2 h-2 md:w-2.5 md:h-2.5 rounded-full flex-shrink-0 ${
                  getOtherParticipantOnlineStatus() ? 'bg-green-500' : 'bg-muted-foreground/50'
                }`}
                title={getOtherParticipantOnlineStatus() ? 'Online' : 'Offline'}
              />
            )}
          </div>
          {conversation.topic_reference_label && (
            <p className="text-xs md:text-sm text-muted-foreground truncate">
              {conversation.topic_reference_label}
            </p>
          )}
          {conversation.is_group && (
            <p className="text-xs text-muted-foreground">
              {conversation.participants.length} {t.members}
            </p>
          )}
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        {loading ? (
          <div className="flex justify-center p-4">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <p>{t.noMessages}</p>
            <p className="text-sm">{t.writeFirstMessage}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => {
              const isOwnMessage = message.sender_id === userId;
              return (
                <div
                  key={message.id}
                  className={`flex gap-2 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                >
                  {/* Avatar for other users */}
                  {!isOwnMessage && (
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarImage src={getSenderAvatar(message.sender_id) || undefined} />
                      <AvatarFallback className="text-xs">
                        {getSenderInitials(message.sender_id)}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div className={`max-w-[85%] md:max-w-[70%] ${isOwnMessage ? 'items-end' : 'items-start'}`}>
                    {/* Always show sender name for messages from others */}
                    {!isOwnMessage && (
                      <p className="text-xs text-muted-foreground mb-1 font-medium">
                        {getSenderName(message.sender_id)}
                      </p>
                    )}
                    <div
                      className={`rounded-lg p-3 ${
                        isOwnMessage
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      {message.content && <p className="text-sm">{message.content}</p>}
                      {message.attachments && message.attachments.length > 0 && (
                        <div className="mt-2 space-y-2">
                          {message.attachments.map((att) => (
                            <div key={att.id}>{renderAttachment(att)}</div>
                          ))}
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatMessageDate(message.created_at)}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      {/* Selected files preview */}
      {selectedFiles.length > 0 && (
        <div className="px-4 py-2 border-t flex flex-wrap gap-2">
          {selectedFiles.map((file, index) => (
            <Badge key={index} variant="secondary" className="flex items-center gap-1">
              {getFileIcon(file.type)}
              <span className="truncate max-w-[100px]">{file.name}</span>
              <button onClick={() => removeFile(index)}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-3 md:p-4 border-t flex gap-2">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          multiple
          accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx"
          className="hidden"
        />
        <Button
          variant="outline"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="h-9 w-9 md:h-10 md:w-10 flex-shrink-0"
        >
          <Paperclip className="h-4 w-4" />
        </Button>
        <Input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder={t.typeMessage}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          disabled={sending || uploading}
          className="text-sm md:text-base"
        />
        <Button 
          onClick={handleSend} 
          disabled={sending || uploading || (!newMessage.trim() && selectedFiles.length === 0)}
          className="h-9 w-9 md:h-10 md:w-10 flex-shrink-0"
          size="icon"
        >
          {sending || uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
};

export default ChatInterface;
