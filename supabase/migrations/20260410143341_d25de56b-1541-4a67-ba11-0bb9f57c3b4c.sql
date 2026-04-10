
-- Server-side PIN verification function (prevents exposing checkin_pin to regular users)
CREATE OR REPLACE FUNCTION public.verify_checkin_pin(_event_id uuid, _pin text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM events
    WHERE id = _event_id
      AND checkin_pin = _pin
  );
$$;
