import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, RefreshCw } from "lucide-react";
import FeedPost from "./FeedPost";
import CreatePostDialog from "./CreatePostDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface Attachment {
  id: string;
  post_id: string;
  file_url: string;
  file_name: string;
  file_type: string;
}

interface Poll {
  id: string;
  post_id: string;
  question: string;
  feed_post_poll_options: {
    id: string;
    option_text: string;
    sort_order: number;
  }[];
}

interface AuthorProfile {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
}

interface Post {
  id: string;
  content: string;
  created_at: string;
  updated_at: string;
  created_by: string;
}

interface FeedListProps {
  userId: string;
  isAdmin: boolean;
  language: 'en' | 'es' | 'ru';
  canSavePosts?: boolean;
}

const translations = {
  en: {
    feed: "Feed",
    createPost: "Create Post",
    refresh: "Refresh",
    noPosts: "No posts yet",
    noPostsDesc: "Check back later for updates from the team.",
    deleteConfirm: "Delete Post",
    deleteDesc: "Are you sure you want to delete this post? This action cannot be undone.",
    cancel: "Cancel",
    delete: "Delete",
    deleteSuccess: "Post deleted successfully",
  },
  es: {
    feed: "Noticias",
    createPost: "Crear Publicación",
    refresh: "Actualizar",
    noPosts: "No hay publicaciones aún",
    noPostsDesc: "Vuelve más tarde para actualizaciones del equipo.",
    deleteConfirm: "Eliminar Publicación",
    deleteDesc: "¿Estás seguro de que quieres eliminar esta publicación? Esta acción no se puede deshacer.",
    cancel: "Cancelar",
    delete: "Eliminar",
    deleteSuccess: "Publicación eliminada exitosamente",
  },
  ru: {
    feed: "Лента",
    createPost: "Создать Пост",
    refresh: "Обновить",
    noPosts: "Постов пока нет",
    noPostsDesc: "Зайдите позже для обновлений от команды.",
    deleteConfirm: "Удалить Пост",
    deleteDesc: "Вы уверены, что хотите удалить этот пост? Это действие нельзя отменить.",
    cancel: "Отмена",
    delete: "Удалить",
    deleteSuccess: "Пост успешно удален",
  },
};

const FeedList = ({ userId, isAdmin, language }: FeedListProps) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [attachmentsMap, setAttachmentsMap] = useState<Record<string, Attachment[]>>({});
  const [pollsMap, setPollsMap] = useState<Record<string, Poll>>({});
  const [authorsMap, setAuthorsMap] = useState<Record<string, AuthorProfile>>({});
  const [acknowledgedMap, setAcknowledgedMap] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editPost, setEditPost] = useState<Post | null>(null);
  const [deletePostId, setDeletePostId] = useState<string | null>(null);

  const t = translations[language];

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    setLoading(true);
    
    // Fetch only published posts for users
    const { data: postsData } = await supabase
      .from("feed_posts")
      .select("*")
      .eq("is_published", true)
      .order("created_at", { ascending: false });

    if (!postsData || postsData.length === 0) {
      setPosts([]);
      setLoading(false);
      return;
    }

    setPosts(postsData);
    
    const postIds = postsData.map(p => p.id);
    const authorIds = [...new Set(postsData.map(p => p.created_by))];

    // Fetch all related data in parallel
    const [attachmentsRes, pollsRes, authorsRes] = await Promise.all([
      supabase
        .from("feed_post_attachments")
        .select("*")
        .in("post_id", postIds),
      supabase
        .from("feed_post_polls")
        .select("*, feed_post_poll_options(*)")
        .in("post_id", postIds),
      supabase
        .from("profiles")
        .select("id, first_name, last_name, avatar_url")
        .in("id", authorIds),
    ]);

    // Fetch user acknowledgments for movers (non-admin) separately
    if (!isAdmin) {
      const { data: acknowledgmentsData } = await supabase
        .from("feed_post_acknowledgments")
        .select("post_id")
        .eq("user_id", userId)
        .in("post_id", postIds);

      const ackMap: Record<string, boolean> = {};
      acknowledgmentsData?.forEach((ack) => {
        ackMap[ack.post_id] = true;
      });
      setAcknowledgedMap(ackMap);
    }

    // Build attachments map
    const attMap: Record<string, Attachment[]> = {};
    attachmentsRes.data?.forEach(att => {
      if (!attMap[att.post_id]) attMap[att.post_id] = [];
      attMap[att.post_id].push(att);
    });
    setAttachmentsMap(attMap);

    // Build polls map
    const pMap: Record<string, Poll> = {};
    pollsRes.data?.forEach(poll => {
      pMap[poll.post_id] = poll;
    });
    setPollsMap(pMap);

    // Build authors map
    const aMap: Record<string, AuthorProfile> = {};
    authorsRes.data?.forEach(author => {
      aMap[author.id] = author;
    });
    setAuthorsMap(aMap);

    setLoading(false);
  };

  const handleEdit = (postId: string) => {
    const post = posts.find((p) => p.id === postId);
    if (post) {
      setEditPost(post);
      setShowCreateDialog(true);
    }
  };

  const handleDelete = async () => {
    if (!deletePostId) return;

    try {
      const { error } = await supabase
        .from("feed_posts")
        .delete()
        .eq("id", deletePostId);

      if (error) throw error;

      toast.success(t.deleteSuccess);
      fetchPosts();
    } catch (error) {
      console.error("Error deleting post:", error);
    } finally {
      setDeletePostId(null);
    }
  };

  const handleCreateSuccess = () => {
    setEditPost(null);
    setShowCreateDialog(false);
    fetchPosts();
  };

  return (
    <div className="space-y-4">
      {/* Header - only show for admin */}
      {isAdmin && (
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">{t.feed}</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchPosts}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button size="sm" onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {t.createPost}
            </Button>
          </div>
        </div>
      )}

      {/* Posts */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : posts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-lg font-medium text-muted-foreground">{t.noPosts}</p>
          <p className="text-sm text-muted-foreground mt-1">{t.noPostsDesc}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => {
            const postAttachments = attachmentsMap[post.id] || [];
            const postPoll = pollsMap[post.id];
            const postAuthor = authorsMap[post.created_by];
            
            // Transform poll data to match FeedPost expected format
            const formattedPoll = postPoll ? {
              id: postPoll.id,
              question: postPoll.question,
              options: postPoll.feed_post_poll_options?.sort((a, b) => a.sort_order - b.sort_order) || [],
            } : null;
            
            return (
              <FeedPost
                key={post.id}
                post={post}
                isAdmin={isAdmin}
                userId={userId}
                onEdit={handleEdit}
                onDelete={(id) => setDeletePostId(id)}
                language={language}
                prefetchedAttachments={postAttachments}
                prefetchedPoll={formattedPoll}
                prefetchedAuthor={postAuthor || null}
                prefetchedAcknowledged={!isAdmin ? acknowledgedMap[post.id] || false : undefined}
              />
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <CreatePostDialog
        open={showCreateDialog}
        onOpenChange={(open) => {
          setShowCreateDialog(open);
          if (!open) setEditPost(null);
        }}
        userId={userId}
        onSuccess={handleCreateSuccess}
        editPost={editPost}
        language={language}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletePostId} onOpenChange={() => setDeletePostId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.deleteConfirm}</AlertDialogTitle>
            <AlertDialogDescription>{t.deleteDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              {t.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default FeedList;