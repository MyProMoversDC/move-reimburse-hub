CREATE POLICY "Admins manage office-ai-kb files"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'office-ai-kb' AND public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (bucket_id = 'office-ai-kb' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Office staff and admins read office-ai-kb files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'office-ai-kb'
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'office_staff'::app_role)
    )
  );