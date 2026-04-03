import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageSquare, Reply, Trash2, Send, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  parent_comment_id: string | null;
  content: string;
  created_at: string;
  profile?: {
    first_name: string;
    last_name: string;
    avatar_url: string | null;
  };
  replies?: Comment[];
}

interface FeedCommentsProps {
  postId: string;
  userId: string;
  isAdmin: boolean;
  language: 'en' | 'es' | 'ru';
}

const translations = {
  en: {
    comments: "Comments",
    writeComment: "Write a comment...",
    writeReply: "Write a reply...",
    send: "Send",
    cancel: "Cancel",
    reply: "Reply",
    delete: "Delete",
    noComments: "No comments yet. Be the first!",
    showReplies: "Show replies",
    hideReplies: "Hide replies",
    charLimit: "characters remaining",
    deleteSuccess: "Comment deleted",
    commentSuccess: "Comment posted",
  },
  es: {
    comments: "Comentarios",
    writeComment: "Escribe un comentario...",
    writeReply: "Escribe una respuesta...",
    send: "Enviar",
    cancel: "Cancelar",
    reply: "Responder",
    delete: "Eliminar",
    noComments: "Aún no hay comentarios. ¡Sé el primero!",
    showReplies: "Mostrar respuestas",
    hideReplies: "Ocultar respuestas",
    charLimit: "caracteres restantes",
    deleteSuccess: "Comentario eliminado",
    commentSuccess: "Comentario publicado",
  },
  ru: {
    comments: "Комментарии",
    writeComment: "Напишите комментарий...",
    writeReply: "Напишите ответ...",
    send: "Отправить",
    cancel: "Отмена",
    reply: "Ответить",
    delete: "Удалить",
    noComments: "Пока нет комментариев. Будьте первым!",
    showReplies: "Показать ответы",
    hideReplies: "Скрыть ответы",
    charLimit: "символов осталось",
    deleteSuccess: "Комментарий удален",
    commentSuccess: "Комментарий опубликован",
  },
};

const MAX_CHARS = 1000;

const FeedComments = ({ postId, userId, isAdmin, language }: FeedCommentsProps) => {
  const t = translations[language];
  const [comments, setComments] = useState<Comment[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchCommentCount();
  }, [postId]);

  useEffect(() => {
    if (showComments) {
      fetchComments();
    }
  }, [showComments, postId]);

  const fetchCommentCount = async () => {
    const { count } = await supabase
      .from("feed_post_comments")
      .select("*", { count: "exact", head: true })
      .eq("post_id", postId);
    setCommentCount(count || 0);
  };

  const fetchComments = async () => {
    const { data } = await supabase
      .from("feed_post_comments")
      .select("*")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    if (!data || data.length === 0) {
      setComments([]);
      return;
    }

    // Fetch profiles for all comment authors
    const userIds = [...new Set(data.map(c => c.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, avatar_url")
      .in("id", userIds);

    const profileMap: Record<string, any> = {};
    profiles?.forEach(p => { profileMap[p.id] = p; });

    // Build tree structure
    const allComments: Comment[] = data.map(c => ({
      ...c,
      profile: profileMap[c.user_id],
      replies: [],
    }));

    const topLevel: Comment[] = [];
    const childMap: Record<string, Comment[]> = {};

    allComments.forEach(c => {
      if (c.parent_comment_id) {
        if (!childMap[c.parent_comment_id]) childMap[c.parent_comment_id] = [];
        childMap[c.parent_comment_id].push(c);
      } else {
        topLevel.push(c);
      }
    });

    topLevel.forEach(c => { c.replies = childMap[c.id] || []; });
    setComments(topLevel);
  };

  const handleSubmitComment = async () => {
    const content = newComment.trim();
    if (!content || content.length > MAX_CHARS) return;

    setSubmitting(true);
    const { error } = await supabase.from("feed_post_comments").insert({
      post_id: postId,
      user_id: userId,
      content,
    });

    if (error) {
      console.error("Error posting comment:", error);
    } else {
      setNewComment("");
      toast.success(t.commentSuccess);
      fetchComments();
      setCommentCount(prev => prev + 1);
    }
    setSubmitting(false);
  };

  const handleSubmitReply = async (parentId: string) => {
    const content = replyContent.trim();
    if (!content || content.length > MAX_CHARS) return;

    setSubmitting(true);
    const { error } = await supabase.from("feed_post_comments").insert({
      post_id: postId,
      user_id: userId,
      parent_comment_id: parentId,
      content,
    });

    if (error) {
      console.error("Error posting reply:", error);
    } else {
      setReplyContent("");
      setReplyTo(null);
      toast.success(t.commentSuccess);
      fetchComments();
      setCommentCount(prev => prev + 1);
      setExpandedReplies(prev => new Set(prev).add(parentId));
    }
    setSubmitting(false);
  };

  const handleDelete = async (commentId: string) => {
    const { error } = await supabase
      .from("feed_post_comments")
      .delete()
      .eq("id", commentId);

    if (!error) {
      toast.success(t.deleteSuccess);
      fetchComments();
      fetchCommentCount();
    }
  };

  const toggleReplies = (commentId: string) => {
    setExpandedReplies(prev => {
      const next = new Set(prev);
      if (next.has(commentId)) next.delete(commentId);
      else next.add(commentId);
      return next;
    });
  };

  const renderComment = (comment: Comment, isReply = false) => {
    const canDelete = comment.user_id === userId || isAdmin;
    const initials = comment.profile
      ? `${comment.profile.first_name?.[0] || ''}${comment.profile.last_name?.[0] || ''}`
      : '?';
    const name = comment.profile
      ? `${comment.profile.first_name} ${comment.profile.last_name}`
      : 'Unknown';

    return (
      <div key={comment.id} className={`flex gap-2 ${isReply ? 'ml-8' : ''}`}>
        <Avatar className="h-7 w-7 shrink-0 mt-0.5">
          <AvatarImage src={comment.profile?.avatar_url || undefined} />
          <AvatarFallback className="text-xs bg-muted">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="bg-muted rounded-lg px-3 py-2">
            <p className="text-xs font-semibold">{name}</p>
            <p className="text-sm whitespace-pre-wrap break-words">{comment.content}</p>
          </div>
          <div className="flex items-center gap-3 mt-1 px-1">
            <span className="text-[11px] text-muted-foreground">
              {format(new Date(comment.created_at), "MMM d, h:mm a")}
            </span>
            {!isReply && (
              <button
                onClick={() => {
                  setReplyTo(replyTo === comment.id ? null : comment.id);
                  setReplyContent("");
                }}
                className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {t.reply}
              </button>
            )}
            {canDelete && (
              <button
                onClick={() => handleDelete(comment.id)}
                className="text-[11px] font-medium text-muted-foreground hover:text-destructive transition-colors"
              >
                {t.delete}
              </button>
            )}
          </div>

          {/* Replies toggle */}
          {!isReply && comment.replies && comment.replies.length > 0 && (
            <button
              onClick={() => toggleReplies(comment.id)}
              className="flex items-center gap-1 text-xs text-primary font-medium mt-1 px-1 hover:underline"
            >
              {expandedReplies.has(comment.id) ? (
                <><ChevronUp className="h-3 w-3" />{t.hideReplies} ({comment.replies.length})</>
              ) : (
                <><ChevronDown className="h-3 w-3" />{t.showReplies} ({comment.replies.length})</>
              )}
            </button>
          )}

          {/* Expanded replies */}
          {!isReply && expandedReplies.has(comment.id) && comment.replies?.map(r => renderComment(r, true))}

          {/* Reply input */}
          {replyTo === comment.id && (
            <div className="mt-2 ml-0 space-y-1">
              <Textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value.slice(0, MAX_CHARS))}
                placeholder={t.writeReply}
                className="min-h-[60px] text-sm resize-none"
              />
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">
                  {MAX_CHARS - replyContent.length} {t.charLimit}
                </span>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setReplyTo(null)}>
                    {t.cancel}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleSubmitReply(comment.id)}
                    disabled={!replyContent.trim() || submitting}
                  >
                    <Send className="h-3 w-3 mr-1" />
                    {t.send}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full">
      {/* Toggle comments button */}
      <button
        onClick={() => setShowComments(!showComments)}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <MessageSquare className="h-4 w-4" />
        {t.comments} ({commentCount})
      </button>

      {showComments && (
        <div className="mt-3 space-y-3">
          {/* New comment input */}
          <div className="space-y-1">
            <Textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value.slice(0, MAX_CHARS))}
              placeholder={t.writeComment}
              className="min-h-[60px] text-sm resize-none"
            />
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">
                {MAX_CHARS - newComment.length} {t.charLimit}
              </span>
              <Button
                size="sm"
                onClick={handleSubmitComment}
                disabled={!newComment.trim() || submitting}
              >
                <Send className="h-3 w-3 mr-1" />
                {t.send}
              </Button>
            </div>
          </div>

          {/* Comments list */}
          {comments.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">{t.noComments}</p>
          ) : (
            <div className="space-y-3">
              {comments.map(c => renderComment(c))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FeedComments;
