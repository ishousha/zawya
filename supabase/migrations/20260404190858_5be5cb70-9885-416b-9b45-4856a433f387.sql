
ALTER TABLE public.rsvps
  ADD COLUMN IF NOT EXISTS is_waitlisted boolean NOT NULL DEFAULT false;
