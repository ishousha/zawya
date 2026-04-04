
-- 1. PREVENT ROLE SELF-ESCALATION: Trigger on profiles
CREATE OR REPLACE FUNCTION public.prevent_role_self_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If role is being changed, only allow if the current user is an admin
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF NOT has_role(auth.uid(), 'admin') THEN
      RAISE EXCEPTION 'Only admins can change user roles';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_role_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_role_self_escalation();

-- 2. FIX RSVP POLICIES: Drop old, create new with role checks

DROP POLICY IF EXISTS "Approved users can view rsvps" ON public.rsvps;
DROP POLICY IF EXISTS "Users can create own rsvp" ON public.rsvps;
DROP POLICY IF EXISTS "Users can update own rsvp" ON public.rsvps;
DROP POLICY IF EXISTS "Users can delete own rsvp" ON public.rsvps;

-- Users can only view their own RSVPs
CREATE POLICY "Users can view own rsvps"
  ON public.rsvps FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Only approved/admin users can create their own RSVPs
CREATE POLICY "Approved users can create own rsvp"
  ON public.rsvps FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND has_role(auth.uid(), 'approved') OR has_role(auth.uid(), 'admin')
  );

-- Only approved/admin users can update their own RSVPs
CREATE POLICY "Approved users can update own rsvp"
  ON public.rsvps FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND (has_role(auth.uid(), 'approved') OR has_role(auth.uid(), 'admin'))
  )
  WITH CHECK (
    auth.uid() = user_id
    AND (has_role(auth.uid(), 'approved') OR has_role(auth.uid(), 'admin'))
  );

-- Only approved/admin users can delete their own RSVPs
CREATE POLICY "Approved users can delete own rsvp"
  ON public.rsvps FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND (has_role(auth.uid(), 'approved') OR has_role(auth.uid(), 'admin'))
  );

-- 3. STANDARDIZE ADMIN CHECKS on events table to use has_role()

DROP POLICY IF EXISTS "Admins can delete events" ON public.events;
DROP POLICY IF EXISTS "Admins can insert events" ON public.events;
DROP POLICY IF EXISTS "Admins can update events" ON public.events;
DROP POLICY IF EXISTS "Approved users can view events" ON public.events;

CREATE POLICY "Admins can delete events"
  ON public.events FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert events"
  ON public.events FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update events"
  ON public.events FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Approved users can view events"
  ON public.events FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'approved') OR has_role(auth.uid(), 'admin'));

-- 4. STANDARDIZE potluck_config policies

DROP POLICY IF EXISTS "Admins can manage potluck config" ON public.potluck_config;
DROP POLICY IF EXISTS "Approved users can view potluck config" ON public.potluck_config;

CREATE POLICY "Admins can manage potluck config"
  ON public.potluck_config FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Approved users can view potluck config"
  ON public.potluck_config FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'approved') OR has_role(auth.uid(), 'admin'));

-- 5. STANDARDIZE profiles admin view policy

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- 6. STANDARDIZE rsvps admin policy

DROP POLICY IF EXISTS "Admins can manage all rsvps" ON public.rsvps;

CREATE POLICY "Admins can manage all rsvps"
  ON public.rsvps FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'));
