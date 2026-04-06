-- Add is_virtual column
ALTER TABLE public.event_types
  ADD COLUMN IF NOT EXISTS is_virtual boolean NOT NULL DEFAULT false;

-- Update existing rows
UPDATE public.event_types SET is_virtual = true WHERE name = 'Nasiha';

-- Insert Hybrid type if it doesn't exist
INSERT INTO public.event_types (name, icon, requires_location, is_virtual, allows_potluck)
VALUES ('Hybrid', 'Globe', true, true, true)
ON CONFLICT (name) DO NOTHING;