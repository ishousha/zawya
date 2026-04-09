
-- Drop and recreate the UPDATE policy with proper WITH CHECK
DROP POLICY IF EXISTS "Admins can update speaker photos" ON storage.objects;
CREATE POLICY "Admins can update speaker photos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = 'speakers'
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role))
)
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = 'speakers'
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role))
);

-- Also fix the INSERT policy to use has_role() consistently
DROP POLICY IF EXISTS "Admins can upload speaker photos" ON storage.objects;
CREATE POLICY "Admins can upload speaker photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = 'speakers'
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role))
);

-- Fix DELETE policy too
DROP POLICY IF EXISTS "Admins can delete speaker photos" ON storage.objects;
CREATE POLICY "Admins can delete speaker photos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = 'speakers'
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role))
);
