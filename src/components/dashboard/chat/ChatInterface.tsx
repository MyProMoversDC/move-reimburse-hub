import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, Paperclip, ArrowLeft, Image, FileText, Film, X, Download, Music, Settings, CheckSquare, SmilePlus, Reply, Pencil, Trash2, MoreHorizontal, Check } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ManageGroupDialog from "./ManageGroupDialog";
import { toast } from "sonner";
import { format, isToday, isYesterday } from "date-fns";
import { chatTranslations, ChatLanguage } from "@/lib/chatTranslations";
import { getSignedUrlsBatch } from "@/lib/storageUtils";
import { compressImage, makeThumbnail } from "@/lib/imageCompression";
import { runWithConcurrency } from "@/lib/uploadQueue";
import { playMessageNotification } from "@/lib/notificationSound";
import { downloadFilesAsZip } from "@/lib/bulkDownload";

const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];


const MAX_VIDEO_BYTES = 25 * 1024 * 1024; // 25 MB hard cap
const UPLOAD_CONCURRENCY = 4;

type UploadStatus = "pending" | "compressing" | "uploading" | "done" | "error";
interface UploadProgress {
  status: UploadStatus;
  originalSize: number;
  outputSize?: number;
  startedAt?: number;
  durationMs?: number;
}

const formatBytes = (n: number) => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};
import MentionDropdown, { type MentionUser } from "./MentionDropdown";

interface Attachment {
  id: string;
  file_url: string;
  file_name: string;
  file_type: string;
  thumb_url?: string;
}

interface Reaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
}

interface Message {
  id: string;
  content: string | null;
  sender_id: string;
  created_at: string;
  edited_at?: string | null;
  reply_to_message_id?: string | null;
  attachments?: Attachment[];
  reactions?: Reaction[];
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
  userRole?: string;
  language: ChatLanguage;
  onBack: () => void;
  isUserOnline?: (userId: string) => boolean;
}

const ChatInterface = ({ conversation, userId, userRole, language, onBack, isUserOnline }: ChatInterfaceProps) => {
  const [manageOpen, setManageOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedAttIds, setSelectedAttIds] = useState<Set<string>>(new Set());
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const isAdmin = userRole === 'admin';

  const t = chatTranslations[language];
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<number, UploadProgress>>({});
  const [usersMap, setUsersMap] = useState<Map<string, { first_name: string; last_name: string; avatar_url?: string; nickname?: string; use_nickname_in_chat?: boolean }>>(new Map());
  const [mentionVisible, setMentionVisible] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionStartPos, setMentionStartPos] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");

  // Fetch all users for name and avatar display
  useEffect(() => {
    const fetchUsers = async () => {
      // Get users from the RPC function
      const { data: allUsers } = await supabase.rpc('list_chat_users_for_picker');
      
      // Also fetch avatar URLs from profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar_url, nickname, use_nickname_in_chat');
      
      if (profiles) {
        const map = new Map(
          profiles.map((p: any) => [
            p.id,
            { first_name: p.first_name, last_name: p.last_name, avatar_url: p.avatar_url || undefined, nickname: p.nickname || undefined, use_nickname_in_chat: p.use_nickname_in_chat || false }
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

          let signedAtts: Attachment[] = [];
          if (attachments && attachments.length > 0) {
            const paths: string[] = [];
            for (const a of attachments) {
              paths.push(a.file_url);
              if (a.file_type?.startsWith('image/')) paths.push(`${a.file_url}.thumb.jpg`);
            }
            const signed = await getSignedUrlsBatch('chat-attachments', paths);
            signedAtts = attachments.map((a: any) => ({
              ...a,
              file_url: signed.get(a.file_url) || a.file_url,
              thumb_url: a.file_type?.startsWith('image/')
                ? signed.get(`${a.file_url}.thumb.jpg`) || undefined
                : undefined,
            }));
          }

          setMessages(prev => [...prev, { ...newMsg, attachments: signedAtts }]);
          if (newMsg.sender_id !== userId) {
            markAsRead();
            // sound played globally by useUnreadMessages
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

  const thumbPathFor = (filePath: string) => `${filePath}.thumb.jpg`;

  const fetchMessages = async () => {
    try {
      const { data: messagesData, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const messageIds = (messagesData || []).map((m: any) => m.id);
      let attachmentsByMsg: Map<string, any[]> = new Map();

      if (messageIds.length > 0) {
        const { data: allAttachments } = await supabase
          .from('chat_message_attachments')
          .select('*')
          .in('message_id', messageIds);

        // Batch-sign originals + thumbnails in a single request
        const pathsToSign: string[] = [];
        for (const a of allAttachments || []) {
          pathsToSign.push(a.file_url);
          if (a.file_type?.startsWith('image/')) {
            pathsToSign.push(thumbPathFor(a.file_url));
          }
        }
        const signedMap = await getSignedUrlsBatch('chat-attachments', pathsToSign);

        for (const a of allAttachments || []) {
          const signed = signedMap.get(a.file_url) || a.file_url;
          const thumb = a.file_type?.startsWith('image/')
            ? signedMap.get(thumbPathFor(a.file_url)) || undefined
            : undefined;
          const list = attachmentsByMsg.get(a.message_id) || [];
          list.push({ ...a, file_url: signed, thumb_url: thumb || undefined });
          attachmentsByMsg.set(a.message_id, list);
        }
      }

      const messagesWithAttachments = (messagesData || []).map((msg: any) => ({
        ...msg,
        attachments: attachmentsByMsg.get(msg.id) || [],
      }));

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

  const updateProgress = (idx: number, patch: Partial<UploadProgress>) => {
    setUploadProgress((prev) => ({ ...prev, [idx]: { ...(prev[idx] || { status: "pending", originalSize: 0 }), ...patch } }));
  };

  const uploadFiles = async (messageId: string) => {
    const indexed = selectedFiles.map((f, i) => ({ file: f, index: i }));

    // Initialize progress
    setUploadProgress(
      Object.fromEntries(
        indexed.map(({ file, index }) => [index, { status: "pending" as UploadStatus, originalSize: file.size }])
      )
    );

    const results = await runWithConcurrency(indexed, UPLOAD_CONCURRENCY, async ({ file: rawFile, index }) => {
      const startedAt = performance.now();
      updateProgress(index, { status: "compressing", startedAt });

      // Compress images (HEIC → JPEG, then resize/compress); videos pass through
      const file = await compressImage(rawFile, (s) => {
        updateProgress(index, { outputSize: s.outputSize });
        console.log(
          `[upload] ${rawFile.name}: ${formatBytes(s.originalSize)} → ${formatBytes(s.outputSize)} in ${Math.round(s.durationMs)}ms`
        );
      });

      updateProgress(index, { status: "uploading", outputSize: file.size });

      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${userId}/${conversation.id}/${fileName}`;

      // Generate + upload thumbnail in parallel with the main upload
      const thumbPromise = file.type.startsWith('image/')
        ? makeThumbnail(file).then((thumbBlob) => {
            if (!thumbBlob) return null;
            return supabase.storage
              .from('chat-attachments')
              .upload(thumbPathFor(filePath), thumbBlob, {
                contentType: 'image/jpeg',
                upsert: true,
              })
              .then(() => null);
          })
        : Promise.resolve(null);

      const { error: uploadError } = await supabase.storage
        .from('chat-attachments')
        .upload(filePath, file);

      await thumbPromise;

      const durationMs = performance.now() - startedAt;
      if (uploadError) {
        console.error('Upload error:', uploadError);
        updateProgress(index, { status: "error", durationMs });
        return null;
      }

      updateProgress(index, { status: "done", durationMs });
      console.log(`[upload] ${rawFile.name}: total ${Math.round(durationMs)}ms`);

      return {
        message_id: messageId,
        file_url: filePath,
        file_name: rawFile.name,
        file_type: file.type,
        file_size: file.size,
      };
    });

    const uploadedFiles = results.filter((r): r is NonNullable<typeof r> => r !== null);

    if (uploadedFiles.length > 0) {
      await supabase.from('chat_message_attachments').insert(uploadedFiles);
    }

    return uploadedFiles;
  };



  const handleSend = async () => {
    if (!newMessage.trim() && selectedFiles.length === 0) return;

    // Snapshot composer state, then clear UI immediately for snappy feel
    const contentToSend = newMessage.trim() || null;
    const filesToUpload = selectedFiles;
    setNewMessage("");
    setSelectedFiles([]);
    setUploadProgress({});

    setSending(true);
    try {
      const { data: message, error } = await supabase
        .from('chat_messages')
        .insert({
          conversation_id: conversation.id,
          sender_id: userId,
          content: contentToSend,
        })
        .select()
        .single();

      if (error) throw error;

      // Re-bind selectedFiles for the uploadFiles closure (it reads state)
      if (filesToUpload.length > 0) {
        setSelectedFiles(filesToUpload);
        setUploading(true);
        try {
          await uploadFiles(message.id);
          // Refresh this message's attachments locally so they appear without waiting for refetch
          const { data: atts } = await supabase
            .from('chat_message_attachments')
            .select('*')
            .eq('message_id', message.id);
          if (atts && atts.length > 0) {
            const paths: string[] = [];
            for (const a of atts) {
              paths.push(a.file_url);
              if (a.file_type?.startsWith('image/')) paths.push(thumbPathFor(a.file_url));
            }
            const signed = await getSignedUrlsBatch('chat-attachments', paths);
            const signedAtts = atts.map((a: any) => ({
              ...a,
              file_url: signed.get(a.file_url) || a.file_url,
              thumb_url: a.file_type?.startsWith('image/')
                ? signed.get(thumbPathFor(a.file_url)) || undefined
                : undefined,
            }));
            setMessages(prev => prev.map(m => m.id === message.id ? { ...m, attachments: signedAtts } : m));
          }
        } finally {
          setUploading(false);
          setSelectedFiles([]);
          setUploadProgress({});
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error(t.errorSendingMessage);
      // Restore composer so user doesn't lose their input
      setNewMessage(contentToSend || "");
      setSelectedFiles(filesToUpload);
    } finally {
      setSending(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);

    // Reject videos that are too large to upload reasonably from a phone.
    const accepted: File[] = [];
    for (const f of files) {
      if (f.type.startsWith('video/') && f.size > MAX_VIDEO_BYTES) {
        toast.error(`"${f.name}" is ${formatBytes(f.size)}. Please trim videos to under ${formatBytes(MAX_VIDEO_BYTES)}.`);
        continue;
      }
      accepted.push(f);
    }

    const total = selectedFiles.length + accepted.length;
    if (total > 10) {
      toast.error("Maximum 10 files allowed");
      const allowed = accepted.slice(0, 10 - selectedFiles.length);
      setSelectedFiles(prev => [...prev, ...allowed]);
    } else {
      setSelectedFiles(prev => [...prev, ...accepted]);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setUploadProgress(prev => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  };

  // Mention helpers
  const mentionUsers: MentionUser[] = conversation.is_group
    ? conversation.participants
        .filter(p => p.user_id !== userId)
        .map(p => {
          const u = usersMap.get(p.user_id);
          return {
            id: p.user_id,
            first_name: u?.first_name || p.profile?.first_name || '',
            last_name: u?.last_name || p.profile?.last_name || '',
            avatar_url: u?.avatar_url,
          };
        })
    : [];

  const filteredMentionUsers = mentionUsers.filter(u => {
    const name = `${u.first_name} ${u.last_name}`.toLowerCase();
    return name.includes(mentionFilter.toLowerCase());
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    setNewMessage(value);

    // Check for @ mention trigger
    if (conversation.is_group) {
      const textBeforeCursor = value.slice(0, cursorPos);
      const atIndex = textBeforeCursor.lastIndexOf('@');
      if (atIndex !== -1) {
        const charBefore = atIndex > 0 ? textBeforeCursor[atIndex - 1] : ' ';
        const textAfterAt = textBeforeCursor.slice(atIndex + 1);
        // Only trigger if @ is at start or after a space, and no space after @
        if ((charBefore === ' ' || atIndex === 0) && !textAfterAt.includes(' ')) {
          setMentionVisible(true);
          setMentionFilter(textAfterAt);
          setMentionStartPos(atIndex);
          setMentionIndex(0);
          return;
        }
      }
    }
    setMentionVisible(false);
  };

  const handleMentionSelect = (user: MentionUser) => {
    if (mentionStartPos === null) return;
    const before = newMessage.slice(0, mentionStartPos);
    const cursorPos = inputRef.current?.selectionStart || newMessage.length;
    const after = newMessage.slice(cursorPos);
    const mention = `@${user.first_name} ${user.last_name} `;
    setNewMessage(before + mention + after);
    setMentionVisible(false);
    setMentionStartPos(null);
    setTimeout(() => {
      const pos = (before + mention).length;
      inputRef.current?.setSelectionRange(pos, pos);
      inputRef.current?.focus();
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (mentionVisible && filteredMentionUsers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex(i => (i + 1) % filteredMentionUsers.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex(i => (i - 1 + filteredMentionUsers.length) % filteredMentionUsers.length);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        handleMentionSelect(filteredMentionUsers[mentionIndex]);
        return;
      }
      if (e.key === 'Escape') {
        setMentionVisible(false);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      handleSend();
    }
  };

  const getSenderName = (senderId: string) => {
    if (senderId === userId) return t.you;
    // Check usersMap for nickname preference
    const user = usersMap.get(senderId);
    if (user?.use_nickname_in_chat && user.nickname) {
      return user.nickname;
    }
    // First try from conversation participants
    const participant = conversation.participants.find(p => p.user_id === senderId);
    if (participant?.profile) {
      return `${participant.profile.first_name} ${participant.profile.last_name}`;
    }
    // Fallback to usersMap
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
      if (user.use_nickname_in_chat && user.nickname) {
        return user.nickname.substring(0, 2).toUpperCase();
      }
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
    if (otherParticipant) {
      const user = usersMap.get(otherParticipant.user_id);
      if (user?.use_nickname_in_chat && user.nickname) {
        return user.nickname;
      }
      if (otherParticipant.profile) {
        return `${otherParticipant.profile.first_name} ${otherParticipant.profile.last_name}`;
      }
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

  const triggerDownload = (url: string, fileName: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const toggleAttSelection = (id: string) => {
    setSelectedAttIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (next.size > 0) setSelectionMode(true);
      return next;
    });
  };

  const exitSelection = () => {
    setSelectionMode(false);
    setSelectedAttIds(new Set());
  };

  const allAttachments: Attachment[] = messages.flatMap((m) => m.attachments || []);

  const handleBulkDownload = async () => {
    const items = allAttachments
      .filter((a) => selectedAttIds.has(a.id))
      .map((a) => ({ url: a.file_url, fileName: a.file_name }));
    if (items.length === 0) return;
    setBulkDownloading(true);
    setBulkProgress({ done: 0, total: items.length });
    try {
      await downloadFilesAsZip(
        items,
        `chat-media-${Date.now()}.zip`,
        (done, total) => setBulkProgress({ done, total })
      );
      toast.success(`Downloaded ${items.length} file${items.length === 1 ? "" : "s"}`);
      exitSelection();
    } catch (e) {
      console.error(e);
      toast.error("Download failed");
    } finally {
      setBulkDownloading(false);
      setBulkProgress(null);
    }
  };

  const renderAttachment = (attachment: Attachment) => {
    const isSelected = selectedAttIds.has(attachment.id);
    const overlay = (
      <div
        className={`absolute top-1 left-1 z-10 bg-background/80 rounded p-0.5 transition-opacity ${
          selectionMode || isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); toggleAttSelection(attachment.id); }}
      >
        <Checkbox checked={isSelected} />
      </div>
    );

    const wrap = (child: React.ReactNode) => (
      <div
        className={`group relative inline-block ${isSelected ? "ring-2 ring-primary rounded-lg" : ""}`}
        onClickCapture={(e) => {
          if (selectionMode) {
            e.stopPropagation();
            e.preventDefault();
            toggleAttSelection(attachment.id);
          }
        }}
      >
        {overlay}
        {child}
      </div>
    );

    const downloadBtn = (
      <button
        onClick={(e) => { e.stopPropagation(); triggerDownload(attachment.file_url, attachment.file_name); }}
        className="flex items-center gap-1 text-xs mt-1 opacity-70 hover:opacity-100 transition-opacity"
        title="Download"
      >
        <Download className="h-3.5 w-3.5" />
        <span className="truncate max-w-[150px]">{attachment.file_name}</span>
      </button>
    );

    if (attachment.file_type.startsWith('image/')) {
      const previewSrc = attachment.thumb_url || attachment.file_url;
      return wrap(
        <div>
          <a href={attachment.file_url} target="_blank" rel="noopener noreferrer">
            <img
              src={previewSrc}
              alt={attachment.file_name}
              loading="lazy"
              className="max-w-[200px] max-h-[200px] rounded-lg object-cover"
            />
          </a>
          {downloadBtn}
        </div>
      );
    }

    if (attachment.file_type.startsWith('video/')) {
      return wrap(
        <div>
          <video
            src={attachment.file_url}
            controls
            preload="metadata"
            className="max-w-[300px] rounded-lg"
          />
          {downloadBtn}
        </div>
      );
    }

    if (attachment.file_type.startsWith('audio/')) {
      return wrap(
        <div>
          <audio src={attachment.file_url} controls preload="metadata" className="max-w-[280px]" />
          {downloadBtn}
        </div>
      );
    }

    return wrap(
      <button
        onClick={() => triggerDownload(attachment.file_url, attachment.file_name)}
        className="flex items-center gap-2 p-2 bg-muted rounded-lg hover:bg-muted/80 cursor-pointer"
      >
        {getFileIcon(attachment.file_type)}
        <span className="text-sm truncate max-w-[150px]">{attachment.file_name}</span>
        <Download className="h-4 w-4" />
      </button>
    );
  };



  const renderMessageContent = (content: string) => {
    // Highlight @mentions
    const parts = content.split(/(@\S+(?:\s\S+)?)/g);
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        return <span key={i} className="font-semibold text-blue-400">{part}</span>;
      }
      return part;
    });
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
        <Button variant="ghost" size="icon" onClick={() => setManageOpen(true)} title={conversation.is_group && isAdmin ? "Manage Group" : "Chat Media"}>
          <Settings className="h-4 w-4 md:h-5 md:w-5" />
        </Button>
      </div>

      <ManageGroupDialog
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        conversationId={conversation.id}
        conversationName={conversation.name}
        currentUserId={userId}
        isGroup={conversation.is_group && isAdmin}
        onMembersChanged={() => { /* refresh on next navigation */ }}
      />

      {/* Bulk selection action bar (WhatsApp-style) */}
      {selectionMode && (
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b bg-muted/50">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={exitSelection} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium">{selectedAttIds.size} selected</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (selectedAttIds.size === allAttachments.length) exitSelection();
                else setSelectedAttIds(new Set(allAttachments.map((a) => a.id)));
              }}
            >
              <CheckSquare className="h-4 w-4 mr-1" />
              {selectedAttIds.size === allAttachments.length ? "Clear" : "Select all"}
            </Button>
            <Button
              size="sm"
              disabled={selectedAttIds.size === 0 || bulkDownloading}
              onClick={handleBulkDownload}
            >
              {bulkDownloading ? (
                <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> {bulkProgress ? `${bulkProgress.done}/${bulkProgress.total}` : "..."}</>
              ) : (
                <><Download className="h-4 w-4 mr-1" /> Download ({selectedAttIds.size})</>
              )}
            </Button>
          </div>
        </div>
      )}


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
                      {message.content && <p className="text-sm">{renderMessageContent(message.content)}</p>}
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
          {selectedFiles.map((file, index) => {
            const p = uploadProgress[index];
            const statusLabel =
              p?.status === "compressing" ? "compressing…" :
              p?.status === "uploading" ? "uploading…" :
              p?.status === "done" ? `done ${p.durationMs ? `${Math.round(p.durationMs / 100) / 10}s` : ""}` :
              p?.status === "error" ? "failed" : null;
            const sizeLabel = p?.outputSize
              ? `${formatBytes(p.originalSize)} → ${formatBytes(p.outputSize)}`
              : formatBytes(file.size);
            return (
              <Badge
                key={index}
                variant={p?.status === "error" ? "destructive" : "secondary"}
                className="flex items-center gap-1.5"
              >
                {p?.status === "compressing" || p?.status === "uploading" ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  getFileIcon(file.type)
                )}
                <span className="truncate max-w-[140px]">{file.name}</span>
                <span className="text-[10px] opacity-70">{sizeLabel}</span>
                {statusLabel && <span className="text-[10px] opacity-70">· {statusLabel}</span>}
                {!uploading && (
                  <button onClick={() => removeFile(index)}>
                    <X className="h-3 w-3" />
                  </button>
                )}
              </Badge>
            );
          })}
        </div>
      )}

      {/* Input */}
      <div className="p-3 md:p-4 border-t relative">
        {/* Mention dropdown */}
        {conversation.is_group && (
          <MentionDropdown
            users={mentionUsers}
            filter={mentionFilter}
            onSelect={handleMentionSelect}
            selectedIndex={mentionIndex}
            visible={mentionVisible}
          />
        )}
        <div className="flex gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            multiple
            accept="image/*,.heic,.heif,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx"
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
            ref={inputRef}
            value={newMessage}
            onChange={handleInputChange}
            placeholder={conversation.is_group ? `${t.typeMessage} (@ to mention)` : t.typeMessage}
            onKeyDown={handleKeyDown}
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
    </div>
  );
};

export default ChatInterface;
