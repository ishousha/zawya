CREATE OR REPLACE FUNCTION public.enforce_event_capacity_on_rsvp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _capacity int;
  _host uuid;
  _current int;
BEGIN
  -- Skip cancelled or waitlisted rows
  IF NEW.status = 'cancelled'::rsvp_status OR COALESCE(NEW.is_waitlisted, false) = true THEN
    RETURN NEW;
  END IF;

  SELECT capacity, host_id INTO _capacity, _host
  FROM public.events WHERE id = NEW.event_id;

  -- Unlimited capacity
  IF _capacity IS NULL THEN
    RETURN NEW;
  END IF;

  -- Hosts don't consume capacity
  IF _host IS NOT NULL AND NEW.user_id = _host THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(r.guests_count), 0) INTO _current
  FROM public.rsvps r
  WHERE r.event_id = NEW.event_id
    AND r.status = 'attending'::rsvp_status
    AND COALESCE(r.is_waitlisted, false) = false
    AND (_host IS NULL OR r.user_id <> _host)
    AND r.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  IF _current + NEW.guests_count > _capacity THEN
    RAISE EXCEPTION 'RSVP_CAPACITY_EXCEEDED: Adding % seat(s) would exceed capacity (% / %).',
      NEW.guests_count, _current, _capacity
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_event_capacity ON public.rsvps;
CREATE TRIGGER trg_enforce_event_capacity
BEFORE INSERT OR UPDATE ON public.rsvps
FOR EACH ROW
EXECUTE FUNCTION public.enforce_event_capacity_on_rsvp();