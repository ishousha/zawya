-- Add published boolean column to events
ALTER TABLE public.events ADD COLUMN published boolean NOT NULL DEFAULT false;

-- Update existing active events to be published (so nothing breaks)
UPDATE public.events SET published = true WHERE status != 'cancelled';

-- Drop and recreate the approved users view policy to filter by published
DROP POLICY IF EXISTS "Approved users can view events" ON public.events;
CREATE POLICY "Approved users can view published events"
ON public.events
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'approved'::app_role) AND published = true);

-- Drop and recreate guests policy to also require published
DROP POLICY IF EXISTS "Guests can view rsvpd events" ON public.events;
CREATE POLICY "Guests can view published rsvpd events"
ON public.events
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'guest'::app_role) AND published = true AND guest_has_rsvp(auth.uid(), id));