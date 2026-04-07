
-- Add family_id column to dependents
ALTER TABLE public.dependents
ADD COLUMN family_id uuid REFERENCES public.families(id) ON DELETE CASCADE;

-- Migrate existing data: copy family_id from the parent's profile
UPDATE public.dependents d
SET family_id = p.family_id
FROM public.profiles p
WHERE d.parent_id = p.id AND p.family_id IS NOT NULL;

-- Drop old RLS policy
DROP POLICY IF EXISTS "Parents can manage own dependents" ON public.dependents;

-- New RLS: family members can view dependents in their family
CREATE POLICY "Family members can view dependents"
  ON public.dependents FOR SELECT TO authenticated
  USING (
    family_id = (SELECT family_id FROM public.profiles WHERE id = auth.uid())
    OR parent_id = auth.uid()
  );

-- Family members can insert dependents for their family
CREATE POLICY "Family members can insert dependents"
  ON public.dependents FOR INSERT TO authenticated
  WITH CHECK (
    family_id = (SELECT family_id FROM public.profiles WHERE id = auth.uid())
    OR parent_id = auth.uid()
  );

-- Family members can update dependents in their family
CREATE POLICY "Family members can update dependents"
  ON public.dependents FOR UPDATE TO authenticated
  USING (
    family_id = (SELECT family_id FROM public.profiles WHERE id = auth.uid())
    OR parent_id = auth.uid()
  );

-- Family members can delete dependents in their family
CREATE POLICY "Family members can delete dependents"
  ON public.dependents FOR DELETE TO authenticated
  USING (
    family_id = (SELECT family_id FROM public.profiles WHERE id = auth.uid())
    OR parent_id = auth.uid()
  );

-- Admins can manage all dependents
CREATE POLICY "Admins can manage all dependents"
  ON public.dependents FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
