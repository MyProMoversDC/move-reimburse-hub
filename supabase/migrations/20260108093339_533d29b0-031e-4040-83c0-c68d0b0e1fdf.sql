-- Add title column to profiles if not exists
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS title TEXT;

-- Create emergency_contacts table
CREATE TABLE public.emergency_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  relationship TEXT,
  address TEXT,
  phone TEXT,
  phone_type TEXT DEFAULT 'mobile',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.emergency_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_contacts FORCE ROW LEVEL SECURITY;

-- Create RLS policies for emergency_contacts
-- HR managers can view all emergency contacts
CREATE POLICY "HR managers can view all emergency contacts"
ON public.emergency_contacts
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'hr_manager'));

-- HR managers can insert emergency contacts
CREATE POLICY "HR managers can insert emergency contacts"
ON public.emergency_contacts
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'hr_manager'));

-- HR managers can update emergency contacts
CREATE POLICY "HR managers can update emergency contacts"
ON public.emergency_contacts
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'hr_manager'));

-- Admins can view all emergency contacts
CREATE POLICY "Admins can view all emergency contacts"
ON public.emergency_contacts
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can insert emergency contacts
CREATE POLICY "Admins can insert emergency contacts"
ON public.emergency_contacts
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admins can update emergency contacts
CREATE POLICY "Admins can update emergency contacts"
ON public.emergency_contacts
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Users can view their own emergency contact
CREATE POLICY "Users can view own emergency contact"
ON public.emergency_contacts
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Create trigger for updating timestamps
CREATE TRIGGER update_emergency_contacts_updated_at
BEFORE UPDATE ON public.emergency_contacts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add phone_type column to profiles for consistency
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_type TEXT DEFAULT 'mobile';