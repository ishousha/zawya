ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS default_host_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS venues_default_host_id_idx
  ON public.venues(default_host_id);

CREATE OR REPLACE FUNCTION public.log_venue_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _changed jsonb := '{}'::jsonb; _f text; _fields text[] := ARRAY['name','address','area_hint','maps_url','default_host_id'];
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_admin_change('venue_create', NEW.id, NEW.name,
      jsonb_build_object('address', NEW.address, 'default_host_id', NEW.default_host_id));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.log_admin_change('venue_delete', OLD.id, OLD.name,
      jsonb_build_object('address', OLD.address));
    RETURN OLD;
  ELSE
    FOREACH _f IN ARRAY _fields LOOP
      IF (to_jsonb(OLD) -> _f) IS DISTINCT FROM (to_jsonb(NEW) -> _f) THEN
        _changed := _changed || jsonb_build_object(_f,
          jsonb_build_object('from', to_jsonb(OLD) -> _f, 'to', to_jsonb(NEW) -> _f));
      END IF;
    END LOOP;
    IF _changed <> '{}'::jsonb THEN
      PERFORM public.log_admin_change('venue_update', NEW.id, NEW.name,
        jsonb_build_object('changed', _changed));
    END IF;
    RETURN NEW;
  END IF;
END;
$function$;