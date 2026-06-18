ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric,
  ADD COLUMN IF NOT EXISTS checkin_radius_meters integer NOT NULL DEFAULT 100;