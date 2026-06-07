
DO $$
DECLARE
  _cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ')
    INTO _cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'events'
    AND column_name NOT IN ('checkin_pin', 'zoom_password', 'recording_passcode');

  EXECUTE format('REVOKE SELECT ON public.events FROM authenticated');
  EXECUTE format('REVOKE SELECT ON public.events FROM anon');
  EXECUTE format('GRANT SELECT (%s) ON public.events TO authenticated', _cols);
  EXECUTE format('GRANT SELECT (%s) ON public.events TO anon', _cols);
END $$;
