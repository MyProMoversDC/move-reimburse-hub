
-- Create knowledge_base_folders table
CREATE TABLE public.knowledge_base_folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.knowledge_base_folders ENABLE ROW LEVEL SECURITY;

-- Create knowledge_base_materials table
CREATE TABLE public.knowledge_base_materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  folder_id UUID NOT NULL REFERENCES public.knowledge_base_folders(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.knowledge_base_materials ENABLE ROW LEVEL SECURITY;

-- Create knowledge_base_folder_shares table
CREATE TABLE public.knowledge_base_folder_shares (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  folder_id UUID NOT NULL REFERENCES public.knowledge_base_folders(id) ON DELETE CASCADE,
  shared_role TEXT NOT NULL,
  shared_by UUID NOT NULL,
  shared_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(folder_id, shared_role)
);

ALTER TABLE public.knowledge_base_folder_shares ENABLE ROW LEVEL SECURITY;

-- RLS Policies for knowledge_base_folders
CREATE POLICY "Admins can manage all folders"
ON public.knowledge_base_folders
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view folders shared with their role"
ON public.knowledge_base_folders
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.knowledge_base_folder_shares fs
    JOIN public.user_roles ur ON ur.role::text = fs.shared_role
    WHERE fs.folder_id = knowledge_base_folders.id
    AND ur.user_id = auth.uid()
  )
);

-- RLS Policies for knowledge_base_materials
CREATE POLICY "Admins can manage all materials"
ON public.knowledge_base_materials
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view materials in shared folders"
ON public.knowledge_base_materials
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.knowledge_base_folder_shares fs
    JOIN public.user_roles ur ON ur.role::text = fs.shared_role
    WHERE fs.folder_id = knowledge_base_materials.folder_id
    AND ur.user_id = auth.uid()
  )
);

-- RLS Policies for knowledge_base_folder_shares
CREATE POLICY "Admins can manage all shares"
ON public.knowledge_base_folder_shares
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view shares for their role"
ON public.knowledge_base_folder_shares
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role::text = knowledge_base_folder_shares.shared_role
  )
);

-- Create storage bucket for knowledge base files
INSERT INTO storage.buckets (id, name, public) VALUES ('knowledge-base', 'knowledge-base', false);

-- Storage policies
CREATE POLICY "Admins can upload knowledge base files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'knowledge-base' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete knowledge base files"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'knowledge-base' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view knowledge base files"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'knowledge-base');

-- Trigger for updated_at
CREATE TRIGGER update_knowledge_base_folders_updated_at
BEFORE UPDATE ON public.knowledge_base_folders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
