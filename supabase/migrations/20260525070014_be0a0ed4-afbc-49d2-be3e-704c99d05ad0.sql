
-- Backfill: ensure every profile has a matching user_roles row
INSERT INTO public.user_roles (user_id, role)
SELECT p.id, p.role
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.user_id = p.id AND ur.role = p.role
)
ON CONFLICT (user_id, role) DO NOTHING;

-- Trigger function: keep user_roles in sync with profiles.role
CREATE OR REPLACE FUNCTION public.sync_user_role_from_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, NEW.role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_user_role_from_profile_trigger ON public.profiles;
CREATE TRIGGER sync_user_role_from_profile_trigger
AFTER INSERT OR UPDATE OF role ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_user_role_from_profile();
