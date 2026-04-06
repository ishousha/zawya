
ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'nasiha';

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS online_link TEXT;
