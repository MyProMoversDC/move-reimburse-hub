
-- Add edit/reply support to chat_messages
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS edited_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS reply_to_message_id uuid REFERENCES public.chat_messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;

-- Allow senders to UPDATE their own messages (only content/edited_at, enforced via app)
CREATE POLICY "Users can update their own messages"
ON public.chat_messages
FOR UPDATE
TO authenticated
USING (auth.uid() = sender_id)
WITH CHECK (auth.uid() = sender_id);

-- Allow senders to DELETE their own messages
CREATE POLICY "Users can delete their own messages"
ON public.chat_messages
FOR DELETE
TO authenticated
USING (auth.uid() = sender_id);

-- Reactions table
CREATE TABLE public.chat_message_reactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id uuid NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  emoji text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_message_reactions TO authenticated;
GRANT ALL ON public.chat_message_reactions TO service_role;

ALTER TABLE public.chat_message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view reactions in their conversations"
ON public.chat_message_reactions
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.chat_messages m
  JOIN public.conversation_participants cp ON cp.conversation_id = m.conversation_id
  WHERE m.id = chat_message_reactions.message_id AND cp.user_id = auth.uid()
));

CREATE POLICY "Users can add their own reactions"
ON public.chat_message_reactions
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.chat_messages m
    JOIN public.conversation_participants cp ON cp.conversation_id = m.conversation_id
    WHERE m.id = chat_message_reactions.message_id AND cp.user_id = auth.uid()
  )
);

CREATE POLICY "Users can remove their own reactions"
ON public.chat_message_reactions
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_message_reactions;
