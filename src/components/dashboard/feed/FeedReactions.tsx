import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Smile } from "lucide-react";

interface FeedReactionsProps {
  postId: string;
  userId: string;
}

const AVAILABLE_EMOJIS = ["👍", "❤️", "😊", "🎉", "👏", "🙌", "💪", "⭐"];

const FeedReactions = ({ postId, userId }: FeedReactionsProps) => {
  const [reactions, setReactions] = useState<Record<string, { count: number; hasReacted: boolean }>>({});
  const [loading, setLoading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    fetchReactions();
  }, [postId]);

  const fetchReactions = async () => {
    const { data } = await supabase
      .from("feed_post_reactions")
      .select("emoji, user_id")
      .eq("post_id", postId);

    if (data) {
      const reactionMap: Record<string, { count: number; hasReacted: boolean }> = {};
      data.forEach((reaction) => {
        if (!reactionMap[reaction.emoji]) {
          reactionMap[reaction.emoji] = { count: 0, hasReacted: false };
        }
        reactionMap[reaction.emoji].count++;
        if (reaction.user_id === userId) {
          reactionMap[reaction.emoji].hasReacted = true;
        }
      });
      setReactions(reactionMap);
    }
  };

  const handleReaction = async (emoji: string) => {
    if (loading) return;
    setLoading(true);
    setShowPicker(false);

    try {
      const hasReacted = reactions[emoji]?.hasReacted;

      if (hasReacted) {
        await supabase
          .from("feed_post_reactions")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", userId)
          .eq("emoji", emoji);
      } else {
        await supabase
          .from("feed_post_reactions")
          .insert({ post_id: postId, user_id: userId, emoji });
      }

      await fetchReactions();
    } finally {
      setLoading(false);
    }
  };

  const sortedReactions = Object.entries(reactions)
    .filter(([_, data]) => data.count > 0)
    .sort((a, b) => b[1].count - a[1].count);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {sortedReactions.map(([emoji, data]) => (
        <Button
          key={emoji}
          variant="outline"
          size="sm"
          className={cn(
            "h-8 px-2 gap-1",
            data.hasReacted && "bg-primary/10 border-primary"
          )}
          onClick={() => handleReaction(emoji)}
          disabled={loading}
        >
          <span className="text-base">{emoji}</span>
          <span className="text-xs font-medium">{data.count}</span>
        </Button>
      ))}

      <Popover open={showPicker} onOpenChange={setShowPicker}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <Smile className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="start">
          <div className="flex gap-1 flex-wrap max-w-[200px]">
            {AVAILABLE_EMOJIS.map((emoji) => (
              <Button
                key={emoji}
                variant="ghost"
                size="sm"
                className={cn(
                  "h-8 w-8 p-0 text-lg hover:bg-muted",
                  reactions[emoji]?.hasReacted && "bg-primary/10"
                )}
                onClick={() => handleReaction(emoji)}
                disabled={loading}
              >
                {emoji}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default FeedReactions;