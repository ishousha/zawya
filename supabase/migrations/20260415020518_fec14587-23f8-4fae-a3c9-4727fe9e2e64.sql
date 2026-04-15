ALTER TABLE public.events
  ADD COLUMN recording_url text DEFAULT NULL,
  ADD COLUMN recording_passcode text DEFAULT NULL;