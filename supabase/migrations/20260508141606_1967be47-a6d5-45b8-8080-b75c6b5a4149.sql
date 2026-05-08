-- Add short_code column to events
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS short_code TEXT UNIQUE;

-- Generator function: 6 chars, unambiguous alphabet
CREATE OR REPLACE FUNCTION public.gen_event_short_code()
RETURNS TEXT
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $$
DECLARE
  _alphabet TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  _len INT := length(_alphabet);
  _code TEXT;
  _i INT;
  _exists BOOLEAN;
BEGIN
  LOOP
    _code := '';
    FOR _i IN 1..6 LOOP
      _code := _code || substr(_alphabet, 1 + floor(random() * _len)::int, 1);
    END LOOP;
    SELECT EXISTS (SELECT 1 FROM public.events WHERE short_code = _code) INTO _exists;
    EXIT WHEN NOT _exists;
  END LOOP;
  RETURN _code;
END;
$$;

-- Trigger to auto-assign on insert
CREATE OR REPLACE FUNCTION public.set_event_short_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.short_code IS NULL THEN
    NEW.short_code := public.gen_event_short_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_events_set_short_code ON public.events;
CREATE TRIGGER trg_events_set_short_code
BEFORE INSERT ON public.events
FOR EACH ROW EXECUTE FUNCTION public.set_event_short_code();

-- Backfill existing events
DO $$
DECLARE _r RECORD;
BEGIN
  FOR _r IN SELECT id FROM public.events WHERE short_code IS NULL LOOP
    UPDATE public.events SET short_code = public.gen_event_short_code() WHERE id = _r.id;
  END LOOP;
END $$;

-- Enforce NOT NULL after backfill
ALTER TABLE public.events ALTER COLUMN short_code SET NOT NULL;

-- Index (UNIQUE constraint already creates one, but ensure it exists)
CREATE INDEX IF NOT EXISTS idx_events_short_code ON public.events(short_code);
