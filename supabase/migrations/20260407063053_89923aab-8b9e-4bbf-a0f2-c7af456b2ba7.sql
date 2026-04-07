
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rsvps_guests_count_range'
  ) THEN
    ALTER TABLE public.rsvps
      ADD CONSTRAINT rsvps_guests_count_range
      CHECK (guests_count >= 1 AND guests_count <= 10);
  END IF;
END $$;
