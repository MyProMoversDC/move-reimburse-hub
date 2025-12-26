import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, Paperclip, ArrowLeft, Image, FileText, Film, X, Download } from "lucide-react";
import { toast } from "sonner";
import { format, isToday, isYesterday } from "date-fns";
import { chatTranslations, ChatLanguage } from "@/lib/chatTranslations";

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
}

const ChatInterface = ({ conversation, userId, language, onBack }: ChatInterfaceProps) => {
  const t = chatTranslations[language];
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

      // Fetch attachments for all messages
      const messagesWithAttachments = await Promise.all(
        (messagesData || []).map(async (msg) => {
          const { data: attachments } = await supabase
            .from('chat_message_attachments')
            .select('*')
            .eq('message_id', msg.id);
          return { ...msg, attachments: attachments || [] };
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

      const { data: { publicUrl } } = supabase.storage
        .from('chat-attachments')
        .getPublicUrl(filePath);

      uploadedFiles.push({
        message_id: messageId,
        file_url: publicUrl,
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
    setSelectedFiles(prev => [...prev, ...files]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const getSenderName = (senderId: string) => {
    if (senderId === userId) return t.you;
    const participant = conversation.participants.find(p => p.user_id === senderId);
    if (participant?.profile) {
      return `${participant.profile.first_name} ${participant.profile.last_name}`;
    }
    return 'Unknown';
  };

  const getConversationTitle = () => {
    if (conversation.is_group) {
      return conversation.name || 'Group Chat';
    }
    const otherParticipant = conversation.participants.find(p => p.user_id !== userId);
    if (otherParticipant?.profile) {
      return `${otherParticipant.profile.first_name} ${otherParticipant.profile.last_name}`;
    }
    return 'Chat';
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
    <div className="flex flex-col h-[600px]">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h3 className="font-semibold">{getConversationTitle()}</h3>
          {conversation.topic_reference_label && (
            <p className="text-sm text-muted-foreground">
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
                  className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[70%] ${isOwnMessage ? 'items-end' : 'items-start'}`}>
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
      <div className="p-4 border-t flex gap-2">
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
        >
          <Paperclip className="h-4 w-4" />
        </Button>
        <Input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder={t.typeMessage}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          disabled={sending || uploading}
        />
        <Button onClick={handleSend} disabled={sending || uploading || (!newMessage.trim() && selectedFiles.length === 0)}>
          {sending || uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
};

export default ChatInterface;
