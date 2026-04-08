CREATE TABLE public.event_reminders_sent (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL DEFAULT 'auto',
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.event_reminders_sent ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and moderators can view reminders"
  ON public.event_reminders_sent
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));