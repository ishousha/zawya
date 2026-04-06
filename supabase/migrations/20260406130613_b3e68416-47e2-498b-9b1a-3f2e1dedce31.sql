-- Fix infinite recursion: replace the family-member SELECT policy
-- with one that uses a SECURITY DEFINER function to avoid re-evaluating RLS

CREATE OR REPLACE FUNCTION public.get_my_family_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT family_id FROM profiles WHERE id = auth.uid()
$$;

-- Drop the recursive policy
DROP POLICY IF EXISTS "Users can view family members profiles" ON public.profiles;

-- Recreate using the safe function
CREATE POLICY "Users can view family members profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    family_id IS NOT NULL
    AND family_id = get_my_family_id()
  );