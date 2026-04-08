
CREATE TABLE public.guest_list_reminders_sent (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL DEFAULT 'auto',
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_guest_list_reminders_event ON public.guest_list_reminders_sent(event_id);

ALTER TABLE public.guest_list_reminders_sent ENABLE ROW LEVEL SECURITY;

-- No public access - only service role
CREATE POLICY "No public access" ON public.guest_list_reminders_sent
  FOR ALL USING (false);
