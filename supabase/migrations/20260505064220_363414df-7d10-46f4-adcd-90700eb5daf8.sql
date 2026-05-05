
-- Update trigger to extract name from Google/OAuth metadata with fallbacks
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _name text;
BEGIN
  _name := COALESCE(
    NULLIF(btrim(NEW.raw_user_meta_data->>'name'), ''),
    NULLIF(btrim(NEW.raw_user_meta_data->>'full_name'), ''),
    NULLIF(btrim(NEW.raw_user_meta_data->>'display_name'), ''),
    NULLIF(btrim(
      COALESCE(NEW.raw_user_meta_data->>'first_name','') ||
      CASE WHEN COALESCE(NEW.raw_user_meta_data->>'last_name','') <> ''
           THEN ' ' || (NEW.raw_user_meta_data->>'last_name') ELSE '' END
    ), ''),
    NULLIF(btrim(NEW.raw_user_meta_data->>'given_name' || ' ' || COALESCE(NEW.raw_user_meta_data->>'family_name','')), ''),
    ''
  );

  INSERT INTO public.profiles (id, email, name)
  VALUES (NEW.id, NEW.email, _name)
  ON CONFLICT (id) DO UPDATE
    SET name = COALESCE(NULLIF(btrim(public.profiles.name), ''), EXCLUDED.name),
        email = COALESCE(public.profiles.email, EXCLUDED.email);
  RETURN NEW;
END;
$function$;

-- Backfill missing names on existing profiles from auth.users metadata
UPDATE public.profiles p
SET name = COALESCE(
  NULLIF(btrim(u.raw_user_meta_data->>'name'), ''),
  NULLIF(btrim(u.raw_user_meta_data->>'full_name'), ''),
  NULLIF(btrim(u.raw_user_meta_data->>'display_name'), ''),
  NULLIF(btrim(
    COALESCE(u.raw_user_meta_data->>'first_name','') ||
    CASE WHEN COALESCE(u.raw_user_meta_data->>'last_name','') <> ''
         THEN ' ' || (u.raw_user_meta_data->>'last_name') ELSE '' END
  ), ''),
  NULLIF(btrim(
    COALESCE(u.raw_user_meta_data->>'given_name','') ||
    CASE WHEN COALESCE(u.raw_user_meta_data->>'family_name','') <> ''
         THEN ' ' || (u.raw_user_meta_data->>'family_name') ELSE '' END
  ), '')
)
FROM auth.users u
WHERE u.id = p.id
  AND (p.name IS NULL OR btrim(p.name) = '')
  AND u.raw_user_meta_data IS NOT NULL;
