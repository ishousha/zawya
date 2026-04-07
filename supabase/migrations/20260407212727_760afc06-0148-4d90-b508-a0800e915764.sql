
-- Add is_mureed to profiles
ALTER TABLE public.profiles ADD COLUMN is_mureed boolean NOT NULL DEFAULT false;

-- Add mureeds_only to events
ALTER TABLE public.events ADD COLUMN mureeds_only boolean NOT NULL DEFAULT false;
