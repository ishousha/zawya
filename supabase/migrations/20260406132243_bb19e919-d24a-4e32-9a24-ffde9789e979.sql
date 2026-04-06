-- Helper: check if a user (or their family) has an RSVP for an event
CREATE OR REPLACE FUNCTION public.guest_has_rsvp(_user_id uuid, _event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
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
$$;

-- Events: guests can only see events they're RSVP'd to
CREATE POLICY "Guests can view rsvpd events"
  ON public.events FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'guest'::app_role)
    AND guest_has_rsvp(auth.uid(), id)
  );

-- RSVPs: guests can manage their own
CREATE POLICY "Guests can view own rsvps"
  ON public.rsvps FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND has_role(auth.uid(), 'guest'::app_role));

CREATE POLICY "Guests can create own rsvp"
  ON public.rsvps FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND has_role(auth.uid(), 'guest'::app_role));

CREATE POLICY "Guests can update own rsvp"
  ON public.rsvps FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND has_role(auth.uid(), 'guest'::app_role));

CREATE POLICY "Guests can delete own rsvp"
  ON public.rsvps FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND has_role(auth.uid(), 'guest'::app_role));

-- Sign-up items: guests can view for events they have access to
CREATE POLICY "Guests can view sign up items for rsvpd events"
  ON public.event_sign_up_items FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'guest'::app_role)
    AND guest_has_rsvp(auth.uid(), event_id)
  );

-- Potluck config: guests can view for events they have access to
CREATE POLICY "Guests can view potluck config for rsvpd events"
  ON public.potluck_config FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'guest'::app_role)
    AND guest_has_rsvp(auth.uid(), event_id)
  );
