import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Plus, Eye, Edit, Trash2, FileText, Image, Video, FileIcon, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import CreatePostDialog from "./CreatePostDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface FeedManagerProps {
  userId: string;
}

interface PostView {
  id: string;
  user_id: string;
  viewed_at: string;
}

export const FeedManager = ({ userId }: FeedManagerProps) => {
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewsDialogOpen, setViewsDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<any>(null);

  const { data: posts, isLoading } = useQuery({
    queryKey: ["admin-feed-posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feed_posts")
        .select(`
          *,
          feed_post_attachments(*),
          feed_post_polls(
            *,
            feed_post_poll_options(*)
          ),
          feed_post_views(count),
          feed_post_reactions(count)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const { data: allUsers } = useQuery({
    queryKey: ["all-users-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });
      if (error) throw error;
      return count || 0;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (postId: string) => {
      // Delete attachments from storage
      const { data: attachments } = await supabase
        .from("feed_post_attachments")
        .select("file_url")
        .eq("post_id", postId);

      if (attachments) {
        for (const attachment of attachments) {
          const path = attachment.file_url.split("/").pop();
          if (path) {
            await supabase.storage.from("feed-attachments").remove([path]);
          }
        }
      }

      const { error } = await supabase.from("feed_posts").delete().eq("id", postId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-feed-posts"] });
      toast.success("Post deleted successfully");
      setDeleteDialogOpen(false);
      setSelectedPost(null);
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const fetchPostViews = async (postId: string) => {
    // First get the views
    const { data: views, error: viewsError } = await supabase
      .from("feed_post_views")
      .select("id, user_id, viewed_at")
      .eq("post_id", postId)
      .order("viewed_at", { ascending: false });

    if (viewsError) throw viewsError;

    // Then get profiles for these users
    const userIds = views?.map(v => v.user_id) || [];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", userIds);

    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
    
    return (views || []).map(view => ({
      ...view,
      profile: profileMap.get(view.user_id)
    }));
  };

  const { data: postViews, refetch: refetchViews } = useQuery({
    queryKey: ["post-views", selectedPost?.id],
    queryFn: () => fetchPostViews(selectedPost?.id),
    enabled: !!selectedPost && viewsDialogOpen,
  });

  const handleViewViews = (post: any) => {
    setSelectedPost(post);
    setViewsDialogOpen(true);
    refetchViews();
  };

  const handleEdit = (post: any) => {
    setSelectedPost(post);
    setEditDialogOpen(true);
  };

  const handleDelete = (post: any) => {
    setSelectedPost(post);
    setDeleteDialogOpen(true);
  };

  const getAttachmentIcon = (fileType: string) => {
    if (fileType.startsWith("image/")) return <Image className="h-4 w-4" />;
    if (fileType.startsWith("video/")) return <Video className="h-4 w-4" />;
    return <FileIcon className="h-4 w-4" />;
  };

  const hasPoll = (post: any) => {
    return post.feed_post_polls !== null;
  };

  const getViewCount = (post: any) => {
    return post.feed_post_views?.[0]?.count || 0;
  };

  const getReactionCount = (post: any) => {
    return post.feed_post_reactions?.[0]?.count || 0;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Feed Management</h2>
          <p className="text-muted-foreground">Create and manage posts for all movers</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Post
        </Button>
      </div>

      <div className="grid gap-4">
        {posts?.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No posts yet. Create your first post!</p>
            </CardContent>
          </Card>
        ) : (
          posts?.map((post) => (
            <Card key={post.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(post.created_at), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                    {post.content && (
                      <p className="mt-2 whitespace-pre-wrap">{post.content.substring(0, 200)}{post.content.length > 200 ? "..." : ""}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => handleViewViews(post)}>
                      <Eye className="h-4 w-4 mr-1" />
                      <span className="text-xs">{getViewCount(post)}/{allUsers}</span>
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(post)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(post)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {post.feed_post_attachments?.map((attachment: any) => (
                    <Badge key={attachment.id} variant="secondary" className="flex items-center gap-1">
                      {getAttachmentIcon(attachment.file_type)}
                      <span className="max-w-[150px] truncate">{attachment.file_name}</span>
                    </Badge>
                  ))}
                  {hasPoll(post) && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <BarChart3 className="h-4 w-4" />
                      Poll
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                  <span>{getViewCount(post)} views</span>
                  <span>{getReactionCount(post)} reactions</span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <CreatePostDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        userId={userId}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["admin-feed-posts"] })}
        language="en"
      />

      {selectedPost && (
        <CreatePostDialog
          open={editDialogOpen}
          onOpenChange={(open) => {
            setEditDialogOpen(open);
            if (!open) setSelectedPost(null);
          }}
          userId={userId}
          editPost={selectedPost}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ["admin-feed-posts"] })}
          language="en"
        />
      )}

      <Dialog open={viewsDialogOpen} onOpenChange={setViewsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Post Views ({postViews?.length || 0}/{allUsers})</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[400px]">
            {postViews?.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No views yet</p>
            ) : (
              <div className="space-y-2">
                {postViews?.map((view) => (
                  <div key={view.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                    <span>
                      {view.profile?.first_name} {view.profile?.last_name}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {format(new Date(view.viewed_at), "MMM d, h:mm a")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Post</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this post? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedPost && deleteMutation.mutate(selectedPost.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
