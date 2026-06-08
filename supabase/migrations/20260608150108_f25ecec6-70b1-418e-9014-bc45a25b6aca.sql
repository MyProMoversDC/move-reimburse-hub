GRANT UPDATE ON public.performance_reports TO authenticated;
GRANT ALL ON public.performance_reports TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'performance_reports'
      AND policyname = 'Admins can update performance reports'
  ) THEN
    CREATE POLICY "Admins can update performance reports"
    ON public.performance_reports
    FOR UPDATE
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'::public.app_role))
    WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
  END IF;
END $$;

GRANT UPDATE ON public.alcohol_test_reports TO authenticated;
GRANT ALL ON public.alcohol_test_reports TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'alcohol_test_reports'
      AND policyname = 'Admin and HR can update alcohol test reports'
  ) THEN
    CREATE POLICY "Admin and HR can update alcohol test reports"
    ON public.alcohol_test_reports
    FOR UPDATE
    TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = auth.uid()
          AND role = ANY (ARRAY['admin'::public.app_role, 'hr_manager'::public.app_role])
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = auth.uid()
          AND role = ANY (ARRAY['admin'::public.app_role, 'hr_manager'::public.app_role])
      )
    );
  END IF;
END $$;