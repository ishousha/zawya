CREATE OR REPLACE FUNCTION public.get_event_rsvp_counts(_event_id uuid)
RETURNS TABLE(attending_count int, attending_rsvp_count int, waitlisted_count int, checked_in_count int)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH allowed AS (
    SELECT e.id FROM public.events e
    WHERE e.id = _event_id
      AND (
        public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'moderator'::app_role)
        OR e.host_id = auth.uid()
        OR (e.published = true AND public.has_role(auth.uid(), 'approved'::app_role))
        OR (e.published = true AND public.has_role(auth.uid(), 'guest'::app_role) AND public.guest_has_rsvp(auth.uid(), e.id))
      )
  )
  SELECT
    COALESCE(SUM(CASE WHEN r.status = 'attending' THEN r.guests_count ELSE 0 END), 0)::int,
    COALESCE(SUM(CASE WHEN r.status = 'attending' THEN 1 ELSE 0 END), 0)::int,
    COALESCE(SUM(CASE WHEN r.status = 'waitlisted' THEN 1 ELSE 0 END), 0)::int,
    COALESCE(SUM(CASE WHEN r.status = 'attending' AND r.checked_in THEN r.guests_count ELSE 0 END), 0)::int
  FROM allowed a
  LEFT JOIN public.rsvps r ON r.event_id = a.id;
$$;

GRANT EXECUTE ON FUNCTION public.get_event_rsvp_counts(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_event_signup_claims(_event_id uuid)
RETURNS TABLE(sign_up_item_id bigint, total_quantity int)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH allowed AS (
    SELECT e.id FROM public.events e
    WHERE e.id = _event_id
      AND (
        public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'moderator'::app_role)
        OR e.host_id = auth.uid()
        OR (e.published = true AND public.has_role(auth.uid(), 'approved'::app_role))
        OR (e.published = true AND public.has_role(auth.uid(), 'guest'::app_role) AND public.guest_has_rsvp(auth.uid(), e.id))
      )
  )
  SELECT s.sign_up_item_id, COALESCE(SUM(s.quantity), 0)::int
  FROM public.rsvp_sign_up_selections s
  JOIN public.rsvps r ON r.id = s.rsvp_id
  JOIN allowed a ON a.id = r.event_id
  WHERE r.status <> 'cancelled'::rsvp_status
  GROUP BY s.sign_up_item_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_event_signup_claims(uuid) TO authenticated;