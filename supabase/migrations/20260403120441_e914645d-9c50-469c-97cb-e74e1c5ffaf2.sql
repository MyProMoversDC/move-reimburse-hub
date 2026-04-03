
-- Create feed post comments table
CREATE TABLE public.feed_post_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  parent_comment_id UUID REFERENCES public.feed_post_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) <= 1000),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_feed_post_comments_post_id ON public.feed_post_comments(post_id);
CREATE INDEX idx_feed_post_comments_parent ON public.feed_post_comments(parent_comment_id);
CREATE INDEX idx_feed_post_comments_user_id ON public.feed_post_comments(user_id);

-- Enable RLS
ALTER TABLE public.feed_post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_post_comments FORCE ROW LEVEL SECURITY;

-- All authenticated users can view comments
CREATE POLICY "Authenticated users can view all comments"
ON public.feed_post_comments FOR SELECT
TO authenticated
USING (true);

-- Users can insert their own comments
CREATE POLICY "Users can insert their own comments"
ON public.feed_post_comments FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own comments
CREATE POLICY "Users can update their own comments"
ON public.feed_post_comments FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Users can delete their own comments
CREATE POLICY "Users can delete their own comments"
ON public.feed_post_comments FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Admins can delete any comment
CREATE POLICY "Admins can delete any comment"
ON public.feed_post_comments FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_feed_post_comments_updated_at
BEFORE UPDATE ON public.feed_post_comments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
