
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS mover_attribute text;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_mover_attribute_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_mover_attribute_check
  CHECK (mover_attribute IS NULL OR mover_attribute IN (
    'foreman','driver','helper','helper_k','foreman_driver'
  ));

CREATE TABLE IF NOT EXISTS public.mover_required_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  url text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.mover_required_documents TO authenticated;
GRANT ALL ON public.mover_required_documents TO service_role;

ALTER TABLE public.mover_required_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Required docs viewable by authenticated"
  ON public.mover_required_documents FOR SELECT TO authenticated USING (true);

CREATE POLICY "Required docs manageable by admin/hr"
  ON public.mover_required_documents FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.has_role(auth.uid(), 'hr_manager'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.has_role(auth.uid(), 'hr_manager'::app_role)
  );

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_mover_required_documents_updated_at ON public.mover_required_documents;
CREATE TRIGGER update_mover_required_documents_updated_at
BEFORE UPDATE ON public.mover_required_documents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.mover_required_documents (key, name, url, sort_order)
VALUES ('w9', 'W-9 Form', NULL, 1)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.mover_document_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.mover_required_documents(id) ON DELETE CASCADE,
  signed_at timestamptz NOT NULL DEFAULT now(),
  file_url text,
  marked_by uuid REFERENCES public.profiles(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, document_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mover_document_signatures TO authenticated;
GRANT ALL ON public.mover_document_signatures TO service_role;

ALTER TABLE public.mover_document_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signatures viewable by admin/hr or owner"
  ON public.mover_document_signatures FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() OR
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.has_role(auth.uid(), 'hr_manager'::app_role)
  );

CREATE POLICY "Signatures manageable by admin/hr"
  ON public.mover_document_signatures FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.has_role(auth.uid(), 'hr_manager'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.has_role(auth.uid(), 'hr_manager'::app_role)
  );

CREATE INDEX IF NOT EXISTS idx_mover_doc_sig_user ON public.mover_document_signatures(user_id);
CREATE INDEX IF NOT EXISTS idx_mover_doc_sig_doc ON public.mover_document_signatures(document_id);
