CREATE POLICY "Anyone can view invite by token"
  ON public.family_invites FOR SELECT TO authenticated
  USING (true);

-- Drop the narrower family-only select policy since this one covers it
DROP POLICY IF EXISTS "Users can view own family invites" ON public.family_invites;