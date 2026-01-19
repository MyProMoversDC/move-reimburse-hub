-- Add a table to track "review later" counts per user per post
CREATE TABLE IF NOT EXISTS public.feed_post_review_later_counts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, post_id)
);

-- Enable RLS
ALTER TABLE public.feed_post_review_later_counts ENABLE ROW LEVEL SECURITY;

-- RLS policies - users can only see/manage their own review later counts
CREATE POLICY "Users can view their own review later counts"
  ON public.feed_post_review_later_counts
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own review later counts"
  ON public.feed_post_review_later_counts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own review later counts"
  ON public.feed_post_review_later_counts
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Enable realtime for the table
ALTER PUBLICATION supabase_realtime ADD TABLE public.feed_post_review_later_counts;