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
    _name := 'My Family';
  END IF;
  IF length(_name) > 100 THEN
    _name := substr(_name, 1, 100);
  END IF;

  SELECT family_id INTO _existing
  FROM public.profiles
  WHERE id = _uid;

  IF _existing IS NOT NULL THEN
    SELECT * INTO _row
    FROM public.families
    WHERE id = _existing;

    IF _row.id IS NULL THEN
      UPDATE public.profiles SET family_id = NULL WHERE id = _uid;
    ELSE
      RETURN _row;
    END IF;
  END IF;

  INSERT INTO public.families (name)
  VALUES (_name)
  RETURNING * INTO _row;

  UPDATE public.profiles
  SET family_id = _row.id
  WHERE id = _uid;

  RETURN _row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_my_family(text) TO authenticated;