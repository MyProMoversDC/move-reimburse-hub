
-- Create payment_question_status enum
CREATE TYPE public.payment_question_status AS ENUM ('open', 'answered', 'closed');

-- Create payment_questions table
CREATE TABLE public.payment_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mover_id UUID NOT NULL,
  mover_name TEXT NOT NULL,
  subject TEXT NOT NULL,
  other_subject TEXT,
  job_number TEXT NOT NULL,
  question_details TEXT NOT NULL,
  status payment_question_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.payment_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_questions FORCE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Movers can insert their own payment questions"
  ON public.payment_questions FOR INSERT
  WITH CHECK (auth.uid() = mover_id);

CREATE POLICY "Movers can view their own payment questions"
  ON public.payment_questions FOR SELECT
  USING (auth.uid() = mover_id);

CREATE POLICY "Admins can view all payment questions"
  ON public.payment_questions FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update payment questions"
  ON public.payment_questions FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Accountants can view all payment questions"
  ON public.payment_questions FOR SELECT
  USING (has_role(auth.uid(), 'accountant'::app_role));

CREATE POLICY "Accountants can update payment questions"
  ON public.payment_questions FOR UPDATE
  USING (has_role(auth.uid(), 'accountant'::app_role));

-- Create payment_question_messages table for back-and-forth communication
CREATE TABLE public.payment_question_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id UUID NOT NULL REFERENCES public.payment_questions(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  message TEXT NOT NULL,
  is_admin_message BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payment_question_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_question_messages FORCE ROW LEVEL SECURITY;

-- RLS policies for messages
CREATE POLICY "Movers can view messages on their questions"
  ON public.payment_question_messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.payment_questions
    WHERE payment_questions.id = payment_question_messages.question_id
    AND payment_questions.mover_id = auth.uid()
  ));

CREATE POLICY "Movers can insert messages on their questions"
  ON public.payment_question_messages FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.payment_questions
    WHERE payment_questions.id = payment_question_messages.question_id
    AND payment_questions.mover_id = auth.uid()
  ) AND auth.uid() = sender_id AND is_admin_message = false);

CREATE POLICY "Admins can view all payment question messages"
  ON public.payment_question_messages FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert payment question messages"
  ON public.payment_question_messages FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND auth.uid() = sender_id);

CREATE POLICY "Accountants can view all payment question messages"
  ON public.payment_question_messages FOR SELECT
  USING (has_role(auth.uid(), 'accountant'::app_role));

CREATE POLICY "Accountants can insert payment question messages"
  ON public.payment_question_messages FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'accountant'::app_role) AND auth.uid() = sender_id);

-- Create payment_question_attachments table
CREATE TABLE public.payment_question_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id UUID NOT NULL REFERENCES public.payment_questions(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payment_question_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_question_attachments FORCE ROW LEVEL SECURITY;

-- RLS policies for attachments
CREATE POLICY "Movers can view their own question attachments"
  ON public.payment_question_attachments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.payment_questions
    WHERE payment_questions.id = payment_question_attachments.question_id
    AND payment_questions.mover_id = auth.uid()
  ));

CREATE POLICY "Movers can insert their own question attachments"
  ON public.payment_question_attachments FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.payment_questions
    WHERE payment_questions.id = payment_question_attachments.question_id
    AND payment_questions.mover_id = auth.uid()
  ));

CREATE POLICY "Admins can view all question attachments"
  ON public.payment_question_attachments FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Accountants can view all question attachments"
  ON public.payment_question_attachments FOR SELECT
  USING (has_role(auth.uid(), 'accountant'::app_role));

-- Create storage bucket for payment question attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('payment-question-attachments', 'payment-question-attachments', false);

-- Storage policies
CREATE POLICY "Movers can upload payment question attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'payment-question-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Authenticated users can view payment question attachments"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'payment-question-attachments' AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'accountant'::app_role)
  ));
