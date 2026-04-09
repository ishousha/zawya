-- Fix the overly permissive families INSERT policy
-- Currently allows any authenticated user to create unlimited families
-- Restrict so users can only create families if they don't already belong to one
DROP POLICY "Authenticated users can create families" ON public.families;

CREATE POLICY "Authenticated users can create families"
  ON public.families
  FOR INSERT
  TO authenticated
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND family_id IS NOT NULL
    )
  );

-- Remove duplicate CHECK constraint on rsvps
ALTER TABLE public.rsvps DROP CONSTRAINT IF EXISTS rsvps_guests_count_check;