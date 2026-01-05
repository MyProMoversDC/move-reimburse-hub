-- Create notifications table for movers
CREATE TABLE public.mover_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    notification_type TEXT NOT NULL, -- 'approval', 'decline', 'appeal_decline', 'paid'
    reference_type TEXT NOT NULL, -- 'reimbursement', 'review_bonus', 'missing_payment'
    reference_id UUID NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.mover_notifications ENABLE ROW LEVEL SECURITY;

-- Policy for movers to view their own notifications
CREATE POLICY "Users can view their own notifications"
ON public.mover_notifications
FOR SELECT
USING (auth.uid() = user_id);

-- Policy for users to update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications"
ON public.mover_notifications
FOR UPDATE
USING (auth.uid() = user_id);

-- Policy for users to delete their own notifications
CREATE POLICY "Users can delete their own notifications"
ON public.mover_notifications
FOR DELETE
USING (auth.uid() = user_id);

-- Policy for admins/system to insert notifications
CREATE POLICY "Authenticated users can insert notifications"
ON public.mover_notifications
FOR INSERT
WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX idx_mover_notifications_user_id ON public.mover_notifications(user_id);
CREATE INDEX idx_mover_notifications_is_read ON public.mover_notifications(user_id, is_read);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.mover_notifications;