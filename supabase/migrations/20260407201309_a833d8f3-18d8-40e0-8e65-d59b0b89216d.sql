
-- Add host_id column to events table
ALTER TABLE public.events
ADD COLUMN host_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Create index for host lookups
CREATE INDEX idx_events_host_id ON public.events(host_id);

-- Allow hosts to view RSVPs for their events
CREATE POLICY "Hosts can view rsvps for their events"
ON public.rsvps
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.events
    WHERE events.id = rsvps.event_id
      AND events.host_id = auth.uid()
  )
);

-- Allow hosts to view profiles of RSVPd users
CREATE POLICY "Hosts can view profiles of rsvpd users"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.rsvps r
    JOIN public.events e ON e.id = r.event_id
    WHERE e.host_id = auth.uid()
      AND r.user_id = profiles.id
  )
);
