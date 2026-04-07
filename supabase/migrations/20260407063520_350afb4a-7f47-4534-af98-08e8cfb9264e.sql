
-- Make the resources bucket private
UPDATE storage.buckets SET public = false WHERE id = 'resources';

-- Drop any existing public SELECT policy
DROP POLICY IF EXISTS "Anyone can view resources files" ON storage.objects;

-- Create a restricted SELECT policy for authenticated users with proper roles
CREATE POLICY "Approved users can view resource files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'resources'
    AND (
      public.has_role(auth.uid(), 'approved') 
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'moderator')
      OR public.has_role(auth.uid(), 'guest')
    )
  );
