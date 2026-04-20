ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS maps_url text;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS maps_url text;