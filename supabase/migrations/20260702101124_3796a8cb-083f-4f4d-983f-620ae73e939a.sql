
-- Count approved guests toward event capacity, and enforce capacity on approval.

CREATE OR REPLACE FUNCTION public.get_event_rsvp_counts(_event_id uuid)
 RETURNS TABLE(attending_count integer, attending_rsvp_count integer, waitlisted_count integer, checked_in_count integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH allowed AS (
    SELECT e.id, e.host_id FROM public.events e
    WHERE e.id = _event_id
      AND (
        public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'moderator'::app_role)
        OR e.host_id = auth.uid()
        OR (e.published = true AND public.has_role(auth.uid(), 'approved'::app_role))
        OR (e.published = true AND public.has_role(auth.uid(), 'guest'::app_role) AND public.guest_has_rsvp(auth.uid(), e.id))
      )
  ),
  rsvp_counts AS (
    SELECT
      COALESCE(SUM(
        CASE WHEN r.status = 'attending' AND (a.host_id IS NULL OR r.user_id <> a.host_id)
             THEN r.guests_count ELSE 0 END
      ), 0)::int AS att,
      COALESCE(SUM(
        CASE WHEN r.status = 'attending' AND (a.host_id IS NULL OR r.user_id <> a.host_id)
             THEN 1 ELSE 0 END
      ), 0)::int AS att_rsvp,
      COALESCE(SUM(CASE WHEN r.status = 'waitlisted' THEN 1 ELSE 0 END), 0)::int AS wait,
      COALESCE(SUM(
        CASE WHEN r.status = 'attending' AND r.checked_in
                  AND (a.host_id IS NULL OR r.user_id <> a.host_id)
             THEN r.guests_count ELSE 0 END
      ), 0)::int AS chk
    FROM allowed a
    LEFT JOIN public.rsvps r ON r.event_id = a.id
  ),
  guest_counts AS (
    SELECT COALESCE(COUNT(*), 0)::int AS approved_guests
    FROM allowed a
    LEFT JOIN public.guest_requests g
      ON g.event_id = a.id AND g.status = 'approved'
    WHERE g.id IS NOT NULL
  )
  SELECT
    (rc.att + gc.approved_guests)::int AS attending_count,
    rc.att_rsvp AS attending_rsvp_count,
    rc.wait AS waitlisted_count,
    rc.chk AS checked_in_count
  FROM rsvp_counts rc CROSS JOIN guest_counts gc;
$function$;


CREATE OR REPLACE FUNCTION public.enforce_event_capacity_on_guest_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _capacity int;
  _host uuid;
  _rsvp_seats int;
  _approved_guests int;
  _current int;
  _remaining int;
BEGIN
  -- Only enforce when the row is (becoming) approved
  IF NEW.status IS DISTINCT FROM 'approved'::guest_request_status THEN
    RETURN NEW;
  END IF;

  -- Skip if UPDATE didn't change status into 'approved'
  IF TG_OP = 'UPDATE'
     AND OLD.status = 'approved'::guest_request_status
     AND NEW.status = 'approved'::guest_request_status THEN
    RETURN NEW;
  END IF;

  SELECT capacity, host_id INTO _capacity, _host
  FROM public.events WHERE id = NEW.event_id;

  IF _capacity IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(r.guests_count), 0) INTO _rsvp_seats
  FROM public.rsvps r
  WHERE r.event_id = NEW.event_id
    AND r.status = 'attending'::rsvp_status
    AND COALESCE(r.is_waitlisted, false) = false
    AND (_host IS NULL OR r.user_id <> _host);

  SELECT COUNT(*) INTO _approved_guests
  FROM public.guest_requests g
  WHERE g.event_id = NEW.event_id
    AND g.status = 'approved'::guest_request_status
    AND g.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  _current := _rsvp_seats + _approved_guests;
  _remaining := GREATEST(0, _capacity - _current);

  IF _current + 1 > _capacity THEN
    RAISE EXCEPTION
      'GUEST_CAPACITY_EXCEEDED: Approving this guest would exceed capacity. Only % seat(s) left (% / % used). attempted=1 current=% capacity=% remaining=%',
      _remaining, _current, _capacity, _current, _capacity, _remaining
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_enforce_event_capacity_on_guest_approval ON public.guest_requests;
CREATE TRIGGER trg_enforce_event_capacity_on_guest_approval
  BEFORE INSERT OR UPDATE ON public.guest_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_event_capacity_on_guest_approval();
