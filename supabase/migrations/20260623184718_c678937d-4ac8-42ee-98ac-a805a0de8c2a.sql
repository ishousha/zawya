CREATE OR REPLACE FUNCTION public.enforce_event_capacity_on_rsvp()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _capacity int;
  _host uuid;
  _current int;
  _old_contrib int := 0;
  _delta int;
  _remaining int;
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

  -- Current attending headcount excluding host and excluding this row
  SELECT COALESCE(SUM(r.guests_count), 0) INTO _current
  FROM public.rsvps r
  WHERE r.event_id = NEW.event_id
    AND r.status = 'attending'::rsvp_status
    AND COALESCE(r.is_waitlisted, false) = false
    AND (_host IS NULL OR r.user_id <> _host)
    AND r.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  -- Compute the *change* this write introduces. On UPDATE of a row that was
  -- previously counted toward capacity, the delta is the increase only.
  IF TG_OP = 'UPDATE'
     AND OLD.status = 'attending'::rsvp_status
     AND COALESCE(OLD.is_waitlisted, false) = false
     AND (_host IS NULL OR OLD.user_id <> _host) THEN
    _old_contrib := COALESCE(OLD.guests_count, 0);
  END IF;
  _delta := NEW.guests_count - _old_contrib;
  _remaining := GREATEST(0, _capacity - _current);

  IF _current + NEW.guests_count > _capacity THEN
    RAISE EXCEPTION
      'RSVP_CAPACITY_EXCEEDED: Adding % seat(s) would exceed capacity. Only % seat(s) left (% / % used). attempted=% current=% capacity=% remaining=%',
      _delta, _remaining, _current, _capacity, _delta, _current, _capacity, _remaining
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;