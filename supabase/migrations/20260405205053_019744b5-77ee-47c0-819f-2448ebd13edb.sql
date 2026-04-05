-- Add ticket_fee column
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS ticket_fee numeric NOT NULL DEFAULT 0;

-- Rename old event_type values to new ones
ALTER TYPE public.event_type RENAME VALUE 'physical' TO 'gathering';
ALTER TYPE public.event_type RENAME VALUE 'online' TO 'class';
ALTER TYPE public.event_type RENAME VALUE 'kids' TO 'trip';

-- Add new values
ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'retreat';
ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'meeting';