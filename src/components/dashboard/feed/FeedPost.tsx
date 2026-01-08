import { useState, useEffect } from "react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Image, FileText, Video, MoreVertical, Pencil, Trash2, Eye, Users } from "lucide-react";
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
  },
};

const FeedPost = ({ post, isAdmin, userId, onEdit, onDelete, language }: FeedPostProps) => {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [poll, setPoll] = useState<Poll | null>(null);
  const [views, setViews] = useState<PostView[]>([]);
  const [showViewers, setShowViewers] = useState(false);
  const [hasRecordedView, setHasRecordedView] = useState(false);
  
  // Translation state
  const [translatedContent, setTranslatedContent] = useState<string | null>(null);
  const [translatedToLang, setTranslatedToLang] = useState<'es' | 'ru' | null>(null);
  const { translateTexts, isTranslating } = useTargetTranslation();

  const t = translations[language];

  useEffect(() => {
    fetchPostData();
    recordView();
  }, [post.id]);

  const fetchPostData = async () => {
    // Fetch attachments
    const { data: attachmentsData } = await supabase
      .from("feed_post_attachments")
      .select("*")
      .eq("post_id", post.id);
    
    if (attachmentsData) setAttachments(attachmentsData);

    // Fetch poll
    const { data: pollData } = await supabase
      .from("feed_post_polls")
      .select("*, feed_post_poll_options(*)")
      .eq("post_id", post.id)
      .maybeSingle();
    
    if (pollData) {
      setPoll({
        id: pollData.id,
        question: pollData.question,
        options: pollData.feed_post_poll_options.sort((a: any, b: any) => a.sort_order - b.sort_order),
      });
    }

    // Fetch views (for admin)
    if (isAdmin) {
      const { data: viewsData } = await supabase
        .from("feed_post_views")
        .select("user_id, viewed_at")
        .eq("post_id", post.id);
      
      if (viewsData) {
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
    if (!post.content) return;
    const results = await translateTexts([post.content], targetLang);
    if (results[0]) {
      setTranslatedContent(results[0]);
      setTranslatedToLang(targetLang);
    }
  };

  const handleShowOriginal = () => {
    setTranslatedContent(null);
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
          className="rounded-lg max-h-96 w-full"
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
              <AvatarFallback className="bg-primary text-primary-foreground">A</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold">{t.postedBy}</p>
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
          <FeedPoll poll={poll} userId={userId} language={language} />
        )}
      </CardContent>

      <CardFooter className="pt-0">
        <FeedReactions postId={post.id} userId={userId} />
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