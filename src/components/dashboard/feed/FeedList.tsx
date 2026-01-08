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
    const { data, error } = await supabase
      .from("feed_posts")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) setPosts(data);
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
          {posts.map((post) => (
            <FeedPost
              key={post.id}
              post={post}
              isAdmin={isAdmin}
              userId={userId}
              onEdit={handleEdit}
              onDelete={(id) => setDeletePostId(id)}
              language={language}
            />
          ))}
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