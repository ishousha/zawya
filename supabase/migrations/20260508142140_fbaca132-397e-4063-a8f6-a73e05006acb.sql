-- Normalize a user-supplied short code: trim, replace spaces with -,
-- strip non [A-Za-z0-9_-], collapse repeated dashes, enforce 3..32 chars.
CREATE OR REPLACE FUNCTION public.normalize_event_short_code(_raw text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  _v text;
BEGIN
  IF _raw IS NULL THEN RETURN NULL; END IF;
  _v := btrim(_raw);
  IF _v = '' THEN RETURN NULL; END IF;
  _v := regexp_replace(_v, '\s+', '-', 'g');
  _v := regexp_replace(_v, '[^A-Za-z0-9_-]', '', 'g');
  _v := regexp_replace(_v, '-{2,}', '-', 'g');
  _v := btrim(_v, '-');
  IF _v = '' OR length(_v) < 3 THEN RETURN NULL; END IF;
  IF length(_v) > 32 THEN _v := substr(_v, 1, 32); END IF;
  RETURN _v;
END;
$$;

-- If desired is free, return it; otherwise append -2, -3, ... up to -99,
-- then fall back to gen_event_short_code(). Excludes _self_id from collisions.
CREATE OR REPLACE FUNCTION public.next_unique_short_code(_desired text, _self_id uuid)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $$
DECLARE
  _candidate text;
  _i int := 2;
  _exists boolean;
BEGIN
  IF _desired IS NULL THEN RETURN gen_event_short_code(); END IF;

  _candidate := _desired;
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM public.events
      WHERE short_code = _candidate
        AND (_self_id IS NULL OR id <> _self_id)
    ) INTO _exists;
    EXIT WHEN NOT _exists;

    IF _i > 99 THEN
      RETURN gen_event_short_code();
    END IF;
    _candidate := _desired || '-' || _i::text;
    _i := _i + 1;
  END LOOP;

  RETURN _candidate;
END;
$$;

-- Replace trigger function to handle both random + admin-supplied codes
CREATE OR REPLACE FUNCTION public.set_event_short_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _norm text;
BEGIN
  _norm := normalize_event_short_code(NEW.short_code);

  -- On UPDATE: if normalized desired equals what's already saved, no change
  IF TG_OP = 'UPDATE' AND _norm IS NOT NULL AND _norm = OLD.short_code THEN
    NEW.short_code := OLD.short_code;
    RETURN NEW;
  END IF;

  IF _norm IS NULL THEN
    -- No usable input; on UPDATE keep existing, on INSERT generate random
    IF TG_OP = 'UPDATE' THEN
      NEW.short_code := OLD.short_code;
    ELSE
      NEW.short_code := gen_event_short_code();
    END IF;
  ELSE
    NEW.short_code := next_unique_short_code(_norm, NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

-- Recreate trigger so it also fires on UPDATE
DROP TRIGGER IF EXISTS trg_events_set_short_code ON public.events;
CREATE TRIGGER trg_events_set_short_code
BEFORE INSERT OR UPDATE OF short_code ON public.events
FOR EACH ROW EXECUTE FUNCTION public.set_event_short_code();
