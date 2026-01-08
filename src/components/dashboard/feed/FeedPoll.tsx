import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface PollOption {
  id: string;
  option_text: string;
  sort_order: number;
}

interface FeedPollProps {
  poll: {
    id: string;
    question: string;
    options: PollOption[];
  };
  userId: string;
  language: 'en' | 'es' | 'ru';
}

const translations = {
  en: {
    votes: "votes",
    vote: "vote",
    totalVotes: "Total votes",
  },
  es: {
    votes: "votos",
    vote: "voto",
    totalVotes: "Votos totales",
  },
  ru: {
    votes: "голосов",
    vote: "голос",
    totalVotes: "Всего голосов",
  },
};

const FeedPoll = ({ poll, userId, language }: FeedPollProps) => {
  const [votes, setVotes] = useState<Record<string, number>>({});
  const [userVote, setUserVote] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const t = translations[language];

  useEffect(() => {
    fetchVotes();
  }, [poll.id]);

  const fetchVotes = async () => {
    // Get all votes for this poll
    const { data: allVotes } = await supabase
      .from("feed_post_poll_votes")
      .select("option_id, user_id")
      .eq("poll_id", poll.id);

    if (allVotes) {
      // Count votes per option
      const voteCounts: Record<string, number> = {};
      allVotes.forEach((vote) => {
        voteCounts[vote.option_id] = (voteCounts[vote.option_id] || 0) + 1;
        if (vote.user_id === userId) {
          setUserVote(vote.option_id);
        }
      });
      setVotes(voteCounts);
    }
  };

  const handleVote = async (optionId: string) => {
    if (loading) return;
    setLoading(true);

    try {
      if (userVote) {
        // Remove existing vote
        await supabase
          .from("feed_post_poll_votes")
          .delete()
          .eq("poll_id", poll.id)
          .eq("user_id", userId);
      }

      if (userVote !== optionId) {
        // Add new vote
        await supabase
          .from("feed_post_poll_votes")
          .insert({ poll_id: poll.id, option_id: optionId, user_id: userId });
      }

      await fetchVotes();
    } finally {
      setLoading(false);
    }
  };

  const totalVotes = Object.values(votes).reduce((sum, count) => sum + count, 0);
  const hasVoted = userVote !== null;

  return (
    <div className="bg-muted/50 rounded-lg p-4 space-y-3">
      <p className="font-medium">{poll.question}</p>
      
      <div className="space-y-2">
        {poll.options.map((option) => {
          const voteCount = votes[option.id] || 0;
          const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
          const isSelected = userVote === option.id;

          return (
            <button
              key={option.id}
              onClick={() => handleVote(option.id)}
              disabled={loading}
              className={cn(
                "w-full text-left rounded-lg border p-3 transition-all hover:border-primary",
                isSelected && "border-primary bg-primary/10"
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  {isSelected && <Check className="h-4 w-4 text-primary" />}
                  <span className={cn("text-sm", isSelected && "font-medium")}>
                    {option.option_text}
                  </span>
                </div>
                {hasVoted && (
                  <span className="text-sm text-muted-foreground">{percentage}%</span>
                )}
              </div>
              {hasVoted && (
                <Progress value={percentage} className="h-1.5" />
              )}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        {t.totalVotes}: {totalVotes}
      </p>
    </div>
  );
};

export default FeedPoll;