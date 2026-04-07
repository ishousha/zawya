
-- Create resources table
CREATE TABLE public.resources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  file_name TEXT,
  file_size BIGINT,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can manage resources"
  ON public.resources FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Moderators can manage resources
CREATE POLICY "Moderators can manage resources"
  ON public.resources FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'moderator'::app_role));

-- Approved users can view resources
CREATE POLICY "Approved users can view resources"
  ON public.resources FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'approved'::app_role));

-- Guests can view resources
CREATE POLICY "Guests can view resources"
  ON public.resources FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'guest'::app_role));

-- Storage policies for the resources bucket
CREATE POLICY "Admins can upload resources"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'resources' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Moderators can upload resources"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'resources' AND has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Anyone can view resources files"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'resources');

CREATE POLICY "Admins can delete resource files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'resources' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Moderators can delete resource files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'resources' AND has_role(auth.uid(), 'moderator'::app_role));
