-- Create storage bucket for medical cards
INSERT INTO storage.buckets (id, name, public)
VALUES ('medical-cards', 'medical-cards', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload/update/delete their own medical card
CREATE POLICY "Users can upload their own medical card"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'medical-cards' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own medical card"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'medical-cards' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own medical card"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'medical-cards' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow authenticated users (HR/Admin) to view all medical cards
CREATE POLICY "Authenticated users can view medical cards"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'medical-cards');

-- Add medical_card_url column to user_driver_status table to store medical card info
ALTER TABLE public.user_driver_status 
ADD COLUMN IF NOT EXISTS medical_card_url text;