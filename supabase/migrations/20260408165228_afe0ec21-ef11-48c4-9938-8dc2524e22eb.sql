
-- Create junction table for many-to-many events <-> speakers
CREATE TABLE public.event_speakers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  speaker_id UUID NOT NULL REFERENCES public.speakers(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(event_id, speaker_id)
);

-- Enable RLS
ALTER TABLE public.event_speakers ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can manage event speakers"
  ON public.event_speakers FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Moderators can manage event speakers"
  ON public.event_speakers FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Authenticated users can view event speakers"
  ON public.event_speakers FOR SELECT TO authenticated
  USING (true);

-- Migrate existing speaker_id data
INSERT INTO public.event_speakers (event_id, speaker_id, display_order)
SELECT id, speaker_id, 0
FROM public.events
WHERE speaker_id IS NOT NULL;

-- Drop the old column
ALTER TABLE public.events DROP COLUMN speaker_id;
