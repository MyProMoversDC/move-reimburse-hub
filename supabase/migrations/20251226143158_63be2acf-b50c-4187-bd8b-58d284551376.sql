-- Fix infinite recursion in chat RLS policies by using SECURITY DEFINER helper functions

-- Helper: is user a participant in conversation?
CREATE OR REPLACE FUNCTION public.is_conversation_participant(_conversation_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_participants cp
    WHERE cp.conversation_id = _conversation_id
      AND cp.user_id = _user_id
  );
$$;

-- Helper: is user the creator of the conversation?
CREATE OR REPLACE FUNCTION public.is_conversation_creator(_conversation_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversations c
    WHERE c.id = _conversation_id
      AND c.created_by = _user_id
  );
$$;

-- Replace recursive SELECT policy on conversation_participants
DROP POLICY IF EXISTS "Users can view participants of their conversations" ON public.conversation_participants;
CREATE POLICY "Users can view participants of their conversations"
ON public.conversation_participants
FOR SELECT
USING (public.is_conversation_participant(conversation_id, auth.uid()));

-- Replace recursive SELECT policy on conversations
DROP POLICY IF EXISTS "Users can view conversations they participate in" ON public.conversations;
CREATE POLICY "Users can view conversations they participate in"
ON public.conversations
FOR SELECT
USING (public.is_conversation_participant(id, auth.uid()));

-- Replace INSERT policy on conversation_participants (avoid subquery referencing conversations under RLS)
DROP POLICY IF EXISTS "Users can add participants to conversations they created or join" ON public.conversation_participants;
DROP POLICY IF EXISTS "Conversation creators can add participants" ON public.conversation_participants;

CREATE POLICY "Conversation creators can add participants"
ON public.conversation_participants
FOR INSERT
WITH CHECK (
  (user_id = auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR public.is_conversation_creator(conversation_id, auth.uid())
);