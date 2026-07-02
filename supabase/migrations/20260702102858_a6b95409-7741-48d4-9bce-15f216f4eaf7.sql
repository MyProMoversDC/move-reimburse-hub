
CREATE TABLE public.application_instruction_materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.application_instruction_materials TO authenticated;
GRANT ALL ON public.application_instruction_materials TO service_role;
ALTER TABLE public.application_instruction_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view materials"
  ON public.application_instruction_materials FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert materials"
  ON public.application_instruction_materials FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update materials"
  ON public.application_instruction_materials FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete materials"
  ON public.application_instruction_materials FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_app_instr_materials_updated_at
  BEFORE UPDATE ON public.application_instruction_materials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.application_instruction_completions (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ,
  last_reminded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.application_instruction_completions TO authenticated;
GRANT ALL ON public.application_instruction_completions TO service_role;
ALTER TABLE public.application_instruction_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own completion"
  ON public.application_instruction_completions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all completions"
  ON public.application_instruction_completions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_app_instr_completions_updated_at
  BEFORE UPDATE ON public.application_instruction_completions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
