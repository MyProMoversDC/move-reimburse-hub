import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import FeedPost from "./FeedPost";

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

interface SavedFeedPostsProps {
  userId: string;
  language: 'en' | 'es' | 'ru';
}

const translations = {
  en: { title: "Saved Feed Posts", empty: "You haven't saved any posts yet.", emptyDesc: "Click \"Save post\" under any feed post to keep it here." },
  es: { title: "Publicaciones Guardadas", empty: "Aún no has guardado publicaciones.", emptyDesc: "Haz clic en \"Guardar publicación\" debajo de cualquier post para tenerlo aquí." },
  ru: { title: "Сохранённые посты", empty: "Вы пока ничего не сохранили.", emptyDesc: "Нажмите \"Сохранить пост\" под любой записью, чтобы добавить её сюда." },
};

const SavedFeedPosts = ({ userId, language }: SavedFeedPostsProps) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [attachmentsMap, setAttachmentsMap] = useState<Record<string, Attachment[]>>({});
  const [pollsMap, setPollsMap] = useState<Record<string, Poll>>({});
  const [authorsMap, setAuthorsMap] = useState<Record<string, AuthorProfile>>({});
  const [loading, setLoading] = useState(true);

  const t = translations[language];

  const fetchSaved = useCallback(async () => {
    setLoading(true);

    const { data: savedRows } = await supabase
      .from("feed_post_saves")
      .select("post_id, saved_at")
      .eq("user_id", userId)
      .order("saved_at", { ascending: false });

    const postIds = (savedRows || []).map((s) => s.post_id);
    if (postIds.length === 0) {
      setPosts([]);
      setLoading(false);
      return;
    }

    const { data: postsData } = await supabase
      .from("feed_posts")
      .select("*")
      .in("id", postIds);

    // Preserve saved-order
    const ordered = postIds
      .map((id) => postsData?.find((p) => p.id === id))
      .filter(Boolean) as Post[];
    setPosts(ordered);

    const authorIds = [...new Set(ordered.map((p) => p.created_by))];
    const [attachmentsRes, pollsRes, authorsRes] = await Promise.all([
      supabase.from("feed_post_attachments").select("*").in("post_id", postIds),
      supabase.from("feed_post_polls").select("*, feed_post_poll_options(*)").in("post_id", postIds),
      supabase.from("profiles").select("id, first_name, last_name, avatar_url").in("id", authorIds),
    ]);

    const attMap: Record<string, Attachment[]> = {};
    attachmentsRes.data?.forEach((att: any) => {
      if (!attMap[att.post_id]) attMap[att.post_id] = [];
      attMap[att.post_id].push(att);
    });
    setAttachmentsMap(attMap);

    const pMap: Record<string, Poll> = {};
    pollsRes.data?.forEach((poll: any) => { pMap[poll.post_id] = poll; });
    setPollsMap(pMap);

    const aMap: Record<string, AuthorProfile> = {};
    authorsRes.data?.forEach((author: any) => { aMap[author.id] = author; });
    setAuthorsMap(aMap);

    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchSaved(); }, [fetchSaved]);

  const handleSaveChange = (postId: string, saved: boolean) => {
    if (!saved) setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">{t.title}</h2>
        <Button variant="outline" size="sm" onClick={fetchSaved}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : posts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-lg font-medium text-muted-foreground">{t.empty}</p>
          <p className="text-sm text-muted-foreground mt-1">{t.emptyDesc}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => {
            const postPoll = pollsMap[post.id];
            const formattedPoll = postPoll ? {
              id: postPoll.id,
              question: postPoll.question,
              options: postPoll.feed_post_poll_options?.sort((a, b) => a.sort_order - b.sort_order) || [],
            } : null;

            return (
              <FeedPost
                key={post.id}
                post={post}
                isAdmin={false}
                userId={userId}
                language={language}
                prefetchedAttachments={attachmentsMap[post.id] || []}
                prefetchedPoll={formattedPoll}
                prefetchedAuthor={authorsMap[post.created_by] || null}
                canSavePosts={true}
                prefetchedSaved={true}
                onSaveChange={handleSaveChange}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SavedFeedPosts;
