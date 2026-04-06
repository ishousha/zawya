
-- 1. Add family_id column to profiles first
ALTER TABLE public.profiles
  ADD COLUMN family_id uuid;

-- 2. Create families table
CREATE TABLE public.families (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 3. Add FK constraint now that both table and column exist
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_family_id_fkey
  FOREIGN KEY (family_id) REFERENCES public.families(id) ON DELETE SET NULL;

-- 4. RLS on families
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own family"
  ON public.families FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.family_id = families.id
        AND profiles.id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage families"
  ON public.families FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 5. Allow users to view profiles sharing the same family_id
CREATE POLICY "Users can view family members profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    family_id IS NOT NULL
    AND family_id IN (
      SELECT p.family_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  );
