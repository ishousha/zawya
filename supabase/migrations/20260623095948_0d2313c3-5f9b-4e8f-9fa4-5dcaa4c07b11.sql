
CREATE POLICY "Authenticated can read resource covers"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'resource-covers');

CREATE POLICY "Admins can insert resource covers"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'resource-covers'
  AND (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'moderator'::app_role))
);

CREATE POLICY "Admins can update resource covers"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'resource-covers'
  AND (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'moderator'::app_role))
);

CREATE POLICY "Admins can delete resource covers"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'resource-covers'
  AND (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'moderator'::app_role))
);
