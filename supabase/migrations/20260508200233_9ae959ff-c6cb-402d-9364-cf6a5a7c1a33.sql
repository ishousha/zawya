CREATE OR REPLACE FUNCTION public.cancel_mismatched_rsvps_on_audience_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _required_gender text;
  _affected RECORD;
BEGIN
  IF NEW.audience_gender IS NOT DISTINCT FROM OLD.audience_gender THEN
    RETURN NEW;
  END IF;
  IF NEW.audience_gender NOT IN ('Brothers Only', 'Sisters Only') THEN
    RETURN NEW;
  END IF;

  _required_gender := CASE WHEN NEW.audience_gender = 'Brothers Only' THEN 'male' ELSE 'female' END;

  FOR _affected IN
    SELECT r.id AS rsvp_id, r.user_id
    FROM public.rsvps r
    JOIN public.profiles p ON p.id = r.user_id
    WHERE r.event_id = NEW.id
      AND r.status <> 'cancelled'::rsvp_status
      AND (p.gender IS NULL OR p.gender IS DISTINCT FROM _required_gender)
  LOOP
    UPDATE public.rsvps
    SET status = 'cancelled'::rsvp_status, is_waitlisted = false
    WHERE id = _affected.rsvp_id;

    INSERT INTO public.notifications (user_id, title, message, type, metadata)
    VALUES (
      _affected.user_id,
      'RSVP Cancelled',
      'Your RSVP for "' || NEW.title || '" was cancelled because the event is now restricted to ' || NEW.audience_gender || '.',
      'rsvp',
      jsonb_build_object('event_id', NEW.id, 'reason', 'audience_gender_change')
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS events_cancel_mismatched_rsvps ON public.events;
CREATE TRIGGER events_cancel_mismatched_rsvps
AFTER UPDATE OF audience_gender ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.cancel_mismatched_rsvps_on_audience_change();