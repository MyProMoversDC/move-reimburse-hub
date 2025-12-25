-- Create table for performance/misconduct messages between admin and movers
CREATE TABLE public.performance_misconduct_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID REFERENCES public.performance_reports(id) ON DELETE CASCADE,
  report_title TEXT NOT NULL,
  sender_id UUID NOT NULL,
  recipient_id UUID NOT NULL,
  message TEXT NOT NULL,
  is_admin_message BOOLEAN NOT NULL DEFAULT true,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.performance_misconduct_messages ENABLE ROW LEVEL SECURITY;

-- Admins can view all messages
CREATE POLICY "Admins can view all messages"
ON public.performance_misconduct_messages
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can insert messages
CREATE POLICY "Admins can insert messages"
ON public.performance_misconduct_messages
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update messages (mark as read)
CREATE POLICY "Admins can update messages"
ON public.performance_misconduct_messages
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Movers can view messages sent to them
CREATE POLICY "Movers can view their messages"
ON public.performance_misconduct_messages
FOR SELECT
USING (auth.uid() = recipient_id OR auth.uid() = sender_id);

-- Movers can insert reply messages
CREATE POLICY "Movers can insert reply messages"
ON public.performance_misconduct_messages
FOR INSERT
WITH CHECK (auth.uid() = sender_id AND is_admin_message = false);

-- Movers can update their received messages (mark as read)
CREATE POLICY "Movers can update their messages"
ON public.performance_misconduct_messages
FOR UPDATE
USING (auth.uid() = recipient_id);