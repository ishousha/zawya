CREATE OR REPLACE FUNCTION public.enforce_event_gender_audience()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _audience text;
  _gender text;
BEGIN
  -- Allow service role and admins/moderators to bypass
  IF auth.role() = 'service_role' THEN RETURN NEW; END IF;
  IF auth.uid() IS NOT NULL AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role)) THEN
    RETURN NEW;
  END IF;

  -- Only enforce on INSERT, or on UPDATE if event/user changes
  IF TG_OP = 'UPDATE' AND NEW.event_id = OLD.event_id AND NEW.user_id = OLD.user_id THEN
    RETURN NEW;
  END IF;

  SELECT audience_gender INTO _audience FROM events WHERE id = NEW.event_id;
  IF _audience IS NULL OR _audience = 'Everyone' THEN
    RETURN NEW;
  END IF;

  SELECT gender INTO _gender FROM profiles WHERE id = NEW.user_id;

  IF _audience = 'Brothers Only' AND _gender IS DISTINCT FROM 'male' THEN
    RAISE EXCEPTION 'This event is restricted to brothers only.' USING ERRCODE = 'check_violation';
  ELSIF _audience = 'Sisters Only' AND _gender IS DISTINCT FROM 'female' THEN
    RAISE EXCEPTION 'This event is restricted to sisters only.' USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rsvps_enforce_gender_audience ON public.rsvps;
CREATE TRIGGER rsvps_enforce_gender_audience
  BEFORE INSERT OR UPDATE ON public.rsvps
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_event_gender_audience();