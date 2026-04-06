-- EVENTS: moderators can create & edit (not delete/cancel)
CREATE POLICY "Moderators can insert events"
  ON public.events FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Moderators can update events"
  ON public.events FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Moderators can view events"
  ON public.events FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'moderator'::app_role));

-- PROFILES: moderators can view all profiles (read-only)
CREATE POLICY "Moderators can view all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'moderator'::app_role));

-- GUEST REQUESTS: moderators can view and update
CREATE POLICY "Moderators can view all guest requests"
  ON public.guest_requests FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Moderators can update guest requests"
  ON public.guest_requests FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'moderator'::app_role));

-- RSVPs: moderators can view all & update (for check-in)
CREATE POLICY "Moderators can view all rsvps"
  ON public.rsvps FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Moderators can update rsvps for checkin"
  ON public.rsvps FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'moderator'::app_role));

-- EVENT SIGN UP ITEMS: moderators can manage
CREATE POLICY "Moderators can manage sign up items"
  ON public.event_sign_up_items FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'moderator'::app_role));

-- POTLUCK CONFIG: moderators can manage
CREATE POLICY "Moderators can manage potluck config"
  ON public.potluck_config FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'moderator'::app_role));

-- VENUES: moderators can view
CREATE POLICY "Moderators can view venues"
  ON public.venues FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'moderator'::app_role));
