
ALTER TABLE public.resources ADD COLUMN IF NOT EXISTS short_code text UNIQUE;

CREATE OR REPLACE FUNCTION public.gen_resource_short_code()
RETURNS text LANGUAGE plpgsql SET search_path TO 'public' AS $$
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
    SELECT EXISTS (SELECT 1 FROM public.resources WHERE short_code = _code) INTO _exists;
    EXIT WHEN NOT _exists;
  END LOOP;
  RETURN _code;
END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_resource_short_code(_raw text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public' AS $$
DECLARE _v text;
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

CREATE OR REPLACE FUNCTION public.next_unique_resource_short_code(_desired text, _self_id uuid)
RETURNS text LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE
  _candidate text; _i int := 2; _exists boolean;
BEGIN
  IF _desired IS NULL THEN RETURN gen_resource_short_code(); END IF;
  _candidate := _desired;
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM public.resources
      WHERE short_code = _candidate
        AND (_self_id IS NULL OR id <> _self_id)
    ) INTO _exists;
    EXIT WHEN NOT _exists;
    IF _i > 99 THEN RETURN gen_resource_short_code(); END IF;
    _candidate := _desired || '-' || _i::text;
    _i := _i + 1;
  END LOOP;
  RETURN _candidate;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_resource_short_code()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE _norm text;
BEGIN
  _norm := normalize_resource_short_code(NEW.short_code);
  IF TG_OP = 'UPDATE' AND _norm IS NOT NULL AND _norm = OLD.short_code THEN
    NEW.short_code := OLD.short_code;
    RETURN NEW;
  END IF;
  IF _norm IS NULL THEN
    IF TG_OP = 'UPDATE' THEN
      NEW.short_code := OLD.short_code;
    ELSE
      NEW.short_code := gen_resource_short_code();
    END IF;
  ELSE
    NEW.short_code := next_unique_resource_short_code(_norm, NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_resource_short_code ON public.resources;
CREATE TRIGGER trg_set_resource_short_code
BEFORE INSERT OR UPDATE OF short_code ON public.resources
FOR EACH ROW EXECUTE FUNCTION public.set_resource_short_code();

-- Backfill short codes for existing rows
UPDATE public.resources SET short_code = NULL WHERE short_code IS NULL;
-- Trigger only fires on the listed column update; force generation:
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.resources WHERE short_code IS NULL LOOP
    UPDATE public.resources SET short_code = gen_resource_short_code() WHERE id = r.id;
  END LOOP;
END $$;
