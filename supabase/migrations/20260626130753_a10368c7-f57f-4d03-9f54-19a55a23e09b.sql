
CREATE TABLE public.admin_todo_dismissals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_type TEXT NOT NULL,
  item_id UUID NOT NULL,
  dismissed_by UUID NOT NULL,
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (item_type, item_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_todo_dismissals TO authenticated;
GRANT ALL ON public.admin_todo_dismissals TO service_role;

ALTER TABLE public.admin_todo_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view todo dismissals"
ON public.admin_todo_dismissals
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can create todo dismissals"
ON public.admin_todo_dismissals
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) AND dismissed_by = auth.uid());

CREATE POLICY "Admins can delete todo dismissals"
ON public.admin_todo_dismissals
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_admin_todo_dismissals_lookup ON public.admin_todo_dismissals (item_type, item_id);
