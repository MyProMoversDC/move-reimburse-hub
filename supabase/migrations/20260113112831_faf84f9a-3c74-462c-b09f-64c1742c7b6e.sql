-- Add scheduled_at column to feed_posts for scheduling functionality
ALTER TABLE public.feed_posts 
ADD COLUMN scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add is_published column to track if post is live
ALTER TABLE public.feed_posts 
ADD COLUMN is_published BOOLEAN DEFAULT true;

-- Create index for efficient querying of scheduled posts
CREATE INDEX idx_feed_posts_scheduled ON public.feed_posts (scheduled_at, is_published);

-- Comment for clarity
COMMENT ON COLUMN public.feed_posts.scheduled_at IS 'When the post should be published. NULL means immediate publish.';
COMMENT ON COLUMN public.feed_posts.is_published IS 'Whether the post is visible to users. Scheduled posts start as false.';