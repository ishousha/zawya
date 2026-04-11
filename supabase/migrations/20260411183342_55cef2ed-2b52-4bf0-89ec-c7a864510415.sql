CREATE POLICY "Admins can view all events"
ON public.events
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));