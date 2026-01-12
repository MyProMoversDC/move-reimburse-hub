-- Create storage bucket for driver licenses
INSERT INTO storage.buckets (id, name, public) 
VALUES ('driver-licenses', 'driver-licenses', true)
ON CONFLICT (id) DO NOTHING;

-- Create policies for driver licenses bucket
CREATE POLICY "Users can upload their own license images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'driver-licenses' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own license images" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'driver-licenses' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own license images" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'driver-licenses' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "License images are viewable by authenticated users" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'driver-licenses' AND auth.role() = 'authenticated');