-- Create table for feed post acknowledgments
CREATE TABLE public.feed_post_acknowledgments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    post_id UUID NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    acknowledged_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(post_id, user_id)
);

-- Enable RLS
ALTER TABLE public.feed_post_acknowledgments ENABLE ROW LEVEL SECURITY;

-- Users can view their own acknowledgments
CREATE POLICY "Users can view own acknowledgments"
ON public.feed_post_acknowledgments
FOR SELECT
USING (auth.uid() = user_id);

-- Admins can view all acknowledgments
CREATE POLICY "Admins can view all acknowledgments"
ON public.feed_post_acknowledgments
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid()
        AND role IN ('admin', 'operations_manager', 'hr_manager')
    )
);

-- Users can insert their own acknowledgments
CREATE POLICY "Users can acknowledge posts"
ON public.feed_post_acknowledgments
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Add index for performance
CREATE INDEX idx_feed_post_acknowledgments_post_id ON public.feed_post_acknowledgments(post_id);
CREATE INDEX idx_feed_post_acknowledgments_user_id ON public.feed_post_acknowledgments(user_id);