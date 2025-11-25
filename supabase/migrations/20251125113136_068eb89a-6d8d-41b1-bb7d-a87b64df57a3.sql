-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'accountant', 'mover');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Create reimbursement status enum
CREATE TYPE public.reimbursement_status AS ENUM ('pending', 'confirmed', 'paid');

-- Create reimbursements table with auto-incrementing number
CREATE TABLE public.reimbursements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reimbursement_number SERIAL UNIQUE NOT NULL,
  mover_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mover_full_name TEXT NOT NULL,
  job_number TEXT NOT NULL,
  truck_number TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  gas_expenses DECIMAL(10,2) DEFAULT 0,
  road_expenses DECIMAL(10,2) DEFAULT 0,
  hotel_expenses DECIMAL(10,2) DEFAULT 0,
  other_expenses DECIMAL(10,2) DEFAULT 0,
  total_expenses DECIMAL(10,2) NOT NULL,
  zelle_info TEXT NOT NULL,
  status reimbursement_status DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ
);

ALTER TABLE public.reimbursements ENABLE ROW LEVEL SECURITY;

-- Create reimbursement_attachments table for pictures
CREATE TABLE public.reimbursement_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reimbursement_id UUID NOT NULL REFERENCES public.reimbursements(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.reimbursement_attachments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- RLS Policies for user_roles
CREATE POLICY "Anyone can view user roles"
  ON public.user_roles FOR SELECT
  USING (true);

CREATE POLICY "System can insert user roles"
  ON public.user_roles FOR INSERT
  WITH CHECK (true);

-- RLS Policies for reimbursements
CREATE POLICY "Movers can view their own reimbursements"
  ON public.reimbursements FOR SELECT
  USING (auth.uid() = mover_id);

CREATE POLICY "Admins can view all reimbursements"
  ON public.reimbursements FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Accountants can view all reimbursements"
  ON public.reimbursements FOR SELECT
  USING (public.has_role(auth.uid(), 'accountant'));

CREATE POLICY "Movers can insert their own reimbursements"
  ON public.reimbursements FOR INSERT
  WITH CHECK (auth.uid() = mover_id);

CREATE POLICY "Admins can update reimbursements"
  ON public.reimbursements FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Accountants can update reimbursements"
  ON public.reimbursements FOR UPDATE
  USING (public.has_role(auth.uid(), 'accountant'));

-- RLS Policies for attachments
CREATE POLICY "Users can view attachments for their reimbursements"
  ON public.reimbursement_attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.reimbursements
      WHERE id = reimbursement_attachments.reimbursement_id
      AND mover_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all attachments"
  ON public.reimbursement_attachments FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Accountants can view all attachments"
  ON public.reimbursement_attachments FOR SELECT
  USING (public.has_role(auth.uid(), 'accountant'));

CREATE POLICY "Users can insert attachments for their reimbursements"
  ON public.reimbursement_attachments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.reimbursements
      WHERE id = reimbursement_attachments.reimbursement_id
      AND mover_id = auth.uid()
    )
  );

-- Create trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, first_name, last_name, email, phone)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'username', new.email),
    COALESCE(new.raw_user_meta_data->>'first_name', ''),
    COALESCE(new.raw_user_meta_data->>'last_name', ''),
    new.email,
    COALESCE(new.raw_user_meta_data->>'phone', '')
  );
  
  -- Assign mover role by default
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'mover');
  
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Insert admin and accountant users
-- Admin: adminmpm / rempm!@#2025
-- Accountant: accountingmpm / accrempm!@#2025
-- Note: These will be created through the app's signup flow and then roles will be assigned manually