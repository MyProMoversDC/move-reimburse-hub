
CREATE POLICY "App instructions: admins upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'application-instructions' AND public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "App instructions: admins update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'application-instructions' AND public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "App instructions: admins delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'application-instructions' AND public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "App instructions: authenticated read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'application-instructions');
