-- Drop the restrictive policy
DROP POLICY IF EXISTS "Conversation creators can add participants" ON public.conversation_participants;

-- Create a more permissive policy for inserting participants
-- Allow users to add themselves as participants OR if they created the conversation
CREATE POLICY "Users can add participants to conversations they created or join"
ON public.conversation_participants
FOR INSERT
WITH CHECK (
  -- User can add themselves
  (user_id = auth.uid())
  OR 
  -- Or user is admin
  has_role(auth.uid(), 'admin'::app_role)
  OR
  -- Or user is the creator of the conversation (using security definer function)
  (SELECT created_by FROM public.conversations WHERE id = conversation_id) = auth.uid()
);