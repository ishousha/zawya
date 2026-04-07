
-- Fix: notifications INSERT policy allows any authenticated user to send notifications to anyone.
-- Restrict to service_role only so notifications can only be created by database triggers and edge functions.
DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notifications;
CREATE POLICY "Service role can insert notifications" ON public.notifications
  FOR INSERT TO public
  WITH CHECK (auth.role() = 'service_role');
