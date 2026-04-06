
-- 1. Add CHECK constraint on rsvps.guests_count
ALTER TABLE public.rsvps
  ADD CONSTRAINT rsvps_guests_count_range
  CHECK (guests_count >= 1 AND guests_count <= 10);

-- 2. Restrict venues SELECT to authenticated users only
DROP POLICY IF EXISTS "Members can view venues" ON public.venues;
CREATE POLICY "Authenticated users can view venues"
  ON public.venues
  FOR SELECT
  TO authenticated
  USING (true);
