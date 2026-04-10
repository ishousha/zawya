CREATE OR REPLACE FUNCTION public.guest_has_rsvp(_user_id uuid, _event_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN _user_id != auth.uid() AND NOT has_role(auth.uid(), 'admin'::app_role)
    THEN false
    ELSE EXISTS (
      SELECT 1 FROM rsvps
      WHERE event_id = _event_id
        AND (
          user_id = _user_id
          OR user_id IN (
            SELECT p2.id FROM profiles p2
            WHERE p2.family_id IS NOT NULL
              AND p2.family_id = (SELECT family_id FROM profiles WHERE id = _user_id)
          )
        )
    )
  END;
$$;