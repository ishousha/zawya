
-- 1. Events: hide sensitive columns from client roles (admins use RPC get_event_admin_secrets / get_event_zoom_credentials)
REVOKE SELECT (checkin_pin, zoom_password, recording_passcode) ON public.events FROM anon, authenticated;

-- 2. Rsvps: hide qr_hash from clients. Owners get it via existing select policies are
--    still restricted because we revoke the column for all client roles. Owners scan
--    their own qr via the rsvp owner SELECT policy + new RPC below. Door scanner
--    (admin/moderator) uses new lookup RPC.
REVOKE SELECT (qr_hash) ON public.rsvps FROM anon, authenticated;

-- Host-safe RSVP listing (no qr_hash). Admins/moderators/host of event only.
CREATE OR REPLACE FUNCTION public.get_event_host_rsvps(_event_id uuid)
RETURNS TABLE(
  id uuid,
  user_id uuid,
  guests_count integer,
  attending_dependents jsonb,
  checked_in boolean,
  status rsvp_status,
  is_waitlisted boolean,
  created_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'moderator'::app_role)
    OR EXISTS (SELECT 1 FROM public.events WHERE id = _event_id AND host_id = auth.uid())
  ) THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT r.id, r.user_id, r.guests_count, r.attending_dependents,
         r.checked_in, r.status, r.is_waitlisted, r.created_at
  FROM public.rsvps r WHERE r.event_id = _event_id;
END;
$$;
REVOKE ALL ON FUNCTION public.get_event_host_rsvps(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_event_host_rsvps(uuid) TO authenticated;

-- Owner's own QR hash
CREATE OR REPLACE FUNCTION public.get_my_rsvp_qr(_rsvp_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT qr_hash FROM public.rsvps
  WHERE id = _rsvp_id AND user_id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.get_my_rsvp_qr(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_rsvp_qr(uuid) TO authenticated;

-- Admin/moderator lookup by QR for door scanner
CREATE OR REPLACE FUNCTION public.lookup_rsvp_by_qr(_qr_hash text)
RETURNS TABLE(
  id uuid,
  event_id uuid,
  user_id uuid,
  guests_count integer,
  attending_dependents jsonb,
  checked_in boolean,
  status rsvp_status
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'moderator'::app_role)
  ) THEN RETURN; END IF;
  RETURN QUERY
  SELECT r.id, r.event_id, r.user_id, r.guests_count, r.attending_dependents,
         r.checked_in, r.status
  FROM public.rsvps r WHERE r.qr_hash = _qr_hash;
END;
$$;
REVOKE ALL ON FUNCTION public.lookup_rsvp_by_qr(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lookup_rsvp_by_qr(text) TO authenticated;

-- 3. Mureed-only enforcement on rsvps (trigger-based, mirrors enforce_event_gender_audience)
CREATE OR REPLACE FUNCTION public.enforce_event_mureed_audience()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _mureeds_only boolean;
  _is_mureed boolean;
BEGIN
  IF auth.role() = 'service_role' THEN RETURN NEW; END IF;
  IF auth.uid() IS NOT NULL AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'moderator'::app_role)
  ) THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.event_id = OLD.event_id AND NEW.user_id = OLD.user_id THEN
    RETURN NEW;
  END IF;

  SELECT mureeds_only INTO _mureeds_only FROM public.events WHERE id = NEW.event_id;
  IF NOT COALESCE(_mureeds_only, false) THEN RETURN NEW; END IF;

  SELECT is_mureed INTO _is_mureed FROM public.profiles WHERE id = NEW.user_id;
  IF NOT COALESCE(_is_mureed, false) THEN
    RAISE EXCEPTION 'This event is restricted to mureeds only.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_event_mureed_audience_trg ON public.rsvps;
CREATE TRIGGER enforce_event_mureed_audience_trg
BEFORE INSERT OR UPDATE ON public.rsvps
FOR EACH ROW EXECUTE FUNCTION public.enforce_event_mureed_audience();

-- 4. Dependents: tighten DELETE policy. Parent_id branch must require a non-null family_id match too.
DROP POLICY IF EXISTS "Family members can delete dependents" ON public.dependents;
CREATE POLICY "Family members can delete dependents"
ON public.dependents FOR DELETE
USING (
  family_id IS NOT NULL
  AND family_id = (SELECT family_id FROM public.profiles WHERE id = auth.uid())
);

-- 5. event_reminders_sent: explicit deny for authenticated writes (service role bypasses RLS)
DROP POLICY IF EXISTS "Block authenticated writes" ON public.event_reminders_sent;
CREATE POLICY "Block authenticated writes"
ON public.event_reminders_sent
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

-- Same for guest_list_reminders_sent for consistency
DROP POLICY IF EXISTS "Block authenticated writes" ON public.guest_list_reminders_sent;
CREATE POLICY "Block authenticated writes"
ON public.guest_list_reminders_sent
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

-- 6. Lock down SECURITY DEFINER trigger functions from anon/public execute
REVOKE EXECUTE ON FUNCTION public.cancel_mismatched_rsvps_on_audience_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_user_role_from_profile() FROM PUBLIC, anon, authenticated;
