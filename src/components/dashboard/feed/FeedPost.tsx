import { useState, useEffect } from "react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Image, FileText, Video, MoreVertical, Pencil, Trash2, Eye, Users, CheckCircle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import FeedPoll from "./FeedPoll";
import FeedReactions from "./FeedReactions";
import FeedComments from "./FeedComments";
import { MoverTranslateButton } from "../MoverTranslateButton";
import { useTargetTranslation } from "@/hooks/useTargetTranslation";

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

interface AuthorProfile {
  first_name: string;
  last_name: string;
  avatar_url: string | null;
}

interface PostView {
  user_id: string;
  viewed_at: string;
  profile?: {
    first_name: string;
    last_name: string;
  };
}

interface FeedPostProps {
  post: {
    id: string;
    content: string;
    created_at: string;
    updated_at: string;
    created_by: string;
  };
  isAdmin: boolean;
  userId: string;
  onEdit?: (postId: string) => void;
  onDelete?: (postId: string) => void;
  language: 'en' | 'es' | 'ru';
  // Prefetched data for performance
  prefetchedAttachments?: Attachment[];
  prefetchedPoll?: Poll | null;
  prefetchedAuthor?: AuthorProfile | null;
  prefetchedAcknowledged?: boolean;
}

const translations = {
  en: {
    postedBy: "Posted by Admin",
    edit: "Edit",
    delete: "Delete",
    viewedBy: "Viewed by",
    people: "people",
    noViews: "No views yet",
    viewers: "Viewers",
    close: "Close",
    translatedTo: "Translated to",
    iUnderstand: "I have read and understand",
    acknowledged: "Acknowledged",
  },
  es: {
    postedBy: "Publicado por Admin",
    edit: "Editar",
    delete: "Eliminar",
    viewedBy: "Visto por",
    people: "personas",
    noViews: "Sin vistas aún",
    viewers: "Espectadores",
    close: "Cerrar",
    translatedTo: "Traducido a",
    iUnderstand: "He leído y entiendo",
    acknowledged: "Reconocido",
  },
  ru: {
    postedBy: "Опубликовано Админом",
    edit: "Редактировать",
    delete: "Удалить",
    viewedBy: "Просмотрено",
    people: "чел.",
    noViews: "Пока нет просмотров",
    viewers: "Просмотревшие",
    close: "Закрыть",
    translatedTo: "Переведено на",
    iUnderstand: "Я прочитал и понимаю",
    acknowledged: "Подтверждено",
  },
};

const FeedPost = ({ 
  post, 
  isAdmin, 
  userId, 
  onEdit, 
  onDelete, 
  language,
  prefetchedAttachments,
  prefetchedPoll,
  prefetchedAuthor,
  prefetchedAcknowledged,
}: FeedPostProps) => {
  const [attachments, setAttachments] = useState<Attachment[]>(prefetchedAttachments || []);
  const [poll, setPoll] = useState<Poll | null>(prefetchedPoll || null);
  const [views, setViews] = useState<PostView[]>([]);
  const [showViewers, setShowViewers] = useState(false);
  const [hasRecordedView, setHasRecordedView] = useState(false);
  const [authorProfile, setAuthorProfile] = useState<AuthorProfile | null>(prefetchedAuthor || null);
  const [hasAcknowledged, setHasAcknowledged] = useState<boolean>(prefetchedAcknowledged || false);
  const [isAcknowledging, setIsAcknowledging] = useState(false);
  
  // Translation state
  const [translatedContent, setTranslatedContent] = useState<string | null>(null);
  const [translatedPollQuestion, setTranslatedPollQuestion] = useState<string | null>(null);
  const [translatedPollOptions, setTranslatedPollOptions] = useState<string[] | null>(null);
  const [translatedToLang, setTranslatedToLang] = useState<'es' | 'ru' | null>(null);
  const { translateTexts, isTranslating } = useTargetTranslation();

  const t = translations[language];

  useEffect(() => {
    // Only fetch data that wasn't prefetched
    if (!prefetchedAttachments || !prefetchedPoll || !prefetchedAuthor) {
      fetchMissingData();
    }
    // Always fetch views for admin (lightweight operation)
    if (isAdmin) {
      fetchViews();
    }
    // Check acknowledgment status if not prefetched
    if (prefetchedAcknowledged === undefined && !isAdmin) {
      checkAcknowledgment();
    }
    recordView();
  }, [post.id]);

  const checkAcknowledgment = async () => {
    const { data } = await supabase
      .from("feed_post_acknowledgments")
      .select("id")
      .eq("post_id", post.id)
      .eq("user_id", userId)
      .maybeSingle();
    setHasAcknowledged(!!data);
  };

  const handleAcknowledge = async () => {
    if (hasAcknowledged || isAcknowledging) return;
    setIsAcknowledging(true);
    try {
      const { error } = await supabase
        .from("feed_post_acknowledgments")
        .insert({ post_id: post.id, user_id: userId });
      if (!error) {
        setHasAcknowledged(true);
      }
    } catch (error) {
      console.error("Error acknowledging post:", error);
    } finally {
      setIsAcknowledging(false);
    }
  };

  const fetchMissingData = async () => {
    // Fetch author profile if not prefetched
    if (!prefetchedAuthor) {
      const { data } = await supabase
        .from("profiles")
        .select("first_name, last_name, avatar_url")
        .eq("id", post.created_by)
        .maybeSingle();
      if (data) setAuthorProfile(data);
    }

    // Fetch attachments if not prefetched
    if (!prefetchedAttachments) {
      const { data } = await supabase
        .from("feed_post_attachments")
        .select("*")
        .eq("post_id", post.id);
      if (data) setAttachments(data);
    }

    // Fetch poll if not prefetched
    if (prefetchedPoll === undefined) {
      const { data } = await supabase
        .from("feed_post_polls")
        .select("*, feed_post_poll_options(*)")
        .eq("post_id", post.id)
        .maybeSingle();
      if (data) {
        setPoll({
          id: data.id,
          question: data.question,
          options: data.feed_post_poll_options.sort((a: any, b: any) => a.sort_order - b.sort_order),
        });
      }
    }
  };

  const fetchViews = async () => {
    const { data: viewsData } = await supabase
      .from("feed_post_views")
      .select("user_id, viewed_at")
      .eq("post_id", post.id);
    
    if (viewsData && viewsData.length > 0) {
      // Fetch profiles for viewers
      const userIds = viewsData.map(v => v.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", userIds);
      
      const viewsWithProfiles = viewsData.map(view => ({
        ...view,
        profile: profiles?.find(p => p.id === view.user_id),
      }));
      
      setViews(viewsWithProfiles);
    }
  };

  const recordView = async () => {
    if (hasRecordedView) return;
    
    try {
      await supabase
        .from("feed_post_views")
        .upsert({ post_id: post.id, user_id: userId }, { onConflict: "post_id,user_id" });
      setHasRecordedView(true);
    } catch (error) {
      // Ignore duplicate errors
    }
  };

  const handleTranslate = async (targetLang: 'es' | 'ru') => {
    // Collect all texts to translate
    const textsToTranslate: string[] = [];
    if (post.content) textsToTranslate.push(post.content);
    if (poll) {
      textsToTranslate.push(poll.question);
      poll.options.forEach(opt => textsToTranslate.push(opt.option_text));
    }
    
    if (textsToTranslate.length === 0) return;
    
    const results = await translateTexts(textsToTranslate, targetLang);
    
    let idx = 0;
    if (post.content) {
      setTranslatedContent(results[idx]);
      idx++;
    }
    if (poll) {
      setTranslatedPollQuestion(results[idx]);
      idx++;
      const translatedOpts = poll.options.map(() => results[idx++]);
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

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith("image/")) return <Image className="h-4 w-4" />;
    if (fileType.startsWith("video/")) return <Video className="h-4 w-4" />;
    return <FileText className="h-4 w-4" />;
  };

  const renderAttachment = (attachment: Attachment) => {
    if (attachment.file_type.startsWith("image/")) {
      return (
        <img
          key={attachment.id}
          src={attachment.file_url}
          alt={attachment.file_name}
          className="rounded-lg max-h-96 w-full object-cover cursor-pointer hover:opacity-90 transition"
          onClick={() => window.open(attachment.file_url, "_blank")}
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
          poster=""
          className="rounded-lg max-h-96 w-full bg-muted"
        />
      );
    }
    return (
      <a
        key={attachment.id}
        href={attachment.file_url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 p-3 bg-muted rounded-lg hover:bg-muted/80 transition"
      >
        {getFileIcon(attachment.file_type)}
        <span className="truncate">{attachment.file_name}</span>
      </a>
    );
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={authorProfile?.avatar_url || undefined} alt="Author" />
              <AvatarFallback className="bg-primary text-primary-foreground">
                {authorProfile ? `${authorProfile.first_name?.[0] || ''}${authorProfile.last_name?.[0] || ''}` : 'A'}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold">
                {authorProfile ? `${authorProfile.first_name} ${authorProfile.last_name}` : t.postedBy}
              </p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(post.created_at), "MMM d, yyyy 'at' h:mm a")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => setShowViewers(true)}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  {views.length}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit?.(post.id)}>
                      <Pencil className="h-4 w-4 mr-2" />
                      {t.edit}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => onDelete?.(post.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {t.delete}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {post.content && (
          <div className="space-y-2">
            <p className="text-sm whitespace-pre-wrap">
              {translatedContent || post.content}
            </p>
            {translatedToLang && (
              <p className="text-xs text-muted-foreground italic">
                {t.translatedTo} {translatedToLang === 'es' ? 'Español' : 'Русский'}
              </p>
            )}
          </div>
        )}

        {/* Translation button for non-admin users */}
        {!isAdmin && post.content && (
          <MoverTranslateButton
            onTranslate={handleTranslate}
            onShowOriginal={handleShowOriginal}
            isTranslating={isTranslating}
            isTranslated={!!translatedContent}
            translatedToLang={translatedToLang}
          />
        )}

        {attachments.length > 0 && (
          <div className="space-y-3">
            {attachments.map(renderAttachment)}
          </div>
        )}

        {poll && (
          <FeedPoll 
            poll={poll} 
            userId={userId} 
            language={language}
            translatedQuestion={translatedPollQuestion}
            translatedOptions={translatedPollOptions}
          />
        )}
      </CardContent>

      <CardFooter className="pt-0 flex-col items-start gap-3">
        <FeedReactions postId={post.id} userId={userId} />
        
        {/* Acknowledgment button for movers */}
        {!isAdmin && (
          <div className="w-full pt-2 border-t">
            {hasAcknowledged ? (
              <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                <CheckCircle className="h-4 w-4 text-green-500" />
                {t.acknowledged}
              </Badge>
            ) : (
              <Button
                onClick={handleAcknowledge}
                disabled={isAcknowledging}
                className="w-full sm:w-auto"
                variant="default"
              >
                {isAcknowledging ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                ) : null}
                {t.iUnderstand}
              </Button>
            )}
          </div>
        )}
      </CardFooter>

      {/* Viewers Dialog (Admin only) */}
      <Dialog open={showViewers} onOpenChange={setShowViewers}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {t.viewers} ({views.length})
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto">
            {views.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">{t.noViews}</p>
            ) : (
              <div className="space-y-2">
                {views.map((view) => (
                  <div
                    key={view.user_id}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-muted"
                  >
                    <span>
                      {view.profile
                        ? `${view.profile.first_name} ${view.profile.last_name}`
                        : "Unknown User"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(view.viewed_at), "MMM d, h:mm a")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default FeedPost;