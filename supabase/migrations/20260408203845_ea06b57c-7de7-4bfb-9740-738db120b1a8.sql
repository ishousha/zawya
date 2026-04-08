
-- 1. Fix notifications INSERT policy: restrict to service_role only
DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notifications;
CREATE POLICY "Service role can insert notifications" ON public.notifications
  FOR INSERT TO public
  WITH CHECK (auth.role() = 'service_role');

-- 2. Prevent profile role self-escalation via trigger
CREATE OR REPLACE FUNCTION public.prevent_profile_field_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF (NEW.role IS DISTINCT FROM OLD.role OR NEW.is_mureed IS DISTINCT FROM OLD.is_mureed) THEN
    IF NOT has_role(auth.uid(), 'admin') THEN
      NEW.role := OLD.role;
      NEW.is_mureed := OLD.is_mureed;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profile_protected_fields ON public.profiles;
CREATE TRIGGER guard_profile_protected_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_profile_field_escalation();
