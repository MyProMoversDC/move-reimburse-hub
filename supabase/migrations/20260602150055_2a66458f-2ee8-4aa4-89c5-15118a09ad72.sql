CREATE TABLE public.feed_post_saves (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  post_id UUID NOT NULL,
  saved_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, post_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.feed_post_saves TO authenticated;
GRANT ALL ON public.feed_post_saves TO service_role;

ALTER TABLE public.feed_post_saves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own saved posts"
  ON public.feed_post_saves FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can save posts for themselves"
  ON public.feed_post_saves FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unsave their own saved posts"
  ON public.feed_post_saves FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_feed_post_saves_user ON public.feed_post_saves(user_id);
CREATE INDEX idx_feed_post_saves_post ON public.feed_post_saves(post_id);