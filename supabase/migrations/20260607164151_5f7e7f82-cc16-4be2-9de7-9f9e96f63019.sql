
GRANT SELECT (qr_hash) ON public.rsvps TO authenticated;
DROP POLICY IF EXISTS "Hosts can view rsvps for their events" ON public.rsvps;
