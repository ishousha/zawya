ALTER TABLE public.resources
  ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS speaker_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS resource_date date;

CREATE INDEX IF NOT EXISTS idx_resources_event_id ON public.resources(event_id);
CREATE INDEX IF NOT EXISTS idx_resources_speaker_ids ON public.resources USING GIN (speaker_ids);
CREATE INDEX IF NOT EXISTS idx_resources_tags ON public.resources USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_resources_resource_date ON public.resources(resource_date DESC NULLS LAST);