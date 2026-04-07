
-- 1. Fix admin_activity_log: restrict INSERT to service_role only
DROP POLICY IF EXISTS "Authenticated users can insert activity log" ON public.admin_activity_log;

-- 2. Fix family_invites: restrict SELECT so tokens aren't enumerable
DROP POLICY IF EXISTS "Anyone can view invite by token" ON public.family_invites;

-- Users can view invites for their own family only
CREATE POLICY "Users can view own family invites" ON public.family_invites
  FOR SELECT TO authenticated
  USING (
    family_id = get_my_family_id()
    OR has_role(auth.uid(), 'admin')
  );

-- 3. Remove profiles from realtime publication
ALTER PUBLICATION supabase_realtime DROP TABLE public.profiles;

-- 4. Add avatars storage policies
CREATE POLICY "Users can upload own avatar" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update own avatar" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own avatar" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Anyone can view avatars" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'avatars');
