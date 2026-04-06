-- Allow any authenticated user to create a family
CREATE POLICY "Users can create families"
ON public.families
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow family members to update their family name
CREATE POLICY "Family members can update own family"
ON public.families
FOR UPDATE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.family_id = families.id
    AND profiles.id = auth.uid()
));

-- Allow family members to delete their family
CREATE POLICY "Family members can delete own family"
ON public.families
FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.family_id = families.id
    AND profiles.id = auth.uid()
));