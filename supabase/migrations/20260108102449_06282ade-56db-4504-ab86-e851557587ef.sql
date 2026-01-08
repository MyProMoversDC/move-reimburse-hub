-- Create feed_posts table
CREATE TABLE public.feed_posts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    content TEXT,
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create feed_post_attachments table for images, videos, documents
CREATE TABLE public.feed_post_attachments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    post_id UUID NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create feed_post_polls table
CREATE TABLE public.feed_post_polls (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    post_id UUID NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE UNIQUE,
    question TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create feed_post_poll_options table
CREATE TABLE public.feed_post_poll_options (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    poll_id UUID NOT NULL REFERENCES public.feed_post_polls(id) ON DELETE CASCADE,
    option_text TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create feed_post_poll_votes table
CREATE TABLE public.feed_post_poll_votes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    poll_id UUID NOT NULL REFERENCES public.feed_post_polls(id) ON DELETE CASCADE,
    option_id UUID NOT NULL REFERENCES public.feed_post_poll_options(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(poll_id, user_id)
);

-- Create feed_post_views table to track who viewed each post
CREATE TABLE public.feed_post_views (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    post_id UUID NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(post_id, user_id)
);

-- Create feed_post_reactions table for emoji reactions
CREATE TABLE public.feed_post_reactions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    post_id UUID NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    emoji TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(post_id, user_id, emoji)
);

-- Enable RLS on all tables
ALTER TABLE public.feed_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_post_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_post_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_post_poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_post_poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_post_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_post_reactions ENABLE ROW LEVEL SECURITY;

-- Policies for feed_posts
-- All authenticated users can view posts
CREATE POLICY "All authenticated users can view feed posts"
ON public.feed_posts FOR SELECT
TO authenticated
USING (true);

-- Only admins can create posts
CREATE POLICY "Admins can create feed posts"
ON public.feed_posts FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Only admins can update posts
CREATE POLICY "Admins can update feed posts"
ON public.feed_posts FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Only admins can delete posts
CREATE POLICY "Admins can delete feed posts"
ON public.feed_posts FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Policies for feed_post_attachments
CREATE POLICY "All authenticated users can view feed post attachments"
ON public.feed_post_attachments FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage feed post attachments"
ON public.feed_post_attachments FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Policies for feed_post_polls
CREATE POLICY "All authenticated users can view feed post polls"
ON public.feed_post_polls FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage feed post polls"
ON public.feed_post_polls FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Policies for feed_post_poll_options
CREATE POLICY "All authenticated users can view poll options"
ON public.feed_post_poll_options FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage poll options"
ON public.feed_post_poll_options FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Policies for feed_post_poll_votes
CREATE POLICY "All authenticated users can view their own votes"
ON public.feed_post_poll_votes FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all poll votes"
ON public.feed_post_poll_votes FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can vote on polls"
ON public.feed_post_poll_votes FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can change their vote"
ON public.feed_post_poll_votes FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Policies for feed_post_views
CREATE POLICY "Users can view their own views"
ON public.feed_post_views FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all post views"
ON public.feed_post_views FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can record their view"
ON public.feed_post_views FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policies for feed_post_reactions
CREATE POLICY "All authenticated users can view reactions"
ON public.feed_post_reactions FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can add reactions"
ON public.feed_post_reactions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their reactions"
ON public.feed_post_reactions FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Create trigger for updated_at on feed_posts
CREATE TRIGGER update_feed_posts_updated_at
BEFORE UPDATE ON public.feed_posts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for feed attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('feed-attachments', 'feed-attachments', true);

-- Storage policies for feed-attachments bucket
CREATE POLICY "Anyone can view feed attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'feed-attachments');

CREATE POLICY "Admins can upload feed attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'feed-attachments' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete feed attachments"
ON storage.objects FOR DELETE
USING (bucket_id = 'feed-attachments' AND public.has_role(auth.uid(), 'admin'::app_role));