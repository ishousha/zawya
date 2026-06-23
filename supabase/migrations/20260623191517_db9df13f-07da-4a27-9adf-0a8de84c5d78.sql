
-- Atomic family creation RPC
CREATE OR REPLACE FUNCTION public.create_my_family(p_name text)
RETURNS public.families
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _existing uuid;
  _name text;
  _row public.families;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  _name := NULLIF(btrim(COALESCE(p_name, '')), '');
  IF _name IS NULL THEN
    RAISE EXCEPTION 'Family name is required' USING ERRCODE = '22023';
  END IF;
  IF length(_name) > 100 THEN
    _name := substr(_name, 1, 100);
  END IF;

  SELECT family_id INTO _existing FROM public.profiles WHERE id = _uid;
  IF _existing IS NOT NULL THEN
    RAISE EXCEPTION 'FAMILY_ALREADY_EXISTS: You are already in a family group.'
      USING ERRCODE = 'unique_violation';
  END IF;

  INSERT INTO public.families (name) VALUES (_name) RETURNING * INTO _row;
  UPDATE public.profiles SET family_id = _row.id WHERE id = _uid;
  RETURN _row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_my_family(text) TO authenticated;

-- Drop the brittle client-side INSERT policy; admins keep their FOR ALL policy.
DROP POLICY IF EXISTS "Authenticated users can create families" ON public.families;
