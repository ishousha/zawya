
-- 1. Add admin-only INSERT policy for activity log
CREATE POLICY "Admins can insert activity log" ON public.admin_activity_log
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin') AND auth.uid() = actor_id);

-- 2. Fix avatars storage policies to match flat naming (userId.ext not userId/file)
DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;

CREATE POLICY "Users can upload own avatar" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND name ~ ('^' || auth.uid()::text || '\.'));

CREATE POLICY "Users can update own avatar" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND name ~ ('^' || auth.uid()::text || '\.'));

CREATE POLICY "Users can delete own avatar" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND name ~ ('^' || auth.uid()::text || '\.'));
