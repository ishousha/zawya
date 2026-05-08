
-- 1. Gated RPC: zoom credentials for RSVP'd users
CREATE OR REPLACE FUNCTION public.get_event_zoom_credentials(_event_id uuid)
RETURNS TABLE(zoom_password text, recording_passcode text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _has_rsvp boolean;
  _is_past boolean;
  _zoom text;
  _rec text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM rsvps
    WHERE event_id = _event_id
      AND user_id = auth.uid()
      AND status <> 'cancelled'::rsvp_status
  ) INTO _has_rsvp;

  IF NOT _has_rsvp AND NOT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role)) THEN
    RETURN;
  END IF;

  SELECT
    e.zoom_password,
    e.recording_passcode,
    (COALESCE(e.end_date_time, e.date_time + interval '6 hours') < now())
  INTO _zoom, _rec, _is_past
  FROM events e WHERE e.id = _event_id;

  RETURN QUERY SELECT
    _zoom,
    CASE WHEN _is_past OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role) THEN _rec ELSE NULL END;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_event_zoom_credentials(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_event_zoom_credentials(uuid) TO authenticated;

-- 2. Admin/moderator/host RPC for all event secrets (used by admin UIs)
CREATE OR REPLACE FUNCTION public.get_event_admin_secrets(_event_id uuid)
RETURNS TABLE(zoom_password text, recording_passcode text, checkin_pin text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  IF NOT (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'moderator'::app_role)
    OR EXISTS (SELECT 1 FROM events WHERE id = _event_id AND host_id = auth.uid())
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT e.zoom_password, e.recording_passcode, e.checkin_pin
  FROM events e WHERE e.id = _event_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_event_admin_secrets(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_event_admin_secrets(uuid) TO authenticated;

-- 3. Replace host profile policy with limited-column RPC
DROP POLICY IF EXISTS "Hosts can view profiles of rsvpd users" ON public.profiles;

CREATE OR REPLACE FUNCTION public.get_event_attendee_profiles(_event_id uuid)
RETURNS TABLE(id uuid, name text, family_name text, avatar_url text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  IF NOT (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'moderator'::app_role)
    OR EXISTS (SELECT 1 FROM events WHERE id = _event_id AND host_id = auth.uid())
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT p.id, p.name, p.family_name, p.avatar_url
  FROM profiles p
  WHERE p.id IN (
    SELECT r.user_id FROM rsvps r WHERE r.event_id = _event_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_event_attendee_profiles(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_event_attendee_profiles(uuid) TO authenticated;

-- 4. Harden dependents INSERT/UPDATE policies
DROP POLICY IF EXISTS "Family members can insert dependents" ON public.dependents;
DROP POLICY IF EXISTS "Family members can update dependents" ON public.dependents;

CREATE POLICY "Family members can insert dependents"
ON public.dependents
FOR INSERT
TO authenticated
WITH CHECK (
  family_id IS NOT NULL
  AND family_id = (SELECT p.family_id FROM profiles p WHERE p.id = auth.uid())
);

CREATE POLICY "Family members can update dependents"
ON public.dependents
FOR UPDATE
TO authenticated
USING (
  family_id IS NOT NULL
  AND family_id = (SELECT p.family_id FROM profiles p WHERE p.id = auth.uid())
)
WITH CHECK (
  family_id IS NOT NULL
  AND family_id = (SELECT p.family_id FROM profiles p WHERE p.id = auth.uid())
);
