CREATE POLICY "Admins and creators can remove participants"
ON public.conversation_participants
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR is_conversation_creator(conversation_id, auth.uid())
);