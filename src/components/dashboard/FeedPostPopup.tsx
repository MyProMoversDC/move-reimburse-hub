import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Newspaper, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { format } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MoverTranslateButton } from "./MoverTranslateButton";
import { useTargetTranslation } from "@/hooks/useTargetTranslation";
import FeedPoll from "./feed/FeedPoll";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

interface Attachment {
  id: string;
  file_url: string;
  file_name: string;
  file_type: string;
}

interface Poll {
  id: string;
  question: string;
  options: {
    id: string;
    option_text: string;
    sort_order: number;
  }[];
}

interface UnreadPost {
  id: string;
  content: string | null;
  created_at: string;
  created_by: string;
  author?: {
    first_name: string;
    last_name: string;
    avatar_url: string | null;
  };
  attachments: Attachment[];
  poll?: Poll | null;
}

interface FeedPostPopupProps {
  userId: string;
  language: 'en' | 'es' | 'ru';
  onComplete: () => void;
  onAcknowledge?: () => void;
}

const translations = {
  en: {
    title: "New Feed Post",
    unreadPosts: "Unread Posts",
    iUnderstand: "I Understand",
    reviewLater: "Review Later",
    postOf: "of",
    translatedTo: "Translated to",
    reviewLaterNote: "You can review this post later in your Feed.",
  },
  es: {
    title: "Nueva Publicación",
    unreadPosts: "Publicaciones No Leídas",
    iUnderstand: "Entiendo",
    reviewLater: "Revisar Después",
    postOf: "de",
    translatedTo: "Traducido a",
    reviewLaterNote: "Puedes revisar esta publicación más tarde en tu Feed.",
  },
  ru: {
    title: "Новая Публикация",
    unreadPosts: "Непрочитанные Публикации",
    iUnderstand: "Я Понимаю",
    reviewLater: "Просмотреть Позже",
    postOf: "из",
    translatedTo: "Переведено на",
    reviewLaterNote: "Вы можете просмотреть эту публикацию позже в Ленте.",
  },
};

const FeedPostPopup = ({ userId, language, onComplete, onAcknowledge }: FeedPostPopupProps) => {
  const t = translations[language];
  
  const [open, setOpen] = useState(false);
  const [unreadPosts, setUnreadPosts] = useState<UnreadPost[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reviewLaterCounts, setReviewLaterCounts] = useState<Record<string, number>>({});
  
  // Translation state
  const [translatedContent, setTranslatedContent] = useState<string | null>(null);
  const [translatedPollQuestion, setTranslatedPollQuestion] = useState<string | null>(null);
  const [translatedPollOptions, setTranslatedPollOptions] = useState<string[] | null>(null);
  const [translatedToLang, setTranslatedToLang] = useState<'es' | 'ru' | null>(null);
  const { translateTexts, isTranslating } = useTargetTranslation();

  useEffect(() => {
    checkForUnreadPosts();
    fetchReviewLaterCounts();
  }, [userId]);

  const fetchReviewLaterCounts = async () => {
    const { data } = await supabase
      .from("feed_post_review_later_counts")
      .select("post_id, count")
      .eq("user_id", userId);
    
    const counts: Record<string, number> = {};
    data?.forEach(item => {
      counts[item.post_id] = item.count;
    });
    setReviewLaterCounts(counts);
  };

  const checkForUnreadPosts = async () => {
    setLoading(true);
    try {
      // Get all published posts
      const { data: posts, error: postsError } = await supabase
        .from("feed_posts")
        .select("*")
        .eq("is_published", true)
        .order("created_at", { ascending: false });

      if (postsError || !posts || posts.length === 0) {
        setLoading(false);
        onComplete();
        return;
      }

      // Get user's acknowledgments
      const { data: acknowledgments } = await supabase
        .from("feed_post_acknowledgments")
        .select("post_id")
        .eq("user_id", userId);

      const acknowledgedIds = new Set(acknowledgments?.map(a => a.post_id) || []);
      
      // Filter unread posts
      const unread = posts.filter(p => !acknowledgedIds.has(p.id));
      
      if (unread.length === 0) {
        setLoading(false);
        onComplete();
        return;
      }

      // Fetch attachments, polls, and author profiles
      const postIds = unread.map(p => p.id);
      const authorIds = [...new Set(unread.map(p => p.created_by))];

      const [attachmentsRes, pollsRes, authorsRes] = await Promise.all([
        supabase.from("feed_post_attachments").select("*").in("post_id", postIds),
        supabase.from("feed_post_polls").select("*, feed_post_poll_options(*)").in("post_id", postIds),
        supabase.from("profiles").select("id, first_name, last_name, avatar_url").in("id", authorIds),
      ]);

      // Build enriched posts
      const enrichedPosts: UnreadPost[] = unread.map(post => {
        const author = authorsRes.data?.find(a => a.id === post.created_by);
        const attachments = attachmentsRes.data?.filter(att => att.post_id === post.id) || [];
        const pollData = pollsRes.data?.find(p => p.post_id === post.id);
        const poll = pollData ? {
          id: pollData.id,
          question: pollData.question,
          options: pollData.feed_post_poll_options?.sort((a: any, b: any) => a.sort_order - b.sort_order) || [],
        } : null;

        return {
          id: post.id,
          content: post.content,
          created_at: post.created_at,
          created_by: post.created_by,
          author: author ? {
            first_name: author.first_name,
            last_name: author.last_name,
            avatar_url: author.avatar_url,
          } : undefined,
          attachments,
          poll,
        };
      });

      setUnreadPosts(enrichedPosts);
      setOpen(true);
    } catch (error) {
      console.error("Error checking unread posts:", error);
      onComplete();
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async () => {
    const currentPost = unreadPosts[currentIndex];
    if (!currentPost) return;

    setSubmitting(true);
    try {
      // Record view
      await supabase
        .from("feed_post_views")
        .upsert({ post_id: currentPost.id, user_id: userId }, { onConflict: "post_id,user_id" });

      // Record acknowledgment
      const { error } = await supabase
        .from("feed_post_acknowledgments")
        .insert({
          user_id: userId,
          post_id: currentPost.id,
        });

      if (error) {
        console.error("Error acknowledging post:", error);
        toast.error(language === 'en' ? 'Failed to acknowledge. Please try again.' : 
                    language === 'es' ? 'Error al confirmar. Por favor intente de nuevo.' :
                    'Не удалось подтвердить. Попробуйте еще раз.');
        return;
      }

      // Notify parent about the acknowledgment for real-time count update
      onAcknowledge?.();

      moveToNextPost();
    } catch (error) {
      console.error("Error acknowledging post:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReviewLater = async () => {
    const currentPost = unreadPosts[currentIndex];
    if (!currentPost) return;

    // Record view but not acknowledgment
    await supabase
      .from("feed_post_views")
      .upsert({ post_id: currentPost.id, user_id: userId }, { onConflict: "post_id,user_id" });

    // Increment review later count
    const currentCount = reviewLaterCounts[currentPost.id] || 0;
    const newCount = currentCount + 1;
    
    await supabase
      .from("feed_post_review_later_counts")
      .upsert(
        { user_id: userId, post_id: currentPost.id, count: newCount, updated_at: new Date().toISOString() },
        { onConflict: "user_id,post_id" }
      );
    
    setReviewLaterCounts(prev => ({ ...prev, [currentPost.id]: newCount }));

    toast.info(t.reviewLaterNote);
    moveToNextPost();
  };
  // Check if current post has been skipped 3+ times (must read)
  const currentPostForSkipCheck = unreadPosts[currentIndex];
  const mustReadCurrentPost = currentPostForSkipCheck ? (reviewLaterCounts[currentPostForSkipCheck.id] || 0) >= 3 : false;

  const moveToNextPost = () => {
    // Clear translation state
    setTranslatedContent(null);
    setTranslatedPollQuestion(null);
    setTranslatedPollOptions(null);
    setTranslatedToLang(null);

    if (currentIndex < unreadPosts.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // All posts handled
      setOpen(false);
      onComplete();
    }
  };

  const handleTranslate = async (targetLang: 'es' | 'ru') => {
    const postToTranslate = unreadPosts[currentIndex];
    if (!postToTranslate) return;

    const textsToTranslate: string[] = [];
    if (postToTranslate.content) textsToTranslate.push(postToTranslate.content);
    if (postToTranslate.poll) {
      textsToTranslate.push(postToTranslate.poll.question);
      postToTranslate.poll.options.forEach(opt => textsToTranslate.push(opt.option_text));
    }
    
    if (textsToTranslate.length === 0) return;
    
    const results = await translateTexts(textsToTranslate, targetLang);
    
    let idx = 0;
    if (postToTranslate.content) {
      setTranslatedContent(results[idx]);
      idx++;
    }
    if (postToTranslate.poll) {
      setTranslatedPollQuestion(results[idx]);
      idx++;
      const translatedOpts = postToTranslate.poll.options.map(() => results[idx++]);
      setTranslatedPollOptions(translatedOpts);
    }
    setTranslatedToLang(targetLang);
  };

  const handleShowOriginal = () => {
    setTranslatedContent(null);
    setTranslatedPollQuestion(null);
    setTranslatedPollOptions(null);
    setTranslatedToLang(null);
  };

  const renderAttachment = (attachment: Attachment) => {
    if (attachment.file_type.startsWith("image/")) {
      return (
        <img
          key={attachment.id}
          src={attachment.file_url}
          alt={attachment.file_name}
          className="rounded-lg max-h-60 w-full object-cover"
        />
      );
    }
    if (attachment.file_type.startsWith("video/")) {
      return (
        <video
          key={attachment.id}
          src={attachment.file_url}
          controls
          preload="none"
          className="rounded-lg max-h-60 w-full bg-muted"
        />
      );
    }
    return (
      <a
        key={attachment.id}
        href={attachment.file_url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 p-2 bg-muted rounded-lg hover:bg-muted/80 transition text-sm"
      >
        <span className="truncate">{attachment.file_name}</span>
      </a>
    );
  };

  if (loading || unreadPosts.length === 0 || !open) return null;

  const currentPost = unreadPosts[currentIndex];
  if (!currentPost) return null;

  return (
    <AlertDialog open={open} onOpenChange={() => {}}>
      <AlertDialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Newspaper className="h-5 w-5 text-primary" />
              {t.title}
            </div>
            <span className="text-sm font-normal text-muted-foreground">
              {currentIndex + 1} {t.postOf} {unreadPosts.length}
            </span>
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <ScrollArea className="max-h-[50vh] pr-4">
              <div className="space-y-4 pt-2">
                {/* Author info */}
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={currentPost.author?.avatar_url || undefined} alt="Author" />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {currentPost.author ? `${currentPost.author.first_name?.[0] || ''}${currentPost.author.last_name?.[0] || ''}` : 'A'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold text-foreground">
                      {currentPost.author ? `${currentPost.author.first_name} ${currentPost.author.last_name}` : 'Admin'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(currentPost.created_at), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                </div>

                {/* Post content */}
                {currentPost.content && (
                  <div className="space-y-2">
                    <p className="text-sm whitespace-pre-wrap text-foreground">
                      {translatedContent || currentPost.content}
                    </p>
                    {translatedToLang && (
                      <p className="text-xs text-muted-foreground italic">
                        {t.translatedTo} {translatedToLang === 'es' ? 'Español' : 'Русский'}
                      </p>
                    )}
                  </div>
                )}

                {/* Translation button */}
                {currentPost.content && (
                  <MoverTranslateButton
                    onTranslate={handleTranslate}
                    onShowOriginal={handleShowOriginal}
                    isTranslating={isTranslating}
                    isTranslated={!!translatedContent}
                    translatedToLang={translatedToLang}
                  />
                )}

                {/* Attachments */}
                {currentPost.attachments.length > 0 && (
                  <div className="space-y-2">
                    {currentPost.attachments.map(renderAttachment)}
                  </div>
                )}

                {/* Poll */}
                {currentPost.poll && (
                  <FeedPoll 
                    poll={currentPost.poll} 
                    userId={userId} 
                    language={language}
                    translatedQuestion={translatedPollQuestion}
                    translatedOptions={translatedPollOptions}
                  />
                )}
              </div>
            </ScrollArea>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2 pt-4">
          <Button
            onClick={handleAcknowledge}
            disabled={submitting}
            className="w-full sm:w-auto"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {language === 'en' ? 'Processing...' : language === 'es' ? 'Procesando...' : 'Обработка...'}
              </>
            ) : (
              t.iUnderstand
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default FeedPostPopup;