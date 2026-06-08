-- Restore table-level SELECT on events (column-only grants break PostgREST embeds/counts,
-- causing "permission denied for table events" for admins and other users).
-- Re-revoke only the sensitive columns; RLS still scopes which rows each role can see.

DO $$
DECLARE
  _col text;
BEGIN
  -- Drop any column-level SELECT grants left by the previous migration so the
  -- table-level grant below becomes the single source of truth.
  FOR _col IN
    SELECT a.attname
    FROM pg_attribute a
    WHERE a.attrelid = 'public.events'::regclass
      AND a.attnum > 0
      AND NOT a.attisdropped
      AND a.attacl IS NOT NULL
  LOOP
    EXECUTE format('REVOKE SELECT (%I) ON public.events FROM authenticated', _col);
    EXECUTE format('REVOKE SELECT (%I) ON public.events FROM anon', _col);
  END LOOP;
END $$;

GRANT SELECT ON public.events TO authenticated;
GRANT SELECT ON public.events TO anon;

-- Keep sensitive columns hidden from client roles; RPCs expose them when needed.
REVOKE SELECT (checkin_pin, zoom_password, recording_passcode)
  ON public.events FROM authenticated, anon;