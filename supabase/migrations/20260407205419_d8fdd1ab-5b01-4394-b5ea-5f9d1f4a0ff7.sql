
-- Fix families: remove duplicate overly-permissive INSERT policies
DROP POLICY IF EXISTS "Allow authenticated users to create families" ON public.families;
DROP POLICY IF EXISTS "Users can create families" ON public.families;

-- Replace with a properly scoped INSERT policy
CREATE POLICY "Approved users can create families" ON public.families
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'approved') 
    OR has_role(auth.uid(), 'admin') 
    OR has_role(auth.uid(), 'moderator')
    OR has_role(auth.uid(), 'guest')
  );

-- Fix profiles: remove duplicate UPDATE policy
DROP POLICY IF EXISTS "Allow users to update their own profile" ON public.profiles;
