
DROP POLICY IF EXISTS "Approved users can create families" ON public.families;

CREATE POLICY "Authenticated users can create families"
ON public.families
FOR INSERT
TO authenticated
WITH CHECK (true);
