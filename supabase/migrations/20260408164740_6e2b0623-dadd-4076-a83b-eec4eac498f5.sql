
-- Create speakers table
CREATE TABLE public.speakers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  bio TEXT,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.speakers ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can manage speakers"
  ON public.speakers FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Moderators can manage speakers"
  ON public.speakers FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Authenticated users can view speakers"
  ON public.speakers FOR SELECT TO authenticated
  USING (true);

-- Add speaker_id to events
ALTER TABLE public.events
  ADD COLUMN speaker_id UUID REFERENCES public.speakers(id) ON DELETE SET NULL;

-- Timestamp trigger for speakers
CREATE TRIGGER update_speakers_updated_at
  BEFORE UPDATE ON public.speakers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
