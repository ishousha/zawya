
-- 1. Prevent duplicate family coverage trigger
CREATE OR REPLACE FUNCTION public.prevent_duplicate_family_rsvp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _covering_name text;
  _entry jsonb;
  _member_id uuid;
  _member_name text;
BEGIN
  -- Skip if this row is cancelled — cancellations don't conflict
  IF NEW.status = 'cancelled'::rsvp_status THEN
    RETURN NEW;
  END IF;

  -- (A) Block if NEW.user_id is already covered as a family_member dependent
  -- inside another active RSVP for the same event.
  SELECT COALESCE(p.name, p.email, 'Another family member')
  INTO _covering_name
  FROM public.rsvps r
  LEFT JOIN public.profiles p ON p.id = r.user_id
  WHERE r.event_id = NEW.event_id
    AND r.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND r.status <> 'cancelled'::rsvp_status
    AND r.attending_dependents @> jsonb_build_array(
          jsonb_build_object('type','family_member','id', NEW.user_id::text)
        )
  LIMIT 1;

  IF _covering_name IS NOT NULL THEN
    RAISE EXCEPTION 'RSVP_DUPLICATE_COVERED: You are already included in %''s RSVP for this event.', _covering_name
      USING ERRCODE = 'check_violation';
  END IF;

  -- (B) For each family_member entry inside NEW.attending_dependents,
  -- ensure that member doesn't already have their own active RSVP or
  -- isn't covered by a third RSVP for this event.
  IF NEW.attending_dependents IS NOT NULL THEN
    FOR _entry IN SELECT * FROM jsonb_array_elements(NEW.attending_dependents)
    LOOP
      IF (_entry->>'type') = 'family_member' THEN
        _member_id := (_entry->>'id')::uuid;
        IF _member_id IS NULL OR _member_id = NEW.user_id THEN
          CONTINUE;
        END IF;

        -- Their own active RSVP
        SELECT COALESCE(p.name, p.email, 'That member')
          INTO _member_name
          FROM public.rsvps r
          LEFT JOIN public.profiles p ON p.id = r.user_id
         WHERE r.event_id = NEW.event_id
           AND r.user_id = _member_id
           AND r.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
           AND r.status <> 'cancelled'::rsvp_status
         LIMIT 1;

        IF _member_name IS NOT NULL THEN
          RAISE EXCEPTION 'RSVP_DUPLICATE_MEMBER: % already has their own RSVP for this event. Ask them to cancel it first.', _member_name
            USING ERRCODE = 'check_violation';
        END IF;

        -- Covered by another RSVP
        SELECT COALESCE(p.name, p.email, 'another member')
          INTO _member_name
          FROM public.rsvps r
          LEFT JOIN public.profiles p ON p.id = r.user_id
         WHERE r.event_id = NEW.event_id
           AND r.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
           AND r.status <> 'cancelled'::rsvp_status
           AND r.attending_dependents @> jsonb_build_array(
                 jsonb_build_object('type','family_member','id', _member_id::text)
               )
         LIMIT 1;

        IF _member_name IS NOT NULL THEN
          RAISE EXCEPTION 'RSVP_DUPLICATE_MEMBER: That family member is already included in %''s RSVP for this event.', _member_name
            USING ERRCODE = 'check_violation';
        END IF;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_duplicate_family_rsvp ON public.rsvps;
CREATE TRIGGER trg_prevent_duplicate_family_rsvp
BEFORE INSERT OR UPDATE ON public.rsvps
FOR EACH ROW EXECUTE FUNCTION public.prevent_duplicate_family_rsvp();

-- 2. Lookup coverage for current user
CREATE OR REPLACE FUNCTION public.get_my_event_coverage(_event_id uuid)
RETURNS TABLE(
  id uuid,
  event_id uuid,
  user_id uuid,
  guests_count integer,
  attending_dependents jsonb,
  potluck_category potluck_category,
  specific_food_item text,
  qr_hash text,
  checked_in boolean,
  status rsvp_status,
  is_waitlisted boolean,
  covering_user_name text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT r.id, r.event_id, r.user_id, r.guests_count, r.attending_dependents,
         r.potluck_category, r.specific_food_item, r.qr_hash, r.checked_in,
         r.status, r.is_waitlisted,
         COALESCE(p.name, p.email, 'a family member')::text AS covering_user_name
  FROM public.rsvps r
  LEFT JOIN public.profiles p ON p.id = r.user_id
  WHERE r.event_id = _event_id
    AND r.user_id <> auth.uid()
    AND r.status <> 'cancelled'::rsvp_status
    AND r.attending_dependents @> jsonb_build_array(
          jsonb_build_object('type','family_member','id', auth.uid()::text)
        )
  ORDER BY r.created_at ASC
  LIMIT 1;
END;
$$;

-- 3. Allow a covered user to remove themselves from the family RSVP
CREATE OR REPLACE FUNCTION public.remove_self_from_family_rsvp(_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _rsvp_id uuid;
  _deps jsonb;
  _new_deps jsonb;
  _removed_count int := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT r.id, r.attending_dependents
    INTO _rsvp_id, _deps
    FROM public.rsvps r
   WHERE r.event_id = _event_id
     AND r.status <> 'cancelled'::rsvp_status
     AND r.attending_dependents @> jsonb_build_array(
           jsonb_build_object('type','family_member','id', auth.uid()::text)
         )
   ORDER BY r.created_at ASC
   LIMIT 1
   FOR UPDATE;

  IF _rsvp_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not covered');
  END IF;

  SELECT COALESCE(jsonb_agg(e), '[]'::jsonb)
    INTO _new_deps
    FROM jsonb_array_elements(_deps) e
   WHERE NOT (
     (e->>'type') = 'family_member' AND (e->>'id') = auth.uid()::text
   );

  _removed_count := jsonb_array_length(_deps) - jsonb_array_length(_new_deps);

  IF _removed_count <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not covered');
  END IF;

  UPDATE public.rsvps
     SET attending_dependents = CASE
           WHEN jsonb_array_length(_new_deps) = 0 THEN NULL
           ELSE _new_deps
         END,
         guests_count = GREATEST(1, guests_count - _removed_count)
   WHERE id = _rsvp_id;

  RETURN jsonb_build_object('success', true, 'rsvp_id', _rsvp_id);
END;
$$;

-- 4. Update head-count RPC to exclude host's seat from public capacity
CREATE OR REPLACE FUNCTION public.get_event_rsvp_counts(_event_id uuid)
RETURNS TABLE(attending_count integer, attending_rsvp_count integer, waitlisted_count integer, checked_in_count integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
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
  )
  SELECT
    COALESCE(SUM(
      CASE WHEN r.status = 'attending' AND (a.host_id IS NULL OR r.user_id <> a.host_id)
           THEN r.guests_count ELSE 0 END
    ), 0)::int,
    COALESCE(SUM(
      CASE WHEN r.status = 'attending' AND (a.host_id IS NULL OR r.user_id <> a.host_id)
           THEN 1 ELSE 0 END
    ), 0)::int,
    COALESCE(SUM(CASE WHEN r.status = 'waitlisted' THEN 1 ELSE 0 END), 0)::int,
    COALESCE(SUM(
      CASE WHEN r.status = 'attending' AND r.checked_in
                AND (a.host_id IS NULL OR r.user_id <> a.host_id)
           THEN r.guests_count ELSE 0 END
    ), 0)::int
  FROM allowed a
  LEFT JOIN public.rsvps r ON r.event_id = a.id;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_event_coverage(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_self_from_family_rsvp(uuid) TO authenticated;
