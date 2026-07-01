
CREATE OR REPLACE FUNCTION public.admin_expand_event_capacity(
  _event_id uuid,
  _extra_seats int,
  _kind text DEFAULT 'attending'
) RETURNS TABLE(new_capacity int, new_waitlist_capacity int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _title text;
  _old_cap int;
  _old_wl int;
  _new_cap int;
  _new_wl int;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT (public.has_role(_uid, 'admin'::app_role) OR public.has_role(_uid, 'moderator'::app_role)) THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;
  IF _extra_seats IS NULL OR _extra_seats <= 0 THEN
    RAISE EXCEPTION 'extra_seats must be > 0';
  END IF;
  IF _kind NOT IN ('attending','waitlist') THEN
    RAISE EXCEPTION 'kind must be attending or waitlist';
  END IF;

  SELECT title, capacity, waitlist_capacity
    INTO _title, _old_cap, _old_wl
    FROM public.events WHERE id = _event_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  IF _kind = 'attending' THEN
    -- If capacity is NULL (unlimited) leave it alone
    IF _old_cap IS NULL THEN
      _new_cap := NULL;
    ELSE
      _new_cap := _old_cap + _extra_seats;
      UPDATE public.events SET capacity = _new_cap WHERE id = _event_id;
    END IF;
    _new_wl := _old_wl;
  ELSE
    _new_wl := COALESCE(_old_wl, 0) + _extra_seats;
    UPDATE public.events SET waitlist_capacity = _new_wl WHERE id = _event_id;
    _new_cap := _old_cap;
  END IF;

  PERFORM public.log_admin_change(
    'event_capacity_override',
    _event_id,
    COALESCE(_title, 'event'),
    jsonb_build_object(
      'kind', _kind,
      'extra_seats', _extra_seats,
      'old_capacity', _old_cap,
      'new_capacity', _new_cap,
      'old_waitlist_capacity', _old_wl,
      'new_waitlist_capacity', _new_wl
    )
  );

  RETURN QUERY SELECT _new_cap, _new_wl;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_expand_event_capacity(uuid, int, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_expand_event_capacity(uuid, int, text) TO authenticated, service_role;
